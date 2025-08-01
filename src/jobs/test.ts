// src/jobs/test.ts

// IMPORTANT: Load environment variables from .env file before anything else.
import * as dotenv from 'dotenv';
dotenv.config();

import { runPriceScraperJob } from './priceScraper.job';
import { NCR_DA_PDF_BASE_URL } from '../config/env';

// --- Manual Test Script ---
// This script provides a simple way to manually execute the price scraper job
// and observe its behavior and output in the console.

console.log('--- Starting Manual Price Scraper Job Test ---');
console.log('Note: This is a basic manual test. External functions (like downloadPdf, saveMarketPrices,');
console.log('and file system operations) will attempt to execute their real logic unless their modules');
console.log('are individually mocked (which is more complex without a testing framework).');
console.log('Please observe the console output carefully for the execution flow and expected calls.');
console.log(`Current NCR_DA_PDF_BASE_URL from process.env: ${process.env.NCR_DA_PDF_BASE_URL}`);

const runTest = async () => {
    try {
        await runPriceScraperJob();
    } catch (error) {
        console.error('An error occurred during the manual test:', error);
    }
    console.log('\n--- Test Scenario: Job Execution Completed ---');
    console.log('Expected observations in the logs above:');
    console.log(' - The NCR PDF URL constructed should use the value from your actual environment.');
    console.log(' - You should see messages indicating attempts to download the PDF,');
    console.log('   then messages related to initiating the regional scrape, and finally');
    console.log('   messages about saving market prices to the database.');
    console.log(' - Regardless of whether the PDF download succeeded or failed, you should');
    console.log('   see a message confirming an attempt to clean up the downloaded PDF file.');
    console.log('\nIf no critical errors were reported in the console, the job flow likely completed');
    console.log('as expected within this manual test setup.');
    console.log('\n--- Manual Price Scraper Job Test Finished ---');
};

runTest();
