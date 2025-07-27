import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { AdminEntity, BuyerEntity, SellerEntity, UserEntity } from '../types/entities/user.entity';
import { AdminResponseDTO, BaseUserResponseDTO, BuyerResponseDTO, SellerResponseDTO, UserResponseDTO } from '../types/dtos/user/user.response.dto';
import { GetFarmerProfilesFilterDTO, ApproveFarmerDTO, RejectFarmerDTO } from '../types/dtos/farmerModeration.dto';
import { VerificationStatus, UserRole } from '../types/enums';



// Helper to convert DB coordinates to LocationResponse
import { LocationResponse } from '../types/location';
function mapDBLocationToLocationResponse(dbLocation: any): LocationResponse | null {
    if (!dbLocation || !dbLocation.coordinates || dbLocation.coordinates.length < 2) {
        return null;
    }
    return {
        lat: dbLocation.coordinates[1],
        lng: dbLocation.coordinates[0],
        address: dbLocation.properties?.address || null
    };
}

async function mapUserAndRoleEntityToUserResponseDTO(
    userEntity: UserEntity,
    roleEntity?: SellerEntity | BuyerEntity | AdminEntity
): Promise<UserResponseDTO> {
    // 1. Map common fields to LocationResponse
    const mappedLocation: LocationResponse | null = userEntity.location ? {
        lat: userEntity.location.coordinates[1],
        lng: userEntity.location.coordinates[0],
        address: userEntity.location.properties?.address || 'N/A'
    } : null;

    // 2. Create the base user DTO object, strictly typed as BaseUserResponseDTO
    const baseUserDTO: BaseUserResponseDTO = {
        id: String(userEntity.id),
        name: userEntity.name,
        email: userEntity.email || '',
        phone: userEntity.phone,
        avatar: userEntity.avatar,
        role: userEntity.role,
        location: mappedLocation,
        createdAt: userEntity.created_at,
        updatedAt: userEntity.updated_at,
        eWalletDetails: userEntity.eWalletDetails,
    };

    // 3. Conditionally build the specific role DTO using the baseUserDTO
    let finalUserResponse: UserResponseDTO;

    if (userEntity.role === UserRole.Seller) {
        const seller = roleEntity as SellerEntity;

        const sellerResponse: SellerResponseDTO = {
            ...baseUserDTO,
            isVerified: seller.is_verified,
            businessName: seller.business_name,
            verificationStatus: seller.verification_status || VerificationStatus.Pending,
            credentials: seller.credentials || { documents: [], businessLicense: null, farmCertificate: null, governmentId: '' },
            rating: seller.rating,
            reviewCount: seller.review_count,
            totalSales: seller.total_sales,
        };
        finalUserResponse = sellerResponse;
    } else if (userEntity.role === UserRole.Buyer) {
        const buyer = roleEntity as BuyerEntity;

        const buyerResponse: BuyerResponseDTO = {
            ...baseUserDTO,
            purchaseHistory: buyer.purchase_history || [],
            favoriteProducts: buyer.favorite_products || [],
        };
        finalUserResponse = buyerResponse;
    } else if (userEntity.role === UserRole.Admin) {
        const adminResponse: AdminResponseDTO = {
            ...baseUserDTO, // Admin only has base fields for now
        };
        finalUserResponse = adminResponse;
    } else {
        finalUserResponse = baseUserDTO;
    }

    return finalUserResponse;
}



// Function to fetch farmer profiles based on filters
export const getFarmerProfiles = async (filters: GetFarmerProfilesFilterDTO): Promise<SellerResponseDTO[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        let query = `
            SELECT
                u.id AS user_id, u.email, u.phone, u.name, u.role, u.location, u.avatar, u.created_at, u.updated_at, u.ewallet_details,
                s.business_name, s.is_verified, s.verification_status, s.credentials, s.rating, s.review_count, s.total_sales
            FROM
                users u
            JOIN
                sellers s ON u.id = s.user_id
            WHERE
                u.role = $1
        `;
        const queryParams: (string | VerificationStatus)[] = [UserRole.Seller];
        let paramIndex = 2;

        if (filters.status) {
            query += ` AND s.verification_status = $${paramIndex}`;
            queryParams.push(filters.status);
            paramIndex++;
        }
        if (filters.name) {
            query += ` AND u.name ILIKE $${paramIndex}`;
            queryParams.push(`%${filters.name}%`);
            paramIndex++;
        }
        if (filters.email) {
            query += ` AND u.email ILIKE $${paramIndex}`;
            queryParams.push(`%${filters.email}%`);
            paramIndex++;
        }
        if (filters.businessName) {
            query += ` AND s.business_name ILIKE $${paramIndex}`;
            queryParams.push(`%${filters.businessName}%`);
            paramIndex++;
        }

        query += ` ORDER BY u.created_at DESC`;

        const result = await client.query(query, queryParams);

        const farmerProfiles: SellerResponseDTO[] = [];
        for (const row of result.rows) {
            const userEntity: UserEntity = {
                id: row.user_id,
                email: row.email,
                phone: row.phone,
                name: row.name,
                role: row.role,
                location: row.location,
                avatar: row.avatar,
                created_at: row.created_at,
                updated_at: row.updated_at,
                password: '',
                eWalletDetails: row.ewallet_details,
            };
            const sellerEntity: SellerEntity = {
                user_id: row.user_id,
                business_name: row.business_name,
                is_verified: row.is_verified,
                verification_status: row.verification_status,
                credentials: row.credentials,
                rating: row.rating,
                review_count: row.review_count,
                total_sales: row.total_sales,
            };
            const mappedProfile = await mapUserAndRoleEntityToUserResponseDTO(userEntity, sellerEntity) as SellerResponseDTO;
            farmerProfiles.push(mappedProfile);
        }

        await client.query('COMMIT');
        return farmerProfiles;

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error in getFarmerProfiles:', error);
        throw new Error('Failed to fetch farmer profiles.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

// Function to approve a farmer
export const approveFarmer = async (farmerId: string, data?: ApproveFarmerDTO): Promise<SellerResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const updateResult = await client.query<SellerEntity>(
            `UPDATE sellers
             SET verification_status = $1, is_verified = $2
             WHERE user_id = $3
             RETURNING *`,
            [VerificationStatus.Approved, true, farmerId]
        );

        if (updateResult.rows.length === 0) {
            throw new Error('Farmer not found or already approved.');
        }

        const updatedSellerEntity: SellerEntity = updateResult.rows[0];

        const userResult = await client.query<UserEntity>(
            `SELECT * FROM users WHERE id = $1`,
            [farmerId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User (farmer) details not found after update.');
        }

        const userEntity: UserEntity = userResult.rows[0];

        await client.query('COMMIT');

        const updatedFarmerDTO = await mapUserAndRoleEntityToUserResponseDTO(userEntity, updatedSellerEntity) as SellerResponseDTO;
        return updatedFarmerDTO;

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error in approveFarmer:', error);
        throw new Error('Failed to approve farmer.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

// Function to reject a farmer
export const rejectFarmer = async (farmerId: string, data: RejectFarmerDTO): Promise<SellerResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const updateResult = await client.query<SellerEntity>(
            `UPDATE sellers
             SET verification_status = $1, is_verified = $2
             WHERE user_id = $3
             RETURNING *`,
            [VerificationStatus.Rejected, false, farmerId]
        );

        if (updateResult.rows.length === 0) {
            throw new Error('Farmer not found or already rejected.');
        }

        const updatedSellerEntity: SellerEntity = updateResult.rows[0];

        const userResult = await client.query<UserEntity>(
            `SELECT * FROM users WHERE id = $1`,
            [farmerId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User (farmer) details not found after update.');
        }

        const userEntity: UserEntity = userResult.rows[0];

        await client.query('COMMIT');

        const updatedFarmerDTO = await mapUserAndRoleEntityToUserResponseDTO(userEntity, updatedSellerEntity) as SellerResponseDTO;
        return updatedFarmerDTO;

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error in rejectFarmer:', error);
        throw new Error('Failed to reject farmer.');
    } finally {
        if (client) {
            client.release();
        }
    }
};