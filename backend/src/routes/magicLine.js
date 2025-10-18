import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db/database.js';
import { parseCSV } from '../services/csvParser.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `magic-line-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});

// GET /api/magic-line - Get all symbols with their magic lines and current prices (Auth required)
router.get('/', authenticate, async (req, res) => {
  try {
    const data = await db.getFullData();
    const stats = await db.getStats();
    
    res.json({
      success: true,
      symbols: data,
      stats: stats
    });
  } catch (error) {
    console.error('Error in GET /api/magic-line:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve magic line data'
    });
  }
});

// GET /api/magic-line/:symbol - Get specific symbol data (Auth required)
router.get('/:symbol', authenticate, async (req, res) => {
  try {
    const { symbol } = req.params;
    const symbolData = await db.getSymbol(symbol);
    
    if (!symbolData) {
      return res.status(404).json({
        success: false,
        error: 'Symbol not found'
      });
    }
    
    // Get current price from centralized Stock model
    const fullData = await db.getFullData();
    const enrichedData = fullData.find(s => s.symbol === symbolData.symbol);
    
    res.json({
      success: true,
      symbol: enrichedData || symbolData
    });
  } catch (error) {
    console.error(`Error in GET /api/magic-line/${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve symbol data'
    });
  }
});

// POST /api/magic-line/upload - Upload magic line CSV file (Auth required)
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    
    // Parse CSV file
    const symbols = await parseCSV(filePath);
    
    if (!symbols || symbols.length === 0) {
      // Clean up the uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        error: 'No valid symbols found in CSV file'
      });
    }

    // Clear existing symbols (optional - could be a query param)
    const shouldClear = req.query.clearExisting === 'true';
    if (shouldClear) {
      await db.clearSymbols();
    }

    // Bulk insert/update symbols
    await db.bulkSetSymbols(symbols);
    
    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    // Get updated data and stats
    const data = await db.getFullData();
    const stats = await db.getStats();

    res.json({
      success: true,
      message: `Successfully uploaded ${symbols.length} symbols`,
      symbols: data,
      stats: stats
    });
  } catch (error) {
    console.error('Error in POST /api/magic-line/upload:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process CSV file'
    });
  }
});

// DELETE /api/magic-line - Clear all magic line symbols (Auth required)
router.delete('/', authenticate, async (req, res) => {
  try {
    await db.clearSymbols();
    
    res.json({
      success: true,
      message: 'All magic line symbols cleared successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/magic-line:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear symbols'
    });
  }
});

// GET /api/magic-line/stats/summary - Get statistics (Auth required)
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error in GET /api/magic-line/stats/summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// POST /api/magic-line/fetch-prices - Fetch closing prices from PSX (on-demand, Auth required)
router.post('/fetch-prices', authenticate, async (req, res) => {
  try {
    // Import the centralized price service
    const { updateStockPrices } = await import('../services/centralizedPriceService.js');
    
    // Fetch prices for active symbols
    await updateStockPrices();
    
    // Get updated data
    const data = await db.getFullData();
    const stats = await db.getStats();
    
    res.json({
      success: true,
      message: 'Prices updated successfully',
      symbols: data,
      stats: stats
    });
  } catch (error) {
    console.error('Error in POST /api/magic-line/fetch-prices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prices'
    });
  }
});

export default router;

