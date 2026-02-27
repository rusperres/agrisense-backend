import * as path from 'node:path';
import { initiateRegionalScrape, RegionalSources } from './index';
import { NewMarketPrice } from '../../types/entities/marketPrice.entity'; 

const runTest = async () => {
  console.log('--- Starting Scrapers Test ---');

  const testYear = 2025;
  const testMonthNumber = '07'; 
  const testDay = '07';     
  const testMonthName = 'July'; 

  const testDate = `${testYear}-${testMonthNumber}-${testDay}`; 

  const testPdfFileName = `Daily-Price-Index-${testMonthName}-${testDay}-${testYear}.pdf`; 

  const testPdfPath = path.join(__dirname, '../../../data/pdfs', testPdfFileName);

  const regionalSources: RegionalSources = {
    ncrPdfPath: testPdfPath,
  };

  console.log(`Attempting to scrape NCR from PDF: ${testPdfPath}`);
  console.log(`For date: ${testDate}`);

  try {
    const scrapedData: NewMarketPrice[] = await initiateRegionalScrape(regionalSources, testDate);

    console.log('\n--- Scrapers Test Results ---');
    if (scrapedData.length > 0) {
      console.log(`Successfully scraped ${scrapedData.length} market price entries.`);
      console.log(JSON.stringify(scrapedData, null, 2)); 
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

runTest();
