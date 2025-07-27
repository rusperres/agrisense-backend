import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { CartEntity, CartItemEntity } from '../types/entities/cart.entity';
import { ProductEntity } from '../types/entities/product.entity';
import { CartResponseDto, CartItemResponseDto } from '../types/dtos/cart.dto';
import { Product } from '../types/dtos/product.dto';
import { Location, DBLocation } from '../types/location';
import { ProductCondition } from '../types/enums';

// --- Helper functions for Product Mapping ---
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

function mapProductEntityToProductDTO(entity: ProductEntity): Product {
    return {
        id: entity.id,
        seller_id: entity.seller_id,
        name: entity.name,
        category: entity.category,
        price: entity.price,
        unit: entity.unit,
        stock: entity.stock,
        variety: entity.variety,
        description: entity.description,
        images: entity.images,
        harvest_date: entity.harvest_date,
        condition: entity.condition as ProductCondition,
        is_active: entity.is_active,
        location: fromDBLocation(entity.location),
        created_at: entity.created_at,
        updated_at: entity.updated_at,
    };
}

/**
 * Helper to map CartEntity and related ProductEntities to CartResponseDto.
 */
async function mapCartEntityToResponseDto(client: PoolClient, cartEntity: CartEntity): Promise<CartResponseDto> {
    const dbCartItems: CartItemEntity[] = cartEntity.items || [];

    const productIds = dbCartItems.map(item => item.productId);
    const uniqueProductIds = [...new Set(productIds)];

    let productsMap = new Map<string, ProductEntity>();
    if (uniqueProductIds.length > 0) {
        const productResult = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE id = ANY($1::uuid[]);`,
            [uniqueProductIds]
        );
        productResult.rows.forEach(p => productsMap.set(p.id, p));
    }

    let totalItems = 0;
    let totalAmount = 0;
    const responseItems: CartItemResponseDto[] = [];

    for (const dbItem of dbCartItems) {
        const productEntity = productsMap.get(dbItem.productId);

        if (productEntity) {
            const productDto = mapProductEntityToProductDTO(productEntity);
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
        // TODO: Consider how to handle products that are no longer available/active/exist
        // For now, they are simply skipped. You might want to return an error or a warning.
    }

    return {
        items: responseItems,
        totalItems: totalItems,
        totalAmount: totalAmount,
    };
}

// --- Main Cart Service Functions ---

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

        const dbCartItems: CartItemEntity[] = cartEntity.items || [];

        // 2. Extract unique product IDs from cart items
        const productIds = dbCartItems.map(item => item.productId);
        const uniqueProductIds = [...new Set(productIds)]; // Deduplicate product IDs

        // 3. Fetch all necessary product details in one go
        let productsMap = new Map<string, ProductEntity>();
        if (uniqueProductIds.length > 0) {
            const productResult = await client.query<ProductEntity>(
                `SELECT * FROM products WHERE id = ANY($1::uuid[]);`,
                [uniqueProductIds]
            );
            productResult.rows.forEach(p => productsMap.set(p.id, p));
        }

        // 4. Map CartItemEntity to CartItemResponseDto and calculate totals
        let totalItems = 0;
        let totalAmount = 0;
        const responseItems: CartItemResponseDto[] = [];

        for (const dbItem of dbCartItems) {
            const productEntity = productsMap.get(dbItem.productId);

            if (productEntity) {
                const productDto = mapProductEntityToProductDTO(productEntity);
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
        }

        await client.query('COMMIT');

        return {
            items: responseItems,
            totalItems: totalItems,
            totalAmount: totalAmount,
        };

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
 * Performs stock checks.
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

        // 1. Fetch the product to validate existence and stock
        const productResult = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE id = $1 AND is_active = TRUE;`,
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

            if (newQuantity > product.stock) {
                throw new Error(`Cannot add more. Only ${product.stock} ${product.unit} available.`);
            }

            newCartItems[existingCartItemIndex] = {
                ...existingItem,
                quantity: newQuantity,
            };
        } else {
            if (quantity > product.stock) {
                throw new Error(`Only ${product.stock} ${product.unit} available.`);
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
 * Performs stock checks.
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

        // 3. Fetch the product details to validate stock
        const productResult = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE id = $1 AND is_active = TRUE;`,
            [itemToUpdate.productId]
        );

        if (productResult.rows.length === 0) {
            throw new Error('Associated product not found or is not active.');
        }
        const product = productResult.rows[0];

        // 4. Validate new quantity against product stock
        if (newQuantity > product.stock) {
            throw new Error(`Cannot update quantity to ${newQuantity}. Only ${product.stock} ${product.unit} available.`);
        }

        // 5. Update the quantity of the item
        const updatedCartItems: CartItemEntity[] = [...currentCartItems];
        updatedCartItems[itemIndex] = {
            ...itemToUpdate,
            quantity: newQuantity,
        };

        // 6. Update the cart in the database with the modified items
        const updatedCartResult = await client.query<CartEntity>(
            `UPDATE carts
       SET items = $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING *;`,
            [JSON.stringify(updatedCartItems), cartEntity.id]
        );

        const updatedCartEntity = updatedCartResult.rows[0];

        // 7. Map the updated CartEntity to CartResponseDto and return
        const responseDto = await mapCartEntityToResponseDto(client, updatedCartEntity);

        await client.query('COMMIT');
        return responseDto;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error updating cart item quantity:', error);
        if (error.message.includes('Cart not found') || error.message.includes('Cart item with ID') || error.message.includes('Associated product not found') || error.message.includes('Cannot update quantity')) {
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