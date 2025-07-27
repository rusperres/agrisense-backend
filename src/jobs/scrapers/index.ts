// src/jobs/scrapers/index.ts

import { NewMarketPrice } from '../../types/entities/marketPrice.entity';
import { scrapeNcrPrices } from './ncr';
// import { scrapeRegionXPrices } from './regionX'; // Uncomment when implemented

export interface RegionalSources {
  ncrPdfPath?: string;
  regionXApiData?: any;
  // Add other source types as needed for other regions
}

/**
 * Initiates the scraping process for market prices across one or more defined regions.
 * It receives an object containing various pre-acquired source data/paths
 * and passes the relevant one to each regional scraper.
 *
 * @param sources An object containing specific source data/paths for each region.
 * @param date The date of the market data (YYYY-MM-DD format).
 * @param region An optional parameter to specify a particular region to scrape.
 * If not provided, all active regions will be scraped.
 * @returns A Promise that resolves to an array of NewMarketPrice objects from the scraped region(s).
 */
export const initiateRegionalScrape = async ( // <--- RENAMED FROM scrapeRegions
  sources: RegionalSources,
  date: string,
  region?: string
): Promise<NewMarketPrice[]> => {
  console.log(`[GLOBAL SCRAPER] Initiating regional scrape for date: ${date}${region ? ` (Region: ${region})` : ' (All Active Regions)'}`);
  let allMarketPrices: NewMarketPrice[] = [];

  // --- NCR Region ---
  if (!region || region.toLowerCase() === 'ncr') {
    if (!sources.ncrPdfPath) {
      console.warn('[GLOBAL SCRAPER] NCR PDF path is missing in sources. Skipping NCR scrape.');
    } else {
      try {
        console.log('[GLOBAL SCRAPER] Running NCR price scraper...'); // Adjusted log for clarity
        const ncrPrices = await scrapeNcrPrices(sources.ncrPdfPath, date);
        if (ncrPrices.length > 0) {
          allMarketPrices.push(...ncrPrices);
          console.log(`[GLOBAL SCRAPER] Successfully scraped ${ncrPrices.length} items from NCR.`);
        } else {
          console.warn('[GLOBAL SCRAPER] NCR scraper returned no market prices.');
        }
      } catch (error: any) {
        console.error(`[GLOBAL SCRAPER] Error scraping NCR: ${error.message}`);
      }
    }
  }

  // --- Region X Example ---
  if (!region || region.toLowerCase() === 'regionx') {
    if (!sources.regionXApiData) {
      console.warn('[GLOBAL SCRAPER] Region X API data is missing in sources. Skipping Region X scrape.');
    } else {
      try {
        console.log('[GLOBAL SCRAPER] Running Region X price scraper...'); // Adjusted log for clarity
        // Uncomment and implement when scrapeRegionXPrices is ready:
        // const regionXPrices = await scrapeRegionXPrices(sources.regionXApiData, date);
        // if (regionXPrices.length > 0) {
        //   allMarketPrices.push(...regionXPrices);
        //   console.log(`[GLOBAL SCRAPER] Successfully scraped ${regionXPrices.length} items from Region X.`);
        // } else {
        //   console.warn('[GLOBAL SCRAPER] Region X scraper returned no market prices.');
        // }
        console.log('[GLOBAL SCRAPER] Region X scraping logic not yet implemented. Placeholder.');
      } catch (error: any) {
        console.error(`[GLOBAL SCRAPER] Error scraping Region X: ${error.message}`);
      }
    }
  }

  if (allMarketPrices.length === 0) {
    console.warn('[GLOBAL SCRAPER] No market prices were successfully scraped during this run from any active region.'); // Adjusted log
  } else {
    console.log(`[GLOBAL SCRAPER] Total market prices collected during this run: ${allMarketPrices.length}`); // Adjusted log
  }

  return allMarketPrices;
};