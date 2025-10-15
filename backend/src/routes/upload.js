import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV } from '../services/csvParser.js';
import { processImage } from '../services/ocrService.js';
import db from '../db/database.js';
import fs from 'fs';
import { adminOnly } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|csv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF) and CSV files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// POST /api/upload - Upload CSV or image file (Admin only)
router.post('/', adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    let symbols = [];
    let errors = [];
    let extractedText = null;

    // Process based on file type
    if (fileExt === '.csv') {
      console.log('📄 Processing CSV file...');
      const result = await parseCSV(filePath);
      symbols = result.symbols;
      errors = result.errors;
    } else {
      // Image file - use OCR
      console.log('🖼️ Processing image file with OCR...');
      const result = await processImage(filePath);
      symbols = result.symbols;
      errors = result.errors;
      extractedText = result.extractedText;
    }

    // Store symbols in database
    if (symbols.length > 0) {
      await db.bulkSetSymbols(symbols);
      console.log(`✅ Stored ${symbols.length} symbols in database`);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Successfully processed ${symbols.length} symbols`,
      data: {
        symbolsCount: symbols.length,
        symbols: symbols,
        errors: errors.length > 0 ? errors : undefined,
        extractedText: extractedText ? extractedText.substring(0, 500) : undefined
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: error.message
    });
  }
});

// POST /api/upload/manual - Manually add symbols via JSON (Admin only)
router.post('/manual', adminOnly, express.json(), async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        message: 'Expected "symbols" array in request body'
      });
    }

    const validSymbols = symbols.filter(s => s.symbol && !isNaN(parseFloat(s.magicLine)));
    
    if (validSymbols.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid symbols provided. Each symbol should have "symbol" and "magicLine" properties'
      });
    }

    await db.bulkSetSymbols(validSymbols);
    console.log(`✅ Manually added ${validSymbols.length} symbols`);

    res.json({
      success: true,
      message: `Successfully added ${validSymbols.length} symbols`,
      data: {
        symbolsCount: validSymbols.length,
        symbols: validSymbols
      }
    });

  } catch (error) {
    console.error('❌ Manual upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding symbols',
      error: error.message
    });
  }
});

export default router;

