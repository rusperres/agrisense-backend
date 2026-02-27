import axios from 'axios';
import * as path from 'node:path';
import * as fs from 'node:fs'; 
import * as fsp from 'node:fs/promises'; 

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

    await fsp.mkdir(saveDirectory, { recursive: true });

    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`[PDF Downloader] PDF downloaded successfully to: ${filePath}`);
        resolve(filePath);
      });
      writer.on('error', (err: Error) => {
        console.error(`[PDF Downloader] Error saving PDF to ${filePath}:`, err);
        reject(err);
      });
    });
  } catch (error: any) {
    console.error(`[PDF Downloader] Error downloading PDF from ${pdfUrl}:`, error.message);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};
