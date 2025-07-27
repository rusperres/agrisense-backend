// src/jobs/scrapers/ncr/index.ts

import * as path from 'node:path';
import { NewMarketPrice } from '../../../types/entities/marketPrice.entity';
import { extractTablesWithTabula } from './structuredParse/lib/textExtractionTabula';
import { processStructuredData, validateTabulaData } from './structuredParse/structuredDataProcessor';
import { extractTextFromPdf } from './aiParse/lib/textExtractionPdfParse';
import { processUnstructuredData } from './aiParse/unstructuredDataProcessor';

/**
 * Scrapes market prices for the NCR region by attempting structured parsing first,
 * and falling back to unstructured (AI-based) parsing if structured fails or yields insufficient data.
 * @param pdfPath The full path to the PDF file to scrape.
 * @param date The date of the market data in the PDF (YYYY-MM-DD format).
 * @returns A Promise that resolves to an array of NewMarketPrice objects.
 */
export const scrapeNcrPrices = async (pdfPath: string, date: string): Promise<NewMarketPrice[]> => {
  console.log(`[NCR SCRAPER] Starting price scraping for PDF: ${pdfPath} on date: ${date}`);
  let marketPrices: NewMarketPrice[] = [];

  // --- Attempt Structured Parsing (Tabula-based) ---
  try {
    console.log('[NCR SCRAPER] Attempting structured parsing...');
    const rawStructuredData = await extractTablesWithTabula(pdfPath);

    // Validate Tabula data before processing
    if (validateTabulaData(rawStructuredData)) {
      marketPrices = await processStructuredData(rawStructuredData, date);
      if (marketPrices.length > 0) {
        console.log(`[NCR SCRAPER] Structured parsing successful. Extracted ${marketPrices.length} items.`);
        return marketPrices; // Return if structured parsing is successful
      } else {
        console.warn('[NCR SCRAPER] Structured parsing yielded no items. Falling back to unstructured parsing.');
      }
    } else {
      console.warn('[NCR SCRAPER] Structured data validation failed. Falling back to unstructured parsing.');
    }
  } catch (error: any) {
    console.error(`[NCR SCRAPER] Error during structured parsing: ${error.message}. Falling back to unstructured parsing.`);
  }

  // --- Fallback to Unstructured Parsing (pdf-parse + AI-based) ---
  try {
    console.log('[NCR SCRAPER] Attempting unstructured parsing...');
    const rawText = await extractTextFromPdf(pdfPath);
    if (rawText) {
      marketPrices = await processUnstructuredData(rawText, date);
      if (marketPrices.length > 0) {
        console.log(`[NCR SCRAPER] Unstructured parsing successful. Extracted ${marketPrices.length} items.`);
        return marketPrices;
      } else {
        console.warn('[NCR SCRAPER] Unstructured parsing yielded no items.');
      }
    } else {
      console.warn('[NCR SCRAPER] Could not extract raw text from PDF for unstructured parsing.');
    }
  } catch (error: any) {
    console.error(`[NCR SCRAPER] Error during unstructured parsing: ${error.message}`);
  }

  console.warn('[NCR SCRAPER] No market price data could be extracted using either method.');
  return []; // Return empty array if both methods fail
};
