import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { CreateProductDTO, Product, UpdateProductDTO } from '../types/dtos/product.dto';
import { ProductEntity } from '../types/entities/product.entity';
import { DBLocation, Location } from '../types/location';
import { ProductCondition } from '../types/enums';
import { UserRole } from '../types/enums';
import { toDBLocation, fromDBLocation } from './utils/location.map';
import { mapProductEntityToProductDTO } from './utils/product.map';

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

        // Convert harvest_date string from frontend back to a Date object
        const harvestDateObject = new Date(productData.harvest_date);

        const result = await client.query<ProductEntity & { location_geojson_text: string }>(
            `INSERT INTO products (
                seller_id, name, variety, quantity, unit, price, description,
                harvest_date, location, category, images, condition, is_active,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                ST_SetSRID(ST_GeomFromGeoJSON($9), 4326)::geography, -- Always use this, even if $9 is NULL
                $10, $11, $12, $13, NOW(), NOW()
            ) RETURNING *, ST_AsGeoJSON(location)::text AS location_geojson_text;`,
            [
                productData.seller_id,    // $1
                productData.name,         // $2
                productData.variety,      // $3
                productData.quantity,     // $4
                productData.unit,         // $5
                productData.price,        // $6
                productData.description,  // $7
                harvestDateObject,        // $8 (Date object)
                dbLocation ? JSON.stringify(dbLocation) : null, // $9 (GeoJSON string or null)
                productData.category,     // $10
                imagesJson,               // $11
                productData.condition,    // $12
                productData.is_active,    // $13
            ]
        );

        const newProductEntityFromDB = result.rows[0];

        await client.query('COMMIT');

        const newProductEntity = {
            ...newProductEntityFromDB,
            location: newProductEntityFromDB.location_geojson_text ?
                JSON.parse(newProductEntityFromDB.location_geojson_text) as DBLocation :
                null
        };
        const createdProduct = mapProductEntityToProductDTO(newProductEntity as any);

        return createdProduct;

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
        const productResult = await client.query<ProductEntity & { location_geojson_text: string }>( // Add location_geojson_text
            `SELECT 
                id, seller_id, name, variety, quantity, unit, price, description,   
                harvest_date, ST_AsGeoJSON(location)::text as location_geojson_text, category, images, 
                condition, is_active, created_at, updated_at 
            FROM products WHERE id = $1;`,
            [productId]
        );

        const existingProductFromDB = productResult.rows[0];

        if (!existingProductFromDB) {
            throw new Error('Product not found.');
        }

        const existingProduct = { // Make this an object that has the correct location type
            ...existingProductFromDB,
            location: existingProductFromDB.location_geojson_text ?
                JSON.parse(existingProductFromDB.location_geojson_text) as DBLocation :
                null
        };

        const mappedExistingProduct = mapProductEntityToProductDTO(existingProduct as any); // Cast to any

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
        if (updates.variety !== undefined) {
            updateFields.push(`variety = $${paramIndex++}`);
            updateValues.push(updates.variety);
        }
        if (updates.quantity !== undefined) {
            updateFields.push(`quantity = $${paramIndex++}`);
            updateValues.push(updates.quantity);
        }
        if (updates.unit !== undefined) {
            updateFields.push(`unit = $${paramIndex++}`);
            updateValues.push(updates.unit);
        }
        if (updates.price !== undefined) {
            updateFields.push(`price = $${paramIndex++}`);
            updateValues.push(updates.price);
        }
        if (updates.description !== undefined) {
            updateFields.push(`description = $${paramIndex++}`);
            updateValues.push(updates.description);
        }
        if (updates.harvest_date !== undefined) {
            updateFields.push(`harvest_date = $${paramIndex++}`);
            updateValues.push(updates.harvest_date.toISOString()); // Ensure it's ISO string for DB
        }
        if (updates.location !== undefined) {
            const updatedDBLocation = toDBLocation(updates.location);
            updateFields.push(`location = ${updatedDBLocation ? `ST_SetSRID(ST_GeomFromGeoJSON($${paramIndex++}), 4326)::geography` : `$${paramIndex++}`}`);
            updateValues.push(updatedDBLocation ? JSON.stringify(updatedDBLocation) : null);
        }
        if (updates.category !== undefined) {
            updateFields.push(`category = $${paramIndex++}`);
            updateValues.push(updates.category);
        }
        if (updates.images !== undefined) {
            updateFields.push(`images = $${paramIndex++}`);
            updateValues.push(updates.images ? JSON.stringify(updates.images) : null);
        }
        if (updates.condition !== undefined) {
            updateFields.push(`condition = $${paramIndex++}`);
            updateValues.push(updates.condition);
        }
        if (updates.is_active !== undefined) {
            updateFields.push(`is_active = $${paramIndex++}`);
            updateValues.push(updates.is_active);
        }
        if (updateFields.length === 0) {
            await client.query('COMMIT');
            return mappedExistingProduct; // Return the fetched and mapped product if no updates
        }

        updateFields.push(`updated_at = NOW()`);

        updateValues.push(productId); // Add productId at the end for the WHERE clause

        const updateQuery = `
            UPDATE products
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *, ST_AsGeoJSON(location)::text AS location_geojson_text;
        `;

        const result = await client.query<ProductEntity & { location_geojson_text: string }>(updateQuery, updateValues);
        const updatedProductFromDB = result.rows[0];

        await client.query('COMMIT');

        const updatedProductEntity = {
            ...updatedProductFromDB,
            location: updatedProductFromDB.location_geojson_text ?
                JSON.parse(updatedProductFromDB.location_geojson_text) as DBLocation :
                null
        };

        const productAfterUpdate = mapProductEntityToProductDTO(updatedProductEntity as any); // Cast to any
        return productAfterUpdate;

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

        const result = await client.query<ProductEntity & { location_geojson_text: string }>( // Add location_geojson_text
            `SELECT
                id, seller_id, name, variety, quantity, unit, price, description,
                harvest_date, ST_AsGeoJSON(location)::text as location_geojson_text, category, images,
                condition, is_active, created_at, updated_at
            FROM products WHERE is_active = TRUE ORDER BY created_at DESC;`
        );

        // Map through results, parsing the `location` string into an object for `mapProductEntityToProductDTO`
        const products: Product[] = result.rows.map(row => {
            const parsedLocation: DBLocation | null = row.location_geojson_text ? JSON.parse(row.location_geojson_text) as DBLocation : null;
            // Create a new object that correctly types the 'location' property
            const productEntityWithParsedLocation = { ...row, location: parsedLocation };
            return mapProductEntityToProductDTO(productEntityWithParsedLocation as any); // Cast to any
        });
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

/**
 * Fetches a single product by its ID from the database.
 * @param productId The ID of the product to fetch.
 * @returns A Promise that resolves to the Product DTO, or null if not found.
 */
export const fetchProductById = async (id: string): Promise<Product | null> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const result = await client.query<ProductEntity & { location_geojson_text: string }>(
            `SELECT id, seller_id, name, variety, quantity, unit, price, description, harvest_date, ST_AsGeoJSON(location)::text as location_geojson_text, category, images, condition, is_active, created_at, updated_at FROM products WHERE id = $1 AND is_active = TRUE;`,
            [id]
        );

        if (result.rows.length === 0) {
            return null; // Product not found or not active
        }

        // Parse the location string from DB to an object
        const productEntityFromDB = result.rows[0];
        const parsedLocation: DBLocation | null = productEntityFromDB.location_geojson_text ? JSON.parse(productEntityFromDB.location_geojson_text) as DBLocation : null;

        const productEntity = { // Create a new object that correctly types the 'location' property
            ...productEntityFromDB,
            location: parsedLocation
        };

        return mapProductEntityToProductDTO(productEntity as any); // Cast to any

    } catch (error: any) {
        console.error('Error fetching product by ID:', error);
        throw new Error(error.message || 'Failed to fetch product by ID.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Fetches all products associated with a specific seller ID from the database.
 * @param sellerId The ID of the seller whose products are to be fetched.
 * @returns A Promise that resolves to an array of Product DTOs.
 */
export const fetchProductsBySellerId = async (sellerId: string): Promise<Product[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const result = await client.query<ProductEntity & { location_geojson_text: string }>( // Add location_geojson_text
            `SELECT *, ST_AsGeoJSON(location)::text as location_geojson_text FROM products WHERE seller_id = $1 AND is_active = TRUE ORDER BY created_at DESC;`,
            [sellerId]
        );

        const products: Product[] = result.rows.map(row => {
            const parsedLocation: DBLocation | null = row.location_geojson_text ? JSON.parse(row.location_geojson_text) as DBLocation : null;
            // Create a new object that correctly types the 'location' property
            const productEntityWithParsedLocation = { ...row, location: parsedLocation };
            return mapProductEntityToProductDTO(productEntityWithParsedLocation as any); // Cast to any
        });

        return products;


    } catch (error: any) {
        console.error('Error fetching seller products:', error);
        throw new Error(error.message || 'Failed to fetch seller products.');
    } finally {
        if (client) {
            client.release();
        }
    }
};