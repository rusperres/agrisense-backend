// src/models/marketPrice.model.ts

import { pool } from '../config/db'; // Assuming db.ts exports a PostgreSQL pool
import { MarketPriceEntity, NewMarketPrice } from '../types/entities/marketPrice.entity';
import { MarketTrend } from '../types/enums'; // Import MarketTrend enum

/**
 * Inserts an array of new market price records into the 'market_prices' table.
 * Uses a single prepared statement with UNNEST for efficient bulk insertion.
 * Each insertion will create a new record with a unique 'id',
 * allowing for "almost identical" entries (e.g., same crop, region, date but different price/source).
 *
 * @param marketPrices An array of NewMarketPrice objects to insert.
 * @returns A Promise resolving to the inserted MarketPrice records (with IDs).
 */
export const insertMarketPrices = async (marketPrices: NewMarketPrice[]): Promise<MarketPriceEntity[]> => {
  if (marketPrices.length === 0) {
    console.log('[MarketPrice Model] No market prices to insert.');
    return [];
  }

  // Construct arrays for each column to be unnested
  const cropNames = marketPrices.map(mp => mp.crop_name || null);
  const categories = marketPrices.map(mp => mp.category || null);
  const regions = marketPrices.map(mp => mp.region || null);
  const prices = marketPrices.map(mp => mp.price || null);
  const units = marketPrices.map(mp => mp.unit || null);
  const trends = marketPrices.map(mp => mp.trend || null); // Keep as MarketTrend or cast if needed by DB
  const sources = marketPrices.map(mp => mp.source || null);
  const dates = marketPrices.map(mp => mp.date ? new Date(mp.date) : null); // Ensure date is a Date object if storing as date type
  const specifications = marketPrices.map(mp => mp.specification || null);

  const query = `
    INSERT INTO market_prices (
      crop_name,
      category,
      region,
      price,
      unit,
      trend,
      source,
      date,
      specification
    )
    SELECT
      unnest($1::text[]),
      unnest($2::text[]),
      unnest($3::text[]),
      unnest($4::numeric[]),
      unnest($5::text[]),
      unnest($6::text[]),
      unnest($7::text[]),
      unnest($8::date[]),
      unnest($9::text[])
    RETURNING *; -- Keep RETURNING * to get the newly inserted rows, including their 'id'
  `;

  try {
    const res = await pool.query<MarketPriceEntity>(query, [
      cropNames,
      categories,
      regions,
      prices,
      units,
      trends,
      sources,
      dates,
      specifications
    ]);
    console.log(`[MarketPrice Model] Successfully inserted ${res.rows.length} market price records.`);
    return res.rows;
  } catch (error) {
    console.error('[MarketPrice Model] Error inserting market prices:', error);
    // Be more specific about the error if needed, but for now, re-throwing is fine.
    throw new Error('Failed to insert market prices into database.');
  }
};


/**
 * Finds market prices by date and optionally by region, crop name, and specification.
 * @param date The date to filter by (YYYY-MM-DD string).
 * @param region Optional region to filter by.
 * @param crop_name Optional crop name to filter by.
 * @param specification Optional specification to filter by.
 * @returns A Promise resolving to an array of MarketPriceEntity objects.
 */
export const findMarketPricesByDate = async (
  date: string,
  region?: string,
  crop_name?: string,
  specification?: string // ADDED THIS
): Promise<MarketPriceEntity[]> => {
  let query = `SELECT * FROM market_prices WHERE date = $1`;
  const params: (string | number)[] = [date];
  let paramIndex = 2;

  if (region) {
    query += ` AND region = $${paramIndex}`;
    params.push(region);
    paramIndex++;
  }
  if (crop_name) {
    query += ` AND crop_name ILIKE $${paramIndex}`; // Use ILIKE for case-insensitive search
    params.push(`%${crop_name}%`);
    paramIndex++;
  }
  if (specification) { // ADDED THIS
    query += ` AND specification ILIKE $${paramIndex}`;
    params.push(`%${specification}%`);
    paramIndex++;
  }
  query += ` ORDER BY crop_name, category, specification, id;`; // Added id to order for consistent results

  try {
    const res = await pool.query<MarketPriceEntity>(query, params);
    return res.rows;
  } catch (error) {
    console.error(`[MarketPrice Model] Error finding market prices by date '${date}':`, error);
    throw new Error('Failed to retrieve market prices from database.');
  }
};



/**
 * Finds the latest market price for a given crop name and optional specification,
 * ordered by date descending.
 * @param cropName The name of the crop.
 * @param specification Optional specification to filter by.
 * @returns A Promise resolving to the latest MarketPriceEntity or null if not found.
 */
export const findLatestMarketPriceByCrop = async (
  cropName: string,
  specification?: string
): Promise<MarketPriceEntity | null> => {
  let query = `
    SELECT * FROM market_prices
    WHERE crop_name ILIKE $1
  `;
  const params: (string | number)[] = [`%${cropName}%`];
  let paramIndex = 2;

  if (specification) {
    query += ` AND specification ILIKE $${paramIndex}`;
    params.push(`%${specification}%`);
  }

  query += `
    ORDER BY date DESC, id DESC -- Order by date first, then id for stable results
    LIMIT 1;
  `;

  try {
    const result = await pool.query<MarketPriceEntity>(query, params);
    return result.rows[0] || null;
  } catch (error: any) {
    console.error(`[MarketPrice Model] Error finding latest market price for crop '${cropName}' (spec: ${specification || 'N/A'}): ${error.message}`);
    throw new Error('Database error during latest market price retrieval.');
  }
};

/**
 * Finds historical market prices for a given crop name and optional specification
 * within a specified limit (e.g., last 180 days).
 * @param cropName The name of the crop.
 * @param limit The maximum number of historical records to retrieve.
 * @param specification Optional specification to filter by.
 * @returns A Promise resolving to an array of MarketPriceEntity objects, ordered by date descending.
 */
export const findHistoricalMarketPricesByCrop = async (
  cropName: string,
  limit: number,
  specification?: string
): Promise<MarketPriceEntity[]> => {
  let query = `
    SELECT * FROM market_prices
    WHERE crop_name ILIKE $1
  `;
  const params: (string | number)[] = [`%${cropName}%`];
  let paramIndex = 2;

  if (specification) {
    query += ` AND specification ILIKE $${paramIndex}`;
    params.push(`%${specification}%`);
  }

  query += `
    ORDER BY date DESC, id DESC
    LIMIT $${paramIndex};
  `;

  try {
    const result = await pool.query<MarketPriceEntity>(query, params);
    return result.rows;
  } catch (error: any) {
    console.error(`[MarketPrice Model] Error finding historical market prices for crop '${cropName}' (spec: ${specification || 'N/A'}): ${error.message}`);
    throw new Error('Database error during historical market price retrieval.');
  }
};
