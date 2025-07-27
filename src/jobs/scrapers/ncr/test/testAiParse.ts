import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { extractTextFromPdf } from '../aiParse/lib/textExtractionPdfParse';
import { performOcr } from '../../utils/ocr'; // Ensure this path is correct
import { processUnstructuredData } from '../aiParse/unstructuredDataProcessor';

const runTestAiParse = async () => {
    console.log("--- Starting AI Parse (Unstructured Data Processor) Test ---");

    const pdfFileName = 'Daily-Price-Index-July-7-2025.pdf';
    const pdfDate = '2025-07-07';
    const localPdfPath = path.join(__dirname, '../../../../../data/pdfs', pdfFileName); // Adjust path relative to test file

    try {
        // Step 1: Extract raw text using pdf-parse
        let rawText = '';
        try {
            rawText = await extractTextFromPdf(localPdfPath);
            console.log(`[TEST-AI-PARSE] Successfully extracted ${rawText.length} characters using pdf-parse.`);
        } catch (error) {
            console.warn("[TEST-AI-PARSE] pdf-parse failed, this is normal if the PDF is image-based. Attempting OCR fallback.");
        }

        // Step 2: If text from pdf-parse is insufficient or failed, try OCR
        const MIN_TEXT_LENGTH_FOR_AI = 50; // Set a reasonable minimum length
        if (rawText.length < MIN_TEXT_LENGTH_FOR_AI) {
            console.log("[TEST-AI-PARSE] Text from pdf-parse is too short or empty. Attempting OCR...");
            try {
                const pdfBuffer = await fs.readFile(localPdfPath);
                rawText = await performOcr(pdfBuffer);
                console.log(`[TEST-AI-PARSE] Successfully extracted ${rawText.length} characters using OCR.`);
            } catch (ocrError) {
                console.error("[TEST-AI-PARSE] OCR fallback failed:", ocrError);
                rawText = ''; // Clear rawText if OCR fails
            }
        }

        if (!rawText.trim()) {
            console.error("[TEST-AI-PARSE] No usable raw text obtained for AI parsing. Please check PDF and OCR setup.");
            return;
        }

        // Step 3: Process the raw text using the AI parser
        console.log("[TEST-AI-PARSE] Passing raw text to processUnstructuredData...");
        const extractedItems = await processUnstructuredData(rawText, pdfDate);

        console.log("\n--- AI Parse Test Results ---");
        if (extractedItems.length > 0) {
            console.log(`Successfully extracted ${extractedItems.length} market price items.`);
            console.log("Sample extracted items (first 5):");
            extractedItems.slice(0, 5).forEach((item, index) => {
                console.log(`  ${index + 1}. Crop: ${item.crop_name}, Price: ${item.price}, Category: ${item.category}, Spec: ${item.specification || 'N/A'}`);
            });
            // You can log all items if you want: console.log(JSON.stringify(extractedItems, null, 2));
        } else {
            console.warn("No market price items were extracted by the AI parser. Check logs above for details.");
        }

    } catch (error) {
        console.error("[TEST-AI-PARSE] An unexpected error occurred during AI parse test:", error);
    } finally {
        console.log("--- AI Parse Test Finished ---");
    }
};

runTestAiParse().catch(console.error);
