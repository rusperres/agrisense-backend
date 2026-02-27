import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { extractTablesWithTabula, TabulaExtractedData } from '../structuredParse/lib/textExtractionTabula';
import { processStructuredData, validateTabulaData } from '../structuredParse/structuredDataProcessor';
import { NewMarketPrice } from '../../../../types/entities/marketPrice.entity';

const PDF_FILENAME = 'Daily-Price-Index-July-3-2025.pdf';
const CORRECTED_PDF_PATH = path.join(__dirname, '../../../../../data/pdfs', PDF_FILENAME);
const DATE_OF_DATA = '2025-07-03'; 

console.log(`[TEST-DEBUG] testStructuredParse.ts script file loaded.`);

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const runStructuredParserTest = async () => {
  console.log(`[TEST-START] Script execution initiated.`);

  console.log(`\n--- Starting Structured Parser Test for PDF: ${PDF_FILENAME} ---\n`);
  console.log(`Attempting to extract tables from: ${CORRECTED_PDF_PATH}`);

  try {
    try {
      await fs.access(CORRECTED_PDF_PATH, fs.constants.F_OK);
      console.log(`[TEST-STRUCTURED-PARSE] PDF file found at: ${CORRECTED_PDF_PATH}`);
    } catch (fileError) {
      console.error(`[TEST-STRUCTURED-PARSE] ERROR: PDF file not found or inaccessible at ${CORRECTED_PDF_PATH}.`);
      console.error(`Please ensure the PDF file exists and the path is correct relative to your project root.`);
      throw fileError;
    }

    console.log(`[TEST-STRUCTURED-PARSE] Calling extractTablesWithTabula...`);
    const rawStructuredData: TabulaExtractedData = await extractTablesWithTabula(CORRECTED_PDF_PATH);
    console.log(`[TEST-STRUCTURED-PARSE] extractTablesWithTabula call completed.`);
    console.log(`\nSuccessfully extracted raw structured data. Number of rows: ${rawStructuredData.length}`);

    if (!validateTabulaData(rawStructuredData)) {
      console.error("[TEST-STRUCTURED-PARSE] Raw Tabula data failed initial validation. Aborting processing.");
      return;
    }

    console.log(`\nStarting structured data processing for date: ${DATE_OF_DATA}`);
    const marketPrices: NewMarketPrice[] = await processStructuredData(rawStructuredData, DATE_OF_DATA);

    console.log(`\n--- Structured Parser Test Results for ${PDF_FILENAME} (${DATE_OF_DATA}) ---`);
    if (marketPrices.length > 0) {
      console.log(`Total market price records extracted and validated: ${marketPrices.length}`);
      console.log('Extracted Market Prices (first 5 records):');
      marketPrices.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. Crop: ${item.crop_name}, Category: ${item.category}, Price: ${item.price}, Unit: ${item.unit}, Spec: "${item.specification}"`);
      });
      if (marketPrices.length > 5) {
        console.log(`... and ${marketPrices.length - 5} more records.`);
      }
    } else {
      console.log('No market price records were extracted or validated.');
    }
    console.log('\n--- Structured Parser Test Completed ---\n');

  } catch (error) {
    console.error('\n--- Structured Parser Test Failed ---');
    console.error('An error occurred during the structured parsing test:', error);
    console.error('Please ensure Python, Java, and tabula-py are correctly installed and configured.');
    console.error('Also, check the console for more detailed error messages from the Python script or the processing logic.');
    console.error('Full error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
};

runStructuredParserTest().catch(console.error);
