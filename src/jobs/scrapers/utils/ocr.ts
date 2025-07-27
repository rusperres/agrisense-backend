import Tesseract from 'tesseract.js';
import * as fs from 'node:fs/promises'; // Needed if you want to test OCR with a direct image file

/**
 * Performs Optical Character Recognition (OCR) on a given image buffer.
 *
 * IMPORTANT NOTE: Tesseract.js directly processes image data (PNG, JPEG, etc.), NOT PDF buffers.
 * In a real-world scenario, if your input is a PDF, you MUST convert each PDF page
 * into an image buffer (e.g., PNG or JPEG) first. This typically requires:
 * 1. An external command-line utility like `poppler-utils` (e.g., `pdftocairo` or `pdftoppm`)
 * and a Node.js wrapper (e.g., `node-poppler` or `pdf-to-img`).
 * 2. A cloud-based PDF processing API that can render pages to images.
 *
 * For the purpose of this Canvas environment and demonstration, we are passing the
 * raw PDF buffer directly to Tesseract.recognize(). While Tesseract.js has some
 * internal handling for certain file types, for reliable PDF OCR, the PDF-to-image
 * conversion step is crucial and must be handled externally or by a more specialized library.
 *
 * @param imageBuffer The Buffer of the image (e.g., PNG, JPEG) to perform OCR on.
 * @returns A Promise that resolves with the extracted text.
 */
export const performOcr = async (imageBuffer: Buffer): Promise<string> => {
    console.log('[OCR] Starting OCR process...');
    try {
        const { data: { text } } = await Tesseract.recognize(
            imageBuffer,
            'eng', // Language code for English
            {
                logger: m => {
                    // Only log progress and status, not verbose details
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
