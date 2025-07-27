import dotenv from 'dotenv';

// Database Configuration
export const DB_HOST = process.env.DB_HOST || 'localhost';
export const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
export const DB_USER = process.env.DB_USER || 'user';
export const DB_PASSWORD = process.env.DB_PASSWORD || 'password';
export const DB_NAME = process.env.DB_NAME || 'agrisense_db';
export const DB_URL = process.env.DB_URL || 'postgresql://user:password@localhost:5432/agrisense_db';

// Security Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';

// PDF Scraper Configuration
export const NCR_DA_PDF_BASE_URL = process.env.NCR_DA_PDF_BASE_URL || 'https://www.da.gov.ph/wp-content/uploads/';
// export const REGION_X_API_URL = process.env.REGION_X_API_URL; // Example for another region's API

// API Configuration
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY || '';
export const SEMAPHORE_SENDER_NAME = process.env.SEMAPHORE_SENDER_NAME || 'AgriSense';

// Job Scheduler Configuration
export const PRICE_SCRAPER_CRON_SCHEDULE = process.env.PRICE_SCRAPER_CRON_SCHEDULE || '0 2 * * *';

// Other configurations
export const PORT = process.env.PORT || 3000;