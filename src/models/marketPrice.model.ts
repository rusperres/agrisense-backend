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
  const trends = marketPrices.map(mp => mp.trend || null); // Note: mp.trend is already a string ('up', 'down', etc.)
  const sources = marketPrices.map(mp => mp.source || null);
  const dates = marketPrices.map(mp => mp.date || null);
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
    SELECT *
    FROM UNNEST(
      $1::TEXT[],
      $2::TEXT[],
      $3::TEXT[],
      $4::NUMERIC[],
      $5::TEXT[],
      $6::market_trend[],
      $7::TEXT[],
      $8::DATE[],
      $9::TEXT[]
    ) AS t(crop_name, category, region, price, unit, trend, source, date, specification)
    RETURNING *;
  `;

  const values = [
    cropNames,
    categories,
    regions,
    prices,
    units,
    trends,
    sources,
    dates,
    specifications,
  ];

  try {
    const result = await pool.query<MarketPriceEntity>(query, values);
    console.log(`[MarketPrice Model] Successfully inserted ${result.rowCount} market price records.`);
    return result.rows;
  } catch (error: any) {
    console.error(`[MarketPrice Model] Error inserting market prices:`, error);
    throw new Error('Database error during market price insertion.');
  }
};

/**
 * Finds the latest market price record for a given crop and optional specification.
 * @param cropName The name of the crop.
 * @param specification Optional specification to filter by.
 * @returns A Promise resolving to the latest MarketPriceEntity object, or null if not found.
 */
export const findLatestMarketPriceByCrop = async (
  cropName: string,
  specification?: string
): Promise<MarketPriceEntity | null> => {
  let query = `
    SELECT *
    FROM market_prices
    WHERE crop_name ILIKE $1
  `;
  const params: (string | number)[] = [`%${cropName}%`];
  let paramIndex = 2;

  if (specification) {
    query += ` AND specification ILIKE $${paramIndex}`;
    params.push(`%${specification}%`);
    paramIndex++;
  }

  query += `
    ORDER BY date DESC, id DESC
    LIMIT 1;
  `;

  try {
    const result = await pool.query<MarketPriceEntity>(query, params);
    return result.rows[0] || null;
  } catch (error: any) {
    console.error(`[MarketPrice Model] Error retrieving latest price for crop '${cropName}' (spec: ${specification || 'N/A'}): ${error.message}`);
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
    paramIndex++;
  }

  query += `
    ORDER BY date DESC, id DESC
    LIMIT $${paramIndex};
  `;
  params.push(limit);


  try {
    const result = await pool.query<MarketPriceEntity>(query, params);
    return result.rows;
  } catch (error: any) {
    console.error(`[MarketPrice Model] Error retrieving historical prices for crop '${cropName}' (limit: ${limit}):`, error);
    throw new Error('Database error during historical market price retrieval.');
  }
};

/**
 * Finds all market price records for a specific date, with optional filters.
 * @param date The date to query for (in 'YYYY-MM-DD' format).
 * @param region Optional region to filter by.
 * @param cropName Optional crop name to filter by.
 * @param specification Optional specification to filter by.
 * @returns A Promise resolving to an array of MarketPriceEntity objects.
 */
export const findMarketPricesByDate = async (
  date: string,
  region?: string,
  cropName?: string,
  specification?: string
): Promise<MarketPriceEntity[]> => {
  let query = `
    SELECT * FROM market_prices
    WHERE date = $1
  `;
  const values = [date];
  let paramIndex = 2;

  if (region) {
    query += ` AND region ILIKE $${paramIndex}`;
    values.push(`%${region}%`);
    paramIndex++;
  }

  if (cropName) {
    query += ` AND crop_name ILIKE $${paramIndex}`;
    values.push(`%${cropName}%`);
    paramIndex++;
  }

  if (specification) {
    query += ` AND specification ILIKE $${paramIndex}`;
    values.push(`%${specification}%`);
    paramIndex++;
  }

  query += `
    ORDER BY crop_name ASC, category ASC;
  `;

  try {
    const result = await pool.query<MarketPriceEntity>(query, values);
    return result.rows;
  } catch (error: any) {
    console.error(`[MarketPrice Model] Error retrieving market prices for date '${date}':`, error);
    throw new Error('Database error during price retrieval by date.');
  }
};
