/**
 * src/jobs/scrapers/ncr/deterministicParse/structuredDataProcessor.ts
 *
 * This module is responsible for processing structured data, typically JSON
 * output from a table extraction tool like Tabula-py. It parses the raw
 * extracted data and transforms it into the standardized NewMarketPrice
 * entity format.
 *
 * It relies on common utility functions for cleaning text and parsing prices/units.
 *
 * IMPORTANT: This parsing logic is highly customized to the specific column
 * headers and data layout produced by Tabula-py for the 'Daily-Price-Index-July-7-2025.pdf'.
 * Any significant changes in the PDF's table structure or Tabula's output
 * may require adjustments here.
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { NewMarketPrice } from '../../../../types/entities/marketPrice.entity';
import { MarketTrend } from '../../../../types/enums';
import { cleanText, parsePrice, extractUnit } from '../utils/commonParsers'; // Import from common utils
import { TabulaExtractedData } from './lib/textExtractionTabula'; // Import the type from textExtractionTabula

/**
 * Processes structured data (e.g., from Tabula) to extract market price items.
 * It handles category detection, item parsing, and data cleaning.
 * @param tabulaData The raw structured data extracted by Tabula.
 * @param date The date of the price index (YYYY-MM-DD format).
 * @returns A Promise that resolves with an array of NewMarketPrice objects.
 */
export const processStructuredData = async (tabulaData: TabulaExtractedData, date: string): Promise<NewMarketPrice[]> => {
  console.log(`[STRUCTURED DATA PROCESSOR] Starting for date: ${date}`);
  const allExtractedItems: NewMarketPrice[] = [];
  const debugLogDir = path.join(__dirname, 'structured_parser_debug_logs');
  await fs.mkdir(debugLogDir, { recursive: true });
  console.log(`[STRUCTURED DATA PROCESSOR] Debug logs will be saved to: ${debugLogDir}`);

  if (!tabulaData || tabulaData.length === 0) {
    console.error("[STRUCTURED DATA PROCESSOR] No usable raw structured data provided. Cannot proceed.");
    return [];
  }

  let currentCategory: string | null = null; // Track current category

  for (const row of tabulaData) {
    const cleanedRow: { [key: string]: string } = {};
    for (const key in row) {
      // Clean the key itself by replacing newlines and trimming whitespace
      const cleanedKey = key.replace(/\r?\n|\r/g, ' ').trim();
      if (typeof row[key] === 'string') {
        // Clean the value by replacing newlines and trimming whitespace
        cleanedRow[cleanedKey] = cleanText((row[key] as string).replace(/\r?\n|\r/g, ' '));
      } else if (row[key] !== null && row[key] !== undefined) {
        cleanedRow[cleanedKey] = String(row[key]); // Convert numbers to string for consistency
      } else {
        cleanedRow[cleanedKey] = ''; // Ensure null/undefined values become empty strings
      }
    }

    // --- Heuristic to detect category rows ---
    // Based on observed pattern: "COMMODITY" is empty, "SPECIFICATION" is a single letter (A, B, C, D, E),
    // and "Unnamed: 1" contains the actual category name.
    const categoryMarker = cleanedRow['SPECIFICATION'];
    const potentialCategoryName = cleanedRow['Unnamed: 1']; // Category name is in Unnamed: 1

    if (
      cleanedRow['COMMODITY'] === '' && // Commodity column is empty
      categoryMarker?.match(/^[A-E]$/) && // SPECIFICATION column has A, B, C, D, E
      potentialCategoryName && potentialCategoryName.length > 5 && // Unnamed: 1 has a substantial name
      !potentialCategoryName.includes('COMMODITY') && // Not a header
      !potentialCategoryName.includes('SPECIFICATION') && // Not a header
      !potentialCategoryName.includes('PRICE PER UNIT') // Not a header
    ) {
      currentCategory = cleanText(potentialCategoryName);
      console.log(`[STRUCTURED DATA PROCESSOR] Detected category: "${currentCategory}"`);
      continue; // Skip this row as it's a category header, not an item
    }

    // --- Skip rows that are clearly just table headers/footers or empty ---
    // These checks are based on the specific text patterns and column emptiness observed in the raw output.
    if (
      Object.values(cleanedRow).every(val => !val) || // Entirely empty row
      cleanedRow['COMMODITY']?.toLowerCase().includes('commodity') || // Common header text
      cleanedRow['SPECIFICATION']?.toLowerCase().includes('specification') || // Common header text
      cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)']?.toLowerCase().includes('prevailing retail price per unit') || // Common header text
      cleanedRow['Unnamed: 0']?.toLowerCase().includes('(p/unit)') || // Common header text
      (cleanedRow['COMMODITY'] === '' && cleanedRow['SPECIFICATION'] === '' && cleanedRow['Unnamed: 0'] === '' && cleanedRow['Unnamed: 1'] === '') || // Empty data row
      // Specific header checks (now using cleaned keys)
      (cleanedRow['COMMODITY'] === 'COMMODITY' && cleanedRow['SPECIFICATION'] === 'SPECIFICATION') || // Header row
      (cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] === 'PREVAILING RETAIL') || // Header row part 1
      (cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] === 'PRICE PER UNIT') || // Header row part 2
      (cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] === '(P/UNIT)') // Header row part 3
    ) {
      continue;
    }

    // --- Attempt to extract item data based on latest raw output mapping ---
    // ID: 'COMMODITY'
    // Crop Name: 'SPECIFICATION'
    // Price: 'Unnamed: 0'
    // Specification (actual description): 'PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'

    const itemId = cleanText(cleanedRow['COMMODITY'] || '').replace(/\.0$/, ''); // Get ID, remove trailing .0
    const cropName = cleanText(cleanedRow['SPECIFICATION'] || ''); // Get crop name from SPECIFICATION
    const specification = cleanText(cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] || ''); // Get actual specification
    const priceStr = cleanedRow['Unnamed: 0']; // Get price string

    // --- Primary Validation: Only proceed if there's a numeric commodity ID and a non-empty crop name ---
    if (!itemId.match(/^\d+$/) || !cropName) { // Ensure ID is purely numeric after cleaning .0, and cropName exists
      console.warn(`[STRUCTURED DATA PROCESSOR] Skipping row (missing numeric ID or crop name): ${JSON.stringify(cleanedRow)}`);
      continue;
    }

    const price = parsePrice(priceStr); // Price will be NaN if priceStr is 'n/a' or empty

    if (currentCategory) { // Ensure a category has been detected for the item
      allExtractedItems.push({
        crop_name: cropName,
        category: currentCategory,
        region: 'NCR',
        price: price,
        unit: extractUnit(specification || cropName), // Unit extraction can still use either if needed
        trend: 'N/A' as MarketTrend,
        source: 'DA',
        date: date,
        specification: specification,
      });
      console.log(`[STRUCTURED DATA PROCESSOR] Parsed: ID: ${itemId} | Crop: "${cropName}" | Spec: "${specification}" | Price: ${price} | Unit: ${extractUnit(specification || cropName)} | Category: "${currentCategory}"`);
    } else {
      console.warn(`[STRUCTURED DATA PROCESSOR] Skipping row (no category detected for item): ${JSON.stringify(cleanedRow)}`);
    }
  }

  console.log(`[STRUCTURED DATA PROCESSOR] Total extracted items: ${allExtractedItems.length}`);

  // --- NEW: Save the cleaned, extracted items to a debug log file ---
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const cleanedLogFileName = `processed_market_prices_${timestamp}.json`;
  const cleanedLogFilePath = path.join(debugLogDir, cleanedLogFileName);
  try {
    await fs.writeFile(cleanedLogFilePath, JSON.stringify(allExtractedItems, null, 2));
    console.log(`[STRUCTURED DATA PROCESSOR] Cleaned market prices saved to: ${cleanedLogFilePath}`);
  } catch (fileWriteError) {
    console.error(`[STRUCTURED DATA PROCESSOR] Failed to write cleaned market prices log:`, fileWriteError);
  }
  // --- END NEW ---

  // Deduplicate before returning
  const seen = new Set<string>();
  const uniqueMarketPrices = allExtractedItems.filter(mp => {
    const key = `${mp.crop_name}|${mp.category}|${mp.region}|${mp.date}|${mp.specification}|${mp.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[STRUCTURED DATA PROCESSOR] Total unique records: ${uniqueMarketPrices.length}`);

  // --- NEW: Save the unique, extracted items to a debug log file ---
  const uniqueLogFileName = `unique_market_prices_${timestamp}.json`;
  const uniqueLogFilePath = path.join(debugLogDir, uniqueLogFileName);
  try {
    await fs.writeFile(uniqueLogFilePath, JSON.stringify(uniqueMarketPrices, null, 2));
    console.log(`[STRUCTURED DATA PROCESSOR] Unique market prices saved to: ${uniqueLogFilePath}`);
  } catch (fileWriteError) {
    console.error(`[STRUCTURED DATA PROCESSOR] Failed to write unique market prices log:`, fileWriteError);
  }
  // --- END NEW ---

  // Database insertion is now handled by the orchestrator after all processing
  return uniqueMarketPrices;
};

/**
 * Validates if the Tabula extracted data has a plausible structure for processing.
 * This is a basic check; more sophisticated validation might be needed depending on PDF variations.
 * @param data The TabulaExtractedData to validate.
 * @returns true if the data seems valid, false otherwise.
 */
export const validateTabulaData = (data: TabulaExtractedData): boolean => {
  if (!data || data.length === 0) {
    console.warn("[STRUCTURED DATA PROCESSOR] Tabula data is empty or null.");
    return false;
  }

  // Check if at least some rows have common column names (e.g., 'COMMODITY' for ID, 'SPECIFICATION' for crop name, 'Unnamed: 0' for price)
  const hasExpectedColumns = data.some(row => {
    const keys = Object.keys(row);
    // Clean keys for validation check as well
    const cleanedKeys = keys.map(key => key.replace(/\r?\n|\r/g, ' ').trim());
    return cleanedKeys.includes('COMMODITY') && cleanedKeys.includes('SPECIFICATION') && cleanedKeys.includes('Unnamed: 0');
  });

  if (!hasExpectedColumns) {
    console.warn("[STRUCTURED DATA PROCESSOR] Tabula data does not contain expected column headers (e.g., 'COMMODITY', 'SPECIFICATION', 'Unnamed: 0').");
    return false;
  }

  // Check if a significant number of rows look like actual data rows
  const plausibleDataRows = data.filter(row => {
    // Need to access raw row keys and clean them for this check too
    const cleanedRow: { [key: string]: string } = {};
    for (const key in row) {
      const cleanedKey = key.replace(/\r?\n|\r/g, ' ').trim();
      cleanedRow[cleanedKey] = cleanText(String(row[key] || ''));
    }

    const itemIdCandidate = cleanedRow['COMMODITY']?.replace(/\.0$/, '');
    const cropNameCandidate = cleanedRow['SPECIFICATION'];
    // A plausible row should have a numeric ID (after cleaning .0) and a non-empty crop name
    return itemIdCandidate?.match(/^\d+$/) && cropNameCandidate?.length > 0;
  }).length;

  const MIN_PLAUSIBLE_ROWS = 5; // Adjust based on typical PDF content
  if (plausibleDataRows < MIN_PLAUSIBLE_ROWS) {
    console.warn(`[STRUCTURED DATA PROCESSOR] Only ${plausibleDataRows} plausible data rows found, which is less than ${MIN_PLAUSIBLE_ROWS}.`);
    return false;
  }

  console.log(`[STRUCTURED DATA PROCESSOR] Tabula data passed basic validation (${plausibleDataRows} plausible rows).`);
  return true;
};
