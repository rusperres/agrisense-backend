// src/jobs/priceScraperjob.ts

import * as path from 'node:path';
import * as fs from 'node:fs/promises'; // For PDF cleanup
import axios from 'axios'; // For making HTTP requests to APIs (e.g., for Region X)
import { initiateRegionalScrape, RegionalSources } from './scrapers/index'; // Import the main scraper orchestrator AND RegionalSources type
import { saveMarketPrices } from '../services/marketPrice.service'; // Import service to save data
import { downloadPdf } from './scrapers/utils/pdfDownloader'; // Import the PDF downloader utility
import { env } from '../config/env'; // Import env to get source URLs

/**
 * This job is responsible for daily scraping of market prices from various regions.
 * It first downloads the latest DA PDF(s) and fetches other data, then orchestrates
 * regional scrapers to extract data from these sources, and finally stores the aggregated data.
 */
export const runPriceScraperJob = async () => {
  console.log('[PRICE SCRAPER JOB] Starting daily price scraping job...');

  // --- PRODUCTION: Get the current date dynamically ---
  const today = new Date(); // Gets the current date and time
  const year = today.getFullYear();
  // getMonth() returns 0-11, so add 1 and pad with '0'
  const monthNumber = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate(); // Get the day of the month
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[today.getMonth()];
  // --- END PRODUCTION DATE SETTINGS ---

  // formattedDate is passed to scrapers to tag the data with the correct date
  const formattedScrapeDate = `${year}-${monthNumber}-${day.toString().padStart(2, '0')}`;
  console.log(`[PRICE SCRAPER JOB] Targeting scrape date: ${formattedScrapeDate}`); // Log the target date

  // Define the target directory for PDFs relative to project root
  const pdfsDirectory = path.join(__dirname, '../../data/pdfs');

  // Variables to store acquired source data
  let downloadedNcrPdfPath: string | null = null; // For NCR's PDF
  // let regionXApiData: any | null = null; // For Region X's API data

  // Initialize the object to hold all regional source data.
  const regionalSources: RegionalSources = {};

  try {
    // --- Acquire Source for NCR (Download PDF) ---
    // Construct the filename using the dynamically determined date components
    const ncrPdfFileName = `Daily-Price-Index-${monthName}-${day}-${year}.pdf`;
    // Construct the URL using the dynamically determined date components and base URL from env
    const NCR_PDF_URL = `${env.NCR_DA_PDF_BASE_URL}${year}/${monthNumber}/${ncrPdfFileName}`;

    console.log(`[PRICE SCRAPER JOB] Attempting to download NCR PDF from: ${NCR_PDF_URL}`);
    try {
      downloadedNcrPdfPath = await downloadPdf(NCR_PDF_URL, pdfsDirectory, ncrPdfFileName);
      console.log(`[PRICE SCRAPER JOB] NCR PDF downloaded successfully to: ${downloadedNcrPdfPath}`);
      regionalSources.ncrPdfPath = downloadedNcrPdfPath;
    } catch (pdfError: any) {
      console.error(`[PRICE SCRAPER JOB] Error downloading NCR PDF: ${pdfError.message}`);
      if (pdfError.isAxiosError && pdfError.response && pdfError.response.status === 404) {
        console.warn(`[PRICE SCRAPER JOB] NCR PDF for ${formattedScrapeDate} not found. Skipping NCR scrape.`);
      } else {
        // Log other types of errors during PDF download explicitly
        console.error(`[PRICE SCRAPER JOB] Unexpected error during NCR PDF download:`, pdfError);
      }
    }

    // --- Acquire Source for Region X (Hypothetical: Fetch from API) ---
    // This section is commented out in your original code, keeping it that way.
    // if (env.REGION_X_API_URL) {
    //   console.log(`[PRICE SCRAPER JOB] Attempting to fetch data for Region X from API: ${env.REGION_X_API_URL}`);
    //   try {
    //     const response = await axios.get(env.REGION_X_API_URL);
    //     regionXApiData = response.data;
    //     regionalSources.regionXApiData = regionXApiData;
    //     console.log(`[PRICE SCRAPER JOB] Region X API data fetched successfully.`);
    //   } catch (apiError: any) {
    //     console.error(`[PRICE SCRAPER JOB] Error fetching Region X API data: ${apiError.message}`);
    //   }
    // } else {
    //   console.warn('[PRICE SCRAPER JOB] REGION_X_API_URL not configured. Skipping Region X data acquisition.');
    // }

    // --- Step 2: Delegate scraping to the regional scrape initiator ---
    console.log('[PRICE SCRAPER JOB] Passing acquired sources to regional scrape initiator...');
    const marketPrices = await initiateRegionalScrape(regionalSources, formattedScrapeDate);

    if (marketPrices.length > 0) {
      console.log(`[PRICE SCRAPER JOB] Successfully collected ${marketPrices.length} market price entries.`);

      // --- Step 3: Save the aggregated scraped data to the database ---
      const savedPrices = await saveMarketPrices(marketPrices);
      console.log(`[PRICE SCRAPER JOB] Saved ${savedPrices.length} market price records to the database.`);

    } else {
      console.warn('[PRICE SCRAPER JOB] No market prices were extracted during the job run from any source.');
    }
  } catch (error: any) {
    console.error(`[PRICE SCRAPER JOB] An unhandled error occurred during the price scraping job: ${error.message}`);
    // Only log full error details if it's not a common, expected error (like a 404 for PDF)
    if (!(error.isAxiosError || error.code === 'ENOENT')) {
      console.error(`[PRICE SCRAPER JOB] Unhandled error details:`, error);
    }
  } finally {
    // --- Step 4: Clean up downloaded PDFs ---
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
