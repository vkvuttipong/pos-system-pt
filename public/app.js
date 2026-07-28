// ============ STATE ============
let cart = [];
let selectedProductForModal = null;
let editingProductCode = null;
let inventoryData = [];
let currentPage = 1;
let itemsPerPage = 10;
let sortColumn = null; // 'code', 'name', 'price', 'quantity'
let sortDirection = 'asc'; // 'asc', 'desc'

// Report pagination state
let reportCurrentPage = 1;
let reportItemsPerPage = 10;
let transactionsData = [];

// ============ DOM ELEMENTS ============
const cartItemsEl = document.getElementById('cart-items');
const cartCountEl = document.getElementById('cart-count');
const cartTotalEl = document.getElementById('cart-total');
const productListEl = document.getElementById('product-list');
const inventoryTbodyEl = document.getElementById('inventory-tbody');
const transactionsTbodyEl = document.getElementById('transactions-tbody');
const checkoutBtn = document.getElementById('checkout-btn');
const clearCartBtn = document.getElementById('clear-cart-btn');
// add-product form removed (inline), but modal is available for adding when not found
const quantityModal = document.getElementById('quantity-modal');
const refundModal = document.getElementById('refund-modal');
const editModal = document.getElementById('edit-modal');
const notificationEl = document.getElementById('notification');
const reportDateEl = document.getElementById('report-date');
const reportMonthEl = document.getElementById('report-month');
const reportTypeEls = document.getElementsByName('report-type');
const reportPrevMonthBtn = document.getElementById('report-prev-month');
const reportNextMonthBtn = document.getElementById('report-next-month');
const generateReportBtn = document.getElementById('generate-report-btn');
const topProductsDateEl = document.getElementById('top-products-date');
const topProductsMonthEl = document.getElementById('top-products-month');
const topProductsTypeEls = document.getElementsByName('top-products-type');
const topProductsPrevMonthBtn = document.getElementById('top-products-prev-month');
const topProductsNextMonthBtn = document.getElementById('top-products-next-month');
const generateTopProductsBtn = document.getElementById('generate-top-products-btn');
const topProductsTbodyEl = document.getElementById('top-products-tbody');
const topProductsInfoEl = document.getElementById('top-products-info');
const barcodeInputEl = document.getElementById('barcode-input');
const productCodeInput = document.getElementById('product-code');
const inventoryTotalValueEl = document.getElementById('inventory-total-value');
// Payment confirm modal elements
const paymentConfirmModal = document.getElementById('payment-confirm-modal');
const confirmTotalEl = document.getElementById('confirm-total');
const confirmFeeEl = document.getElementById('confirm-fee15');
const confirmNetAfterEl = document.getElementById('confirm-net-after');
const confirmReceivedEl = document.getElementById('confirm-received');
const confirmChangeEl = document.getElementById('confirm-change');
const confirmStatusEl = document.getElementById('confirm-status');
const confirmPaymentBtn = document.getElementById('confirm-payment-btn');
const cancelPaymentBtn = document.getElementById('cancel-payment-btn');
const paymentConfirmClose = document.getElementById('payment-confirm-close');
// Add-product modal elements
const addProductModal = document.getElementById('add-product-modal');
const addProductCodeInput = document.getElementById('add-product-code');
const addProductNameInput = document.getElementById('add-product-name');
const addProductPriceInput = document.getElementById('add-product-price');
const addProductQtyInput = document.getElementById('add-product-qty');
const confirmAddBtn = document.getElementById('confirm-add-btn');
const cancelAddBtn = document.getElementById('cancel-add-btn');
// Payment / cash UI
const receivedAmountEl = document.getElementById('received-amount');
const changeAmountEl = document.getElementById('change-amount');
const cashControlsEl = document.getElementById('cash-controls');
const clearReceivedBtn = document.getElementById('clear-received-btn');
const denomButtons = {
    1000: document.getElementById('bill-1000'),
    500: document.getElementById('bill-500'),
    100: document.getElementById('bill-100'),
    50: document.getElementById('bill-50'),
    20: document.getElementById('bill-20'),
    10: document.getElementById('coin-10'),
    5: document.getElementById('coin-5'),
    1: document.getElementById('coin-1')
};

let pendingNewProductCode = null;

function formatMoney(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    loadInventory();
    loadAvailableDates();
    
    setupEventListeners();
    // Auto-focus barcode input for scanner convenience
    if (barcodeInputEl) {
        barcodeInputEl.focus();
    }
    // If page starts on inventory tab, focus the product code input
    const inventoryTabBtn = document.querySelector('[data-tab="inventory"]');
    if (inventoryTabBtn && inventoryTabBtn.classList.contains('active')) {
        setTimeout(() => {
            const codeInput = document.getElementById('product-code');
            if (codeInput) {
                codeInput.focus();
                codeInput.select();
            }
        }, 50);
    }
    // layout is fixed in HTML (product left, cart right)
    // initialize payment UI
    updatePaymentUI();
});

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });


    // Sales
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('checkout clicked - opening payment confirm modal');
            openPaymentConfirmModal();
        });
    }
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    
    // Inventory add-product UI removed per user request
    // Product-code input: when scanning/pasting code in inventory tab
    if (productCodeInput) {
        productCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleInventoryCodeInput(productCodeInput.value);
                // keep the code in input so user can see it; clear only when new product added
                e.preventDefault();
            }
        });

        productCodeInput.addEventListener('paste', (e) => {
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            setTimeout(() => {
                const val = productCodeInput.value || paste;
                if (val) handleInventoryCodeInput(val);
            }, 10);
        });
    }
    

    // Report
    if (generateReportBtn) generateReportBtn.addEventListener('click', loadReport);
    // report type switch (day/month)
    if (reportTypeEls && reportTypeEls.length) {
        reportTypeEls.forEach(r => r.addEventListener('change', () => {
            const monthWrap = document.querySelector('.report-month-input');
            const dateWrap = document.querySelector('.report-date-input');
            if (r.value === 'month' && r.checked) {
                monthWrap.style.display = 'block';
                dateWrap.style.display = 'none';
                // auto-load selected month
                if (reportMonthEl && reportMonthEl.value) loadReport();
            } else if (r.value === 'day' && r.checked) {
                monthWrap.style.display = 'none';
                dateWrap.style.display = 'block';
            }
        }));
    }

    // Prev/Next month buttons
    if (reportPrevMonthBtn) reportPrevMonthBtn.addEventListener('click', () => adjustMonth(-1));
    if (reportNextMonthBtn) reportNextMonthBtn.addEventListener('click', () => adjustMonth(1));

    // Top products controls
    if (generateTopProductsBtn) generateTopProductsBtn.addEventListener('click', loadTopProducts);
    if (topProductsTypeEls && topProductsTypeEls.length) {
        topProductsTypeEls.forEach(r => r.addEventListener('change', () => {
            const monthWrap = document.querySelector('.top-products-month-input');
            const dateWrap = document.querySelector('.top-products-date-input');
            if (r.value === 'month' && r.checked) {
                monthWrap.style.display = 'block';
                dateWrap.style.display = 'none';
                if (topProductsMonthEl && topProductsMonthEl.value) loadTopProducts();
            } else if (r.value === 'day' && r.checked) {
                monthWrap.style.display = 'none';
                dateWrap.style.display = 'block';
            }
        }));
    }
    if (topProductsPrevMonthBtn) topProductsPrevMonthBtn.addEventListener('click', () => adjustTopProductsMonth(-1));
    if (topProductsNextMonthBtn) topProductsNextMonthBtn.addEventListener('click', () => adjustTopProductsMonth(1));

    // Modal Close
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('show');
        });
    });

    console.log('setupEventListeners completed');

    // Add-product modal handlers
    if (confirmAddBtn) {
        confirmAddBtn.addEventListener('click', async () => {
            const code = addProductCodeInput?.value || pendingNewProductCode || '';
            const name = (addProductNameInput?.value || '').trim();
            const price = parseFloat(addProductPriceInput?.value) || 0;
            const qty = parseInt(addProductQtyInput?.value) || 0;

            if (!code || !name) {
                showNotification('กรุณากรอกรหัสและชื่อสินค้า', 'error');
                return;
            }

            try {
                const response = await fetch('/api/product', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, name, price, quantity: qty })
                });
                const result = await response.json();
                if (!result.success) throw new Error(result.error);

                showNotification('เพิ่มสินค้าสำเร็จ', 'success');
                if (addProductModal) addProductModal.classList.remove('show');
                pendingNewProductCode = null;
                if (addProductCodeInput) addProductCodeInput.value = '';
                if (addProductNameInput) addProductNameInput.value = '';
                if (addProductPriceInput) addProductPriceInput.value = '0.00';
                if (addProductQtyInput) addProductQtyInput.value = 1;
                loadInventory();
                setTimeout(() => {
                    const codeInput = document.getElementById('product-code');
                    if (codeInput) { codeInput.value = ''; codeInput.focus(); codeInput.select(); }
                }, 100);
            } catch (err) {
                showNotification('เพิ่มสินค้าไม่สำเร็จ: ' + err.message, 'error');
            }
        });
    }
    if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', () => {
            if (addProductModal) addProductModal.classList.remove('show');
            pendingNewProductCode = null;
            const codeInput = document.getElementById('product-code');
            if (codeInput) { setTimeout(() => { codeInput.value = ''; codeInput.focus(); codeInput.select(); }, 50); }
        });
    }

    const confirmQtyBtn = document.getElementById('confirm-quantity-btn');
    if (confirmQtyBtn) confirmQtyBtn.addEventListener('click', addToCart);
    const cancelQtyBtn = document.getElementById('cancel-quantity-btn');
    if (cancelQtyBtn) cancelQtyBtn.addEventListener('click', () => {
        if (quantityModal) quantityModal.classList.remove('show');
    });

    // Quantity +/- buttons
    const qtyPlusBtn = document.getElementById('qty-plus-btn');
    if (qtyPlusBtn) qtyPlusBtn.addEventListener('click', () => {
        const input = document.getElementById('quantity-input');
        const max = parseInt(input.max) || 999;
        if (parseInt(input.value) < max) {
            input.value = parseInt(input.value) + 1;
        }
    });

    const qtyMinusBtn = document.getElementById('qty-minus-btn');
    if (qtyMinusBtn) qtyMinusBtn.addEventListener('click', () => {
        const input = document.getElementById('quantity-input');
        if (parseInt(input.value) > 1) {
            input.value = parseInt(input.value) - 1;
        }
    });

    // Refund +/- buttons
    const refundPlus = document.getElementById('refund-qty-plus-btn');
    if (refundPlus) refundPlus.addEventListener('click', () => {
        const input = document.getElementById('refund-qty-input');
        const max = parseInt(input.max) || 999;
        if (parseInt(input.value) < max) {
            input.value = parseInt(input.value) + 1;
        }
    });

    const refundMinus = document.getElementById('refund-qty-minus-btn');
    if (refundMinus) refundMinus.addEventListener('click', () => {
        const input = document.getElementById('refund-qty-input');
        if (parseInt(input.value) > 1) {
            input.value = parseInt(input.value) - 1;
        }
    });

    // Edit +/- buttons
    const editPlus = document.getElementById('edit-qty-plus-btn');
    if (editPlus) editPlus.addEventListener('click', () => {
        const input = document.getElementById('edit-qty');
        if (parseInt(input.value) < 9999) {
            input.value = parseInt(input.value) + 1;
        }
    });

    const editMinus = document.getElementById('edit-qty-minus-btn');
    if (editMinus) editMinus.addEventListener('click', () => {
        const input = document.getElementById('edit-qty');
        if (parseInt(input.value) > 0) {
            input.value = parseInt(input.value) - 1;
        }
    });

    // Edit product buttons
    document.getElementById('confirm-edit-btn').addEventListener('click', confirmEditProduct);
    document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);

    function cancelEdit() {
        // Clear editing state and inputs
        editingProductCode = null;
        editModal.classList.remove('show');
        const fields = ['edit-name', 'edit-price', 'edit-qty', 'edit-expiry-date'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // Return focus to product-code for quick scanning/input
        const codeInput = document.getElementById('product-code');
        if (codeInput) {
            setTimeout(() => {
                // clear input before focusing so it's ready for a fresh scan
                codeInput.value = '';
                codeInput.focus();
                codeInput.select();
            }, 50);
        }
    }

    // Ensure clicking the close (X) on edit modal also cancels properly
    const editModalCloseBtn = document.querySelector('#edit-modal .close');
    if (editModalCloseBtn) editModalCloseBtn.addEventListener('click', cancelEdit);
    // Delete button in edit modal
    const deleteProductBtn = document.getElementById('delete-product-btn');
    if (deleteProductBtn) {
        deleteProductBtn.addEventListener('click', async () => {
            if (!editingProductCode) return;
            if (!confirm('ต้องการลบสินค้านี้หรือไม่?')) return;
            try {
                const response = await fetch(`/api/product/${editingProductCode}`, { method: 'DELETE' });
                const result = await response.json();
                if (!result.success) throw new Error(result.error);
                showNotification('ลบสินค้าสำเร็จ', 'success');
                editModal.classList.remove('show');
                editingProductCode = null;
                loadInventory();
                const codeInput = document.getElementById('product-code');
                if (codeInput) { setTimeout(() => { codeInput.value = ''; codeInput.focus(); codeInput.select(); }, 50); }
            } catch (err) {
                showNotification('ลบสินค้าไม่สำเร็จ: ' + err.message, 'error');
            }
        });
    }

    // Sort by column headers
    document.querySelectorAll('th.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            
            if (sortColumn === column) {
                // Toggle direction if same column
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // Set new column and default to ascending
                sortColumn = column;
                sortDirection = 'asc';
            }
            
            currentPage = 1;
            displayInventoryTable(inventoryData);
            updateSortIcons();
        });
    });

    // Items per page selector for Inventory
    const inventorySelector = document.getElementById('items-per-page-select');
    if (inventorySelector) {
        inventorySelector.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            displayInventoryTable(inventoryData);
            window.scrollTo(0, 0);
        });
    }

    // Pagination buttons
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayInventoryTable(inventoryData);
            window.scrollTo(0, 0);
        }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
        const totalPages = Math.ceil(inventoryData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayInventoryTable(inventoryData);
            window.scrollTo(0, 0);
        }
    });

    // Items per page selector for Report
    const reportSelector = document.getElementById('report-items-per-page-select');
    if (reportSelector) {
        reportSelector.addEventListener('change', (e) => {
            reportItemsPerPage = parseInt(e.target.value);
            reportCurrentPage = 1;
            displayTransactionsPage(transactionsData);
        });
    }

    // Report pagination buttons
    document.getElementById('report-prev-btn').addEventListener('click', () => {
        if (reportCurrentPage > 1) {
            reportCurrentPage--;
            displayTransactionsPage(transactionsData);
        }
    });

    document.getElementById('report-next-btn').addEventListener('click', () => {
        const totalPages = Math.ceil(transactionsData.length / reportItemsPerPage);
        if (reportCurrentPage < totalPages) {
            reportCurrentPage++;
            displayTransactionsPage(transactionsData);
        }
    });

    // Refund modal (already has refund qty buttons)
    document.getElementById('confirm-refund-btn').addEventListener('click', confirmRefund);
    document.getElementById('cancel-refund-btn').addEventListener('click', () => {
        refundModal.classList.remove('show');
    });

    // Payment UI: denomination buttons
    Object.keys(denomButtons).forEach(key => {
        const btn = denomButtons[key];
        if (!btn) return;
        btn.addEventListener('click', () => {
            const val = Number(key);
            const cur = parseFloat(receivedAmountEl.value) || 0;
            receivedAmountEl.value = (cur + val).toFixed(2);
            updatePaymentUI();
        });
    });

    if (clearReceivedBtn) {
        clearReceivedBtn.addEventListener('click', () => {
            receivedAmountEl.value = '0.00';
            updatePaymentUI();
        });
    }

    if (receivedAmountEl) {
        receivedAmountEl.addEventListener('input', updatePaymentUI);
    }

    // Payment type change: enable/disable cash controls
    document.querySelectorAll('input[name="payment"]').forEach(r => {
        r.addEventListener('change', updatePaymentUI);
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });

    // Barcode Scanner Input Handler
    if (barcodeInputEl) {
        // Default: many USB barcode scanners act like keyboard and send the code + Enter
        barcodeInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleBarcodeInput(barcodeInputEl.value);
                barcodeInputEl.value = ''; // Clear for next scan
                e.preventDefault();
            }
        });

        // Support paste (some scanners or manual paste)
        barcodeInputEl.addEventListener('paste', (e) => {
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            // small timeout to allow pasted value to appear in input
            setTimeout(() => {
                const val = barcodeInputEl.value || paste;
                if (val) {
                    handleBarcodeInput(val);
                    barcodeInputEl.value = '';
                }
            }, 10);
        });

        // When clicking the barcode area, focus input so scanner sends there
        barcodeInputEl.addEventListener('click', () => barcodeInputEl.focus());

        // Global keydown: focus appropriate input depending on active tab
        document.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            const isInputFocused = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
            if (isInputFocused) return;
            if (!/[0-9]/.test(e.key)) return;

            // Determine active tab
            const activeTabEl = document.querySelector('.tab-content.active');
            const activeTabId = activeTabEl ? activeTabEl.id : null;

            if (activeTabId === 'sales') {
                if (barcodeInputEl) {
                    barcodeInputEl.focus();
                    barcodeInputEl.select();
                }
            } else if (activeTabId === 'inventory') {
                if (productCodeInput) {
                    productCodeInput.focus();
                    productCodeInput.select();
                }
            }
        });
    }

    // Payment confirm modal events
    if (confirmPaymentBtn) confirmPaymentBtn.addEventListener('click', () => {
        // call existing checkout handler
        // hide modal first
        console.log('confirm-payment clicked - proceeding to checkout');
        if (paymentConfirmModal) paymentConfirmModal.classList.remove('show');
        checkout();
    });
    if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', () => {
        if (paymentConfirmModal) paymentConfirmModal.classList.remove('show');
    });
    if (paymentConfirmClose) paymentConfirmClose.addEventListener('click', () => {
        if (paymentConfirmModal) paymentConfirmModal.classList.remove('show');
    });

    // Keyboard shortcuts when payment confirm modal is open
    document.addEventListener('keydown', (e) => {
        if (!paymentConfirmModal) return;
        const modalOpen = paymentConfirmModal.classList.contains('show');
        if (!modalOpen) return;

        // Prevent accidental submits while modal is open
        if (e.key === 'Enter') {
            e.preventDefault();
            if (confirmPaymentBtn) confirmPaymentBtn.click();
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            paymentConfirmModal.classList.remove('show');
        }
    });

    // Keyboard shortcuts for edit modal (Enter=save, Esc=cancel)
    document.addEventListener('keydown', (e) => {
        if (!editModal) return;
        const open = editModal.classList.contains('show');
        if (!open) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            confirmEditProduct();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

function openPaymentConfirmModal() {
    const total = calculateCartTotal();
    const fee15 = parseFloat((total * 0.15).toFixed(2));
    const netAfter = parseFloat((total - fee15).toFixed(2));
    const received = parseFloat(receivedAmountEl?.value) || 0;
    const change = Math.max(0, received - total);
    const status = netAfter < 0 ? `ขาดทุน ฿${formatMoney(Math.abs(netAfter))}` : `กำไร ฿${formatMoney(netAfter)}`;

    // Pre-check: if payment is cash, received must cover total before showing modal
    const paymentType = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
    if (paymentType === 'cash' && received < total) {
        showNotification('รับเงินไม่พอ กรุณากรอกจำนวนที่รับ', 'error');
        if (receivedAmountEl) {
            receivedAmountEl.focus();
            receivedAmountEl.select();
        }
        return;
    }

    if (confirmTotalEl) confirmTotalEl.textContent = formatMoney(total);
    if (confirmFeeEl) confirmFeeEl.textContent = formatMoney(fee15);
    if (confirmNetAfterEl) confirmNetAfterEl.textContent = formatMoney(netAfter);
    if (confirmReceivedEl) confirmReceivedEl.textContent = formatMoney(received);
    if (confirmChangeEl) confirmChangeEl.textContent = formatMoney(change);
    if (confirmStatusEl) confirmStatusEl.textContent = status;

    // populate product list
    const itemsEl = document.getElementById('confirm-items');
    if (itemsEl) {
        if (!cart.length) {
            itemsEl.innerHTML = '<li>ไม่มีสินค้า</li>';
        } else {
            itemsEl.innerHTML = cart.map(i => {
                const stockInfo = inventoryData.find(p => String(p.code) === String(i.code));
                const currentQty = Number(stockInfo?.quantity || 0);
                const remainingQty = Math.max(0, currentQty - Number(i.quantity || 0));
                return `<li>${i.name} × ${i.quantity} = ฿${formatMoney(i.price * i.quantity)} <span style="color:#667eea;">(คงเหลือ ${remainingQty})</span></li>`;
            }).join('');
        }
    }

    // payment type
    const paymentTypeEl = document.getElementById('confirm-payment-type');
    if (paymentTypeEl) {
        const p = document.querySelector('input[name="payment"]:checked')?.value || '-';
        paymentTypeEl.textContent = p === 'cash' ? 'เงินสด' : p === 'transfer' ? 'โอนธนาคาร' : p;
    }
    // show/hide change row depending on payment type
    const changeRow = document.getElementById('confirm-change-row');
    if (changeRow) {
        const p = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
        if (p === 'cash') {
            changeRow.style.display = 'flex';
            if (confirmChangeEl) confirmChangeEl.textContent = formatMoney(change);
        } else {
            changeRow.style.display = 'none';
            if (confirmChangeEl) confirmChangeEl.textContent = '-';
        }
    }
    // show/hide received row depending on payment type (hide for transfer)
    const receivedRow = document.getElementById('confirm-received-row');
    if (receivedRow) {
        const p = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
        if (p === 'cash') {
            receivedRow.style.display = 'flex';
            if (confirmReceivedEl) confirmReceivedEl.textContent = formatMoney(received);
        } else {
            receivedRow.style.display = 'none';
            if (confirmReceivedEl) confirmReceivedEl.textContent = '-';
        }
    }

    if (paymentConfirmModal) paymentConfirmModal.classList.add('show');
}


function adjustMonth(delta) {
    if (!reportMonthEl) return;
    const cur = reportMonthEl.value ? reportMonthEl.value : (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    })();

    const [y, m] = cur.split('-').map(Number);
    if (!y || !m) return;
    const date = new Date(y, m - 1 + delta, 1);
    const newVal = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    reportMonthEl.value = newVal;
    loadReport();
}

function adjustTopProductsMonth(delta) {
    if (!topProductsMonthEl) return;
    const cur = topProductsMonthEl.value ? topProductsMonthEl.value : (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    })();

    const [y, m] = cur.split('-').map(Number);
    if (!y || !m) return;
    const date = new Date(y, m - 1 + delta, 1);
    const newVal = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    topProductsMonthEl.value = newVal;
    loadTopProducts();
}
    // layout is fixed in HTML: product left, cart right
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    // Auto-focus barcode input when switching to Sales tab
    if (tabName === 'sales' && barcodeInputEl) {
        // small timeout to ensure element is visible/focused
        setTimeout(() => {
            barcodeInputEl.focus();
            barcodeInputEl.select();
        }, 50);
    }
    // Auto-focus product code when switching to Inventory tab
    if (tabName === 'inventory') {
        setTimeout(() => {
            const codeInput = document.getElementById('product-code');
            if (codeInput) {
                codeInput.focus();
                codeInput.select();
            }
        }, 50);
    }
    // Auto-run report when switching to Report tab
    if (tabName === 'report') {
        // small timeout so the tab content becomes visible
        setTimeout(() => {
            if (typeof loadReport === 'function') loadReport();
        }, 100);
    }
    if (tabName === 'top-products') {
        setTimeout(() => {
            if (typeof loadTopProducts === 'function') loadTopProducts();
        }, 100);
    }
}

// ============ UTILITIES ============
function updateDateTime() {
    const now = new Date();
    document.getElementById('current-date').textContent = 
        now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('current-time').textContent = 
        now.toLocaleTimeString('th-TH');
}

function showNotification(message, type = 'success') {
    notificationEl.textContent = message;
    notificationEl.className = `notification show ${type}`;
    setTimeout(() => {
        notificationEl.classList.remove('show');
    }, 3000);
}

// ============ INVENTORY ============
async function loadInventory() {
    try {
        const response = await fetch('/api/inventory');
        const result = await response.json();
        
        if (!result.success) throw new Error(result.error);
        
        const products = result.data || [];
        
        // Display products in sales section
        displayProducts(products);
        
        // Keep current sort state on reload
        
        // Display inventory table
        displayInventoryTable(products);
    } catch (error) {
        showNotification('โหลดสินค้าไม่สำเร็จ: ' + error.message, 'error');
    }
}

function displayProducts(products) {
    if (!products.length) {
        productListEl.innerHTML = '<p class="empty-message">ไม่มีสินค้า</p>';
        return;
    }
    
    productListEl.innerHTML = products.map(product => {
        const outOfStock = Number(product.quantity) === 0;
        const lowStock = Number(product.quantity) > 0 && Number(product.quantity) <= 5;
        
        return `
            <div class="product-item" onclick="selectProductForSale(this)" data-code="${product.code}">
                <h4>${product.name}</h4>
                <p>รหัส: ${product.code}</p>
                <div class="product-item-meta">
                    <span class="product-price">฿${formatMoney(product.price)}</span>
                    <span class="product-qty ${outOfStock ? 'out' : lowStock ? 'low' : ''}">
                        คงเหลือ: ${product.quantity}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function updateInventorySummary(products) {
    const totalValue = (products || []).reduce((sum, product) => {
        const price = Number(product.price) || 0;
        const qty = Number(product.quantity) || 0;
        return sum + (price * qty);
    }, 0);

    if (inventoryTotalValueEl) {
        inventoryTotalValueEl.textContent = `฿${formatMoney(totalValue)}`;
    }
}

function displayInventoryTable(products) {
    if (!products.length) {
        inventoryTbodyEl.innerHTML = '<tr><td colspan="6" class="empty-message">ไม่มีสินค้า</td></tr>';
        document.getElementById('pagination').style.display = 'none';
        updateInventorySummary(products);
        return;
    }
    
    inventoryData = products;
    updateInventorySummary(products);
    
    // Sort data
    let sortedData = [...inventoryData];
    if (sortColumn) {
        sortedData.sort((a, b) => {
            let aVal = a[sortColumn];
            let bVal = b[sortColumn];
            
            if (sortColumn === 'expiryDate') {
                const aExpiry = aVal ? new Date(aVal) : null;
                const bExpiry = bVal ? new Date(bVal) : null;
                const aTime = aExpiry && !Number.isNaN(aExpiry.getTime()) ? aExpiry.getTime() : Number.MAX_SAFE_INTEGER;
                const bTime = bExpiry && !Number.isNaN(bExpiry.getTime()) ? bExpiry.getTime() : Number.MAX_SAFE_INTEGER;
                aVal = aTime;
                bVal = bTime;
            } else if (sortColumn === 'price' || sortColumn === 'quantity') {
                aVal = Number(aVal);
                bVal = Number(bVal);
            } else {
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
            }
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Pagination
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = sortedData.slice(startIndex, endIndex);
    
    // Display data
    inventoryTbodyEl.innerHTML = pageData.map((product, index) => {
        const qty = Number(product.quantity);
        const isLowStock = qty < 5;
        const expiryDate = product.expiryDate || '';
        const expiryWarning = getExpiryWarning(expiryDate);
        const rowClass = `${isLowStock ? 'low-stock' : ''} ${expiryWarning ? 'expiry-warning' : ''}`.trim();
        const rowNumber = startIndex + index + 1;
        const formattedExpiry = expiryDate ? formatDisplayDate(expiryDate) : '—';
        const expiryBadge = expiryWarning ? `<span class="expiry-badge">${expiryWarning}</span>` : '';
        
        return `
            <tr class="${rowClass}">
                <td style="text-align: center; font-weight: 500;">${rowNumber}</td>
                <td>${product.code}</td>
                <td>${product.name}</td>
                <td>฿${formatMoney(product.price)}</td>
                <td>${qty}${isLowStock ? ' ⚠️' : ''}</td>
                <td>${formattedExpiry}${expiryBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="editProduct('${product.code}')">แก้ไข</button>
                        <button class="btn btn-danger" onclick="deleteProduct('${product.code}')">ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Update pagination info
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = totalPages;
    
    // Generate page numbers (Smart pagination - show only nearby pages)
    const pageNumbersEl = document.getElementById('page-numbers');
    pageNumbersEl.innerHTML = '';
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    // Show first page if not in range
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => {
            currentPage = 1;
            displayInventoryTable(inventoryData);
            window.scrollTo(0, 0);
        });
        pageNumbersEl.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'page-dots';
            pageNumbersEl.appendChild(dots);
        }
    }
    
    // Show range of pages
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.addEventListener('click', () => {
            currentPage = i;
            displayInventoryTable(inventoryData);
            window.scrollTo(0, 0);
        });
        pageNumbersEl.appendChild(btn);
    }
    
    // Show last page if not in range
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'page-dots';
            pageNumbersEl.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => {
            currentPage = totalPages;
            displayInventoryTable(inventoryData);
            window.scrollTo(0, 0);
        });
        pageNumbersEl.appendChild(lastBtn);
    }
    
    // Show/hide pagination
    if (totalPages > 1) {
        document.getElementById('pagination').style.display = 'flex';
    } else {
        document.getElementById('pagination').style.display = 'none';
    }
    
    // Update sort icons
    updateSortIcons();
}

function formatDisplayDate(value) {
    if (!value) return '—';
    const parts = String(value).split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
    }
    return value;
}

function getExpiryWarning(expiryDate) {
    if (!expiryDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(diffDays)) return '';
    if (diffDays < 0) return 'หมดอายุแล้ว';
    if (diffDays <= 7) return `ใกล้หมดอายุ ${diffDays} วัน`;
    return '';
}

function updateSortIcons() {
    document.querySelectorAll('th.sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        const icon = header.querySelector('.sort-icon');
        
        if (header.dataset.sort === sortColumn) {
            if (sortDirection === 'asc') {
                header.classList.add('sort-asc');
                icon.textContent = '↑';
            } else {
                header.classList.add('sort-desc');
                icon.textContent = '↓';
            }
        } else {
            icon.textContent = '⇅';
        }
    });
}

    // Product Search removed per user request

// handleAddProduct removed — add-product feature disabled

function editProduct(code) {
    // Try to find product in inventoryData first, fallback to DOM
    let product = inventoryData.find(p => p.code === code);
    if (!product) product = document.querySelector(`[data-code="${code}"]`);

    if (product) {
        const name = product.name || product.querySelector?.('h4')?.textContent.trim() || '';
        const price = (product.price !== undefined) ? product.price : (product.querySelector ? product.querySelector('.product-price').textContent.replace('฿', '').trim() : '0');
        const qty = (product.quantity !== undefined) ? product.quantity : (product.querySelector ? product.querySelector('.product-qty').textContent.replace('คงเหลือ: ', '').replace('⚠️', '').trim() : '0');

        editingProductCode = code;

        document.getElementById('edit-product-info').innerHTML = `
            รหัส: ${code}<br>
            <strong style="color: #667eea;">ปัจจุบัน: ${qty} ชิ้น</strong>
        `;

        document.getElementById('edit-name').value = name;
        document.getElementById('edit-price').value = parseFloat(price) || 0;
        document.getElementById('edit-qty').value = parseInt(qty) || 0;
        const expiryValue = product.expiryDate || '';
        document.getElementById('edit-expiry-date').value = expiryValue;

        editModal.classList.add('show');
        document.getElementById('edit-qty').focus();
        document.getElementById('edit-qty').select();
    }
}

async function confirmEditProduct() {
    if (!editingProductCode) {
        // Try to extract code from modal display if available
        const infoEl = document.getElementById('edit-product-info');
        if (infoEl && infoEl.textContent) {
            const m = infoEl.textContent.match(/รหัส:\s*([^\n\r<\s]+)/);
            if (m && m[1]) {
                editingProductCode = m[1].trim();
            }
        }
        if (!editingProductCode) {
            showNotification('ไม่มีรหัสสินค้าที่จะบันทึก', 'error');
            return;
        }
    }
    
    const name = document.getElementById('edit-name').value.trim();
    const price = parseFloat(document.getElementById('edit-price').value);
    const qty = parseInt(document.getElementById('edit-qty').value);
    const expiryDate = document.getElementById('edit-expiry-date').value;
    
    if (!name) {
        showNotification('กรุณากรอกชื่อสินค้า', 'error');
        return;
    }
    
    if (price < 0 || qty < 0) {
        showNotification('ราคาและจำนวนต้องมากกว่าหรือเท่ากับ 0', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                code: editingProductCode, 
                name: name,
                price: price, 
                quantity: qty,
                expiryDate: expiryDate || ''
            })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        showNotification('แก้ไขสินค้าสำเร็จ ✅', 'success');
        editModal.classList.remove('show');
        editingProductCode = null;
        loadInventory();
    } catch (error) {
        showNotification('แก้ไขสินค้าไม่สำเร็จ: ' + error.message, 'error');
    }
}

async function deleteProduct(code) {
    if (!confirm('ต้องการลบสินค้านี้หรือไม่?')) return;
    
    try {
        const response = await fetch(`/api/product/${code}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        showNotification('ลบสินค้าสำเร็จ', 'success');
        currentPage = 1;
        sortColumn = null;
        sortDirection = 'asc';
        loadInventory();
    } catch (error) {
        showNotification('ลบสินค้าไม่สำเร็จ: ' + error.message, 'error');
    }
}

// ============ CART & SALES ============
function selectProductForSale(element) {
    // Directly add 1 item to cart when product is clicked
    const code = element.dataset.code;
    const product = inventoryData.find(p => p.code === code);

    if (!product) {
        showNotification('ไม่พบสินค้า', 'error');
        return;
    }

    const available = Number(product.quantity);
    if (available <= 0) {
        showNotification('สินค้าหมด', 'warning');
        return;
    }

    addProductToCart(code, 1);
}

async function addToCart() {
    const quantity = parseInt(document.getElementById('quantity-input').value);
    
    if (quantity <= 0 || quantity > selectedProductForModal.qty) {
        showNotification('จำนวนไม่ถูกต้อง', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.code === selectedProductForModal.code);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        const price = parseFloat(selectedProductForModal.price.replace('฿', ''));
        cart.push({
            code: selectedProductForModal.code,
            name: selectedProductForModal.name,
            price: price,
            quantity: quantity
        });
    }
    
    quantityModal.classList.remove('show');
    updateCartDisplay();
    showNotification('เพิ่มสินค้าในตะกร้าสำเร็จ', 'success');
}

function updateCartDisplay() {
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="empty-message">กรุณาเลือกสินค้า</p>';
        cartCountEl.textContent = '0';
        cartTotalEl.textContent = '0.00';
        // update payment UI even when cart is empty
        updatePaymentUI();
        return;
    }
    
    let total = 0;
    cartItemsEl.innerHTML = cart.map((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.quantity} × ฿${formatMoney(item.price)} = ฿${formatMoney(itemTotal)}</p>
                </div>
                <div class="cart-item-actions">
                    <button class="btn btn-edit" onclick="editCartItem(${index})">✏️ แก้ไข</button>
                    <button class="btn btn-refund" onclick="openRefundModal('${item.code}', '${item.name}', ${item.quantity})">🔄 คืน</button>
                    <button class="btn btn-delete" onclick="removeFromCart(${index})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    cartCountEl.textContent = cart.length;
    cartTotalEl.textContent = formatMoney(total);
    // Update payment UI (received/change) after cart changes
    updatePaymentUI();
}

function calculateCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updatePaymentUI() {
    const payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
    const total = calculateCartTotal();

    if (payment === 'cash') {
        // enable cash controls
        if (cashControlsEl) cashControlsEl.style.display = 'block';
        const received = parseFloat(receivedAmountEl?.value) || 0;
        const change = Math.max(0, received - total);
        if (changeAmountEl) changeAmountEl.textContent = formatMoney(change);
    } else {
        // hide/disable cash controls
        if (cashControlsEl) cashControlsEl.style.display = 'none';
        if (changeAmountEl) changeAmountEl.textContent = '0.00';
    }
}

function editCartItem(index) {
    const item = cart[index];
    document.getElementById('product-info').innerHTML = `
        <strong>${item.name}</strong><br>
        ราคา: ฿${formatMoney(item.price)}
    `;
    document.getElementById('quantity-input').value = item.quantity;
    document.getElementById('quantity-input').max = 999;
    
    selectedProductForModal = { index };
    
    // Override the confirm button
    const confirmBtn = document.getElementById('confirm-quantity-btn');
    const oldOnClick = confirmBtn.onclick;
    confirmBtn.onclick = () => {
        const newQty = parseInt(document.getElementById('quantity-input').value);
        if (newQty > 0) {
            cart[index].quantity = newQty;
            updateCartDisplay();
        }
        quantityModal.classList.remove('show');
        confirmBtn.onclick = oldOnClick;
    };
    
    quantityModal.classList.add('show');
}

function removeFromCart(index) {
    if (confirm('ต้องการลบสินค้านี้จากตะกร้าหรือไม่?')) {
        cart.splice(index, 1);
        updateCartDisplay();
        showNotification('ลบสินค้าออกจากตะกร้าแล้ว', 'success');
    }
}

function clearCart() {
    if (cart.length === 0) {
        showNotification('ตะกร้าว่างอยู่แล้ว', 'warning');
        return;
    }
    
    if (confirm('ต้องการล้างตะกร้าหรือไม่?')) {
        cart = [];
        updateCartDisplay();
        // Also clear received amount and change display
        if (receivedAmountEl) receivedAmountEl.value = '0.00';
        if (changeAmountEl) changeAmountEl.textContent = '0.00';
        updatePaymentUI();
        showNotification('ล้างตะกร้าแล้ว', 'success');
    }
}

function openRefundModal(code, name, maxQty) {
    document.getElementById('refund-product-info').innerHTML = `
        <strong>${name}</strong><br>
        รหัส: ${code}<br>
        จำนวนในตะกร้า: ${maxQty}<br>
        <hr style="margin: 8px 0;">
        <strong>จะคืน: <span id="refund-qty-show">1</span> ชิ้น</strong>
    `;
    document.getElementById('refund-qty-input').value = 1;
    document.getElementById('refund-qty-input').max = maxQty;
    
    // Event listener for real-time quantity display
    const refundInput = document.getElementById('refund-qty-input');
    refundInput.addEventListener('input', function() {
        let val = parseInt(this.value) || 0;
        if (val < 1) val = 1;
        if (val > maxQty) val = maxQty;
        document.getElementById('refund-qty-show').textContent = val;
    });
    
    selectedProductForModal = { code, maxQty };
    refundModal.classList.add('show');
}

async function confirmRefund() {
    const quantity = parseInt(document.getElementById('refund-qty-input').value);
    
    if (quantity <= 0 || quantity > selectedProductForModal.maxQty) {
        showNotification('จำนวนไม่ถูกต้อง', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: selectedProductForModal.code, quantity })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // Remove from cart
        const cartIndex = cart.findIndex(item => item.code === selectedProductForModal.code);
        if (cartIndex >= 0) {
            if (cart[cartIndex].quantity > quantity) {
                cart[cartIndex].quantity -= quantity;
            } else {
                cart.splice(cartIndex, 1);
            }
        }
        
        updateCartDisplay();
        refundModal.classList.remove('show');
        showNotification('คืนสินค้าสำเร็จ', 'success');
        loadInventory();
    } catch (error) {
        showNotification('คืนสินค้าไม่สำเร็จ: ' + error.message, 'error');
    }
}

async function checkout() {
    if (cart.length === 0) {
        showNotification('ตะกร้าว่าง', 'warning');
        return;
    }
    
    const payment = document.querySelector('input[name="payment"]:checked').value;
    
    try {
        // If cash, ensure received amount is enough
        if (payment === 'cash') {
            const total = calculateCartTotal();
            const received = parseFloat(receivedAmountEl?.value) || 0;
            if (received < total) {
                showNotification('รับเงินไม่พอ กรุณากรอกจำนวนที่รับ', 'error');
                return;
            }
        }

        // Record all sales
        for (const item of cart) {
            const response = await fetch('/api/sell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: item.code,
                    quantity: item.quantity,
                    payment: payment
                })
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
        }

        // Show change if cash
        if (payment === 'cash') {
            const total = calculateCartTotal();
            const received = parseFloat(receivedAmountEl?.value) || 0;
            const change = Math.max(0, received - total);
            showNotification(`ชำระเงินสำเร็จ - เงินทอน ฿${formatMoney(change)}`, 'success');
        } else {
            showNotification('ชำระเงินสำเร็จ', 'success');
        }

        // Reset cart and UI
        cart = [];
        updateCartDisplay();
        // reset received amount
        if (receivedAmountEl) receivedAmountEl.value = '0.00';
        if (changeAmountEl) changeAmountEl.textContent = '0.00';
        loadInventory();
    } catch (error) {
        showNotification('ชำระเงินไม่สำเร็จ: ' + error.message, 'error');
    }
}

// ============ REPORT ============
async function loadAvailableDates() {
    try {
        // Set date picker to today
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        if (reportDateEl) reportDateEl.value = `${year}-${month}-${day}`;
        if (topProductsDateEl) topProductsDateEl.value = `${year}-${month}-${day}`;
        // Set month picker to current month (YYYY-MM)
        if (reportMonthEl) {
            reportMonthEl.value = `${year}-${month}`;
        }
        if (topProductsMonthEl) {
            topProductsMonthEl.value = `${year}-${month}`;
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadTopProducts() {
    try {
        const type = document.querySelector('input[name="top-products-type"]:checked')?.value || 'day';
        let url = '/api/top-products';

        if (type === 'month') {
            const monthValue = topProductsMonthEl?.value;
            if (!monthValue) {
                showNotification('กรุณาเลือกเดือน', 'error');
                return;
            }
            url += `?month=${monthValue}`;
        } else {
            const dateValue = topProductsDateEl?.value;
            if (!dateValue) {
                showNotification('กรุณาเลือกวันที่', 'error');
                return;
            }
            url += `?date=${dateValue}`;
        }

        const response = await fetch(url);
        const text = await response.text();
        let result = null;

        try {
            result = text ? JSON.parse(text) : null;
        } catch (err) {
            console.error('Top products response was not valid JSON:', text);
            throw new Error('เซิร์ฟเวอร์ตอบกลับเป็นข้อมูลที่ไม่ใช่ JSON');
        }

        if (!response.ok || !result?.success) {
            throw new Error(result?.error || `คำขอไม่สำเร็จ (${response.status})`);
        }

        const data = result.data || {};
        if (topProductsInfoEl) {
            topProductsInfoEl.textContent = data.date ? `ช่วง: ${data.date}` : 'ไม่พบข้อมูล';
        }

        if (!data.items || !data.items.length) {
            topProductsTbodyEl.innerHTML = '<tr><td colspan="5" class="empty-message">ไม่มีข้อมูลสินค้าขายดี</td></tr>';
            return;
        }

        topProductsTbodyEl.innerHTML = data.items.map((item, index) => `
            <tr>
                <td style="text-align: center; font-weight: 600;">${index + 1}</td>
                <td>${item.code}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>฿${formatMoney(item.total || 0)}</td>
            </tr>
        `).join('');
    } catch (error) {
        showNotification('โหลดสินค้าขายดีไม่สำเร็จ: ' + error.message, 'error');
    }
}

async function loadReport() {
    try {
        // Determine report type: day or month
        const reportType = document.querySelector('input[name="report-type"]:checked')?.value || 'day';

        let response;
        if (reportType === 'month') {
            const monthValue = reportMonthEl?.value;
            if (!monthValue) {
                showNotification('กรุณาเลือกเดือน', 'error');
                return;
            }
            // monthValue format: YYYY-MM -> convert to YYYYMM
            const month = monthValue.replace(/-/g, '');
            response = await fetch(`/api/report?month=${month}`);
        } else {
            const dateValue = reportDateEl.value; // Format: YYYY-MM-DD from date picker
            if (!dateValue) {
                showNotification('กรุณาเลือกวันที่', 'error');
                return;
            }
            // Convert YYYY-MM-DD to YYYYMMDD
            const date = dateValue.replace(/-/g, '');
            response = await fetch(`/api/report?date=${date}`);
        }
        const result = await response.json();
        
        if (!result.success) throw new Error(result.error);
        
        const data = result.data;
        
        // Update summary cards
        document.getElementById('report-total-sale').textContent = formatMoney(data.totalSale);
        document.getElementById('report-total-refund').textContent = formatMoney(data.totalRefund);
        document.getElementById('report-cash').textContent = formatMoney(data.cash);
        document.getElementById('report-transfer').textContent = formatMoney(data.transfer);
        // 15% fee and net-after-fee (server may provide these fields)
        const fee15 = (data.fee15 !== undefined) ? Number(data.fee15) : parseFloat((data.totalSale * 0.15).toFixed(2));
        const netAfter = (data.netAfterFee !== undefined) ? Number(data.netAfterFee) : parseFloat((data.totalSale - fee15).toFixed(2));
        if (document.getElementById('report-fee15')) document.getElementById('report-fee15').textContent = formatMoney(fee15);
        if (document.getElementById('report-net-after-fee')) document.getElementById('report-net-after-fee').textContent = formatMoney(netAfter);
        document.getElementById('report-net').textContent = formatMoney(data.net);
        
        // Update transactions table with pagination
        if (!data.transactions.length) {
            transactionsTbodyEl.innerHTML = '<tr><td colspan="8" class="empty-message">ไม่มีรายการ</td></tr>';
            document.getElementById('report-page-info').textContent = 'หน้า 0';
            return;
        }
        
        // Store all transactions and reset to page 1
        transactionsData = data.transactions;
        reportCurrentPage = 1;
        displayTransactionsPage(transactionsData);
        
        showNotification('โหลดรายงานสำเร็จ', 'success');
    } catch (error) {
        showNotification('โหลดรายงานไม่สำเร็จ: ' + error.message, 'error');
    }
}

function displayTransactionsPage(transactions) {
    if (!transactions || !transactions.length) {
        transactionsTbodyEl.innerHTML = '<tr><td colspan="9" class="empty-message">ไม่มีรายการ</td></tr>';
        document.getElementById('report-page-info').textContent = 'หน้า 0';
        return;
    }
    
    const totalPages = Math.ceil(transactions.length / reportItemsPerPage);
    
    // Validate current page
    if (reportCurrentPage > totalPages) {
        reportCurrentPage = totalPages;
    }
    if (reportCurrentPage < 1) {
        reportCurrentPage = 1;
    }
    
    // Calculate start and end index
    const startIdx = (reportCurrentPage - 1) * reportItemsPerPage;
    const endIdx = startIdx + reportItemsPerPage;
    const pageTransactions = transactions.slice(startIdx, endIdx);
    
    // Display transactions for this page
    transactionsTbodyEl.innerHTML = pageTransactions.map((tx, index) => `
        <tr class="type-${tx.type}">
            <td style="text-align: center; font-weight: 500;">${startIdx + index + 1}</td>
            <td>${tx.datetime}</td>
            <td>${tx.type === 'sale' ? '✅ ขาย' : '❌ คืน'}</td>
            <td>${tx.code}</td>
            <td>${tx.name}</td>
            <td>฿${formatMoney(tx.unitPrice)}</td>
            <td>${Math.abs(tx.quantity)}</td>
            <td>฿${formatMoney(tx.total)}</td>
            <td>${tx.payment === 'cash' ? '💵 เงินสด' : '🏦 โอนธนาคาร'}</td>
        </tr>
    `).join('');
    
    // Update pagination info
    document.getElementById('report-page-info').textContent = `หน้า ${reportCurrentPage} / ${totalPages}`;
    
    // Update button disabled states
    document.getElementById('report-prev-btn').disabled = reportCurrentPage === 1;
    document.getElementById('report-next-btn').disabled = reportCurrentPage === totalPages;
}

// ============ BARCODE SCANNER HANDLER ============
function handleBarcodeInput(barcode) {
    if (!barcode || barcode.trim() === '') return;

    const code = barcode.trim();
    // If Inventory tab is active, route to inventory handler instead of adding to cart
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'inventory') {
        handleInventoryCodeInput(code);
        return;
    }
    // Normalize and try flexible match (trim, remove non-alnum, strip leading zeros)
    const normalize = (s) => String(s || '').toString().replace(/[^0-9a-zA-Z]/g, '').replace(/^0+/, '');
    const normCode = normalize(code);
    // ค้นหาสินค้าจากรหัส (ตรงเป๊ะ -> เปรียบเทียบแบบ normalize -> endsWith fallback)
    let product = inventoryData.find(p => String(p.code) === code);
    if (!product) product = inventoryData.find(p => normalize(p.code) === normCode);
    if (!product) product = inventoryData.find(p => String(p.code).endsWith(code) || String(p.code).endsWith(normCode));
    
    if (!product) {
        showNotification(`❌ ไม่พบสินค้ารหัส: ${code}`, 'error');
        return;
    }
    
    // ตรวจสอบจำนวนคงคลัง
    const qty = Number(product.quantity);
    if (qty <= 0) {
        showNotification(`⚠️ สินค้า "${product.name}" หมดคลัง`, 'error');
        return;
    }
    
    // เพิ่มลงไป cart (ปริมาณ = 1)
    addProductToCart(code, 1);
}

// (reuse normalize for inventory code input)

// Handle code entered from inventory product-code field (scan or manual)
function handleInventoryCodeInput(code) {
    if (!code || String(code).trim() === '') return;
    const trimmed = String(code).trim();
    const normalize = (s) => String(s || '').toString().replace(/[^0-9a-zA-Z]/g, '').replace(/^0+/, '');
    const norm = normalize(trimmed);
    // Find product in inventory with flexible matching
    let product = inventoryData.find(p => String(p.code) === trimmed);
    if (!product) product = inventoryData.find(p => normalize(p.code) === norm);
    if (!product) product = inventoryData.find(p => String(p.code).endsWith(trimmed) || String(p.code).endsWith(norm));
    if (product) {
        // If product exists, switch to inventory tab and open edit modal for quick update
        switchTab('inventory');
        setTimeout(() => {
            editProduct(trimmed);
        }, 150);
    } else {
        // If not found, prompt to add via modal
        pendingNewProductCode = trimmed;
        if (addProductCodeInput) addProductCodeInput.value = trimmed;
        if (addProductPriceInput) addProductPriceInput.value = '0.00';
        if (addProductQtyInput) addProductQtyInput.value = 1;
        if (addProductNameInput) addProductNameInput.value = '';
        if (addProductModal) addProductModal.classList.add('show');
        // focus name input for quick entry
        setTimeout(() => { if (addProductNameInput) addProductNameInput.focus(); }, 100);
    }
}

// Helper: add a product to cart by code and quantity (used for clicks and barcode)
function addProductToCart(code, quantity = 1) {
    const product = inventoryData.find(p => p.code === code);
    if (!product) {
        showNotification(`ไม่พบสินค้ารหัส: ${code}`, 'error');
        return;
    }

    const available = Number(product.quantity);
    if (quantity <= 0 || quantity > available) {
        showNotification('จำนวนไม่ถูกต้อง หรือเกินสต็อก', 'error');
        return;
    }

    const existingItem = cart.find(item => item.code === code);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        const price = parseFloat(product.price || 0);
        cart.push({ code: product.code, name: product.name, price: price, quantity: quantity });
    }

    updateCartDisplay();
    showNotification(`เพิ่ม ${product.name} (${quantity} ชิ้น)`, 'success');
}
