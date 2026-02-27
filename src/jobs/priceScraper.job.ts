import * as path from 'node:path';
import * as fs from 'node:fs/promises'; 
import axios from 'axios'; 
import { initiateRegionalScrape, RegionalSources } from './scrapers/index';
import { saveMarketPrices } from '../services/marketPrice.service'; 
import { downloadPdf } from './scrapers/utils/pdfDownloader'; 
import { NCR_DA_PDF_BASE_URL /*, REGION_X_API_URL */ } from '../config/env';
import { extractLatestDailyPriceIndexPdfLink } from './scrapers/utils/pdfLinkExtractor';

export const runPriceScraperJob = async () => {
  console.log('[PRICE SCRAPER JOB] Starting daily price scraping job...');

  const today = new Date(); 
  const year = today.getFullYear();
  const monthNumber = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate(); 
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[today.getMonth()];
  const formattedScrapeDate = `${year}-${monthNumber}-${day.toString().padStart(2, '0')}`;
  console.log(`[PRICE SCRAPER JOB] Targeting scrape date: ${formattedScrapeDate}`); 

  const pdfsDirectory = path.join(__dirname, '../../data/pdfs');

  let downloadedNcrPdfPath: string | null = null; 
  
  const regionalSources: RegionalSources = {};

  try {
    const priceMonitoringPageUrl = NCR_DA_PDF_BASE_URL;

    console.log(`[PRICE SCRAPER JOB] Attempting to find NCR PDF link from: ${priceMonitoringPageUrl}`);
    const NCR_PDF_URL = await extractLatestDailyPriceIndexPdfLink(priceMonitoringPageUrl);

    if (NCR_PDF_URL) {
      const ncrPdfFileName = path.basename(NCR_PDF_URL);
      console.log(`[PRICE SCRAPER JOB] Found PDF link: ${NCR_PDF_URL}. Attempting to download with filename: ${ncrPdfFileName}`);
      try {
        downloadedNcrPdfPath = await downloadPdf(NCR_PDF_URL, pdfsDirectory, ncrPdfFileName);
        console.log(`[PRICE SCRAPER JOB] NCR PDF downloaded successfully to: ${downloadedNcrPdfPath}`);
        regionalSources.ncrPdfPath = downloadedNcrPdfPath;
      } catch (pdfDownloadError: any) {
        console.error(`[PRICE SCRAPER JOB] Error downloading NCR PDF from extracted link: ${pdfDownloadError.message}`);
        if (pdfDownloadError.isAxiosError && pdfDownloadError.response && pdfDownloadError.response.status === 404) {
          console.warn(`[PRICE SCRAPER JOB] Downloaded PDF link for ${formattedScrapeDate} returned 404. Skipping NCR scrape.`);
        } else {
          console.error(`[PRICE SCRAPER JOB] Unexpected error during NCR PDF download from extracted link:`, pdfDownloadError);
        }
      }
    } else {
      console.warn('[PRICE SCRAPER JOB] Could not find the latest Daily Price Index PDF link. Skipping NCR scrape.');
    }
    console.log('[PRICE SCRAPER JOB] Passing acquired sources to regional scrape initiator...');
    const marketPrices = await initiateRegionalScrape(regionalSources, formattedScrapeDate);

    if (marketPrices.length > 0) {
      console.log(`[PRICE SCRAPER JOB] Successfully collected ${marketPrices.length} market price entries.`);

      const savedPrices = await saveMarketPrices(marketPrices);
      console.log(`[PRICE SCRAPER JOB] Saved ${savedPrices.length} market price records to the database.`);

    } else {
      console.warn('[PRICE SCRAPER JOB] No market prices were extracted during the job run from any source.');
    }
  } catch (error: any) {
    console.error(`[PRICE SCRAPER JOB] An unhandled error occurred during the price scraping job: ${error.message}`);
    if (!(error.isAxiosError || error.code === 'ENOENT')) {
      console.error(`[PRICE SCRAPER JOB] Unhandled error details:`, error);
    }
  } finally {
    if (downloadedNcrPdfPath) {
      try {
        await fs.unlink(downloadedNcrPdfPath);
        console.log(`[PRICE SCRAPER JOB] Cleaned up downloaded NCR PDF: ${downloadedNcrPdfPath}`);
      } catch (cleanupError: any) {
        console.warn(`[PRICE SCRAPER JOB] Failed to clean up NCR PDF ${downloadedNcrPdfPath}: ${cleanupError.message}`);
      }
    }
  }

  console.log('[PRICE SCRAPER JOB] Daily price scraping job finished.');
};
