import cron from 'node-cron';
import { runPriceScraperJob } from './priceScraper.job';


export const startJobScheduler = () => {
  console.log('[JOB SCHEDULER] Initializing scheduled jobs...');

  cron.schedule('0 2 * * *', async () => {
    console.log('[JOB SCHEDULER] Triggering daily price scraping job...');
    try {
      await runPriceScraperJob();
      console.log('[JOB SCHEDULER] Daily price scraping job completed successfully.');
    } catch (error) {
      console.error('[JOB SCHEDULER] Error during daily price scraping job:', error);
    }
  }, {
    timezone: "Asia/Manila"
  });

  console.log('[JOB SCHEDULER] All scheduled jobs configured and running.');
};

