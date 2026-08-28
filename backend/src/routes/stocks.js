import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import Stock from '../models/Stock.js';
import { adminOnly, authenticate } from '../middleware/auth.js';
import { escapeRegex } from '../utils/escapeRegex.js';

const router = express.Router();

// Configure multer for CSV upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Get all stocks (with pagination and search)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 100, search = '', sector = '', shariahCompliant = '' } = req.query;

    const query = {};

    // Search by symbol or company name
    if (search) {
      query.$or = [
        { symbol: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by sector
    if (sector) {
      query.sector = sector;
    }

    // Filter by shariah compliance
    if (shariahCompliant) {
      query.shariahCompliant = shariahCompliant;
    }

    const total = await Stock.countDocuments(query);
    const stocks = await Stock.find(query)
      .sort({ symbol: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({
      success: true,
      data: {
        stocks,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stocks',
      error: error.message
    });
  }
});

// Get stock by ID
router.get('/:id', async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    res.json({
      success: true,
      data: stock
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock',
      error: error.message
    });
  }
});

// Search/Autocomplete for stock symbols (for trade plans)
// Signed in, because the suggestions are scoped to the market you are in and a
// request with no user has no market. It is only ever called from inside the app.
router.get('/search/autocomplete', authenticate, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 1) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Escaped, because the raw query went straight into a regex: typing '[' or
    // '*' built an invalid pattern and returned a 500.
    const safe = escapeRegex(q.trim());

    // No market filter here any more - the model carries one, so this returns
    // the stocks of whichever market the request is in.
    const stocks = await Stock.find({
      $or: [
        { symbol: { $regex: `^${safe}`, $options: 'i' } },
        { companyName: { $regex: safe, $options: 'i' } }
      ]
    })
      .select('symbol companyName sector shariahCompliant currentPrice delisted')
      .limit(10)
      .sort({ symbol: 1 });

    res.json({
      success: true,
      data: stocks
    });
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search stocks',
      error: error.message
    });
  }
});

// Create a new stock (Admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { symbol, companyName, sector, shariahCompliant } = req.body;

    // Validate required fields
    if (!symbol || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Symbol and Company Name are required'
      });
    }

    // Check if stock already exists
    const existing = await Stock.findOne({ symbol: symbol.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Stock with symbol ${symbol} already exists`
      });
    }

    const stock = new Stock({
      symbol: symbol.toUpperCase(),
      companyName: companyName.trim(),
      sector: sector?.trim() || null,
      shariahCompliant: shariahCompliant || null
    });

    await stock.save();

    res.status(201).json({
      success: true,
      message: 'Stock created successfully',
      data: stock
    });
  } catch (error) {
    console.error('Error creating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create stock',
      error: error.message
    });
  }
});

// Update a stock (Admin only)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { symbol, companyName, sector, shariahCompliant, delisted } = req.body;

    // Validate required fields
    if (!symbol || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Symbol and Company Name are required'
      });
    }

    // Check if symbol is being changed and if new symbol exists
    const stock = await Stock.findById(req.params.id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    if (stock.symbol !== symbol.toUpperCase()) {
      const existing = await Stock.findOne({ symbol: symbol.toUpperCase() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Stock with symbol ${symbol} already exists`
        });
      }
    }

    stock.symbol = symbol.toUpperCase();
    stock.companyName = companyName.trim();
    stock.sector = sector?.trim() || null;
    stock.shariahCompliant = shariahCompliant || null;
    // Only when the caller says so, so an older client that omits the field
    // cannot silently re-list a stock.
    if (delisted !== undefined) stock.delisted = Boolean(delisted);

    await stock.save();

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: stock
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock',
      error: error.message
    });
  }
});

// Delete a stock (Admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const stock = await Stock.findByIdAndDelete(req.params.id);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    res.json({
      success: true,
      message: 'Stock deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete stock',
      error: error.message
    });
  }
});

// Bulk upload stocks from CSV (Admin only)
router.post('/upload/csv', adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const results = [];
    const errors = [];
    let lineNumber = 1;

    // Parse CSV
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;

          // Validate required fields
          const symbol = row.Symbol?.trim()?.toUpperCase();
          const companyName = row.CompanyName?.trim();

          if (!symbol || !companyName) {
            errors.push({
              line: lineNumber,
              error: 'Missing Symbol or CompanyName',
              data: row
            });
            return;
          }

          results.push({
            symbol,
            companyName,
            sector: row.Sector?.trim() || null,
            shariahCompliant: row.ShariahCompliant?.trim() || null
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in CSV',
        errors
      });
    }

    // Bulk insert with upsert (update if exists, insert if not)
    const bulkOps = results.map(stock => ({
      updateOne: {
        filter: { symbol: stock.symbol },
        update: { $set: stock },
        upsert: true
      }
    }));

    const bulkResult = await Stock.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: 'Stocks uploaded successfully',
      data: {
        total: results.length,
        inserted: bulkResult.upsertedCount,
        updated: bulkResult.modifiedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error uploading stocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload stocks',
      error: error.message
    });
  }
});

// Get unique sectors (for filtering)
router.get('/meta/sectors', async (req, res) => {
  try {
    const sectors = await Stock.distinct('sector', { sector: { $ne: null } });

    res.json({
      success: true,
      data: sectors.sort()
    });
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sectors',
      error: error.message
    });
  }
});

export default router;

