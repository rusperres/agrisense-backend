import pdfParseLib from 'pdf-parse';
import * as fs from 'node:fs/promises';

export const extractTextFromPdf = async (pdfPath: string): Promise<string> => {
  console.log(`[PDF-PARSE EXTRACTOR] Extracting text from: ${pdfPath}`);
  try {
    const pdfBuffer = await fs.readFile(pdfPath);
    const data = await pdfParseLib(pdfBuffer);
    console.log(`[PDF-PARSE EXTRACTOR] Successfully extracted ${data.text.length} characters.`);
    return data.text;
  } catch (error) {
    console.error(`[PDF-PARSE EXTRACTOR] Failed to extract text from PDF ${pdfPath}:`, error);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
};
