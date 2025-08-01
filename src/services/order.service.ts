import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { OrderEntity, OrderItemEntity } from '../types/entities/order.entity';
import { PlaceOrderRequestDTO, OrderResponseDTO, PlaceOrderItemDTO, GetOrdersResponseDTO } from '../types/dtos/order.dto'; // Added GetOrdersResponseDTO
import { ProductEntity } from '../types/entities/product.entity';
import { DBLocation, Location } from '../types/location';
import { OrderStatus, UserRole } from '../types/enums';
import { v4 as uuidv4 } from 'uuid';

// --- Helper Functions (Reusable from previous discussions) ---

/**
 * Converts frontend Location DTO to backend DBLocation entity (GeoJSON format).
 * @param simpleLocation The Location DTO from the frontend.
 * @returns A DBLocation object in GeoJSON format or null.
 */
function toDBLocation(simpleLocation: Location | null): DBLocation | null {
    if (!simpleLocation || simpleLocation.lat === null || simpleLocation.lng === null) {
        return null;
    }
    return {
        type: 'Point',
        coordinates: [simpleLocation.lng, simpleLocation.lat],
        properties: {
            address: simpleLocation.address || null
        }
    };
}

/**
 * Converts backend DBLocation entity (GeoJSON format) to frontend Location DTO.
 * @param dbLocation The DBLocation object from the database.
 * @returns A Location DTO for the frontend or null.
 */
function fromDBLocation(dbLocation: DBLocation | null): Location | null {
    if (!dbLocation || !dbLocation.coordinates || dbLocation.coordinates.length < 2) {
        return null;
    }
    return {
        lat: dbLocation.coordinates[1],
        lng: dbLocation.coordinates[0],
        address: dbLocation.properties?.address || null
    };
}

/**
 * Safely converts a date-like value to an ISO string, or returns null if the value is invalid.
 * This is a more robust version to handle various invalid date inputs.
 * @param dateValue The value to convert.
 * @returns An ISO string or null.
 */
function toISOStringSafe(dateValue: any): string | null {
    if (!dateValue) {
        return null;
    }

    let date: Date;
    // Check if the value is a number (timestamp), string, or Date object.
    if (typeof dateValue === 'number' || typeof dateValue === 'string') {
        date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
        date = dateValue;
    } else {
        // Unrecognized type, return null
        return null;
    }

    // Check if the date object is valid
    if (isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

/**
 * Maps an OrderEntity from the database to an OrderResponseDTO for the frontend.
 * This version handles the fact that some DTO fields are defined as non-nullable strings.
 * @param orderEntity The OrderEntity from the database.
 * @returns An OrderResponseDTO for the frontend.
 */
function mapOrderEntityToOrderResponseDTO(orderEntity: OrderEntity): OrderResponseDTO {
    return {
        id: orderEntity.id,
        buyer_id: orderEntity.buyerId,
        seller_id: orderEntity.sellerId,
        seller_name: orderEntity.seller_name,
        order_items: orderEntity.orderItems.map(item => ({
            id: item.id,
            product_id: item.productId,
            product_name: item.productName,
            product_image: item.productImage,
            quantity: item.quantity,
            unit: item.unit,
            price_per_unit: item.pricePerUnit,
            subtotal: item.subtotal
        })),
        total_price: Number(orderEntity.totalPrice),
        status: orderEntity.status,
        payment_method: orderEntity.paymentMethod,
        order_date: new Date(orderEntity.orderDate),
        // The DTO allows this to be null
        estimated_deliveryDate: orderEntity.estimatedDeliveryDate ? new Date(orderEntity.estimatedDeliveryDate) : null,
        delivery_location: fromDBLocation(orderEntity.deliveryLocation),
        tracking_number: orderEntity.trackingNumber,
        can_reorder: orderEntity.canReorder,
        can_review: orderEntity.canReview,
        created_at: new Date(orderEntity.createdAt),
        updated_at: new Date(orderEntity.updatedAt),
    };
}

// --- Service Functions ---

/**
 * Fetches a list of orders based on various filters.
 *
 * @param buyerId Optional ID of the buyer.
 * @param sellerId Optional ID of the seller.
 * @param status Optional order status to filter by.
 * @returns A promise that resolves to an array of OrderResponseDTOs or null if an error occurs.
 */
export async function fetchOrders(
    buyer_id?: string, // Changed parameter name
    seller_id?: string, // Changed parameter name
    status?: OrderStatus
): Promise<GetOrdersResponseDTO | null> {
    const client = await pool.connect();
    try {
        // Simple query without aliases for order columns
        let queryText = `
            SELECT o.*, u.name AS seller_name 
            FROM orders o 
            JOIN users u ON o.seller_id = u.id 
            WHERE true`;
        let countQueryText = 'SELECT COUNT(*) FROM orders WHERE true';
        const queryParams = [];
        let paramIndex = 1;

        if (buyer_id) {
            queryText += ` AND o.buyer_id = $${paramIndex}`;
            countQueryText += ` AND buyer_id = $${paramIndex}`;
            queryParams.push(buyer_id);
            paramIndex++;
        }

        if (seller_id) {
            queryText += ` AND o.seller_id = $${paramIndex}`;
            countQueryText += ` AND seller_id = $${paramIndex}`;
            queryParams.push(seller_id);
            paramIndex++;
        }

        if (status) {
            queryText += ` AND o.status = $${paramIndex}`;
            countQueryText += ` AND status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        queryText += ' ORDER BY o.created_at DESC;';

        // The query result rows now match the DTO interface properties.
        const ordersResult = await client.query(queryText, queryParams);
        const countResult = await client.query<{ count: string }>(countQueryText, queryParams);
        const totalCount = parseInt(countResult.rows[0].count, 10);

        if (ordersResult.rows.length === 0) {
            return { orders: [], total_count: 0, page: 1, limit: 0 };
        }

        const ordersWithItems: OrderResponseDTO[] = [];
        for (const order of ordersResult.rows) {
            const orderItemsResult = await client.query(
                `SELECT oi.*, p.name AS "product_name", p.images[1] AS "product_image", p.unit AS "unit"
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1;`,
                [order.id]
            );

            // Now, mapping is much simpler and direct.
            const orderItems = orderItemsResult.rows.map(item => ({
                id: item.id,
                product_id: item.product_id,
                product_name: item.product_name,
                product_image: item.product_image,
                quantity: item.quantity,
                unit: item.unit,
                price_per_unit: item.price_per_unit,
                subtotal: item.subtotal
            }));

            // Calculate totalPrice using the snake_case properties
            const total_price = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

            // The dates are still Date objects from the database,
            // so they need to be converted to strings.
            const mappedOrder: OrderResponseDTO = {
                ...order, // Spread the existing order properties (already snake_case)
                order_items: orderItems, // Add the order items
                total_price: total_price, // Use the calculated total price
                // Explicitly convert dates to ISO strings
                order_date: order.order_date.toISOString(),
                estimated_delivery_date: order.estimated_delivery_date ? order.estimated_delivery_date.toISOString() : null,
                created_at: order.created_at.toISOString(),
                updated_at: order.updated_at.toISOString(),
            };

            ordersWithItems.push(mappedOrder);
        }

        return {
            orders: ordersWithItems,
            total_count: totalCount,
            page: 1,
            limit: ordersWithItems.length
        };
    } catch (error: any) {
        console.error('Service error fetching orders:', error);
        throw new Error(error.message || 'Failed to fetch orders.');
    } finally {
        client.release();
    }
}
/**
 * Places a new order. This function is transactional, ensuring all
 * database operations succeed or fail as a single unit.
 *
 * @param buyerId The ID of the buyer placing the order.
 * @param placeOrderRequestDTO The DTO containing order items and details.
 * @returns An array of OrderResponseDTOs for the newly placed order(s).
 */
export async function placeOrder(buyerId: string, placeOrderRequestDTO: PlaceOrderRequestDTO): Promise<OrderResponseDTO[] | null> {

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { items, payment_method, delivery_location } = placeOrderRequestDTO;
        const placedOrders: OrderResponseDTO[] = [];

        // Group items by seller to create a separate order for each seller
        const itemsBySeller = new Map<string, PlaceOrderItemDTO[]>();
        const productDetails = new Map<string, ProductEntity>();

        // 1. Fetch product details and group by seller
        const productIds = items.map(item => item.product_id);
        const productsResult = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE id = ANY($1::uuid[]);`,
            [productIds]
        );

        if (productsResult.rows.length < productIds.length) {
            throw new Error('One or more products not found.');
        }

        productsResult.rows.forEach(product => {
            productDetails.set(product.id, product);
            if (!itemsBySeller.has(product.seller_id)) {
                itemsBySeller.set(product.seller_id, []);
            }
            const item = items.find(i => i.product_id === product.id);
            if (item) {
                itemsBySeller.get(product.seller_id)?.push(item);
            }
        });

        // 2. Validate and create an order for each seller
        for (const [sellerId, orderItems] of itemsBySeller.entries()) {
            let totalPrice = 0;
            const orderItemsForDb: OrderItemEntity[] = [];

            for (const item of orderItems) {
                const product = productDetails.get(item.product_id);

                if (!product) {
                    throw new Error(`Product with ID ${item.product_id} not found.`);
                }

                // Consistency check: Ensure ordered quantity is available
                if (product.quantity < item.quantity) {
                    throw new Error(`Insufficient quantity for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}.`);
                }

                // Prepare order item for database insertion
                const subtotal = product.price * item.quantity;
                totalPrice += subtotal;

                // Prepare order item for database insertion
                orderItemsForDb.push({
                    id: uuidv4(),
                    productId: product.id,
                    productName: product.name,
                    productImage: product.images ? product.images[0] : '',
                    quantity: item.quantity,
                    unit: product.unit,
                    pricePerUnit: product.price,
                    subtotal: subtotal
                });
            }

            // 3. Insert the new order into the database
            const orderId = uuidv4();
            const sellerNameResult = await client.query('SELECT name FROM users WHERE id = $1', [sellerId]);
            const sellerName = sellerNameResult.rows[0]?.name || 'Unknown Seller';

            // Correctly handle the delivery_location
            let deliveryLocationParam: string | null = null;
            if (delivery_location) {
                deliveryLocationParam = JSON.stringify(toDBLocation(delivery_location));
            }

            const insertOrderResult = await client.query<OrderEntity>(
                `INSERT INTO orders (
                    id, buyer_id, seller_id, seller_name, total_price, status,
                    payment_method, delivery_location, tracking_number, order_date,
                    estimated_delivery_date, can_reorder, can_review
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromGeoJSON($8), NULL, NOW(), NULL, FALSE, FALSE)
                 RETURNING *;`,
                [
                    orderId,
                    buyerId,
                    sellerId,
                    sellerName,
                    totalPrice,
                    OrderStatus.Pending,
                    payment_method,
                    deliveryLocationParam // Now passing the JSON string here
                ]
            );

            if (insertOrderResult.rows.length === 0) {
                throw new Error('Failed to create order.');
            }

            const newOrderEntity = insertOrderResult.rows[0];
            newOrderEntity.orderItems = orderItemsForDb; // Ensure orderItems is set on the entity

            // 4. Insert order items
            const orderItemInsertPromises = orderItemsForDb.map(item =>
                client.query(
                    `INSERT INTO order_items (id, order_id, product_id, product_name,
                        product_image, quantity, unit, price_per_unit, subtotal)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
                    [item.id, orderId, item.productId, item.productName,
                    item.productImage, item.quantity, item.unit, item.pricePerUnit, item.subtotal]
                )
            );
            await Promise.all(orderItemInsertPromises);

            // 5. Deduct product quantity from stock
            const stockUpdatePromises = orderItemsForDb.map(item => {
                const product = productDetails.get(item.productId);
                if (!product) {
                    throw new Error(`Product with ID ${item.productId} not found for quantity deduction.`);
                }
                const newQuantity = product.quantity - item.quantity;
                return client.query(
                    `UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2;`,
                    [newQuantity, item.productId]
                );
            });
            await Promise.all(stockUpdatePromises);

            // Add the new order to the list of placed orders
            placedOrders.push(mapOrderEntityToOrderResponseDTO(newOrderEntity));
        }

        await client.query('COMMIT');
        return placedOrders;
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Service error placing order:', error);
        throw new Error(error.message || 'Failed to place order.');
    } finally {
        client.release();
    }
}

/**
 * Updates the status of an existing order.
 *
 * @param orderId The ID of the order to update.
 * @param newStatus The new status to set.
 * @param userRole The role of the user performing the action.
 * @param userId The ID of the user performing the action.
 * @returns The updated order details as an OrderResponseDTO.
 */
export async function updateOrderStatus(orderId: string, newStatus: OrderStatus, userRole: UserRole, userId: string): Promise<OrderResponseDTO | null> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentOrderResult = await client.query<OrderEntity>(
            `SELECT * FROM orders WHERE id = $1;`,
            [orderId]
        );

        if (currentOrderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const currentOrder = currentOrderResult.rows[0];

        if (userRole === UserRole.Buyer && userId !== currentOrder.buyerId) {
            throw new Error('Only the buyer can update their own order status.');
        }

        if (userRole === UserRole.Seller && userId !== currentOrder.sellerId) {
            throw new Error('Only the seller can update their own order status.');
        }

        // Additional business logic for status transitions
        if (newStatus === OrderStatus.Processing && currentOrder.status !== OrderStatus.Pending) {
            throw new Error('Order must be pending to be set to processing.');
        }
        if (newStatus === OrderStatus.Delivered && currentOrder.status !== OrderStatus.Shipped) {
            throw new Error('Order must be shipped to be set to delivered.');
        }
        // ... more rules for other transitions can be added here

        const updateResult = await client.query<OrderEntity>(
            `UPDATE orders
             SET status = $1,
                 can_review = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *;`,
            [newStatus, newStatus === OrderStatus.Delivered, orderId]
        );

        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const updatedOrderEntity = updateResult.rows[0];

        const orderItemsResult = await client.query<OrderItemEntity>(
            `SELECT * FROM order_items WHERE order_id = $1;`,
            [orderId]
        );
        updatedOrderEntity.orderItems = orderItemsResult.rows;

        await client.query('COMMIT');

        return mapOrderEntityToOrderResponseDTO(updatedOrderEntity);
    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Service error updating order status for ${orderId}:`, error);
        throw new Error(error.message || 'Failed to update order status.');
    } finally {
        client.release();
    }
}
