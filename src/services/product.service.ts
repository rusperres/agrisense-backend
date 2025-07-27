import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { CreateProductDTO, Product, UpdateProductDTO } from '../types/dtos/product.dto';
import { ProductEntity } from '../types/entities/product.entity';
import { DBLocation, Location } from '../types/location';
import { ProductCondition } from '../types/enums';
import { UserRole } from '../types/enums';

// --- Helper function for mapping Location DTO to DBLocation entity ---
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

// --- Helper function for mapping DBLocation entity to Location DTO ---
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
 * Maps a ProductEntity (from database) to a Product DTO (for API response).
 * This function is crucial for transforming DB-specific types (like DBLocation)
 * into API-friendly types (like simple Location) and ensuring camelCase.
 */
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
 * Creates a new product in the database.
 * @param productData The data for the new product, adhering to CreateProductDTO.
 * @returns A Promise that resolves to the newly created Product (Response DTO).
 */
export const createProduct = async (productData: CreateProductDTO): Promise<Product> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const dbLocation = toDBLocation(productData.location);

        const imagesJson = productData.images ? JSON.stringify(productData.images) : null;

        const result = await client.query<ProductEntity>(
            `INSERT INTO products (
                seller_id, name, category, price, unit, stock, variety,
                description, images, harvest_date, condition, is_active, location,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
            ) RETURNING *;`,
            [
                productData.seller_id,
                productData.name,
                productData.category,
                productData.price,
                productData.unit,
                productData.stock,
                productData.variety,
                productData.description,
                imagesJson,
                productData.harvest_date,
                productData.condition,
                productData.is_active,
                dbLocation ? JSON.stringify(dbLocation) : null,
            ]
        );

        const newProductEntity: ProductEntity = result.rows[0];

        await client.query('COMMIT');

        return mapProductEntityToProductDTO(newProductEntity);

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error creating product:', error);
        if (error.code === '23503') {
            throw new Error('Seller ID not found. Product cannot be added without a valid seller.');
        }
        throw new Error(error.message || 'Failed to create product.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const updateProduct = async (
    productId: string,
    userId: string,
    userRole: UserRole,
    updates: UpdateProductDTO
): Promise<Product> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch the existing product to check ownership/existence
        const productResult = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE id = $1;`,
            [productId]
        );

        const existingProduct = productResult.rows[0];

        if (!existingProduct) {
            throw new Error('Product not found.');
        }

        // 2. Authorization Check:
        if (userRole === UserRole.Seller && existingProduct.seller_id !== userId) {
            throw new Error('Unauthorized: You can only update your own products.');
        }

        // 3. Dynamically build the UPDATE query
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        // Map DTO fields to entity fields and add to update arrays
        if (updates.name !== undefined) {
            updateFields.push(`name = $${paramIndex++}`);
            updateValues.push(updates.name);
        }
        if (updates.category !== undefined) {
            updateFields.push(`category = $${paramIndex++}`);
            updateValues.push(updates.category);
        }
        if (updates.price !== undefined) {
            updateFields.push(`price = $${paramIndex++}`);
            updateValues.push(updates.price);
        }
        if (updates.unit !== undefined) {
            updateFields.push(`unit = $${paramIndex++}`);
            updateValues.push(updates.unit);
        }
        if (updates.stock !== undefined) {
            updateFields.push(`stock = $${paramIndex++}`);
            updateValues.push(updates.stock);
        }
        if (updates.variety !== undefined) {
            updateFields.push(`variety = $${paramIndex++}`);
            updateValues.push(updates.variety);
        }
        if (updates.description !== undefined) {
            updateFields.push(`description = $${paramIndex++}`);
            updateValues.push(updates.description);
        }
        if (updates.images !== undefined) {
            updateFields.push(`images = $${paramIndex++}`);
            updateValues.push(updates.images ? JSON.stringify(updates.images) : null);
        }
        if (updates.harvest_date !== undefined) {
            updateFields.push(`harvest_date = $${paramIndex++}`);
            updateValues.push(updates.harvest_date);
        }
        if (updates.condition !== undefined) {
            updateFields.push(`condition = $${paramIndex++}`);
            updateValues.push(updates.condition);
        }
        if (updates.is_active !== undefined) {
            updateFields.push(`is_active = $${paramIndex++}`);
            updateValues.push(updates.is_active);
        }
        if (updates.location !== undefined) {
            updateFields.push(`location = $${paramIndex++}`);
            updateValues.push(updates.location ? JSON.stringify(toDBLocation(updates.location)) : null);
        }

        if (updateFields.length === 0) {
            await client.query('COMMIT');
            return mapProductEntityToProductDTO(existingProduct);
        }

        updateFields.push(`updated_at = NOW()`);

        updateValues.push(productId);

        const updateQuery = `
            UPDATE products
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *;
        `;

        const result = await client.query<ProductEntity>(updateQuery, updateValues);

        const updatedProductEntity: ProductEntity = result.rows[0];

        await client.query('COMMIT');

        return mapProductEntityToProductDTO(updatedProductEntity);

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error updating product:', error);
        throw new Error(error.message || 'Failed to update product.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const deleteProduct = async (
    productId: string,
    userId: string,
    userRole: UserRole
): Promise<void> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch the existing product to check ownership/existence
        const productResult = await client.query<ProductEntity>(
            `SELECT seller_id FROM products WHERE id = $1;`,
            [productId]
        );

        const existingProduct = productResult.rows[0];

        if (!existingProduct) {
            throw new Error('Product not found.');
        }

        // 2. Authorization Check:
        if (userRole === UserRole.Seller && existingProduct.seller_id !== userId) {
            throw new Error('Unauthorized: You can only delete your own products.');
        }

        // 3. Perform the deletion
        const deleteResult = await client.query(
            `DELETE FROM products WHERE id = $1;`,
            [productId]
        );

        if (deleteResult.rowCount === 0) {
            throw new Error('Product not found or already deleted.');
        }

        await client.query('COMMIT');

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error deleting product:', error);
        throw new Error(error.message || 'Failed to delete product.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const fetchProducts = async (): Promise<Product[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const result = await client.query<ProductEntity>(
            `SELECT * FROM products WHERE is_active = TRUE ORDER BY created_at DESC;`
        );

        const products: Product[] = result.rows.map(mapProductEntityToProductDTO);

        return products;

    } catch (error: any) {
        console.error('Error fetching products:', error);
        throw new Error(error.message || 'Failed to fetch products.');
    } finally {
        if (client) {
            client.release();
        }
    }
};