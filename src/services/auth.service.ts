import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { CreateUserDTO, LoginRequestDTO, UpdateProfileRequestDTO } from '../types/dtos/user/user.request.dto';
import { LocationUpdateRequestDTO } from '../types/dtos/location.dto';
import { AdminResponseDTO, BaseUserResponseDTO, BuyerResponseDTO, LoginResponseDTO, SellerResponseDTO, UserResponseDTO } from '../types/dtos/user/user.response.dto';
import { UserEntity, SellerEntity, BuyerEntity, AdminEntity } from '../types/entities/user.entity';
import { UserRole, VerificationStatus } from '../types/enums';
import { DBLocation, Location, LocationResponse } from '../types/location';
import { signToken } from '../utils/jwt';
import { EWalletDetails, EWalletUpdateRequestDTO } from '../types/ewallet';

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

// Helper function to map entities to UserResponseDTO
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
            ...baseUserDTO,
        };
        finalUserResponse = adminResponse;
    } else {
        finalUserResponse = baseUserDTO;
    }

    return finalUserResponse;
}

// Register a new user
export const registerUser = async (userData: CreateUserDTO): Promise<LoginResponseDTO> => {
    if (![UserRole.Buyer, UserRole.Seller, UserRole.Admin].includes(userData.role)) {
        console.error('Attempted to register with an unsupported role:', userData.role);
        throw new Error('Unsupported user role during registration.');
    }

    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        // Default email if none provided, based on phone (e.g., "09123456789@agrisense.com")
        const finalEmail = userData.email || `${userData.phone.replace(/\D/g, '')}@agrisense.com`;
        const initialLocationData: { lat: number; lng: number; address: string } = { lat: 14.5995, lng: 120.9842, address: 'Philippines' };
        const initialDBLocation: DBLocation = {
            type: 'Point',
            coordinates: [initialLocationData.lng, initialLocationData.lat], // GeoJSON: [longitude, latitude]
            properties: { address: initialLocationData.address }
        }
        const initialAvatar: string | null = null;

        // 1. Insert into `users` table
        const userTableResult = await client.query<UserEntity>(
            `INSERT INTO users (name, phone, email, password, role, avatar, location, created_at, updated_at, ewallet_details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8)
             RETURNING *`,
            [
                userData.name,
                userData.phone,
                finalEmail,
                hashedPassword,
                userData.role,
                initialAvatar,
                JSON.stringify(initialDBLocation),
                null
            ]
        );
        const newUserEntity: UserEntity = userTableResult.rows[0];

        let roleSpecificEntity: SellerEntity | BuyerEntity | AdminEntity | undefined;

        // 2. Conditionally insert into role-specific table with default values
        if (newUserEntity.role === UserRole.Seller) {
            const businessName = `${newUserEntity.name}'s Farm`;
            const initialIsVerified = false;
            const initialVerificationStatus: VerificationStatus = VerificationStatus.Pending;
            const initialCredentials = JSON.stringify({ documents: [], businessLicense: null, farmCertificate: null, governmentId: '' });
            const initialRating = 0.0;
            const initialReviewCount = 0;
            const initialTotalSales = 0;

            const sellerResult = await client.query<SellerEntity>(
                `INSERT INTO sellers (user_id, business_name, is_verified, verification_status, credentials, rating, review_count, total_sales)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [
                    newUserEntity.id,
                    businessName,
                    initialIsVerified,
                    initialVerificationStatus,
                    initialCredentials,
                    initialRating,
                    initialReviewCount,
                    initialTotalSales,
                ]
            );
            roleSpecificEntity = sellerResult.rows[0];

        } else if (newUserEntity.role === UserRole.Buyer) {
            const initialPurchaseHistory = JSON.stringify([]);
            const initialFavoriteProducts = JSON.stringify([]);

            const buyerResult = await client.query<BuyerEntity>(
                `INSERT INTO buyers (user_id, purchase_history, favorite_products)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [
                    newUserEntity.id,
                    initialPurchaseHistory,
                    initialFavoriteProducts,
                ]
            );
            roleSpecificEntity = buyerResult.rows[0];

        } else if (newUserEntity.role === UserRole.Admin) {
            console.log(`Admin user ${newUserEntity.id} registered. No separate admin table specific fields to initialize.`);
        }

        await client.query('COMMIT');

        // 3. Generate JWT Token
        const token = signToken({
            id: newUserEntity.id,
            role: newUserEntity.role,
            email: newUserEntity.email,
        });

        // 4. Map entities to the unified UserResponseDTO
        const userResponse: UserResponseDTO = await mapUserAndRoleEntityToUserResponseDTO(newUserEntity, roleSpecificEntity);

        // 5. Return the complete LoginResponseDTO
        return { user: userResponse, token };

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Registration failed, transaction rolled back:', error);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const loginUser = async (credentials: LoginRequestDTO): Promise<LoginResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        // 1. Find user by phone number
        const userResult = await client.query<UserEntity>(
            `SELECT * FROM users WHERE phone = $1`,
            [credentials.phone]
        );

        const userEntity: UserEntity = userResult.rows[0];

        if (!userEntity) {
            throw new Error('Invalid credentials'); // User not found
        }

        // 2. Compare passwords
        const isPasswordValid = await bcrypt.compare(credentials.password, userEntity.password);

        if (!isPasswordValid) {
            throw new Error('Invalid credentials'); // Password mismatch
        }

        // 3. Fetch role-specific data (if applicable)
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
        } else if (userEntity.role === UserRole.Admin) {
            console.log(`Admin user ${userEntity.id} logged in. No separate admin table data fetched.`);
        }

        // 4. Generate JWT Token
        const token = signToken({
            id: userEntity.id,
            role: userEntity.role,
            email: userEntity.email,
        });

        // 5. Map entities to the unified UserResponseDTO
        const userResponse: UserResponseDTO = await mapUserAndRoleEntityToUserResponseDTO(userEntity, roleSpecificEntity);

        // 6. Return the complete LoginResponseDTO
        return { user: userResponse, token };

    } catch (error) {
        console.error('Login failed:', error);
        throw new Error('Invalid mobile number or password.');
    } finally {
        if (client) {
            client.release();
        }
    }
};


export const updateUserProfile = async (userId: string, updates: UpdateProfileRequestDTO): Promise<UserResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        // --- Update users table fields ---
        if (updates.name !== undefined) {
            updateFields.push(`name = $${paramIndex++}`);
            updateValues.push(updates.name);
        }
        if (updates.email !== undefined) {
            // Check for duplicate email if it's being updated
            const emailCheck = await client.query(
                'SELECT id FROM users WHERE email = $1 AND id != $2', [updates.email, userId]);
            if (emailCheck.rows.length > 0) {
                throw new Error('Email already in use.');
            }
            updateFields.push(`email = $${paramIndex++}`);
            updateValues.push(updates.email);
        }
        if (updates.phone !== undefined) {
            // Check for duplicate phone if it's being updated
            const phoneCheck = await client.query('SELECT id FROM users WHERE phone = $1 AND id != $2', [updates.phone, userId]);
            if (phoneCheck.rows.length > 0) {
                throw new Error('Phone number already in use.');
            }
            updateFields.push(`phone = $${paramIndex++}`);
            updateValues.push(updates.phone);
        }


        // --- Update location address ---
        if (updates.location && updates.location.address !== undefined) {
            const currentUserLocationResult = await client.query<{ location: DBLocation | null }>('SELECT location FROM users WHERE id = $1', [userId]);
            const currentDBLocation = currentUserLocationResult.rows[0]?.location;

            if (!currentDBLocation) {
                const defaultLocation: DBLocation = {
                    type: 'Point',
                    coordinates: [0, 0],
                    properties: { address: 'Unknown Address' }
                };
                const updatedDBLocation: DBLocation = {
                    ...defaultLocation,
                    properties: {
                        ...defaultLocation.properties,
                        address: updates.location.address
                    }
                };
                updateFields.push(`location = $${paramIndex++}`);
                updateValues.push(JSON.stringify(updatedDBLocation));
            } else {
                const updatedDBLocation: DBLocation = {
                    ...currentDBLocation,
                    properties: {
                        ...(currentDBLocation.properties || {}),
                        address: updates.location.address
                    }
                };
                updateFields.push(`location = $${paramIndex++}`);
                updateValues.push(JSON.stringify(updatedDBLocation));
            }
        }
        updateFields.push(`updated_at = NOW()`);


        if (updateFields.length > 0) {
            const userUpdateQuery = `
                UPDATE users
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex++}
                RETURNING *;
            `;
            updateValues.push(userId);
            const updatedUserResult = await client.query<UserEntity>(userUpdateQuery, updateValues);
            if (updatedUserResult.rows.length === 0) {
                throw new Error('User not found or nothing to update.');
            }
        } else {
            const currentUserResult = await client.query<UserEntity>('SELECT * FROM users WHERE id = $1', [userId]);
            if (currentUserResult.rows.length === 0) {
                throw new Error('User not found.');
            }
        }

        const finalUserResult = await client.query<UserEntity>(
            `SELECT * FROM users WHERE id = $1`,
            [userId]
        );
        const finalUserEntity: UserEntity = finalUserResult.rows[0];

        let roleSpecificEntity: SellerEntity | BuyerEntity | AdminEntity | undefined;
        if (finalUserEntity.role === UserRole.Seller) {
            const sellerResult = await client.query<SellerEntity>(`SELECT * FROM sellers WHERE user_id = $1`, [finalUserEntity.id]);
            roleSpecificEntity = sellerResult.rows[0];
        } else if (finalUserEntity.role === UserRole.Buyer) {
            const buyerResult = await client.query<BuyerEntity>(`SELECT * FROM buyers WHERE user_id = $1`, [finalUserEntity.id]);
            roleSpecificEntity = buyerResult.rows[0];
        }

        const updatedUserResponse = await mapUserAndRoleEntityToUserResponseDTO(finalUserEntity, roleSpecificEntity);

        await client.query('COMMIT');
        return updatedUserResponse;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Update profile failed:', error);
        if (error.code === '23505') {
            if (error.detail && error.detail.includes('email')) {
                throw new Error('This email is already in use by another account.');
            }
            if (error.detail && error.detail.includes('phone')) {
                throw new Error('This phone number is already in use by another account.');
            }
        }
        throw new Error(error.message || 'Failed to update profile due to an unexpected error.');
    } finally {
        if (client) {
            client.release();
        }
    }
};



export const updateUserLocationInDB = async (userId: string, updates: LocationUpdateRequestDTO): Promise<UserResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch the current user's entire location JSONB object
        const currentUserLocationResult = await client.query<{ location: DBLocation | null }>('SELECT location FROM users WHERE id = $1', [userId]);
        const currentDBLocation = currentUserLocationResult.rows[0]?.location;

        if (!currentDBLocation && (updates.lat !== undefined || updates.lng !== undefined || updates.address !== undefined)) {
            console.warn(`User ${userId} attempting to update location without existing data. Initializing new location object.`);
        }

        const updatedDBLocation: DBLocation = {
            type: currentDBLocation?.type || 'Point',
            coordinates: currentDBLocation?.coordinates || [0, 0],
            properties: {
                ...(currentDBLocation?.properties || {}),
                address: currentDBLocation?.properties?.address || null
            }
        };

        if (updates.lat !== undefined && updates.lng !== undefined) {
            updatedDBLocation.coordinates = [updates.lng, updates.lat];
        } else if (updates.lat !== undefined) {
            updatedDBLocation.coordinates[1] = updates.lat;
        } else if (updates.lng !== undefined) {
            updatedDBLocation.coordinates[0] = updates.lng;
        }

        if (updates.address !== undefined) {
            updatedDBLocation.properties.address = updates.address;
        } else if (updates.address === null) {
            updatedDBLocation.properties.address = null;
        }


        // 2. Update the 'location' column in the users table
        const userUpdateQuery = `
            UPDATE users
            SET location = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *;
        `;
        const updatedUserResult = await client.query<UserEntity>(userUpdateQuery, [updatedDBLocation, userId]);

        if (updatedUserResult.rows.length === 0) {
            throw new Error('User not found or location update failed.');
        }

        const finalUserEntity: UserEntity = updatedUserResult.rows[0];

        // 3. Fetch role-specific data (if necessary, for a complete UserResponseDTO)
        let roleSpecificEntity: SellerEntity | BuyerEntity | AdminEntity | undefined;
        if (finalUserEntity.role === UserRole.Seller) {
            const sellerResult = await client.query<SellerEntity>(`SELECT * FROM sellers WHERE user_id = $1`, [finalUserEntity.id]);
            roleSpecificEntity = sellerResult.rows[0];
        } else if (finalUserEntity.role === UserRole.Buyer) {
            const buyerResult = await client.query<BuyerEntity>(`SELECT * FROM buyers WHERE user_id = $1`, [finalUserEntity.id]);
            roleSpecificEntity = buyerResult.rows[0];
        }

        // 4. Map to DTO and commit
        const updatedUserResponse = await mapUserAndRoleEntityToUserResponseDTO(finalUserEntity, roleSpecificEntity);

        await client.query('COMMIT');
        return updatedUserResponse;

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK'); // Rollback on error
        }
        console.error('Update user location failed:', error);
        throw error; // Re-throw for controller to handle
    } finally {
        if (client) {
            client.release();
        }
    }
};


export const updateUserEWalletDetailsInDB = async (userId: string, updates: EWalletUpdateRequestDTO): Promise<UserResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch current eWalletDetails
        const currentUserResult = await client.query<{ eWalletDetails: any | null }>('SELECT "eWalletDetails" FROM users WHERE id = $1', [userId]);
        const currentEWalletDetails = currentUserResult.rows[0]?.eWalletDetails;

        const updatedEWalletDetails = {
            provider: currentEWalletDetails?.provider || null,
            accountNumber: currentEWalletDetails?.accountNumber || null,
            accountName: currentEWalletDetails?.accountName || null,
            qrCodeImage: currentEWalletDetails?.qrCodeImage || null,
        };

        if (updates.provider !== undefined) updatedEWalletDetails.provider = updates.provider;
        if (updates.accountNumber !== undefined) updatedEWalletDetails.accountNumber = updates.accountNumber;
        if (updates.accountName !== undefined) updatedEWalletDetails.accountName = updates.accountName;
        if (updates.qrCodeImage !== undefined) {
            updatedEWalletDetails.qrCodeImage = updates.qrCodeImage;
        }
        const finalEWalletDetails = (updatedEWalletDetails.provider || updatedEWalletDetails.accountNumber || updatedEWalletDetails.accountName || updatedEWalletDetails.qrCodeImage) ? updatedEWalletDetails : null;


        // 2. Update the 'eWalletDetails' column in the users table
        const userUpdateQuery = `
      UPDATE users
      SET "eWalletDetails" = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
        const updatedUserResult = await client.query<UserEntity>(userUpdateQuery, [finalEWalletDetails, userId]);

        if (updatedUserResult.rows.length === 0) {
            throw new Error('User not found or e-wallet update failed.');
        }

        const finalUserEntity: UserEntity = updatedUserResult.rows[0];

        // 3. Fetch role-specific data (necessary for a complete UserResponseDTO)
        let roleSpecificEntity: SellerEntity | BuyerEntity | AdminEntity | undefined;
        if (finalUserEntity.role === UserRole.Seller) {
            const sellerResult = await client.query<SellerEntity>(`SELECT * FROM sellers WHERE user_id = $1`, [finalUserEntity.id]);
            roleSpecificEntity = sellerResult.rows[0];
        } else if (finalUserEntity.role === UserRole.Buyer) {
            const buyerResult = await client.query<BuyerEntity>(`SELECT * FROM buyers WHERE user_id = $1`, [finalUserEntity.id]);
            roleSpecificEntity = buyerResult.rows[0];
        }

        // 4. Map to DTO and commit
        const updatedUserResponse = await mapUserAndRoleEntityToUserResponseDTO(finalUserEntity, roleSpecificEntity);

        await client.query('COMMIT');
        return updatedUserResponse;

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Update user e-wallet details failed:', error);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
};