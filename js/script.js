// Referensi elemen DOM
const form = document.getElementById('transactionForm');
const itemName = document.getElementById('itemName');
const amount = document.getElementById('amount');
const categorySelect = document.getElementById('category');
const customCategoryInput = document.getElementById('customCategory');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const transactionList = document.getElementById('transactionList');
const totalBalanceEl = document.getElementById('totalBalance');
const darkModeToggle = document.getElementById('darkModeToggle');
const sortSelect = document.getElementById('sortSelect');
const ctx = document.getElementById('expenseChart').getContext('2d');

// Mengambil data dari Local Storage atau inisialisasi default
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || ['Food', 'Transport', 'Fun'];
let myChart = null;

// Inisialisasi awal
function init() {
    populateCategories();
    renderTransactions();
    updateTotal();
    updateChart();
}

// Memasukkan kategori ke dalam select dropdown
function populateCategories() {
    const currentValue = categorySelect.value;
    categorySelect.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
    // Tetap pada pilihan sebelumnya jika memungkinkan
    if (categories.includes(currentValue)) {
        categorySelect.value = currentValue;
    }
}

// Fitur: Menambahkan kategori kustom (Optional Challenge)
addCategoryBtn.addEventListener('click', () => {
    const newCat = customCategoryInput.value.trim();
    if (newCat && !categories.includes(newCat)) {
        categories.push(newCat);
        localStorage.setItem('categories', JSON.stringify(categories));
        populateCategories();
        categorySelect.value = newCat; // Pilih otomatis kategori yang baru dibuat
        customCategoryInput.value = '';
    }
});

// Fitur: Menambah Transaksi
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Validasi Form
    if (itemName.value.trim() === '' || amount.value.trim() === '') {
        alert('Please fill in all fields!');
        return;
    }

    const transaction = {
        id: Math.floor(Math.random() * 100000000), // Generate random ID
        name: itemName.value,
        amount: parseFloat(amount.value),
        category: categorySelect.value
    };

    transactions.push(transaction);
    updateLocalStorage();
    init(); // Render ulang semua komponen
    
    // Reset Form (kecuali kategori)
    itemName.value = '';
    amount.value = '';
});

// Fitur: Render Daftar Transaksi & Sortir (Optional Challenge)
function renderTransactions() {
    transactionList.innerHTML = '';
    let displayTransactions = [...transactions];

    // Logika Pengurutan (Sorting)
    const sortType = sortSelect.value;
    if (sortType === 'amountAsc') {
        displayTransactions.sort((a, b) => a.amount - b.amount);
    } else if (sortType === 'amountDesc') {
        displayTransactions.sort((a, b) => b.amount - a.amount);
    } else if (sortType === 'category') {
        displayTransactions.sort((a, b) => a.category.localeCompare(b.category));
    }

    displayTransactions.forEach(transaction => {
        const li = document.createElement('li');
        li.classList.add('transaction-item');
        li.innerHTML = `
            <div class="transaction-info">
                <h4>${transaction.name}</h4>
                <p>$${transaction.amount.toFixed(2)}</p>
                <small>${transaction.category}</small>
            </div>
            <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">Delete</button>
        `;
        transactionList.appendChild(li);
    });
}

// Event Listener untuk fitur Sorting
sortSelect.addEventListener('change', renderTransactions);

// Fitur: Menghapus Transaksi
window.deleteTransaction = function(id) {
    transactions = transactions.filter(t => t.id !== id);
    updateLocalStorage();
    init();
};

// Fitur: Menghitung & Memperbarui Total Balance
function updateTotal() {
    const total = transactions.reduce((acc, t) => acc + t.amount, 0);
    totalBalanceEl.innerText = `$${total.toFixed(2)}`;
}

// Fitur: Render Pie Chart Menggunakan Chart.js
function updateChart() {
    const categoryTotals = {};
    
    // Agregasi jumlah pengeluaran per kategori
    transactions.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    // Dynamic background colors berdasarkan jumlah kategori
    const bgColors = labels.map((_, i) => `hsl(${i * (360 / Math.max(labels.length, 1))}, 70%, 55%)`);

    // Hapus instance chart lama agar tidak bertumpuk ketika dirender ulang
    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#333'
                    }
                }
            }
        }
    });
}

// Update Local Storage
function updateLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// Fitur: Toggle Dark Mode (Optional Challenge)
darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    updateChart(); // Memperbarui warna font label pada chart
});

// Panggil fungsi utama saat load pertama
init();