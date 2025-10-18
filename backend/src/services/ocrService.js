import Tesseract from 'tesseract.js';
import { parseTextTable } from './csvParser.js';

/**
 * Extract text from image using OCR
 */
export async function extractTextFromImage(imagePath) {
  try {
    console.log('🔍 Starting OCR on image...');
    
    const result = await Tesseract.recognize(
      imagePath,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    console.log('✅ OCR completed');
    return result.data.text;
  } catch (error) {
    console.error('❌ OCR Error:', error);
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
}

/**
 * Process image and extract symbol/magic line data
 */
export async function processImage(imagePath) {
  try {
    // Extract text using OCR
    const extractedText = await extractTextFromImage(imagePath);
    
    // Parse the extracted text as a table
    const { symbols, errors } = parseTextTable(extractedText);

    return {
      symbols,
      errors,
      extractedText
    };
  } catch (error) {
    throw error;
  }
}

