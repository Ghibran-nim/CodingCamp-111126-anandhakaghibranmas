/* =============================================
   Expense & Budget Visualizer — script.js
   Vanilla JS · LocalStorage · Chart.js
   ============================================= */

'use strict';

/* ── Constants ─────────────────────────────── */
const STORAGE_KEY_TRANSACTIONS = 'ebv_transactions';
const STORAGE_KEY_CATEGORIES   = 'ebv_categories';
const STORAGE_KEY_THEME        = 'ebv_theme';

/** Default categories always available */
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

/** Emoji map for category badges */
const CATEGORY_EMOJI = {
  Food:      '🍔',
  Transport: '🚌',
  Fun:       '🎉',
};

/** Chart.js color palette (cycles if more categories exist) */
const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

/* ── State ─────────────────────────────────── */
let transactions = [];   // { id, name, amount, category, createdAt }
let categories   = [];   // string[]
let chartInstance = null;

/* ── DOM References ─────────────────────────── */
const totalBalanceEl      = document.getElementById('total-balance');
const transactionForm     = document.getElementById('transaction-form');
const itemNameInput       = document.getElementById('item-name');
const itemAmountInput     = document.getElementById('item-amount');
const itemCategorySelect  = document.getElementById('item-category');
const nameError           = document.getElementById('name-error');
const amountError         = document.getElementById('amount-error');
const categoryError       = document.getElementById('category-error');
const customCategoryInput = document.getElementById('custom-category-input');
const addCategoryBtn      = document.getElementById('add-category-btn');
const transactionList     = document.getElementById('transaction-list');
const listEmptyMsg        = document.getElementById('list-empty-msg');
const chartCanvas         = document.getElementById('expense-chart');
const chartEmptyMsg       = document.getElementById('chart-empty-msg');
const sortSelect          = document.getElementById('sort-select');
const themeToggleBtn      = document.getElementById('theme-toggle');

/* =============================================
   LocalStorage Helpers
   ============================================= */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
}

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
  transactions = raw ? JSON.parse(raw) : [];
}

function saveCategories() {
  localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
}

function loadCategories() {
  const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
  const saved = raw ? JSON.parse(raw) : [];
  // Merge defaults with any user-saved custom categories
  const merged = [...DEFAULT_CATEGORIES];
  saved.forEach(cat => {
    if (!merged.includes(cat)) merged.push(cat);
  });
  categories = merged;
}

function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

function loadTheme() {
  return localStorage.getItem(STORAGE_KEY_THEME) || 'light';
}

/* =============================================
   Theme
   ============================================= */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeToggleBtn.setAttribute('aria-label',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  );
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
  // Rebuild chart so colors adapt (Chart.js reads CSS variables at paint time)
  renderChart();
}

/* =============================================
   Category Select — populate <select> options
   ============================================= */
function renderCategoryOptions() {
  // Keep the placeholder option, rebuild the rest
  const placeholder = itemCategorySelect.options[0];
  itemCategorySelect.innerHTML = '';
  itemCategorySelect.appendChild(placeholder);

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    itemCategorySelect.appendChild(opt);
  });
}

/* =============================================
   Add Custom Category
   ============================================= */
function addCustomCategory() {
  const raw  = customCategoryInput.value.trim();
  const name = raw.charAt(0).toUpperCase() + raw.slice(1); // capitalise first letter

  if (!name) return;

  if (categories.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
    // Already exists — just select it
    itemCategorySelect.value = categories.find(
      c => c.toLowerCase() === name.toLowerCase()
    );
    customCategoryInput.value = '';
    return;
  }

  categories.push(name);
  saveCategories();
  renderCategoryOptions();

  // Auto-select the new category
  itemCategorySelect.value = name;
  customCategoryInput.value = '';
}

/* =============================================
   Form Validation
   ============================================= */
function validateForm() {
  let valid = true;

  // Name
  if (!itemNameInput.value.trim()) {
    itemNameInput.classList.add('invalid');
    nameError.classList.add('visible');
    valid = false;
  } else {
    itemNameInput.classList.remove('invalid');
    nameError.classList.remove('visible');
  }

  // Amount
  const amount = parseFloat(itemAmountInput.value);
  if (!itemAmountInput.value || isNaN(amount) || amount <= 0) {
    itemAmountInput.classList.add('invalid');
    amountError.classList.add('visible');
    valid = false;
  } else {
    itemAmountInput.classList.remove('invalid');
    amountError.classList.remove('visible');
  }

  // Category
  if (!itemCategorySelect.value) {
    itemCategorySelect.classList.add('invalid');
    categoryError.classList.add('visible');
    valid = false;
  } else {
    itemCategorySelect.classList.remove('invalid');
    categoryError.classList.remove('visible');
  }

  return valid;
}

/* Clear inline validation on user input */
function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove('invalid');
  errorEl.classList.remove('visible');
}

/* =============================================
   Add Transaction
   ============================================= */
function addTransaction(e) {
  e.preventDefault();

  if (!validateForm()) return;

  const transaction = {
    id:        crypto.randomUUID(),
    name:      itemNameInput.value.trim(),
    amount:    parseFloat(parseFloat(itemAmountInput.value).toFixed(2)),
    category:  itemCategorySelect.value,
    createdAt: Date.now(),
  };

  transactions.push(transaction);
  saveTransactions();

  // Reset form
  transactionForm.reset();

  // Re-render everything
  renderAll();
}

/* =============================================
   Delete Transaction
   ============================================= */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

/* =============================================
   Sort Transactions (non-destructive)
   ============================================= */
function getSortedTransactions() {
  const copy = [...transactions];
  const mode = sortSelect.value;

  switch (mode) {
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'category':
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    default:
      // 'default' — most-recent first (insertion order reversed)
      return copy.reverse();
  }
}

/* =============================================
   Render: Total Balance
   ============================================= */
function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const formatted = formatCurrency(total);

  totalBalanceEl.textContent = formatted;

  // Brief pop animation
  totalBalanceEl.classList.remove('updated');
  void totalBalanceEl.offsetWidth; // reflow to restart animation
  totalBalanceEl.classList.add('updated');

  // Remove class after animation finishes
  setTimeout(() => totalBalanceEl.classList.remove('updated'), 300);
}

/* =============================================
   Render: Transaction List
   ============================================= */
function renderList() {
  const sorted = getSortedTransactions();

  transactionList.innerHTML = '';

  if (sorted.length === 0) {
    listEmptyMsg.classList.add('visible');
    return;
  }

  listEmptyMsg.classList.remove('visible');

  sorted.forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = t.id;

    const emoji  = CATEGORY_EMOJI[t.category] || getCategoryInitial(t.category);
    const amount = formatCurrency(t.amount);

    li.innerHTML = `
      <div class="category-badge" aria-hidden="true">${emoji}</div>
      <div class="transaction-info">
        <p class="transaction-name">${escapeHtml(t.name)}</p>
        <p class="transaction-category">${escapeHtml(t.category)}</p>
      </div>
      <span class="transaction-amount" aria-label="Amount: ${amount}">-${amount}</span>
      <button class="btn-delete" data-id="${t.id}" aria-label="Delete ${escapeHtml(t.name)}">
        Delete
      </button>
    `;

    transactionList.appendChild(li);
  });
}

/* =============================================
   Render: Pie Chart
   ============================================= */
function renderChart() {
  // Aggregate amounts by category
  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(totals);
  const data   = Object.values(totals);

  if (labels.length === 0) {
    // Show empty state, hide canvas
    chartCanvas.style.display   = 'none';
    chartEmptyMsg.classList.add('visible');

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  chartCanvas.style.display = '';
  chartEmptyMsg.classList.remove('visible');

  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (chartInstance) {
    // Update existing chart data in-place (smooth transition)
    chartInstance.data.labels          = labels;
    chartInstance.data.datasets[0].data   = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.data.datasets[0].borderColor      = colors;
    chartInstance.update();
  } else {
    chartInstance = new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor:     colors,
          borderWidth:     2,
          hoverOffset:     8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position:  'bottom',
            labels: {
              padding:   16,
              font:      { size: 12 },
              color:     getComputedStyle(document.documentElement)
                           .getPropertyValue('--text-secondary').trim() || '#6b7280',
              usePointStyle: true,
              pointStyle:    'circle',
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const val   = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((val / total) * 100).toFixed(1);
                return ` ${formatCurrency(val)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

/* =============================================
   Render All
   ============================================= */
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
}

/* =============================================
   Utility Helpers
   ============================================= */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Returns the first letter of a category for use as a badge fallback */
function getCategoryInitial(category) {
  return category ? category.charAt(0).toUpperCase() : '?';
}

/* =============================================
   Event Listeners
   ============================================= */

// Form submit
transactionForm.addEventListener('submit', addTransaction);

// Clear individual field errors on input
itemNameInput.addEventListener('input',   () => clearFieldError(itemNameInput,     nameError));
itemAmountInput.addEventListener('input', () => clearFieldError(itemAmountInput,   amountError));
itemCategorySelect.addEventListener('change', () => clearFieldError(itemCategorySelect, categoryError));

// Add custom category button
addCategoryBtn.addEventListener('click', addCustomCategory);

// Allow pressing Enter inside custom category input
customCategoryInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomCategory();
  }
});

// Delete button (event delegation on the list)
transactionList.addEventListener('click', e => {
  const btn = e.target.closest('.btn-delete');
  if (btn) deleteTransaction(btn.dataset.id);
});

// Sort change
sortSelect.addEventListener('change', renderList);

// Theme toggle
themeToggleBtn.addEventListener('click', toggleTheme);

/* =============================================
   Initialise App
   ============================================= */
function init() {
  // Load persisted data
  loadTransactions();
  loadCategories();

  // Apply saved theme
  applyTheme(loadTheme());

  // Populate category dropdown
  renderCategoryOptions();

  // Render UI
  renderAll();
}

init();
