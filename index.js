const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const moment = require('moment');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.xlsx');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeExpiryDate(value) {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('/');
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

function formatMoney(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function loadInventory() {
  ensureDataDir();
  if (!fs.existsSync(INVENTORY_FILE)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'products');
    XLSX.writeFile(wb, INVENTORY_FILE);
    return [];
  }
  const wb = XLSX.readFile(INVENTORY_FILE, { cellDates: true });
  const ws = wb.Sheets['products'];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }).map((item) => ({
    ...item,
    expiryDate: normalizeExpiryDate(item.expiryDate)
  }));
}

function saveInventory(items) {
  const normalized = (items || []).map((item) => ({
    ...item,
    expiryDate: normalizeExpiryDate(item.expiryDate)
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(normalized);
  XLSX.utils.book_append_sheet(wb, ws, 'products');
  XLSX.writeFile(wb, INVENTORY_FILE);
}

function getDailyFile(date = null) {
  const d = date ? moment(date, 'YYYYMMDD') : moment();
  const safe = d.isValid() ? d.format('YYYYMMDD') : moment().format('YYYYMMDD');
  return path.join(DATA_DIR, `${safe}.xlsx`);
}

function loadDailySales(date = null) {
  const file = getDailyFile(date);
  if (!fs.existsSync(file)) return [];
  const wb = XLSX.readFile(file, { cellDates: true });
  // Prefer sheet named 'sales', but fall back to the first sheet if not present
  let ws = wb.Sheets['sales'];
  if (!ws) {
    const sheetNames = Object.keys(wb.Sheets || {});
    if (sheetNames.length > 0) ws = wb.Sheets[sheetNames[0]];
  }
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function saveDailySales(sales, date = null) {
  const file = getDailyFile(date);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sales);
  XLSX.utils.book_append_sheet(wb, ws, 'sales');
  XLSX.writeFile(wb, file);
}

function addProduct(code, name, price, qty, expiryDate = '') {
  const inv = loadInventory();
  const idx = inv.findIndex((i) => i.code === code);
  const normalizedExpiry = normalizeExpiryDate(expiryDate);
  if (idx >= 0) {
    inv[idx].quantity = Number(qty);
    inv[idx].price = Number(price);
    inv[idx].name = name;
    inv[idx].expiryDate = normalizedExpiry;
  } else {
    inv.push({ code, name, price: Number(price), quantity: Number(qty), expiryDate: normalizedExpiry });
  }
  saveInventory(inv);
  console.log(`เพิ่ม/ปรับรายการ: ${code} | ${name} | ราคา ${price} | จำนวน ${qty} | วันหมดอายุ ${normalizedExpiry || '-'}`);
}

function changeStock(code, delta) {
  const inv = loadInventory();
  const item = inv.find((i) => i.code === code);
  if (!item) {
    console.log('ไม่พบสินค้าในคลัง');
    return;
  }
  item.quantity = Number(item.quantity) + Number(delta);
  if (item.quantity < 0) item.quantity = 0;
  saveInventory(inv);
  console.log(`ปรับสต็อกเรียบร้อย: ${code} = ${item.quantity}`);
}

function recordTransaction(type, code, qty, payment) {
  const inv = loadInventory();
  const item = inv.find((i) => i.code === code);
  if (!item) return;
  const now = moment();
  const amount = Number(item.price) * Number(qty) * (type === 'refund' ? -1 : 1);
  const sales = loadDailySales();
  sales.push({
    datetime: now.format('YYYY-MM-DD HH:mm:ss'),
    type,
    code: item.code,
    name: item.name,
    unitPrice: item.price,
    quantity: Number(qty) * (type === 'refund' ? -1 : 1),
    total: amount,
    payment: type === 'sale' ? payment : 'refund'
  });
  saveDailySales(sales);
}

function sellItem(code, qty, payment) {
  const inv = loadInventory();
  const item = inv.find((i) => i.code === code);
  if (!item) {
    console.log('สินค้าไม่ถูกต้อง');
    return;
  }
  if (Number(item.quantity) < Math.abs(Number(qty))) {
    console.log('สินค้าคงเหลือไม่เพียงพอ');
    return;
  }
  item.quantity = Number(item.quantity) - Number(qty);
  saveInventory(inv);
  recordTransaction('sale', code, Number(qty), payment);
  console.log(`ขายสินค้า: ${code} จำนวน ${qty} ชิ้น โดย ${payment}`);
}

function refundItem(code, qty) {
  const inv = loadInventory();
  const item = inv.find((i) => i.code === code);
  if (!item) {
    console.log('สินค้าไม่ถูกต้อง');
    return;
  }
  item.quantity = Number(item.quantity) + Number(qty);
  saveInventory(inv);
  recordTransaction('refund', code, Number(qty), 'refund');
  console.log(`คืนสินค้า: ${code} จำนวน ${qty} ชิ้น`);
}

function showInventory() {
  const inv = loadInventory();
  if (!inv.length) {
    console.log('ไม่พบข้อมูลสินค้าในคลัง');
    return;
  }
  console.log('สินค้าคงคลัง:');
  inv.forEach((i) => {
    console.log(`- ${i.code} | ${i.name} | ราคา ${i.price} | จำนวน ${i.quantity}`);
  });
}

function dailyReport(date = null) {
  const sales = loadDailySales(date);
  if (!sales.length) {
    console.log('ไม่มียอดขายวันนี้หรือวันที่เลือก');
    return;
  }
  const totalSale = sales.filter((r) => r.type === 'sale').reduce((sum, r) => sum + Number(r.total), 0);
  const totalRefund = sales.filter((r) => r.type === 'refund').reduce((sum, r) => sum + Number(r.total), 0);
  const cash = sales.filter((r) => r.payment === 'cash').reduce((sum, r) => sum + Number(r.total), 0);
  const transfer = sales.filter((r) => r.payment === 'transfer').reduce((sum, r) => sum + Number(r.total), 0);

  console.log(`สรุปยอดขายวันที่ ${date || moment().format('YYYY-MM-DD')}`);
  console.log(`- ยอดขายรวม: ${formatMoney(totalSale)}`);
  console.log(`- ยอดคืนรวม: ${formatMoney(totalRefund)}`);
  console.log(`- ยอดเงินสด: ${formatMoney(cash)}`);
  console.log(`- ยอดโอนธนาคาร: ${formatMoney(transfer)}`);
  console.log(`- ยอดสุทธิ: ${formatMoney(totalSale + totalRefund)}`);
}

function getSalesForPeriod(date = null, monthRaw = null) {
  let month = null;
  if (monthRaw) {
    const digits = String(monthRaw).trim().replace(/\D/g, '');
    if (/^[0-9]{6}$/.test(digits)) month = digits;
  }

  let sales = [];
  let label = null;

  if (month) {
    ensureDataDir();
    const files = fs.readdirSync(DATA_DIR).filter(f => new RegExp('^' + month + '\\d{2}\\.xlsx$').test(f));
    if (files.length > 0) {
      files.sort();
      files.forEach((f) => {
        const day = f.replace('.xlsx', '');
        const daySales = loadDailySales(day);
        if (daySales && daySales.length) sales = sales.concat(daySales);
      });
    }
    label = `${month.slice(0, 4)}-${month.slice(4, 6)}`;
  } else {
    sales = loadDailySales(date);
    label = date || moment().format('YYYY-MM-DD');
  }

  return { sales, label };
}

// ============ API ENDPOINTS ============

// Get all products
app.get('/api/inventory', (req, res) => {
  try {
    const inv = loadInventory();
    res.json({ success: true, data: inv });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add or update product
app.post('/api/product', (req, res) => {
  try {
    let { code, name, price, quantity, expiryDate } = req.body;
    code = code ? String(code).trim() : '';
    // Accept requests with empty name/nullable price/quantity by applying defaults
    if (!code) {
      return res.status(400).json({ success: false, error: 'รหัสสินค้า (code) เป็นค่าว่าง' });
    }
    // Treat missing or empty name as null (unknown name)
    name = (name === undefined || name === null || String(name).trim() === '') ? null : String(name).trim();
    price = price === undefined || price === null ? 0 : Number(price);
    quantity = quantity === undefined || quantity === null ? 0 : Number(quantity);
    const normalizedExpiry = normalizeExpiryDate(expiryDate);

    addProduct(code, name, price, quantity, normalizedExpiry);
    res.json({ success: true, message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update stock
app.post('/api/stock', (req, res) => {
  try {
    const { code, delta } = req.body;
    if (!code || delta === undefined) {
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' });
    }
    changeStock(code, Number(delta));
    res.json({ success: true, message: 'ปรับสต็อกสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Record sale transaction
app.post('/api/sell', (req, res) => {
  try {
    const { code, quantity, payment } = req.body;
    if (!code || quantity === undefined || !payment) {
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' });
    }
    if (!['cash', 'transfer'].includes(payment)) {
      return res.status(400).json({ success: false, error: 'ประเภทการชำระเงินไม่ถูกต้อง' });
    }
    sellItem(code, Number(quantity), payment);
    res.json({ success: true, message: 'ขายสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Record refund
app.post('/api/refund', (req, res) => {
  try {
    const { code, quantity } = req.body;
    if (!code || quantity === undefined) {
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' });
    }
    refundItem(code, Number(quantity));
    res.json({ success: true, message: 'คืนสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get top-selling products for a selected period
app.get('/api/top-products', (req, res) => {
  try {
    const date = req.query.date;
    const monthRaw = req.query.month ? String(req.query.month).trim() : null;
    const { sales, label } = getSalesForPeriod(date, monthRaw);

    const soldItems = sales.filter((r) => r.type === 'sale');
    const aggregated = new Map();

    soldItems.forEach((item) => {
      const code = String(item.code || '');
      const name = String(item.name || 'ไม่ระบุ');
      const key = `${code}::${name}`;
      const qty = Math.abs(Number(item.quantity) || 0);
      const total = Number(item.total) || 0;
      if (!aggregated.has(key)) {
        aggregated.set(key, { code, name, quantity: 0, total: 0 });
      }
      const current = aggregated.get(key);
      current.quantity += qty;
      current.total += total;
    });

    const items = Array.from(aggregated.values())
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return b.total - a.total;
      })
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        date: label,
        items
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get daily report
app.get('/api/report', (req, res) => {
  try {
    const date = req.query.date;
    // sanitize month param (accept YYYYMM or YYYY-MM or similar)
    let monthRaw = req.query.month ? String(req.query.month).trim() : null;
    let month = null; // normalized YYYYMM
    if (monthRaw) {
      // remove non-digit characters
      const digits = monthRaw.replace(/\D/g, '');
      if (/^[0-9]{6}$/.test(digits)) month = digits;
    }

    console.log(`/api/report called - date=${date || ''} monthRaw=${monthRaw || ''} month=${month || ''}`);

    let sales = [];
    let label = null;

    if (month) {
      // aggregate all daily files for the given month (YYYYMM)
      ensureDataDir();
      const files = fs.readdirSync(DATA_DIR).filter(f => new RegExp('^' + month + '\\d{2}\\.xlsx$').test(f));
      console.log('  matched files:', files);
      if (files.length === 0) {
        const label = `${month.slice(0,4)}-${month.slice(4,6)}`;
        return res.json({
          success: true,
          data: {
            date: label,
            totalSale: 0,
            totalRefund: 0,
            cash: 0,
            transfer: 0,
            net: 0,
            transactions: []
          }
        });
      }

      files.sort();
      files.forEach(f => {
        const day = f.replace('.xlsx', '');
        const daySales = loadDailySales(day);
        if (daySales && daySales.length) sales = sales.concat(daySales);
      });
      label = `${month.slice(0,4)}-${month.slice(4,6)}`;
    } else {
      sales = loadDailySales(date);
      label = date || moment().format('YYYY-MM-DD');
    }

    if (!sales.length) {
      return res.json({ 
        success: true, 
        data: {
          date: label,
          totalSale: 0,
          totalRefund: 0,
          cash: 0,
          transfer: 0,
          net: 0,
          transactions: []
        }
      });
    }

    const totalSale = sales.filter((r) => r.type === 'sale').reduce((sum, r) => sum + Number(r.total), 0);
    const totalRefund = sales.filter((r) => r.type === 'refund').reduce((sum, r) => sum + Number(r.total), 0);
    const cash = sales.filter((r) => r.payment === 'cash').reduce((sum, r) => sum + Number(r.total), 0);
    const transfer = sales.filter((r) => r.payment === 'transfer').reduce((sum, r) => sum + Number(r.total), 0);

    res.json({
      success: true,
      data: {
        date: label,
        totalSale: parseFloat(totalSale.toFixed(2)),
        totalRefund: parseFloat(totalRefund.toFixed(2)),
        cash: parseFloat(cash.toFixed(2)),
        transfer: parseFloat(transfer.toFixed(2)),
        net: parseFloat((totalSale + totalRefund).toFixed(2)),
        // 15% deduction (e.g., fee or cost). Provide both fee and net-after-fee.
        fee15: parseFloat((totalSale * 0.15).toFixed(2)),
        netAfterFee: parseFloat((totalSale - (totalSale * 0.15)).toFixed(2)),
        transactions: sales
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get available dates with sales data
app.get('/api/available-dates', (req, res) => {
  try {
    ensureDataDir();
    const files = fs.readdirSync(DATA_DIR).filter(f => /^\d{8}\.xlsx$/.test(f));
    const dates = files.map(f => f.replace('.xlsx', '')).sort().reverse();
    res.json({ success: true, data: dates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete product
app.delete('/api/product/:code', (req, res) => {
  try {
    const code = req.params.code;
    const inv = loadInventory();
    const idx = inv.findIndex(i => i.code === code);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'ไม่พบสินค้า' });
    }
    inv.splice(idx, 1);
    saveInventory(inv);
    res.json({ success: true, message: 'ลบสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  ensureDataDir();
  console.log(`🚀 POS System running at http://localhost:${PORT}`);
});
