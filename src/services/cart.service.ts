import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { CartEntity, CartItemEntity } from '../types/entities/cart.entity';
import { ProductEntity } from '../types/entities/product.entity';
import { CartResponseDto, CartItemResponseDto } from '../types/dtos/cart.dto';
import { Product } from '../types/dtos/product.dto';
import { DBLocation } from '../types/location';
import { mapProductEntityToProductDTO } from './utils/product.map'; // Import the shared mapping function

// --- Main Cart Service Functions ---

/**
 * Helper to map CartEntity and related ProductEntities to CartResponseDto.
 * Utilizes the shared mapProductEntityToProductDTO for product mapping.
 */
async function mapCartEntityToResponseDto(client: PoolClient, cartEntity: CartEntity): Promise<CartResponseDto> {
    const dbCartItems: CartItemEntity[] = cartEntity.items || [];

    const productIds = dbCartItems.map(item => item.productId);
    const uniqueProductIds = [...new Set(productIds)];

    let productsMap = new Map<string, ProductEntity & { location_geojson_text?: string }>(); // Include location_geojson_text
    if (uniqueProductIds.length > 0) {
        const productResult = await client.query<ProductEntity & { location_geojson_text: string }>(
            `SELECT 
                id, seller_id, name, variety, quantity, unit, price, description, 
                harvest_date, ST_AsGeoJSON(location)::text as location_geojson_text, category, images, 
                condition, is_active, created_at, updated_at 
            FROM products WHERE id = ANY($1::uuid[]);`,
            [uniqueProductIds]
        );
        productResult.rows.forEach(p => productsMap.set(p.id, p));
    }

    let totalItems = 0;
    let totalAmount = 0;
    const responseItems: CartItemResponseDto[] = [];

    for (const dbItem of dbCartItems) {
        const productEntityFromDB = productsMap.get(dbItem.productId);

        if (productEntityFromDB) {
            // Parse the location string from DB to an object before mapping
            const parsedLocation: DBLocation | null = productEntityFromDB.location_geojson_text ? JSON.parse(productEntityFromDB.location_geojson_text) as DBLocation : null;

            // Create a new object that correctly types the 'location' property for the mapper
            const productEntityForMapping = {
                ...productEntityFromDB,
                location: parsedLocation,
                harvest_date: productEntityFromDB.harvest_date, // Ensure Date string
                created_at: productEntityFromDB.created_at, // Ensure Date string
                updated_at: productEntityFromDB.updated_at, // Ensure Date string
            };

            const productDto = mapProductEntityToProductDTO(productEntityForMapping as any); // Cast to any due to Omit type

            const subtotal = productDto.price * dbItem.quantity;

            responseItems.push({
                id: dbItem.id,
                productId: dbItem.productId,
                product: productDto,
                quantity: dbItem.quantity,
                subtotal: subtotal,
            });

            totalItems += dbItem.quantity;
            totalAmount += subtotal;
        }
        // Products that are no longer active or found will be skipped, effectively removing them from the displayed cart.
    }

    return {
        items: responseItems,
        totalItems: totalItems,
        totalAmount: totalAmount,
    };
}

/**
 * Fetches the user's cart, populates product details, and calculates totals.
 * If no cart exists for the user, it creates an empty one.
 * @param userId The ID of the authenticated user.
 * @returns A Promise that resolves to the CartResponseDto.
 */
export const fetchCartByUserId = async (userId: string): Promise<CartResponseDto> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Find or Create Cart for the user
        let cartEntity: CartEntity;
        const cartResult = await client.query<CartEntity>(
            `SELECT id, user_id, items, created_at, updated_at
       FROM carts
       WHERE user_id = $1;`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            const newCartResult = await client.query<CartEntity>(
                `INSERT INTO carts (user_id, items, created_at, updated_at)
         VALUES ($1, '[]'::jsonb, NOW(), NOW())
         RETURNING *;`,
                [userId]
            );
            cartEntity = newCartResult.rows[0];
        } else {
            cartEntity = cartResult.rows[0];
        }

        // Use the helper function to map the cart entity to the response DTO
        const responseDto = await mapCartEntityToResponseDto(client, cartEntity);

        await client.query('COMMIT');
        return responseDto;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error fetching cart:', error);
        throw new Error(error.message || 'Failed to fetch cart.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Adds a product to the user's cart or updates its quantity if it already exists.
 * Performs quantity checks.
 * @param userId The ID of the user.
 * @param productId The ID of the product to add.
 * @param quantity The quantity to add (or increment by).
 * @returns A Promise that resolves to the updated CartResponseDto.
 */
export const addItemToCart = async (userId: string, productId: string, quantity: number): Promise<CartResponseDto> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch the product to validate existence and quantity
        const productResult = await client.query<ProductEntity>(
            `SELECT quantity, is_active, unit FROM products WHERE id = $1 AND is_active = TRUE;`,
            [productId]
        );

        if (productResult.rows.length === 0) {
            throw new Error('Product not found or is not active.');
        }
        const product = productResult.rows[0];

        // 2. Find or Create Cart for the user
        let cartEntity: CartEntity;
        const cartResult = await client.query<CartEntity>(
            `SELECT id, user_id, items, created_at, updated_at
       FROM carts
       WHERE user_id = $1 FOR UPDATE;`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            const newCartResult = await client.query<CartEntity>(
                `INSERT INTO carts (user_id, items, created_at, updated_at)
         VALUES ($1, '[]'::jsonb, NOW(), NOW())
         RETURNING *;`,
                [userId]
            );
            cartEntity = newCartResult.rows[0];
        } else {
            cartEntity = cartResult.rows[0];
        }

        const currentCartItems: CartItemEntity[] = cartEntity.items || [];

        // 3. Check if the item already exists in the cart
        const existingCartItemIndex = currentCartItems.findIndex(item => item.productId === productId);
        let newCartItems: CartItemEntity[] = [...currentCartItems];

        if (existingCartItemIndex !== -1) {
            const existingItem = newCartItems[existingCartItemIndex];
            const newQuantity = existingItem.quantity + quantity;

            if (newQuantity > product.quantity) {
                throw new Error(`Cannot add more. Only ${product.quantity} ${product.unit} available.`);
            }

            newCartItems[existingCartItemIndex] = {
                ...existingItem,
                quantity: newQuantity,
            };
        } else {
            if (quantity > product.quantity) {
                throw new Error(`Only ${product.quantity} ${product.unit} available.`);
            }

            const newCartItemId = crypto.randomUUID();

            newCartItems.push({
                id: newCartItemId,
                productId: productId,
                quantity: quantity,
            });
        }

        // 4. Update the cart in the database
        const updatedCartResult = await client.query<CartEntity>(
            `UPDATE carts
       SET items = $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING *;`,
            [JSON.stringify(newCartItems), cartEntity.id]
        );

        const updatedCartEntity = updatedCartResult.rows[0];

        // 5. Map the updated CartEntity to CartResponseDto and return
        const responseDto = await mapCartEntityToResponseDto(client, updatedCartEntity);

        await client.query('COMMIT');
        return responseDto;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error adding item to cart:', error);
        if (error.message.includes('Product not found')) {
            throw new Error(error.message);
        }
        if (error.message.includes('Cannot add more') || error.message.includes('Only')) {
            throw new Error(error.message);
        }
        throw new Error(error.message || 'Failed to add item to cart.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Removes a specific item from the user's cart.
 * @param userId The ID of the user.
 * @param itemId The unique ID of the cart item to remove.
 * @returns A Promise that resolves to the updated CartResponseDto.
 */
export const removeCartItemById = async (userId: string, itemId: string): Promise<CartResponseDto> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Find the user's cart and lock the row
        const cartResult = await client.query<CartEntity>(
            `SELECT id, user_id, items, created_at, updated_at
       FROM carts
       WHERE user_id = $1 FOR UPDATE;`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            await client.query('COMMIT');
            return { items: [], totalItems: 0, totalAmount: 0 };
        }

        const cartEntity: CartEntity = cartResult.rows[0];
        const currentCartItems: CartItemEntity[] = cartEntity.items || [];

        // 2. Filter out the item to be removed
        const initialItemCount = currentCartItems.length;
        const newCartItems = currentCartItems.filter(item => item.id !== itemId);

        if (newCartItems.length === initialItemCount) {
            console.warn(`Attempted to remove cart item ${itemId} not found in user ${userId}'s cart.`);
        }

        // 3. Update the cart in the database with the filtered items
        const updatedCartResult = await client.query<CartEntity>(
            `UPDATE carts
       SET items = $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING *;`,
            [JSON.stringify(newCartItems), cartEntity.id]
        );

        const updatedCartEntity = updatedCartResult.rows[0];

        // 4. Map the updated CartEntity to CartResponseDto and return
        const responseDto = await mapCartEntityToResponseDto(client, updatedCartEntity);

        await client.query('COMMIT');
        return responseDto;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error removing item from cart:', error);
        throw new Error(error.message || 'Failed to remove item from cart.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Updates the quantity of a specific item in the user's cart.
 * Performs quantity checks against product's available quantity.
 * @param userId The ID of the user.
 * @param itemId The unique ID of the cart item to update.
 * @param newQuantity The new quantity for the item.
 * @returns A Promise that resolves to the updated CartResponseDto.
 */
export const updateCartItemQuantity = async (userId: string, itemId: string, newQuantity: number): Promise<CartResponseDto> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Find the user's cart and lock the row
        const cartResult = await client.query<CartEntity>(
            `SELECT id, user_id, items, created_at, updated_at
       FROM carts
       WHERE user_id = $1 FOR UPDATE;`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            throw new Error('Cart not found for this user.');
        }

        const cartEntity: CartEntity = cartResult.rows[0];
        const currentCartItems: CartItemEntity[] = cartEntity.items || [];

        // 2. Find the specific item in the cart
        const itemIndex = currentCartItems.findIndex(item => item.id === itemId);

        if (itemIndex === -1) {
            throw new Error(`Cart item with ID ${itemId} not found in user's cart.`);
        }

        const itemToUpdate = currentCartItems[itemIndex];

        // 3. Fetch the product details to validate quantity
        const productResult = await client.query<ProductEntity>(
            `SELECT quantity, is_active, unit FROM products WHERE id = $1 AND is_active = TRUE;`,
            [itemToUpdate.productId]
        );

        if (productResult.rows.length === 0) {
            throw new Error('Associated product not found or is not active.');
        }
        const product = productResult.rows[0];

        // 4. Validate new quantity against product's available quantity
        if (newQuantity > product.quantity) {
            throw new Error(`Cannot update quantity to ${newQuantity}. Only ${product.quantity} ${product.unit} available.`);
        }

        // 5. Ensure newQuantity is not negative
        if (newQuantity < 0) {
            throw new Error('Quantity cannot be negative.');
        }

        // 6. Update the quantity of the item
        const updatedCartItems: CartItemEntity[] = [...currentCartItems];
        updatedCartItems[itemIndex] = {
            ...itemToUpdate,
            quantity: newQuantity,
        };

        // 7. Update the cart in the database with the modified items
        const updatedCartResult = await client.query<CartEntity>(
            `UPDATE carts
       SET items = $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING *;`,
            [JSON.stringify(updatedCartItems), cartEntity.id]
        );

        const updatedCartEntity = updatedCartResult.rows[0];

        // 8. Map the updated CartEntity to CartResponseDto and return
        const responseDto = await mapCartEntityToResponseDto(client, updatedCartEntity);

        await client.query('COMMIT');
        return responseDto;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error updating cart item quantity:', error);
        if (error.message.includes('Cart not found') || error.message.includes('Cart item with ID') || error.message.includes('Associated product not found') || error.message.includes('Cannot update quantity') || error.message.includes('Quantity cannot be negative')) {
            throw new Error(error.message);
        }
        throw new Error(error.message || 'Failed to update cart item quantity.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Clears all items from a user's cart.
 * @param userId The ID of the user whose cart is to be cleared.
 * @returns A Promise that resolves to the cleared CartResponseDto (empty cart).
 */
export const clearUserCart = async (userId: string): Promise<CartResponseDto> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query<CartEntity>(
            `UPDATE carts
            SET items = '[]'::jsonb, updated_at = NOW()
            WHERE user_id = $1
            RETURNING *;`,
            [userId]
        );

        if (result.rows.length === 0) {
            await client.query('COMMIT');
            // If no cart found, return an empty cart response
            return { items: [], totalItems: 0, totalAmount: 0 };
        }

        const clearedCartEntity = result.rows[0];
        const responseDto = await mapCartEntityToResponseDto(client, clearedCartEntity);

        await client.query('COMMIT');
        return responseDto;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error clearing cart:', error);
        throw new Error(error.message || 'Failed to clear cart.');
    } finally {
        if (client) {
            client.release();
        }
    }
};
