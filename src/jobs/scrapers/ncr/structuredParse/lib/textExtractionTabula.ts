import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export type TabulaExtractedData = { [key: string]: string | number | null | undefined }[];

export const extractTablesWithTabula = async (pdfPath: string): Promise<TabulaExtractedData> => {
  console.log(`[TABULA EXTRACTOR] Attempting to extract tables from: ${pdfPath}`);

  const pythonScriptPath = path.join(__dirname, '../../python_scripts/extract_tables_tabula.py');

  const debugLogDir = path.join(__dirname, 'tabula_extractor_debug_logs');
  await fs.mkdir(debugLogDir, { recursive: true });
  console.log(`[TABULA EXTRACTOR] Debug logs will be saved to: ${debugLogDir}`);

  try {
    await fs.access(pythonScriptPath);
  } catch (error) {
    throw new Error(`[TABULA EXTRACTOR] Python script not found at ${pythonScriptPath}. Please ensure it exists.`);
  }

  return new Promise((resolve, reject) => {
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
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const logFileName = `tabula_output_${timestamp}.json`;
      const logFilePath = path.join(debugLogDir, logFileName);

      if (code !== 0) {
        const errorMessage = `[TABULA EXTRACTOR] Python script exited with code ${code}. Stderr: ${stderrData || 'No stderr output.'}`;
        console.error(errorMessage);
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
