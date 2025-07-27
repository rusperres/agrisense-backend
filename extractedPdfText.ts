import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import axios from 'axios';
import pdfParse from 'pdf-parse';

/**
 * Downloads a PDF from a given URL and extracts its raw text content.
 * @param pdfUrl The URL of the PDF to download.
 * @returns A Promise that resolves with the extracted text content.
 */
async function extractPdfTextFromUrl(pdfUrl: string): Promise<string> {
  console.log(`[PDF EXTRACTOR] Downloading PDF from: ${pdfUrl}`);
  try {
    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    const pdfBuffer = response.data;
    console.log(`[PDF EXTRACTOR] Downloaded PDF. Parsing text...`);

    const data = await pdfParse(pdfBuffer);
    console.log(`[PDF EXTRACTOR] PDF parsing complete. Extracted ${data.text.length} characters.`);
    return data.text;
  } catch (error) {
    console.error(`[PDF EXTRACTOR] Error during PDF download or parsing:`, error);
    throw error;
  }
}

// --- Main execution ---
(async () => {
  const pdfSourceUrl = 'https://www.da.gov.ph/wp-content/uploads/2025/07/Daily-Price-Index-July-7-2025.pdf';

  try {
    const rawText = await extractPdfTextFromUrl(pdfSourceUrl);
    console.log('\n--- RAW PDF TEXT CONTENT ---');
    console.log(rawText);
    console.log('\n--- END OF RAW PDF TEXT CONTENT ---');
  } catch (error) {
    console.error(`[MAIN] Failed to extract PDF text:`, error);
  }
})();
