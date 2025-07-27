import pdfParseLib from 'pdf-parse';
import * as fs from 'node:fs/promises';

/**
 * Extracts raw text content from a local PDF file using pdf-parse.
 * @param pdfPath The local path to the PDF file.
 * @returns A Promise that resolves with the extracted text content.
 * @throws Error if PDF parsing fails.
 */
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
