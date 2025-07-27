/**
 * src/jobs/scrapers/ncr/deterministicParse/lib/textExtractionTabula.ts
 *
 * This module is responsible for extracting tabular data from PDF files
 * by executing a Python script that uses the Tabula-py library.
 * It acts as a bridge between the Node.js environment and the Python-based
 * Tabula extraction.
 *
 * Requirements:
 * - Python installed on the system.
 * - `tabula-py` library installed in the Python environment (`pip install tabula-py`).
 * - A Python script (`extract_tables_tabula.py`) that handles the Tabula extraction.
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * Interface for the expected structured output from Tabula.
 * It's an array of objects, where each object represents a row with column headers as keys.
 */
export type TabulaExtractedData = { [key: string]: string | number | null | undefined }[];

/**
 * Extracts tables from a PDF file using a Python script that leverages Tabula-py.
 * The Python script is expected to return JSON string of the extracted tables.
 *
 * @param pdfPath The absolute path to the PDF file.
 * @returns A Promise that resolves with the raw extracted structured table data from Tabula.
 * @throws Error if the Python script execution fails or returns an error.
 */
export const extractTablesWithTabula = async (pdfPath: string): Promise<TabulaExtractedData> => {
  console.log(`[TABULA EXTRACTOR] Attempting to extract tables from: ${pdfPath}`);

  // Corrected path to the Python script:
  // From 'src/jobs/scrapers/ncr/deterministicParse/lib/' (where __dirname points)
  // Go up one level: '../' -> 'src/jobs/scrapers/ncr/deterministicParse/'
  // Go up another level: '../../' -> 'src/jobs/scrapers/ncr/'
  // Then into 'python_scripts/'
  const pythonScriptPath = path.join(__dirname, '../../python_scripts/extract_tables_tabula.py');

  // Define debug log directory
  const debugLogDir = path.join(__dirname, 'tabula_extractor_debug_logs');
  await fs.mkdir(debugLogDir, { recursive: true });
  console.log(`[TABULA EXTRACTOR] Debug logs will be saved to: ${debugLogDir}`);

  // Ensure the Python script exists
  try {
    await fs.access(pythonScriptPath);
  } catch (error) {
    throw new Error(`[TABULA EXTRACTOR] Python script not found at ${pythonScriptPath}. Please ensure it exists.`);
  }

  return new Promise((resolve, reject) => {
    // Spawn a Python child process
    const pythonProcess = spawn('python', [pythonScriptPath, pdfPath]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      // Create a timestamp for the log file
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const logFileName = `tabula_output_${timestamp}.json`;
      const logFilePath = path.join(debugLogDir, logFileName);

      if (code !== 0) {
        const errorMessage = `[TABULA EXTRACTOR] Python script exited with code ${code}. Stderr: ${stderrData || 'No stderr output.'}`;
        console.error(errorMessage);
        // Attempt to save stderr for debugging failed runs
        try {
            await fs.writeFile(logFilePath.replace('.json', '_error.log'), stderrData || 'No stderr output.');
            console.error(`[TABULA EXTRACTOR] Error log saved to: ${logFilePath.replace('.json', '_error.log')}`);
        } catch (fileWriteError) {
            console.error(`[TABULA EXTRACTOR] Failed to write error log:`, fileWriteError);
        }
        try {
            const errorJson = JSON.parse(stderrData);
            reject(new Error(`Tabula extraction failed: ${errorJson.message || errorJson.error || 'Unknown error'}. Python stderr: ${stderrData}`));
        } catch {
            reject(new Error(errorMessage));
        }
        return;
      }

      try {
        // Save the raw stdout data (JSON string) to a debug file
        await fs.writeFile(logFilePath, stdoutData);
        console.log(`[TABULA EXTRACTOR] Raw Tabula output saved to: ${logFilePath}`);

        const extractedData: TabulaExtractedData = JSON.parse(stdoutData);
        console.log(`[TABULA EXTRACTOR] Successfully received ${extractedData.length} rows from Tabula.`);
        resolve(extractedData);
      } catch (parseError) {
        console.error(`[TABULA EXTRACTOR] Failed to parse JSON output from Python script:`, parseError);
        console.error(`[TABULA EXTRACTOR] Python stdout (partial): ${stdoutData.substring(0, 500)}...`);
        reject(new Error(`Failed to parse Tabula output: ${parseError}. Raw stdout: ${stdoutData.substring(0, 500)}...`));
      }
    });

    pythonProcess.on('error', (err) => {
      const errorMessage = `[TABULA EXTRACTOR] Failed to start Python process: ${err.message}. Check if Python is installed and in your PATH.`;
      console.error(errorMessage);
      reject(new Error(errorMessage));
    });
  });
};
