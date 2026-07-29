const XLSX = require('xlsx');
const path = require('path');
const files = ['20260328.xlsx','20260329.xlsx'];
const DATA_DIR = path.join(__dirname, '..', 'data');
files.forEach(f => {
  const fp = path.join(DATA_DIR, f);
  try {
    const wb = XLSX.readFile(fp, { cellDates: true });
    wb.SheetNames.forEach(sn => {
      const ws = wb.Sheets[sn];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (data.length > 0) {
        // no-op: inspected silently
      }
    });
  } catch (err) {
    console.error('error reading', f, err.message);
  }
});
