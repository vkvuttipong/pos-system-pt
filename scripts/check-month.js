const fs = require('fs');
const path = require('path');
const month = process.argv[2] || '202603';
const DATA_DIR = path.join(__dirname, '..', 'data');
console.log('DATA_DIR =', DATA_DIR);
const files = fs.readdirSync(DATA_DIR).filter(f => new RegExp('^' + month + '\\d{2}\\.xlsx$').test(f));
console.log('month', month, 'matched files:', files);
