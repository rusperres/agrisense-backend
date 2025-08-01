import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fetches the DA price monitoring page and extracts the URL of the latest Daily Price Index PDF.
 * @param priceMonitoringUrl The URL of the DA Price Monitoring page.
 * @returns The URL of the latest Daily Price Index PDF, or null if not found.
 */
export const extractLatestDailyPriceIndexPdfLink = async (priceMonitoringUrl: string): Promise<string | null> => {
    console.log(`[PDF LINK EXTRACTOR] Attempting to fetch HTML from: ${priceMonitoringUrl}`);
    try {
        // Add a timeout to the axios request to prevent it from hanging indefinitely
        const response = await axios.get(priceMonitoringUrl, { timeout: 30000 }); // 30 second timeout
        const html = response.data;
        console.log(`[PDF LINK EXTRACTOR] Successfully fetched HTML. Response status: ${response.status}`);

        const $ = cheerio.load(html); // Load the HTML into cheerio
        console.log('[PDF LINK EXTRACTOR] HTML loaded into Cheerio parser.');

        // Target the "Daily Price Index" section.
        // We look for the h3 tag with the specific text, then find the next table.
        const dailyPriceIndexTable = $('h3:contains("Daily Price Index")').next('table#tablepress-112');
        console.log(`[PDF LINK EXTRACTOR] Checking for 'Daily Price Index' table... Found: ${dailyPriceIndexTable.length > 0}`);

        if (dailyPriceIndexTable.length === 0) {
            console.warn('[PDF LINK EXTRACTOR] "Daily Price Index" table not found on the page. Exiting extraction.');
            return null;
        }

        // Find the first <a> tag within the tbody of this table.
        // This should correspond to the most recent daily price index.
        console.log('[PDF LINK EXTRACTOR] Table found. Searching for the latest PDF link...');
        const latestPdfLink = dailyPriceIndexTable.find('tbody tr:first-child td.column-1 a').attr('href');

        if (latestPdfLink) {
            console.log(`[PDF LINK EXTRACTOR] Found latest Daily Price Index PDF link: ${latestPdfLink}`);
            return latestPdfLink;
        } else {
            console.warn('[PDF LINK EXTRACTOR] No PDF link found within the "Daily Price Index" table. Exiting extraction.');
            return null;
        }

    } catch (error: any) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            console.error(`[PDF LINK EXTRACTOR] Request to ${priceMonitoringUrl} timed out after 30 seconds.`);
        } else if (error.isAxiosError) {
            console.error(`[PDF LINK EXTRACTOR] Axios error details: Status ${error.response?.status} - ${error.message}`);
        } else {
            console.error(`[PDF LINK EXTRACTOR] An unexpected error occurred: ${error.message}`);
        }
        return null;
    }
};
