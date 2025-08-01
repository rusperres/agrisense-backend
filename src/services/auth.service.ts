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
import { fromDBLocation } from './utils/location.map';
import { SellerVerificationRequestDTO } from '../types/dtos/verification.dto';


const mapDBLocationToFrontendLocation = (dbLocation: any | null): Location | null => {
    if (!dbLocation) {
        return null;
    }

    // Ensure dbLocation is an object if it was stored as JSON string
    let parsedLocation = dbLocation;
    if (typeof dbLocation === 'string') {
        try {
            parsedLocation = JSON.parse(dbLocation);
        } catch (e) {
            console.error("Error parsing location JSON:", e);
            return null;
        }
    }

    // Check if coordinates and properties exist before accessing
    if (parsedLocation && parsedLocation.coordinates && Array.isArray(parsedLocation.coordinates) && parsedLocation.coordinates.length >= 2) {
        return {
            lat: parsedLocation.coordinates[1], // Latitude is typically second in [lng, lat]
            lng: parsedLocation.coordinates[0], // Longitude is typically first in [lng, lat]
            address: parsedLocation.properties?.address || 'Unknown Address'
        };
    }
    return null;
};

// Helper function to map entities to UserResponseDTO
export const mapUserAndRoleEntityToUserResponseDTO = (
    userEntity: UserEntity,
    roleSpecificEntity?: SellerEntity | BuyerEntity | AdminEntity
): UserResponseDTO => {

    let mappedLocation: Location | null = null;
    // Assuming the location is now fetched as 'location_geojson' which is a JSON string or null
    const rawGeoJsonString = (userEntity as any).location_geojson;

    // Safely parse the GeoJSON string from the DB before passing to fromDBLocation
    if (rawGeoJsonString !== null && typeof rawGeoJsonString === 'string') {
        try {
            const processedLocation: DBLocation = JSON.parse(rawGeoJsonString) as DBLocation;
            mappedLocation = fromDBLocation(processedLocation);
        } catch (e) {
            console.error("Error parsing GeoJSON string from DB (ST_AsGeoJSON output expected):", rawGeoJsonString, e);
            // mappedLocation remains null
        }
    } else if (rawGeoJsonString !== null && typeof rawGeoJsonString === 'object') {
        // In some cases, if the driver auto-parses JSONB, it might already be an object.
        // Or if location was originally JSONB, it might be returned as object.
        // If it's an object, directly pass it to fromDBLocation assuming it's DBLocation.
        mappedLocation = fromDBLocation(rawGeoJsonString as DBLocation);
    }
    // If rawGeoJsonString is null or undefined, mappedLocation correctly remains null


    const baseUser: BaseUserResponseDTO = {
        id: userEntity.id,
        email: userEntity.email || '',
        phone: userEntity.phone,
        name: userEntity.name,
        role: userEntity.role,
        location: mappedLocation, // Use the safely mapped location
        avatar: userEntity.avatar || undefined,
        createdAt: userEntity.created_at, // Ensure consistency with DB column name
        updatedAt: userEntity.updated_at, // Ensure consistency with DB column name
        eWalletDetails: userEntity.eWalletDetails // Ensure consistency with DB column name
    };

    if (userEntity.role === UserRole.Seller && roleSpecificEntity) {
        const sellerEntity = roleSpecificEntity as SellerEntity;
        const seller: SellerResponseDTO = {
            ...baseUser,
            businessName: sellerEntity.business_name || '',
            isVerified: sellerEntity.is_verified,
            verificationStatus: sellerEntity.verification_status,
            credentials: sellerEntity.credentials,
            rating: sellerEntity.rating,
            reviewCount: sellerEntity.review_count,
            totalSales: sellerEntity.total_sales,
        };
        return seller;
    } else if (userEntity.role === UserRole.Buyer && roleSpecificEntity) {
        const buyerEntity = roleSpecificEntity as BuyerEntity;
        const buyer: BuyerResponseDTO = {
            ...baseUser,
            purchaseHistory: buyerEntity.purchase_history || [],
            favoriteProducts: buyerEntity.favorite_products || [],
        };
        return buyer;
    } else if (userEntity.role === UserRole.Admin && roleSpecificEntity) {
        // Admin type directly extends BaseUser, so no extra properties from entity currently
        const admin: AdminResponseDTO = {
            ...baseUser,
            // Add any admin-specific properties here if they exist in AdminEntity
        };
        return admin;
    } else {
        return baseUser;
    }
};

/**
 * Fetches a complete user profile by ID, including role-specific details.
 * @param userId The ID of the user to fetch.
 * @returns A Promise that resolves to the complete UserResponseDTO.
 */
export const fetchUserProfileById = async (userId: string): Promise<UserResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // 1. Fetch the base user entity
        const userResult = await client.query<UserEntity>(
            `SELECT * FROM users WHERE id = $1;`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User not found.');
        }

        const baseUserEntity: UserEntity = userResult.rows[0];

        // 2. Fetch role-specific data based on user role
        let roleSpecificEntity: SellerEntity | BuyerEntity | AdminEntity | undefined;
        if (baseUserEntity.role === UserRole.Seller) {
            const sellerResult = await client.query<SellerEntity>(
                `SELECT * FROM sellers WHERE user_id = $1;`,
                [userId]
            );
            roleSpecificEntity = sellerResult.rows[0];
        } else if (baseUserEntity.role === UserRole.Buyer) {
            const buyerResult = await client.query<BuyerEntity>(
                `SELECT * FROM buyers WHERE user_id = $1;`,
                [userId]
            );
            roleSpecificEntity = buyerResult.rows[0];
        } else if (baseUserEntity.role === UserRole.Admin) {
            const adminResult = await client.query<AdminEntity>(
                `SELECT * FROM admins WHERE user_id = $1;`,
                [userId]
            );
            roleSpecificEntity = adminResult.rows[0];
        }

        // 3. Map to UserResponseDTO using a helper function (if you have one, otherwise inline)
        const userResponseDTO = mapUserAndRoleEntityToUserResponseDTO(baseUserEntity, roleSpecificEntity);

        await client.query('COMMIT'); // Commit transaction
        return userResponseDTO;

    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK'); // Rollback on error
        }
        console.error('Error fetching user profile by ID:', error);
        throw new Error(error.message || 'Failed to fetch user profile.');
    } finally {
        if (client) {
            client.release();
        }
    }
};


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
        // Use ST_GeomFromGeoJSON to insert the GeoJSON string into a GEOMETRY column,
        // then cast to GEOGRAPHY.
        // Use ST_AsGeoJSON(location)::text to retrieve the GEOGRAPHY as a GeoJSON string
        const userTableResult = await client.query<any>( // Use 'any' to handle the extra 'location_geojson_text' field
            `INSERT INTO users (name, phone, email, password, role, avatar, location, created_at, updated_at, ewallet_details)
             VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326)::geography, NOW(), NOW(), $8)
             RETURNING *, ST_AsGeoJSON(location)::text AS location_geojson_text`,
            [
                userData.name,
                userData.phone,
                finalEmail,
                hashedPassword,
                userData.role,
                initialAvatar,
                JSON.stringify(initialDBLocation), // $7 is the GeoJSON string
                null
            ]
        );
        const newUserEntityFromDB: any = userTableResult.rows[0];

        // Manually reconstruct newUserEntity to include the parsed location as DBLocation type
        const newUserEntity: UserEntity = {
            ...newUserEntityFromDB, // Copy all existing fields
            // Parse the 'location_geojson_text' back into the 'location' property as a DBLocation object
            location: newUserEntityFromDB.location_geojson_text ?
                JSON.parse(newUserEntityFromDB.location_geojson_text) as DBLocation :
                null
        };

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
            const initialPurchaseHistory: string[] = [];
            const initialFavoriteProducts: string[] = [];

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
            name: newUserEntity.name,
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
        // Add ST_AsGeoJSON(location)::text as location_geojson_text
        const userResult = await client.query<UserEntity & { location_geojson_text: string }>(
            `SELECT *, ST_AsGeoJSON(location)::text AS location_geojson_text FROM users WHERE phone = $1`,
            [credentials.phone]
        );

        const userEntityFromDB = userResult.rows[0];

        if (!userEntityFromDB) {
            throw new Error('Invalid credentials'); // User not found
        }

        // Manually reconstruct userEntity to include the parsed location as DBLocation type
        const userEntity: UserEntity = {
            ...userEntityFromDB, // Copy all existing fields
            // Parse the 'location_geojson_text' back into the 'location' property as a DBLocation object
            location: userEntityFromDB.location_geojson_text ?
                JSON.parse(userEntityFromDB.location_geojson_text) as DBLocation :
                null
        };

        // ... rest of the loginUser function remains the same
        // (continue from '2. Compare passwords' using userEntity)
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

export const submitSellerVerification = async (userId: string, updates: SellerVerificationRequestDTO): Promise<UserResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Check if the user is a seller
        const userCheckQuery = await client.query<UserEntity>('SELECT role FROM users WHERE id = $1', [userId]);
        if (userCheckQuery.rows.length === 0 || userCheckQuery.rows[0].role !== UserRole.Seller) {
            throw new Error('User is not a seller and cannot be verified.');
        }

        // Prepare the credentials object to be stored as JSONB
        const credentialsJson = JSON.stringify(updates.credentials);

        // Update the sellers table with the business name and verification status
        const sellerUpdateQuery = `
            UPDATE sellers
            SET
                business_name = $1,
                credentials = $2,
                verification_status = $3
            WHERE user_id = $4
            RETURNING *;
        `;

        const sellerUpdateResult = await client.query<SellerEntity>(sellerUpdateQuery, [
            updates.businessName,
            credentialsJson,
            updates.verificationStatus,
            userId
        ]);

        if (sellerUpdateResult.rows.length === 0) {
            throw new Error('Seller profile not found or update failed.');
        }

        // Fetch the user and role-specific data for a complete DTO response
        const userEntityResult = await client.query<UserEntity>('SELECT * FROM users WHERE id = $1', [userId]);
        const userEntity = userEntityResult.rows[0];
        const sellerEntity = sellerUpdateResult.rows[0];

        const updatedUser = await mapUserAndRoleEntityToUserResponseDTO(userEntity, sellerEntity);

        await client.query('COMMIT');
        return updatedUser;
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Submit seller verification failed:', error);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
};