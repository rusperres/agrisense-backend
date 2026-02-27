import Tesseract from 'tesseract.js';
import * as fs from 'node:fs/promises'; 

export const performOcr = async (imageBuffer: Buffer): Promise<string> => {
    console.log('[OCR] Starting OCR process...');
    try {
        const { data: { text } } = await Tesseract.recognize(
            imageBuffer,
            'eng', 
            {
                logger: m => {
                    if (m.status && m.progress) {
                        console.log(`[TESSERACT] ${m.status}: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );
        console.log('[OCR] OCR process completed.');
        return text;
    } catch (error) {
        console.error('[OCR] Error during OCR process:', error);
        throw new Error(`OCR failed: ${error instanceof Error ? error.message : String(error)}`);
    }
};
