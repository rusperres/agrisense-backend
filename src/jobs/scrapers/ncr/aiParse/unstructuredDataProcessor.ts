/**
 * src/jobs/scrapers/ncr/aiParse/unstructuredDataProcessor.ts
 *
 * This module is responsible for processing unstructured (raw text) data,
 * typically extracted from PDFs, using a Large Language Model (LLM) to
 * extract structured market price information. It now instructs the LLM
 * to return data in a pipe-separated table format to optimize token usage.
 * It handles chunking the input text, making API calls to the LLM, and
 * parsing the LLM's table-formatted response.
 */

import { NewMarketPrice } from '../../../../types/entities/marketPrice.entity';
import { MarketTrend } from '../../../../types/enums';
import { cleanText, parsePrice, extractUnit } from '../utils/commonParsers'; // Import from common utils
import { saveScraperLog } from '../../scraperLog.service'; // NEW: Import the new log service


const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Defines the structure for the LLM's expected output for a single market price item.
 * This interface remains the same, as it's the target structure after parsing.
 */
interface LLMMarketPriceItem {
  crop_name: string;
  category: string;
  specification: string;
  price: string;
  unit: string;
}

/**
 * Parses a pipe-separated table string from the LLM into an array of LLMMarketPriceItem objects.
 * Assumes the first line is a header and subsequent lines are data.
 * Expected format: crop_name|category|specification|price|unit
 * @param tableString The raw table string output from the LLM.
 * @returns An array of LLMMarketPriceItem objects.
 */
const parseLLMTableString = (tableString: string): LLMMarketPriceItem[] => {
  const lines = tableString.trim().split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {
    console.warn("[UNSTRUCTURED DATA PROCESSOR] parseLLMTableString: No lines found in LLM table response.");
    return [];
  }

  // Assuming the first line is the header and we'll ignore it for direct parsing
  const dataLines = lines.slice(1);

  const extractedItems: LLMMarketPriceItem[] = [];
  for (const line of dataLines) {
    // Split by pipe, then trim each part to remove leading/trailing spaces
    const parts = line.split('|').map(part => part.trim());

    // Ensure we have at least 5 parts: crop_name, category, specification, price, unit
    if (parts.length >= 5) {
      extractedItems.push({
        crop_name: parts[0],
        category: parts[1],
        specification: parts[2],
        price: parts[3],
        unit: parts[4]
      });
    } else {
      console.warn(`[UNSTRUCTURED DATA PROCESSOR] parseLLMTableString: Skipping malformed line (expected 5 parts, got ${parts.length}): "${line}"`);
    }
  }
  return extractedItems;
};


/**
 * Processes unstructured (raw text) data using an LLM to extract market price items.
 * @param rawText The raw text content from the PDF.
 * @param date The date of the price index (YYYY-MM-DD format).
 * @returns A Promise that resolves with an array of NewMarketPrice objects.
 */
export const processUnstructuredData = async (rawText: string, date: string): Promise<NewMarketPrice[]> => {
  console.log(`[UNSTRUCTURED DATA PROCESSOR] Starting for date: ${date}`);
  const allExtractedItems: NewMarketPrice[] = [];
  // Removed file system logic for creating debug log directory

  if (!rawText.trim()) {
    console.error("[UNSTRUCTURED DATA PROCESSOR] No usable raw text provided. Cannot proceed with LLM.");
    return [];
  }

  const MAX_ITEMS_PER_SUBCHUNK = 50;
  let currentSubChunkItems: string[] = [];
  let subChunkIndex = 0;

  const itemsToProcess: string[] = rawText.split(/\r?\n/).map(line => cleanText(line)).filter(Boolean);

  for (let i = 0; i < itemsToProcess.length; i++) {
    currentSubChunkItems.push(itemsToProcess[i]);

    if (currentSubChunkItems.length >= MAX_ITEMS_PER_SUBCHUNK || i === itemsToProcess.length - 1) {
      const subChunkText = currentSubChunkItems.join('\n');
      subChunkIndex++;
      console.log(`[UNSTRUCTURED DATA PROCESSOR]   Processing sub-chunk ${subChunkIndex} (${currentSubChunkItems.length} items).`);

      const prompt = `
          You are an expert data extractor. Your task is to extract market price data for items from the following text.
          The text contains a list of agricultural and fishery commodities with their specifications and prevailing retail prices.
          Each item has a a commodity name, a specification, and a price. Prices can be "n/a" for not available.
          Infer the 'unit' (e.g., 'P/kg', 'P/pc', 'P/bottle', 'P/unit') from the specification or commodity description.
          If a unit is not clearly inferable, default to 'P/unit'.

          Extract the data into a pipe-separated table format. Each row should represent one item.
          The columns should be: crop_name|category|specification|price|unit
          Provide a header row. Ensure all fields are present for each item.
          If a specification is not available, use an empty string "".
          If a crop name cannot be identified, return "UNKNOWN CROP".

          Here is the text segment to parse:
          ---
          ${subChunkText}
          ---
          Provide the COMPLETE table for this segment. Do not omit any items or truncate the table.
          Ensure the table is perfectly well-formed and complete.
        `;

      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
        }
      };

      console.log(`[UNSTRUCTURED DATA PROCESSOR]   Sending extraction request to LLM for sub-chunk ${subChunkIndex}.`);
      const llmResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!llmResponse.ok) {
        const errorData = await llmResponse.json();
        throw new Error(`LLM API error for sub-chunk ${subChunkIndex}: ${llmResponse.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await llmResponse.json();

      if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content || !result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
        console.warn(`[UNSTRUCTURED DATA PROCESSOR]   LLM response structure is unexpected or content is missing for sub-chunk ${subChunkIndex}.`);
        currentSubChunkItems = [];
        continue;
      }

      const llmExtractedTableString = result.candidates[0].content.parts[0].text;

      console.log(`--- RAW LLM TABLE STRING for Sub-chunk ${subChunkIndex} START ---`);
      console.log(llmExtractedTableString);
      console.log(`--- RAW LLM TABLE STRING for Sub-chunk ${subChunkIndex} END ---\n`);

      let extractedSubChunkData: LLMMarketPriceItem[] = [];
      try {
        extractedSubChunkData = parseLLMTableString(llmExtractedTableString);
        console.log(`[UNSTRUCTURED DATA PROCESSOR]   LLM extracted ${extractedSubChunkData.length} records for sub-chunk ${subChunkIndex}.`);
      } catch (parseErr) {
        console.error(`[UNSTRUCTURED DATA PROCESSOR]   Failed to parse table string for sub-chunk ${subChunkIndex}:`, parseErr);
      }

      const validRecordsForThisSubChunk: NewMarketPrice[] = [];
      for (const item of extractedSubChunkData) {
        const price = parsePrice(item.price);
        const finalSpecification = cleanText(item.specification || '');

        if (cleanText(item.crop_name) && cleanText(item.category)) {
          validRecordsForThisSubChunk.push({
            crop_name: cleanText(item.crop_name),
            category: cleanText(item.category),
            region: 'NCR',
            price: price,
            unit: extractUnit(item.unit || 'P/unit'),
            trend: 'N/A' as MarketTrend,
            source: 'DA',
            date: date,
            specification: finalSpecification,
          });
        } else {
          console.warn(`[UNSTRUCTURED DATA PROCESSOR]   Skipping record in sub-chunk ${subChunkIndex} due to missing/empty crop_name or category:`, JSON.stringify(item));
        }
      }

      // Prepare the log content to be saved to the database
      const subChunkLogContent = `
=== RAW LLM TABLE OUTPUT (SUB-CHUNK ${subChunkIndex}) ===
Input Type: unstructured
Potential Records (from LLM): ${extractedSubChunkData.length}
Inserted Records (after validation): ${validRecordsForThisSubChunk.length}

${llmExtractedTableString}

=== VALIDATED AND PREPARED RECORDS FOR INSERTION (FROM THIS SUB-CHUNK) ===
${JSON.stringify(validRecordsForThisSubChunk, null, 2)}
`;
      try {
        await saveScraperLog({
          text: subChunkLogContent.trim(),
          parserUsed: 'AI Unstructured',
          date: date,
        });
      } catch (dbError) {
        console.error(`[UNSTRUCTURED DATA PROCESSOR]   Failed to save debug log to database for sub-chunk ${subChunkIndex}:`, dbError);
      }

      allExtractedItems.push(...validRecordsForThisSubChunk);
      currentSubChunkItems = [];
    }
  }

  console.log(`[UNSTRUCTURED DATA PROCESSOR] Total LLM extracted and validated ${allExtractedItems.length} records.`);

  // Deduplicate before returning
  const seen = new Set<string>();
  const uniqueMarketPrices = allExtractedItems.filter(mp => {
    const key = `${mp.crop_name}|${mp.category}|${mp.region}|${mp.date}|${mp.specification}|${mp.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[UNSTRUCTURED DATA PROCESSOR] Total unique records: ${uniqueMarketPrices.length}`);

  return uniqueMarketPrices;
};
