import { NewMarketPrice } from '../../types/entities/marketPrice.entity';
import { scrapeNcrPrices } from './ncr';

export interface RegionalSources {
  ncrPdfPath?: string;
  regionXApiData?: any;
}

export const initiateRegionalScrape = async (
  sources: RegionalSources,
  date: string,
  region?: string
): Promise<NewMarketPrice[]> => {
  console.log(`[GLOBAL SCRAPER] Initiating regional scrape for date: ${date}${region ? ` (Region: ${region})` : ' (All Active Regions)'}`);
  let allMarketPrices: NewMarketPrice[] = [];

  if (!region || region.toLowerCase() === 'ncr') {
    if (!sources.ncrPdfPath) {
      console.warn('[GLOBAL SCRAPER] NCR PDF path is missing in sources. Skipping NCR scrape.');
    } else {
      try {
        console.log('[GLOBAL SCRAPER] Running NCR price scraper...'); 
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

  if (!region || region.toLowerCase() === 'regionx') {
    if (!sources.regionXApiData) {
      console.warn('[GLOBAL SCRAPER] Region X API data is missing in sources. Skipping Region X scrape.');
    } else {
      try {
        console.log('[GLOBAL SCRAPER] Running Region X price scraper...'); 
        console.log('[GLOBAL SCRAPER] Region X scraping logic not yet implemented. Placeholder.');
      } catch (error: any) {
        console.error(`[GLOBAL SCRAPER] Error scraping Region X: ${error.message}`);
      }
    }
  }

  if (allMarketPrices.length === 0) {
    console.warn('[GLOBAL SCRAPER] No market prices were successfully scraped during this run from any active region.');
  } else {
    console.log(`[GLOBAL SCRAPER] Total market prices collected during this run: ${allMarketPrices.length}`);
  }

  return allMarketPrices;
};
