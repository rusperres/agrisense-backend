import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { CropListingResponseDTO, GetCropListingsQueryDTO } from '../types/dtos/cropListing.dto';
import { CropListingEntity } from '../types/entities/cropListing.entity';
import { DBLocation, Location } from '../types/location';
import { CropListingStatus } from '../types/enums';


// --- Helper functions for Location mapping (can be moved to a shared utility) ---
function toDBLocation(simpleLocation: Location | null): DBLocation | null {
    if (!simpleLocation || simpleLocation.lat === null || simpleLocation.lng === null) {
        return null;
    }
    return {
        type: 'Point',
        coordinates: [simpleLocation.lng, simpleLocation.lat], // GeoJSON format: [longitude, latitude]
        properties: {
            address: simpleLocation.address || null
        }
    };
}

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
 * Maps a CropListingWithFarmerNameEntity (from database with joined farmer name)
 * to a CropListingResponseDTO (for API response).
 * Handles date formatting and location transformation.
 */
function mapCropListingEntityToDTO(entity: CropListingEntity): CropListingResponseDTO {
    return {
        id: entity.id,
        crop_name: entity.crop_name,
        variety: entity.variety,
        farmer_name: entity.farmer_name,
        farmer_id: entity.farmer_id,
        price: entity.price,
        unit: entity.unit,
        quantity: entity.quantity,
        submission_date: entity.submission_date.toISOString(),
        status: entity.status,
        images: entity.images,
        description: entity.description,
        location: fromDBLocation(entity.location),
        is_suspicious: entity.is_suspicious,
        flag_reason: entity.flag_reason,
        created_at: entity.created_at.toISOString(),
        updated_at: entity.updated_at.toISOString(),
    };
}

/**
 * Fetches crop listings from the database, with optional filtering,
 * joining farmer (user) details.
 * @param filters Optional filters for status, farmer_id, etc.
 * @returns An array of CropListingResponseDTOs.
 */
export const fetchCropListings = async (filters: GetCropListingsQueryDTO = {}): Promise<CropListingResponseDTO[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        let queryText = `
            SELECT
                cl.*,
                u.name AS farmer_name -- Alias user's name as farmer_name
            FROM
                crop_listings cl
            JOIN
                users u ON cl.farmer_id = u.id -- Assuming 'users' table has 'id' and 'name'
            WHERE 1 = 1
        `;
        const queryParams: any[] = [];
        let paramIndex = 1;

        if (filters.status) {
            queryText += ` AND cl.status = $${paramIndex++}`;
            queryParams.push(filters.status);
        }
        if (filters.farmer_id) {
            queryText += ` AND cl.farmer_id = $${paramIndex++}`;
            queryParams.push(filters.farmer_id);
        }
        if (filters.crop_name) {
            queryText += ` AND cl.crop_name ILIKE $${paramIndex++}`;
            queryParams.push(`%${filters.crop_name}%`);
        }
        if (filters.min_price !== undefined) {
            queryText += ` AND cl.price >= $${paramIndex++}`;
            queryParams.push(filters.min_price);
        }
        if (filters.max_price !== undefined) {
            queryText += ` AND cl.price <= $${paramIndex++}`;
            queryParams.push(filters.max_price);
        }
        if (filters.location_address) {
            // will implement later
        }


        queryText += ` ORDER BY cl.submission_date DESC;`;

        const result = await client.query<CropListingEntity>(queryText, queryParams);

        const cropListings: CropListingResponseDTO[] = result.rows.map(mapCropListingEntityToDTO);

        return cropListings;

    } catch (error: any) {
        console.error('Error fetching crop listings:', error);
        throw new Error(error.message || 'Failed to fetch crop listings.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const approveCrop = async (cropId: string): Promise<CropListingResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        await client.query('BEGIN');

        const updateResult = await client.query<CropListingEntity>(
            `UPDATE crop_listings
             SET status = $1, updated_at = NOW()
             WHERE id = $2 AND status = $3
             RETURNING *;`,
            [CropListingStatus.Approved, cropId, CropListingStatus.Pending]
        );

        if (updateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            throw new Error('Crop listing not found or already approved/processed.');
        }

        const updatedEntity = updateResult.rows[0];

        const farmerResult = await client.query<{ name: string }>(
            `SELECT name FROM users WHERE id = $1;`,
            [updatedEntity.farmer_id]
        );

        if (farmerResult.rowCount === 0) {
            await client.query('ROLLBACK');
            throw new Error(`Farmer details not found for ID: ${updatedEntity.farmer_id}`);
        }

        updatedEntity.farmer_name = farmerResult.rows[0].name;


        await client.query('COMMIT');

        return mapCropListingEntityToDTO(updatedEntity);

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Error approving crop listing ${cropId}:`, error);
        throw new Error(error.message || `Failed to approve crop listing with ID: ${cropId}.`);
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const rejectCrop = async (cropId: string, reason?: string): Promise<CropListingResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const updateResult = await client.query(
            `UPDATE crop_listings
             SET status = $1, flag_reason = $2, updated_at = NOW()
             WHERE id = $3 AND status IN ($4, $5)
             RETURNING id;`,
            [
                CropListingStatus.Rejected,
                reason || null,
                cropId,
                CropListingStatus.Pending,
                CropListingStatus.Flagged
            ]
        );

        if (updateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            throw new Error('Crop listing not found or cannot be rejected from its current status (must be pending or flagged).');
        }

        const fetchUpdatedResult = await client.query<CropListingEntity>(
            `SELECT
                cl.*,
                u.name AS farmer_name
            FROM
                crop_listings cl
            JOIN
                users u ON cl.farmer_id = u.id
            WHERE cl.id = $1;`,
            [cropId]
        );

        if (fetchUpdatedResult.rowCount === 0) {
            await client.query('ROLLBACK');
            throw new Error('Failed to retrieve updated crop listing after rejection.');
        }

        const updatedCropEntity = fetchUpdatedResult.rows[0];

        await client.query('COMMIT');

        return mapCropListingEntityToDTO(updatedCropEntity);

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Error rejecting crop listing ${cropId}:`, error);
        throw new Error(error.message || `Failed to reject crop listing with ID: ${cropId}.`);
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const flagCrop = async (cropId: string, reason: string): Promise<CropListingResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const updateResult = await client.query(
            `UPDATE crop_listings
             SET status = $1, is_suspicious = $2, flag_reason = $3, updated_at = NOW()
             WHERE id = $4 AND status IN ($5, $6)
             RETURNING id;`,
            [
                CropListingStatus.Flagged,
                true,
                reason,
                cropId,
                CropListingStatus.Pending,
                CropListingStatus.Approved
            ]
        );

        if (updateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            throw new Error('Crop listing not found or cannot be flagged from its current status (must be pending or approved).');
        }

        const fetchUpdatedResult = await client.query<CropListingEntity>(
            `SELECT
                cl.*,
                u.name AS farmer_name
            FROM
                crop_listings cl
            JOIN
                users u ON cl.farmer_id = u.id
            WHERE cl.id = $1;`,
            [cropId]
        );

        if (fetchUpdatedResult.rowCount === 0) {
            await client.query('ROLLBACK');
            throw new Error('Failed to retrieve updated crop listing after flagging.');
        }

        const updatedCropEntity = fetchUpdatedResult.rows[0];

        await client.query('COMMIT');

        return mapCropListingEntityToDTO(updatedCropEntity);

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Error flagging crop listing ${cropId}:`, error);
        throw new Error(error.message || `Failed to flag crop listing with ID: ${cropId}.`);
    } finally {
        if (client) {
            client.release();
        }
    }
};