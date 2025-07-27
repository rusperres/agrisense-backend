// src/jobs/scrapers/testScrapers.ts

import * as path from 'node:path';
import { initiateRegionalScrape, RegionalSources } from './index';
import { NewMarketPrice } from '../../types/entities/marketPrice.entity'; // For type checking

const runTest = async () => {
  console.log('--- Starting Scrapers Test ---');

  // Define the date for the PDF you downloaded - SET TO JULY 7, 2025
  const testYear = 2025;
  const testMonthNumber = '07'; // July is 07
  const testDay = '07';     // Day is 07
  const testMonthName = 'July'; // Full month name for PDF filename

  const testDate = `${testYear}-${testMonthNumber}-${testDay}`; // YYYY-MM-DD format: 2025-07-07

  // Construct the expected filename for the test PDF
  const testPdfFileName = `Daily-Price-Index-${testMonthName}-${testDay}-${testYear}.pdf`; // Daily-Price-Index-July-07-2025.pdf

  // Construct the full path to your downloaded test PDF
  // This assumes testScrapers.ts is in src/jobs/scrapers/
  // and the PDF is in data/pdfs/ (relative to project root)
  const testPdfPath = path.join(__dirname, '../../../data/pdfs', testPdfFileName);

  // Prepare the RegionalSources object, as initiateRegionalScrape now expects it
  const regionalSources: RegionalSources = {
    ncrPdfPath: testPdfPath,
    // Add other source types here if you were testing other regions
    // regionXApiData: { /* mock API data here */ }
  };

  console.log(`Attempting to scrape NCR from PDF: ${testPdfPath}`);
  console.log(`For date: ${testDate}`);

  try {
    // Call initiateRegionalScrape with the RegionalSources object and date
    // We're not specifying a 'region' here, so it should run for all active scrapers (currently just NCR)
    const scrapedData: NewMarketPrice[] = await initiateRegionalScrape(regionalSources, testDate);

    console.log('\n--- Scrapers Test Results ---');
    if (scrapedData.length > 0) {
      console.log(`Successfully scraped ${scrapedData.length} market price entries.`);
      console.log(JSON.stringify(scrapedData, null, 2)); // Uncomment to see the full data
    } else {
      console.warn('No market price data was scraped. Check PDF path, content, and scraper logic.');
    }
    console.log('--- Scrapers Test Finished ---');

  } catch (error: any) {
    console.error('An error occurred during the scraper test:', error.message);
    if (error.code === 'ENOENT') {
      console.error(`Error: The PDF file was not found at ${testPdfPath}.`);
      console.error('Please ensure you have manually downloaded the PDF and placed it in the correct directory (`data/pdfs/`).');
    }
  }
};

// Execute the test function
runTest();