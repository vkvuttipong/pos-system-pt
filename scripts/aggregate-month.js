const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const month = process.argv[2] || '202603';
const DATA_DIR = path.join(__dirname, '..', 'data');
const files = fs.readdirSync(DATA_DIR).filter(f => new RegExp('^' + month + '\\d{2}\\.xlsx$').test(f));
let sales = [];
files.sort();
files.forEach(f => {
  const fp = path.join(DATA_DIR, f);
  const wb = XLSX.readFile(fp, { cellDates: true });
  let ws = wb.Sheets['sales'];
  if (!ws) {
    const sheetNames = Object.keys(wb.Sheets || {});
    if (sheetNames.length > 0) ws = wb.Sheets[sheetNames[0]];
  }
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rows && rows.length) sales = sales.concat(rows);
});
