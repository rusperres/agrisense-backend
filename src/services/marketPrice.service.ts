// src/services/marketPrice.service.ts

import { NewMarketPrice, MarketPriceEntity } from '../types/entities/marketPrice.entity';
import { insertMarketPrices, findMarketPricesByDate, findLatestMarketPriceByCrop, findHistoricalMarketPricesByCrop } from '../models/marketPrice.model';
import { CreateMarketPriceDTO } from '../types/dtos/marketPrice.dto';
import { PoolClient } from 'pg';
import { pool } from '../config/db';


// ============== DATA SCRAPING FUNCTIONS ====================
/**
 * Saves an array of market price data to the database.
 * This service layer can include validation or transformation logic if necessary.
 *
 * @param marketPrices An array of NewMarketPrice objects.
 * @returns A Promise resolving to the saved MarketPriceEntity objects (with IDs).
 */
export const saveMarketPrices = async (marketPrices: NewMarketPrice[]): Promise<MarketPriceEntity[]> => {
  console.log(`[MarketPrice Service] Attempting to save ${marketPrices.length} market prices.`);
  try {
    const savedPrices = await insertMarketPrices(marketPrices);
    console.log(`[MarketPrice Service] Successfully saved ${savedPrices.length} prices.`);
    return savedPrices;
  } catch (error: any) {
    console.error(`[MarketPrice Service] Error saving market prices: ${error.message}`);
    throw new Error('Could not save market prices.');
  }
};

/**
 * Retrieves market prices from the database for a specific date, with optional region, crop, and specification filters.
 * @param date The date to retrieve prices for (YYYY-MM-DD).
 * @param region Optional region filter.
 * @param crop_name Optional crop name filter.
 * @param specification Optional specification filter.
 * @returns A Promise resolving to an array of MarketPriceEntity objects.
 */
export const getMarketPricesByDate = async (
  date: string,
  region?: string,
  crop_name?: string,
  specification?: string
): Promise<MarketPriceEntity[]> => {
  console.log(`[MarketPrice Service] Fetching market prices for date: ${date}`);
  try {
    const prices = await findMarketPricesByDate(date, region, crop_name, specification);
    console.log(`[MarketPrice Service] Found ${prices.length} market prices.`);
    return prices;
  } catch (error: any) {
    console.error(`[MarketPrice Service] Error fetching market prices: ${error.message}`);
    throw new Error('Could not retrieve market prices.');
  }
};

/**
 * Retrieves the latest market price for a given crop.
 * @param cropName The name of the crop.
 * @param specification Optional specification to filter by.
 * @returns A Promise resolving to the latest MarketPriceEntity or null.
 */
export const getLatestMarketPrice = async (
  cropName: string,
  specification?: string
): Promise<MarketPriceEntity | null> => {
  console.log(`[MarketPrice Service] Fetching latest market price for crop: ${cropName} (spec: ${specification || 'N/A'})`);
  try {
    const price = await findLatestMarketPriceByCrop(cropName, specification);
    return price;
  } catch (error: any) {
    console.error(`[MarketPrice Service] Error fetching latest market price for ${cropName} (spec: ${specification || 'N/A'}): ${error.message}`);
    throw new Error('Could not retrieve latest market price.');
  }
};

/**
 * Retrieves historical market prices for a given crop within a specified limit.
 * @param cropName The name of the crop.
 * @param limit The maximum number of historical records to retrieve (default: 180 days).
 * @param specification Optional specification to filter by.
 * @returns A Promise resolving to an array of MarketPriceEntity objects.
 */
export const getHistoricalMarketPrices = async (
  cropName: string,
  limit: number = 180,
  specification?: string
): Promise<MarketPriceEntity[]> => {
  console.log(`[MarketPrice Service] Fetching historical market prices for crop: ${cropName}, limit: ${limit} (spec: ${specification || 'N/A'})`);
  try {
    const prices = await findHistoricalMarketPricesByCrop(cropName, limit, specification);
    return prices;
  } catch (error: any) {
    console.error(`[MarketPrice Service] Error fetching historical market prices for ${cropName} (spec: ${specification || 'N/A'}): ${error.message}`);
    throw new Error('Could not retrieve historical market prices.');
  }
};

// ========================== END OF DATA SCRAPING FUNCTIONS ========================

export const fetchMarketPrices = async (): Promise<MarketPriceEntity[]> => {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    const result = await client.query<MarketPriceEntity>(
      `SELECT * FROM market_prices ORDER BY date DESC, created_at DESC;`
    );
    const marketPrices: MarketPriceEntity[] = result.rows;

    return marketPrices;

  } catch (error: any) {
    console.error('Error fetching market prices:', error);
    throw new Error(error.message || 'Failed to fetch market prices.');
  } finally {
    if (client) {
      client.release();
    }
  }
};
