// src/jobs/scrapers/utils/pdfDownloader.ts <-- Updated path

import axios from 'axios';
import * as path from 'node:path';
import * as fs from 'node:fs'; // <--- CHANGE: Import from 'node:fs' for createWriteStream
import * as fsp from 'node:fs/promises'; // <--- NEW: Use fsp for promises-based operations like mkdir

/**
 * Downloads a PDF file from a given URL and saves it to the specified directory.
 * @param pdfUrl The URL of the PDF to download.
 * @param saveDirectory The directory where the PDF should be saved.
 * @param filename The desired filename for the downloaded PDF.
 * @returns The full path to the downloaded PDF file.
 */
export const downloadPdf = async (pdfUrl: string, saveDirectory: string, filename: string): Promise<string> => {
  const filePath = path.join(saveDirectory, filename);

  try {
    console.log(`[PDF Downloader] Attempting to download PDF from: ${pdfUrl}`);
    const response = await axios({
      method: 'GET',
      url: pdfUrl,
      responseType: 'stream',
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download PDF. Status: ${response.status} ${response.statusText}`);
    }

    // Ensure the directory exists using the promises-based fs
    await fsp.mkdir(saveDirectory, { recursive: true });

    // Use fs.createWriteStream from the regular 'node:fs' import
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`[PDF Downloader] PDF downloaded successfully to: ${filePath}`);
        resolve(filePath);
      });
      writer.on('error', (err: Error) => { // <--- CHANGE: Explicitly type 'err' as Error
        console.error(`[PDF Downloader] Error saving PDF to ${filePath}:`, err);
        reject(err);
      });
    });
  } catch (error: any) { // Keep as 'any' or provide a more specific type if known (e.g., AxiosError | Error)
    console.error(`[PDF Downloader] Error downloading PDF from ${pdfUrl}:`, error.message);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};