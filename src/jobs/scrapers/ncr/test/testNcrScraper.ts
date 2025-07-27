/**
 * src/jobs/scrapers/ncr/test/testNcrScraper.ts
 *
 * This script is designed to test the entire NCR scraping pipeline.
 * It calls the main `scrapeNcrPrices` function which orchestrates
 * structured (Tabula) and unstructured (pdf-parse + AI) parsing.
 *
 * Before running this test:
 * 1. Ensure you have the PDF file(s) located at 'data/pdfs/'.
 * 2. Ensure Python is installed and `tabula-py` is installed within your Python environment (`pip install tabula-py`).
 * 3. Ensure Java Runtime Environment (JRE) is installed and available in your system's PATH.
 * 4. Ensure your environment is configured for the Gemini API if unstructured parsing is expected to be used.
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { scrapeNcrPrices } from '../index'; // Import the main NCR scraper function
import { NewMarketPrice } from '../../../../types/entities/marketPrice.entity'; // Adjust path as necessary

// Define the path to the PDF and the date for the data
// Use the PDF that you've successfully tested with structured parsing
const PDF_FILENAME = 'Daily-Price-Index-July-7-2025.pdf'; // Use a PDF that works with structured parsing
const TEST_PDF_PATH = path.join(__dirname, '../../../../../data/pdfs', PDF_FILENAME);
const DATE_OF_DATA = '2025-07-07'; // Match the date of your PDF

// --- VERY EARLY LOG TO CONFIRM SCRIPT EXECUTION ---
console.log(`[TEST-DEBUG] testNcrScraper.ts script file loaded.`);

// --- Global unhandled promise rejection handler ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  // Optionally, exit the process with a non-zero code
  process.exit(1);
});

/**
 * Runs the full NCR scraper test.
 * This function initiates the scraping process and logs the results.
 */
const runNcrScraperTest = async () => {
  console.log(`[TEST-START] Full NCR Scraper test initiated.`);

  console.log(`\n--- Starting NCR Scraper Test for PDF: ${PDF_FILENAME} ---\n`);
  console.log(`Attempting to scrape prices from: ${TEST_PDF_PATH}`);

  try {
    // Step 0: Verify PDF file exists and is accessible
    try {
      await fs.access(TEST_PDF_PATH, fs.constants.F_OK);
      console.log(`[TEST-NCR-SCRAPER] PDF file found at: ${TEST_PDF_PATH}`);
    } catch (fileError) {
      console.error(`[TEST-NCR-SCRAPER] ERROR: PDF file not found or inaccessible at ${TEST_PDF_PATH}.`);
      console.error(`Please ensure the PDF file exists and the path is correct relative to your project root.`);
      throw fileError;
    }

    // Call the main NCR scraper function
    const marketPrices: NewMarketPrice[] = await scrapeNcrPrices(TEST_PDF_PATH, DATE_OF_DATA);

    // Log the results
    console.log(`\n--- NCR Scraper Test Results for ${PDF_FILENAME} (${DATE_OF_DATA}) ---`);
    if (marketPrices.length > 0) {
      console.log(`Total market price records extracted: ${marketPrices.length}`);
      console.log('Extracted Market Prices (first 5 records):');
      marketPrices.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. Crop: ${item.crop_name}, Category: ${item.category}, Price: ${item.price}, Unit: ${item.unit}, Spec: "${item.specification}"`);
      });
      if (marketPrices.length > 5) {
        console.log(`... and ${marketPrices.length - 5} more records.`);
      }
    } else {
      console.log('No market price records were extracted.');
    }
    console.log('\n--- NCR Scraper Test Completed ---\n');

  } catch (error) {
    console.error('\n--- NCR Scraper Test Failed ---');
    console.error('An error occurred during the full NCR scraping test:', error);
    console.error('Please check the console for more detailed error messages.');
    console.error('Ensure all dependencies (Python, Java, tabula-py, Node.js packages) are correctly installed and configured.');
    console.error('Full error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
};

// Execute the test
runNcrScraperTest().catch(console.error);
