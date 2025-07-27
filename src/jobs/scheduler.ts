// src/jobs/scheduler.ts

import cron from 'node-cron';
import { runPriceScraperJob } from './priceScraper.job'; // Import the price scraper job

/**
 * Configures and starts all scheduled jobs for the application.
 * This function should be called once when the application starts.
 */
export const startJobScheduler = () => {
  console.log('[JOB SCHEDULER] Initializing scheduled jobs...');

  // --- Price Scraper Job ---
  // Schedule the price scraper job to run daily at 2:00 AM.
  // Cron syntax: 'minute hour day_of_month month day_of_week'
  // '0 2 * * *' means: At minute 0, at hour 2 (2 AM), every day of the month, every month, every day of the week.
  cron.schedule('0 2 * * *', async () => {
    console.log('[JOB SCHEDULER] Triggering daily price scraping job...');
    try {
      await runPriceScraperJob();
      console.log('[JOB SCHEDULER] Daily price scraping job completed successfully.');
    } catch (error) {
      console.error('[JOB SCHEDULER] Error during daily price scraping job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Manila" // Set to your application's target timezone (e.g., for Cebu City)
  });

  // --- Add other jobs here as needed in the future ---
  // Example:
  // cron.schedule('0 0 * * *', async () => { // Midnight daily
  //   console.log('[JOB SCHEDULER] Triggering daily report generation job...');
  //   // await runReportGenerationJob();
  //   console.log('[JOB SCHEDULER] Daily report generation job completed.');
  // }, {
  //   scheduled: true,
  //   timezone: "Asia/Manila"
  // });

  console.log('[JOB SCHEDULER] All scheduled jobs configured and running.');
};

