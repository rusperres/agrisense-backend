import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { NewMarketPrice } from '../../../../types/entities/marketPrice.entity';
import { MarketTrend } from '../../../../types/enums';
import { cleanText, parsePrice, extractUnit } from '../utils/commonParsers'; 
import { TabulaExtractedData } from './lib/textExtractionTabula'; 

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

  let currentCategory: string | null = null; 

  for (const row of tabulaData) {
    const cleanedRow: { [key: string]: string } = {};
    for (const key in row) {
      const cleanedKey = key.replace(/\r?\n|\r/g, ' ').trim();
      if (typeof row[key] === 'string') {
        cleanedRow[cleanedKey] = cleanText((row[key] as string).replace(/\r?\n|\r/g, ' '));
      } else if (row[key] !== null && row[key] !== undefined) {
        cleanedRow[cleanedKey] = String(row[key]); 
      } else {
        cleanedRow[cleanedKey] = ''; 
      }
    }

    const categoryMarker = cleanedRow['SPECIFICATION'];
    const potentialCategoryName = cleanedRow['Unnamed: 1']; 

    if (
      cleanedRow['COMMODITY'] === '' && 
      categoryMarker?.match(/^[A-E]$/) && 
      potentialCategoryName && potentialCategoryName.length > 5 && 
      !potentialCategoryName.includes('COMMODITY') && 
      !potentialCategoryName.includes('SPECIFICATION') && 
      !potentialCategoryName.includes('PRICE PER UNIT') 
    ) {
      currentCategory = cleanText(potentialCategoryName);
      console.log(`[STRUCTURED DATA PROCESSOR] Detected category: "${currentCategory}"`);
      continue;
    }

    if (
      Object.values(cleanedRow).every(val => !val) || 
      cleanedRow['COMMODITY']?.toLowerCase().includes('commodity') ||
      cleanedRow['SPECIFICATION']?.toLowerCase().includes('specification') || 
      cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)']?.toLowerCase().includes('prevailing retail price per unit') || 
      cleanedRow['Unnamed: 0']?.toLowerCase().includes('(p/unit)') || 
      (cleanedRow['COMMODITY'] === '' && cleanedRow['SPECIFICATION'] === '' && cleanedRow['Unnamed: 0'] === '' && cleanedRow['Unnamed: 1'] === '') || 
      (cleanedRow['COMMODITY'] === 'COMMODITY' && cleanedRow['SPECIFICATION'] === 'SPECIFICATION') || 
      (cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] === 'PREVAILING RETAIL') || 
      (cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] === 'PRICE PER UNIT') || 
      (cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] === '(P/UNIT)') 
    ) {
      continue;
    }


    const itemId = cleanText(cleanedRow['COMMODITY'] || '').replace(/\.0$/, ''); 
    const cropName = cleanText(cleanedRow['SPECIFICATION'] || ''); 
    const specification = cleanText(cleanedRow['PREVAILING RETAIL PRICE PER UNIT (P/UNIT)'] || ''); 
    const priceStr = cleanedRow['Unnamed: 0'];

    if (!itemId.match(/^\d+$/) || !cropName) { 
      console.warn(`[STRUCTURED DATA PROCESSOR] Skipping row (missing numeric ID or crop name): ${JSON.stringify(cleanedRow)}`);
      continue;
    }

    const price = parsePrice(priceStr);

    if (currentCategory) { 
      allExtractedItems.push({
        crop_name: cropName,
        category: currentCategory,
        region: 'NCR',
        price: price,
        unit: extractUnit(specification || cropName),
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

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const cleanedLogFileName = `processed_market_prices_${timestamp}.json`;
  const cleanedLogFilePath = path.join(debugLogDir, cleanedLogFileName);
  try {
    await fs.writeFile(cleanedLogFilePath, JSON.stringify(allExtractedItems, null, 2));
    console.log(`[STRUCTURED DATA PROCESSOR] Cleaned market prices saved to: ${cleanedLogFilePath}`);
  } catch (fileWriteError) {
    console.error(`[STRUCTURED DATA PROCESSOR] Failed to write cleaned market prices log:`, fileWriteError);
  }

  const seen = new Set<string>();
  const uniqueMarketPrices = allExtractedItems.filter(mp => {
    const key = `${mp.crop_name}|${mp.category}|${mp.region}|${mp.date}|${mp.specification}|${mp.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[STRUCTURED DATA PROCESSOR] Total unique records: ${uniqueMarketPrices.length}`);

  const uniqueLogFileName = `unique_market_prices_${timestamp}.json`;
  const uniqueLogFilePath = path.join(debugLogDir, uniqueLogFileName);
  try {
    await fs.writeFile(uniqueLogFilePath, JSON.stringify(uniqueMarketPrices, null, 2));
    console.log(`[STRUCTURED DATA PROCESSOR] Unique market prices saved to: ${uniqueLogFilePath}`);
  } catch (fileWriteError) {
    console.error(`[STRUCTURED DATA PROCESSOR] Failed to write unique market prices log:`, fileWriteError);
  }

  return uniqueMarketPrices;
};

export const validateTabulaData = (data: TabulaExtractedData): boolean => {
  if (!data || data.length === 0) {
    console.warn("[STRUCTURED DATA PROCESSOR] Tabula data is empty or null.");
    return false;
  }

  const hasExpectedColumns = data.some(row => {
    const keys = Object.keys(row);
    const cleanedKeys = keys.map(key => key.replace(/\r?\n|\r/g, ' ').trim());
    return cleanedKeys.includes('COMMODITY') && cleanedKeys.includes('SPECIFICATION') && cleanedKeys.includes('Unnamed: 0');
  });

  if (!hasExpectedColumns) {
    console.warn("[STRUCTURED DATA PROCESSOR] Tabula data does not contain expected column headers (e.g., 'COMMODITY', 'SPECIFICATION', 'Unnamed: 0').");
    return false;
  }

  const plausibleDataRows = data.filter(row => {
    const cleanedRow: { [key: string]: string } = {};
    for (const key in row) {
      const cleanedKey = key.replace(/\r?\n|\r/g, ' ').trim();
      cleanedRow[cleanedKey] = cleanText(String(row[key] || ''));
    }

    const itemIdCandidate = cleanedRow['COMMODITY']?.replace(/\.0$/, '');
    const cropNameCandidate = cleanedRow['SPECIFICATION'];
    return itemIdCandidate?.match(/^\d+$/) && cropNameCandidate?.length > 0;
  }).length;

  const MIN_PLAUSIBLE_ROWS = 5; 
  if (plausibleDataRows < MIN_PLAUSIBLE_ROWS) {
    console.warn(`[STRUCTURED DATA PROCESSOR] Only ${plausibleDataRows} plausible data rows found, which is less than ${MIN_PLAUSIBLE_ROWS}.`);
    return false;
  }

  console.log(`[STRUCTURED DATA PROCESSOR] Tabula data passed basic validation (${plausibleDataRows} plausible rows).`);
  return true;
};
