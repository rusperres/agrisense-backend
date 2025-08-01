// Database Configuration
export const DB_HOST = process.env.DB_HOST;
export const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
export const DB_USER = process.env.DB_USER;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const DB_NAME = process.env.DB_NAME || 'agrisense_db';
export const DB_URL = process.env.DB_URL;

// Security Configuration
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined. Please set it in your .env file.');
}
export const JWT_SECRET = jwtSecret;
export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';

// PDF Scraper Configuration
export const NCR_DA_PDF_BASE_URL = process.env.NCR_DA_PDF_BASE_URL || 'https://www.da.gov.ph/price-monitoring/';
// export const REGION_X_API_URL = process.env.REGION_X_API_URL; // Example for another region's API

// API Configuration
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY;
export const SEMAPHORE_SENDER_NAME = process.env.SEMAPHORE_SENDER_NAME;

// Job Scheduler Configuration
export const PRICE_SCRAPER_CRON_SCHEDULE = process.env.PRICE_SCRAPER_CRON_SCHEDULE || '0 2 * * *';

// Other configurations
export const PORT = process.env.PORT || 3000;