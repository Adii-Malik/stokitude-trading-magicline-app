import Papa from 'papaparse';
import fs from 'fs';

/**
 * Parse CSV file and extract symbol and magic line data
 * Expected columns: "Scrip" or "Symbol", "Magic Line" or "Magic Lin" (from image)
 */
export function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const symbols = [];
          const errors = [];

          results.data.forEach((row, index) => {
            // Try to find symbol column (flexible matching)
            const symbol = row['Scrip'] || row['Symbol'] || row['scrip'] || row['symbol'];
            
            // Try to find magic line column (flexible matching)
            const magicLine = row['Magic Line'] || row['Magic Lin'] || row['magic line'] || 
                            row['MagicLine'] || row['magicline'] || row['Threshold'];

            if (symbol && magicLine) {
              const parsedMagicLine = parseFloat(magicLine);
              
              if (!isNaN(parsedMagicLine)) {
                symbols.push({
                  symbol: symbol.trim(),
                  magicLine: parsedMagicLine
                });
              } else {
                errors.push(`Row ${index + 2}: Invalid magic line value "${magicLine}"`);
              }
            } else {
              if (!symbol && !magicLine) {
                // Skip empty rows
              } else {
                errors.push(`Row ${index + 2}: Missing ${!symbol ? 'symbol' : 'magic line'}`);
              }
            }
          });

          if (symbols.length === 0 && errors.length === 0) {
            reject(new Error('No valid data found in CSV. Expected columns: "Scrip" or "Symbol" and "Magic Line"'));
          } else {
            resolve({ symbols, errors });
          }
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Parse manual text/table data
 * Expected format: rows with symbol and magic line separated by comma, tab, or pipe
 */
export function parseTextTable(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const symbols = [];
  const errors = [];

  lines.forEach((line, index) => {
    // Try different delimiters: comma, tab, pipe, multiple spaces
    const parts = line.split(/[,\t|]|\s{2,}/).map(p => p.trim()).filter(p => p);
    
    if (parts.length >= 2) {
      const symbol = parts[0];
      const magicLine = parseFloat(parts[1]);
      
      if (!isNaN(magicLine)) {
        symbols.push({ symbol, magicLine });
      } else {
        errors.push(`Line ${index + 1}: Invalid magic line value "${parts[1]}"`);
      }
    } else {
      errors.push(`Line ${index + 1}: Invalid format. Expected: Symbol, MagicLine`);
    }
  });

  return { symbols, errors };
}

