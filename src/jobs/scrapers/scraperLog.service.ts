import { pool } from '../../config/db';

interface ScraperLog {
    text: string;
    parserUsed: 'AI Unstructured' | 'Tabula Structured' | 'PDF Parse';
    date: string;
}

export const saveScraperLog = async (logData: ScraperLog): Promise<void> => {
    let client;

    try {
        client = await pool.connect();

        const query = `
      INSERT INTO scraper_logs (log_text, parser_used, log_date)
      VALUES ($1, $2, $3)
    `;
        const values = [logData.text, logData.parserUsed, logData.date];

        await client.query(query, values);
        console.log(`[SCRAPER LOG SERVICE] Successfully saved log for parser: ${logData.parserUsed} on date: ${logData.date}`);
    } catch (error) {
        console.error(`[SCRAPER LOG SERVICE] Failed to save log to database:`, error);
    } finally {
        if (client) {
            client.release();
        }
    }
};
