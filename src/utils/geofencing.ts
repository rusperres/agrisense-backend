import { pool } from '../config/db';
import { Location, User, Product } from '../types/types';

/**
 * Find nearby sellers based on a user's coordinates and search radius.
 * 
 * @param coordinates [lng, lat] of the reference location
 * @param radius radius in meters
 * @returns array of seller users within radius
 */
export const findNearbySellers = async (
  coordinates: [number, number],
  radius: number
): Promise<User[]> => {
  const [lng, lat] = coordinates;

  const result = await pool.query<User>(
    `
    SELECT *, ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance
    FROM users
    WHERE role = 'seller'
      AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    ORDER BY distance ASC
    `,
    [lng, lat, radius]
  );

  return result.rows;
};

/**
 * Find nearby products based on a reference location and radius.
 * 
 * @param coordinates [lng, lat] of the reference location
 * @param radius radius in meters
 * @returns array of products within radius
 */
export const findNearbyProducts = async (
  coordinates: [number, number],
  radius: number
): Promise<Product[]> => {
  const [lng, lat] = coordinates;

  const result = await pool.query<Product>(
    `
    SELECT *, ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance
    FROM products
    WHERE is_active = true
      AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    ORDER BY distance ASC
    `,
    [lng, lat, radius]
  );

  return result.rows;
};
