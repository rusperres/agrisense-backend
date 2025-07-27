import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { OrderEntity, OrderItemEntity } from '../types/entities/order.entity';
import { PlaceOrderRequestDTO, OrderResponseDTO, PlaceOrderItemDTO } from '../types/dtos/order.dto';
import { ProductEntity } from '../types/entities/product.entity';
import { DBLocation, Location } from '../types/location';
import { OrderStatus, UserRole } from '../types/enums';
import { v4 as uuidv4 } from 'uuid';

// --- Helper Functions (Reusable from previous discussions) ---

// Converts frontend Location DTO to backend DBLocation entity
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

// Converts backend DBLocation entity to frontend Location DTO
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

// Helper function to map OrderEntity (from database) to an array of OrderResponseDTOs (for frontend)
function mapOrderEntityToOrderResponseDTOs(entity: OrderEntity): OrderResponseDTO[] {
    return entity.orderItems.map(item => ({
        id: entity.id,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        buyerId: entity.buyerId,
        sellerId: entity.sellerId,
        sellerName: entity.sellerName,
        quantity: item.quantity,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        totalPrice: item.subtotal,
        status: entity.status,
        paymentMethod: entity.paymentMethod,
        orderDate: entity.orderDate.toISOString(),
        estimatedDelivery: entity.estimatedDeliveryDate?.toISOString() || undefined,
        deliveryLocation: fromDBLocation(entity.deliveryLocation),
        trackingNumber: entity.trackingNumber,
        canReorder: entity.canReorder,
        canReview: entity.canReview,
    }));
}

// --- Helper to get product details (Crucial for PlaceOrder) ---
async function getProductDetails(productId: string): Promise<ProductEntity | null> {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        const result = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE id = $1;`,
            [productId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error(`Error fetching product details for ${productId}:`, error);
        throw new Error(`Failed to retrieve product details for ID: ${productId}`);
    } finally {
        if (client) client.release();
    }
}

async function getSellerDetails(sellerId: string): Promise<{ name: string } | null> {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        const result = await client.query<{ name: string }>(
            `SELECT name FROM users WHERE id = $1 AND role = 'seller';`,
            [sellerId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error(`Error fetching seller details for ${sellerId}:`, error);
        throw new Error(`Failed to retrieve seller details for ID: ${sellerId}`);
    } finally {
        if (client) client.release();
    }
}

// --- Service Functions ---

export const fetchOrders = async (
    buyerId?: string,
    sellerId?: string
): Promise<OrderResponseDTO[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        let query = `SELECT * FROM orders WHERE 1=1`;
        const params: (string | number | object)[] = [];
        let paramIndex = 1;

        if (buyerId) {
            query += ` AND buyer_id = $${paramIndex++}`;
            params.push(buyerId);
        }
        if (sellerId) {
            query += ` AND seller_id = $${paramIndex++}`;
            params.push(sellerId);
        }
        query += ` ORDER BY created_at DESC;`;

        const result = await client.query<OrderEntity>(query, params);

        const allFlattenedOrders: OrderResponseDTO[] = [];
        for (const entity of result.rows) {
            allFlattenedOrders.push(...mapOrderEntityToOrderResponseDTOs(entity));
        }

        return allFlattenedOrders;
    } catch (error: any) {
        console.error('Service error fetching orders:', error);
        throw new Error(error.message || 'Failed to fetch orders.');
    } finally {
        if (client) client.release();
    }
};


export const placeOrder = async (
    buyerId: string,
    orderData: PlaceOrderRequestDTO
): Promise<OrderResponseDTO[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const placedOrders: OrderResponseDTO[] = [];
        const itemsGroupedBySeller: { [sellerId: string]: PlaceOrderItemDTO[] } = {};
        const productDetailsMap = new Map<string, ProductEntity>();

        // 1. Fetch all product details and group by seller
        const productIds = orderData.items.map(item => item.productId);
        if (productIds.length === 0) {
            throw new Error('No items provided in the order.');
        }

        const productsResult = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE id = ANY($1::uuid[]) FOR SHARE;`,
            [productIds]
        );

        if (productsResult.rows.length !== productIds.length) {
            throw new Error('One or more products not found.');
        }

        productsResult.rows.forEach(product => {
            productDetailsMap.set(product.id, product);
        });

        for (const item of orderData.items) {
            const product = productDetailsMap.get(item.productId);

            if (!product) {
                throw new Error(`Product with ID ${item.productId} not found.`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
            }
            if (product.is_active === false) {
                throw new Error(`Product ${product.name} is not active and cannot be ordered.`);
            }
            if (item.pricePerUnit !== product.price) {
                throw new Error(`Price mismatch for product ${product.name}. Expected ${product.price}, got ${item.pricePerUnit}.`);
            }

            if (!itemsGroupedBySeller[product.seller_id]) {
                itemsGroupedBySeller[product.seller_id] = [];
            }
            itemsGroupedBySeller[product.seller_id].push(item);
        }

        for (const sellerId in itemsGroupedBySeller) {
            const sellerItems = itemsGroupedBySeller[sellerId];
            const totalOrderPrice = sellerItems.reduce((sum, item) => sum + item.subtotal, 0);

            const sellerResult = await client.query<{ id: string, name: string }>(
                `SELECT id, name FROM users WHERE id = $1;`,
                [sellerId]
            );
            const seller = sellerResult.rows[0];
            if (!seller) {
                throw new Error(`Seller with ID ${sellerId} not found for one of the products.`);
            }
            const sellerName = seller.name;

            const insertOrderResult = await client.query<OrderEntity>(
                `INSERT INTO orders (
                    buyer_id, seller_id, seller_name, total_price, status, payment_method,
                    delivery_location, order_date, estimated_delivery_date,
                    can_reorder, can_review, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() + INTERVAL '3 days', $8, $9, NOW(), NOW())
                RETURNING *;`,
                [
                    buyerId,
                    sellerId,
                    sellerName,
                    totalOrderPrice,
                    OrderStatus.Pending,
                    orderData.paymentMethod,
                    toDBLocation(orderData.deliveryLocation),
                    true,
                    false
                ]
            );
            const newOrder = insertOrderResult.rows[0];

            const orderItemsForEntity: OrderItemEntity[] = [];
            for (const item of sellerItems) {
                const product = productDetailsMap.get(item.productId)!;

                const insertOrderItemResult = await client.query<OrderItemEntity>(
                    `INSERT INTO order_items (
                        order_id, product_id, product_name, product_image, quantity, unit, price_per_unit, subtotal
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *;`,
                    [
                        newOrder.id,
                        item.productId,
                        product.name,
                        product.images ? product.images[0] || null : null,
                        item.quantity,
                        product.unit,
                        item.pricePerUnit,
                        item.subtotal
                    ]
                );
                orderItemsForEntity.push(insertOrderItemResult.rows[0]);

                await client.query(
                    `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2;`,
                    [item.quantity, item.productId]
                );
            }

            newOrder.orderItems = orderItemsForEntity;
            const mappedOrders = mapOrderEntityToOrderResponseDTOs(newOrder);
            placedOrders.push(...mappedOrders);
        }

        await client.query('COMMIT');

        return placedOrders;
    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Service error placing order:', error);
        throw new Error(error.message || 'Failed to place order.');
    } finally {
        if (client) client.release();
    }
};

export const updateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus
): Promise<OrderResponseDTO | null> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch the current order to perform checks (e.g., status transitions)
        const currentOrderResult = await client.query<OrderEntity>(
            `SELECT * FROM orders WHERE id = $1 FOR UPDATE;`,
            [orderId]
        );

        const currentOrder = currentOrderResult.rows[0];

        if (!currentOrder) {
            await client.query('ROLLBACK');
            return null;
        }

        if (currentOrder.status === OrderStatus.Delivered && newStatus !== OrderStatus.Delivered) {
            throw new Error('Cannot change status of a delivered order.');
        }
        if (currentOrder.status === OrderStatus.Cancelled) {
            throw new Error('Cannot change status of a cancelled order.');
        }
        if (newStatus === OrderStatus.Processing && currentOrder.status !== OrderStatus.Pending) {
            throw new Error('Order must be pending to be set to processing.');
        }

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


        const flattenedUpdatedOrders = mapOrderEntityToOrderResponseDTOs(updatedOrderEntity);
        return flattenedUpdatedOrders[0] || null;
    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Service error updating order status for ${orderId}:`, error);
        throw new Error(error.message || 'Failed to update order status.');
    } finally {
        if (client) client.release();
    }
};
