import { PoolClient } from 'pg';
import { pool } from '../config/db';
import {
    GetApplicationsResponseDTO,
    SingleApplicationResponseDTO,
    GetUsersResponseDTO,
    SingleUserResponseDTO,
    VerificationApplication,
} from '../types/dtos/admin.dto';
import { UserResponseDTO, SellerResponseDTO, BuyerResponseDTO, AdminResponseDTO, BaseUserResponseDTO } from '../types/dtos/user/user.response.dto'; // User DTOs
import { UserEntity, SellerEntity, BuyerEntity, AdminEntity } from '../types/entities/user.entity';
import { VerificationApplicationEntity } from '../types/entities/admin.entity';
import { UserRole, VerificationStatus } from '../types/enums';
import { DBLocation, LocationResponse } from '../types/location';
import { EWalletDetails } from '../types/ewallet';

// --- Helper Functions (Copied/Adapted from auth.service.ts for consistency) ---

// Helper function to map entities to UserResponseDTO
async function mapUserAndRoleEntityToUserResponseDTO(
    userEntity: UserEntity,
    roleEntity?: SellerEntity | BuyerEntity | AdminEntity
): Promise<UserResponseDTO> {
    const mappedLocation: LocationResponse | null = userEntity.location ? {
        lat: userEntity.location.coordinates[1],
        lng: userEntity.location.coordinates[0],
        address: userEntity.location.properties?.address || 'N/A'
    } : null;

    const baseUserDTO: BaseUserResponseDTO = {
        id: String(userEntity.id),
        name: userEntity.name,
        email: userEntity.email || null,
        phone: userEntity.phone,
        avatar: userEntity.avatar,
        role: userEntity.role,
        location: mappedLocation,
        createdAt: userEntity.created_at,
        updatedAt: userEntity.updated_at,
        eWalletDetails: userEntity.eWalletDetails,
    };

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
            ...baseUserDTO,
        };
        finalUserResponse = adminResponse;
    } else {
        finalUserResponse = baseUserDTO;
    }

    return finalUserResponse;
}

// Helper function to map VerificationApplicationEntity to VerificationApplication DTO
function mapApplicationEntityToDTO(entity: VerificationApplicationEntity): VerificationApplication {
    return {
        id: String(entity.id),
        sellerId: String(entity.seller_id),
        documents: entity.documents || { governmentId: '', businessLicense: null, farmCertificate: null, additionalDocs: [] },
        status: entity.status,
        submittedAt: new Date(entity.submitted_at),
        reviewedAt: entity.reviewed_at ? new Date(entity.reviewed_at) : undefined,
        reviewedBy: entity.reviewed_by === null ? undefined : entity.reviewed_by,
        reviewNotes: entity.review_notes === null ? undefined : entity.review_notes,
    };
}

// --- Admin Service Functions ---

/**
 * Fetches all verification applications.
 */
export const getApplications = async (): Promise<GetApplicationsResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const result = await client.query<VerificationApplicationEntity>(
            `SELECT * FROM verification_applications ORDER BY submitted_at DESC`
        );

        const applications: VerificationApplication[] = result.rows.map(mapApplicationEntityToDTO);
        const totalCountResult = await client.query<{ count: string }>(
            `SELECT COUNT(*) FROM verification_applications`
        );
        const totalCount = parseInt(totalCountResult.rows[0].count, 10);

        return { applications, totalCount };
    } catch (error) {
        console.error('Failed to fetch applications:', error);
        throw new Error('Could not retrieve verification applications.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Approves a verification application.
 */
export const approveApplication = async (
    applicationId: string,
    notes: string | undefined,
    adminId: string
): Promise<SingleApplicationResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Update the verification application status
        const updateAppResult = await client.query<VerificationApplicationEntity>(
            `UPDATE verification_applications
             SET status = $1, reviewed_at = NOW(), reviewed_by = $2, review_notes = $3
             WHERE id = $4 AND status = $5
             RETURNING *`,
            [VerificationStatus.Approved, adminId, notes || null, applicationId, VerificationStatus.Pending]
        );

        if (updateAppResult.rows.length === 0) {
            throw new Error('Application not found or already reviewed.');
        }

        const updatedApplicationEntity = updateAppResult.rows[0];

        // 2. Update the associated seller's `is_verified` and `verification_status`
        await client.query(
            `UPDATE sellers
             SET is_verified = TRUE, verification_status = $1
             WHERE user_id = $2`,
            [VerificationStatus.Approved, updatedApplicationEntity.seller_id]
        );

        await client.query('COMMIT');

        return mapApplicationEntityToDTO(updatedApplicationEntity);
    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Failed to approve application ${applicationId}:`, error);
        throw new Error(error.message || 'Failed to approve application.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Rejects a verification application.
 */
export const rejectApplication = async (
    applicationId: string,
    notes: string, // `notes` is required for rejection
    adminId: string
): Promise<SingleApplicationResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        if (!notes || notes.trim() === '') {
            throw new Error('Rejection notes are required.');
        }

        // 1. Update the verification application status
        const updateAppResult = await client.query<VerificationApplicationEntity>(
            `UPDATE verification_applications
             SET status = $1, reviewed_at = NOW(), reviewed_by = $2, review_notes = $3
             WHERE id = $4 AND status = $5
             RETURNING *`,
            [VerificationStatus.Rejected, adminId, notes, applicationId, VerificationStatus.Pending]
        );

        if (updateAppResult.rows.length === 0) {
            throw new Error('Application not found or already reviewed.');
        }

        const updatedApplicationEntity = updateAppResult.rows[0];

        // 2. Update the associated seller's `is_verified` and `verification_status`
        // A rejected seller is not verified.
        await client.query(
            `UPDATE sellers
             SET is_verified = FALSE, verification_status = $1
             WHERE user_id = $2`,
            [VerificationStatus.Rejected, updatedApplicationEntity.seller_id]
        );

        await client.query('COMMIT');

        return mapApplicationEntityToDTO(updatedApplicationEntity);
    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Failed to reject application ${applicationId}:`, error);
        throw new Error(error.message || 'Failed to reject application.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Fetches all users (including role-specific details).
 */
export const getUsers = async (): Promise<GetUsersResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const userResults = await client.query<UserEntity>(
            `SELECT * FROM users ORDER BY created_at DESC`
        );

        const users: UserResponseDTO[] = [];
        for (const userEntity of userResults.rows) {
            let roleSpecificEntity: SellerEntity | BuyerEntity | AdminEntity | undefined;

            if (userEntity.role === UserRole.Seller) {
                const sellerResult = await client.query<SellerEntity>(
                    `SELECT * FROM sellers WHERE user_id = $1`,
                    [userEntity.id]
                );
                roleSpecificEntity = sellerResult.rows[0];
            } else if (userEntity.role === UserRole.Buyer) {
                const buyerResult = await client.query<BuyerEntity>(
                    `SELECT * FROM buyers WHERE user_id = $1`,
                    [userEntity.id]
                );
                roleSpecificEntity = buyerResult.rows[0];
            }
            const userResponse = await mapUserAndRoleEntityToUserResponseDTO(userEntity, roleSpecificEntity);
            users.push(userResponse);
        }

        const totalCountResult = await client.query<{ count: string }>(
            `SELECT COUNT(*) FROM users`
        );
        const totalCount = parseInt(totalCountResult.rows[0].count, 10);

        return { users, totalCount };
    } catch (error) {
        console.error('Failed to fetch users:', error);
        throw new Error('Could not retrieve users.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Suspends a user.
 */
export const suspendUser = async (userId: string, reason: string, adminId: string): Promise<SingleUserResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        if (!reason || reason.trim() === '') {
            throw new Error('Suspension reason is required.');
        }

        // 1. Update the user's suspension status in the `users` table
        const userUpdateResult = await client.query<UserEntity>(
            `UPDATE users
             SET is_suspended = TRUE, suspension_reason = $1, suspended_at = NOW(), updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [reason, userId]
        );

        if (userUpdateResult.rows.length === 0) {
            throw new Error('User not found or already suspended.');
        }

        const updatedUserEntity = userUpdateResult.rows[0];

        // 2. Fetch role-specific data for the updated user
        let roleSpecificEntity: SellerEntity | BuyerEntity | AdminEntity | undefined;
        if (updatedUserEntity.role === UserRole.Seller) {
            const sellerResult = await client.query<SellerEntity>(
                `SELECT * FROM sellers WHERE user_id = $1`,
                [updatedUserEntity.id]
            );
            roleSpecificEntity = sellerResult.rows[0];
        } else if (updatedUserEntity.role === UserRole.Buyer) {
            const buyerResult = await client.query<BuyerEntity>(
                `SELECT * FROM buyers WHERE user_id = $1`,
                [updatedUserEntity.id]
            );
            roleSpecificEntity = buyerResult.rows[0];
        }

        await client.query('COMMIT');

        return mapUserAndRoleEntityToUserResponseDTO(updatedUserEntity, roleSpecificEntity);
    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Failed to suspend user ${userId}:`, error);
        throw new Error(error.message || 'Failed to suspend user.');
    } finally {
        if (client) {
            client.release();
        }
    }
};