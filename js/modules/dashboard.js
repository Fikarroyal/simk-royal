/* =========================================================================
   modules/dashboard.js — Ringkasan bisnis (FR-02)
   ========================================================================= */
(function () {
  let chartInstance = null;
  let currentRange = 'today';

  function getRange(range) {
    const today = Util.todayISO();
    const d = new Date();
    if (range === 'today') return { from: today, to: today, label: 'Hari ini' };
    if (range === '7d') {
      const from = new Date(); from.setDate(from.getDate() - 6);
      return { from: from.toISOString().slice(0, 10), to: today, label: '7 hari terakhir' };
    }
    if (range === '30d') {
      const from = new Date(); from.setDate(from.getDate() - 29);
      return { from: from.toISOString().slice(0, 10), to: today, label: '30 hari terakhir' };
    }
    if (range === 'month') {
      const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      return { from, to: today, label: 'Bulan ini' };
    }
    return { from: null, to: null, label: 'Semua waktu' };
  }

  function statCard(icon, iconBg, label, value, sub) {
    return `
      <div class="card stat-card">
        <div class="stat-icon ${iconBg}"><i data-lucide="${icon}"></i></div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${sub ? `<div class="stat-delta">${sub}</div>` : ''}
      </div>`;
  }

  function render(container) {
    const { from, to, label } = getRange(currentRange);
    const stats = Store.dashboardStats(from, to);
    const top = Store.topProducts(5, from, to);
    const recentTrx = Store.list('transactions').slice(-8).reverse();
    const lowStock = Store.lowStockProducts();

    container.innerHTML = `
      <div class="page-header">
        <div></div>
        <div class="page-actions">
          <select class="input" id="dash-range" style="width:auto;">
            <option value="today" ${currentRange === 'today' ? 'selected' : ''}>Hari ini</option>
            <option value="7d" ${currentRange === '7d' ? 'selected' : ''}>7 hari terakhir</option>
            <option value="30d" ${currentRange === '30d' ? 'selected' : ''}>30 hari terakhir</option>
            <option value="month" ${currentRange === 'month' ? 'selected' : ''}>Bulan ini</option>
            <option value="all" ${currentRange === 'all' ? 'selected' : ''}>Semua waktu</option>
          </select>
        </div>
      </div>

      <div class="grid grid-4">
        ${statCard('banknote', 'icon-bg-black', `Pendapatan &middot; ${label}`, Util.formatCurrency(stats.revenue))}
        ${statCard('receipt-text', 'icon-bg-info', 'Jumlah Transaksi', Util.formatNumber(stats.transactionCount))}
        ${statCard('shopping-basket', 'icon-bg-purple', 'Produk Terjual', Util.formatNumber(stats.itemsSold))}
        ${statCard('trending-up', stats.netProfit >= 0 ? 'icon-bg-success' : 'icon-bg-danger', 'Laba Bersih (Estimasi)', Util.formatCurrency(stats.netProfit))}
      </div>

      <div class="grid grid-4 mt-16">
        ${statCard('users', 'icon-bg-info', 'Total Pelanggan', Util.formatNumber(stats.customerCount))}
        ${statCard('id-card', 'icon-bg-purple', 'Karyawan Aktif', Util.formatNumber(stats.employeeCount))}
        ${statCard('warehouse', 'icon-bg-warning', 'Nilai Stok Gudang', Util.formatCurrency(stats.stockValue))}
        ${statCard('triangle-alert', stats.lowStockCount > 0 ? 'icon-bg-danger' : 'icon-bg-success', 'Produk Stok Menipis', Util.formatNumber(stats.lowStockCount))}
      </div>

      <div class="grid grid-main-side mt-16" id="dash-grid-2">
        <div class="card">
          <div class="section-title">Tren Penjualan 7 Hari Terakhir</div>
          <canvas id="sales-chart" height="130"></canvas>
        </div>
        <div class="card">
          <div class="section-title">Produk Terlaris</div>
          ${top.length === 0 ? UI.emptyState('package-search', 'Belum ada penjualan', 'Data akan muncul setelah ada transaksi.') : `
          <div class="kv-list">
            ${top.map((t, i) => `
              <div class="kv-row">
                <span>${i + 1}. ${Util.escape(t.product.name)}</span>
                <span>${Util.formatNumber(t.qty)} terjual</span>
              </div>`).join('')}
          </div>`}
        </div>
      </div>

      <div class="grid grid-main-side mt-16">
        <div class="table-card">
          <div class="table-toolbar">
            <strong style="font-size:14px;">Transaksi Terbaru</strong>
            <a href="#transaksi" class="btn btn-outline btn-sm">Lihat Semua <i data-lucide="arrow-right"></i></a>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Invoice</th><th>Kasir</th><th>Metode</th><th>Total</th><th>Waktu</th></tr></thead>
              <tbody>
                ${recentTrx.length === 0 ? `<tr><td colspan="5">${UI.emptyState('receipt', 'Belum ada transaksi')}</td></tr>` :
      recentTrx.map(t => {
        const emp = Store.list('employees').find(e => e.id === t.cashier_id);
        return `<tr>
                    <td class="mono">${t.invoice_number}</td>
                    <td>${emp ? Util.escape(emp.name) : '-'}</td>
                    <td>${UI.badge(t.payment_method.toUpperCase(), 'badge-info')}</td>
                    <td class="mono cell-title">${Util.formatCurrency(t.total)}</td>
                    <td class="cell-sub">${Util.formatDateTime(t.created_at)}</td>
                  </tr>`;
      }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="section-title">Peringatan Stok Menipis</div>
          ${lowStock.length === 0 ? UI.emptyState('circle-check', 'Semua stok aman') : `
          <div class="kv-list">
            ${lowStock.slice(0, 6).map(p => `
              <div class="kv-row">
                <span>${Util.escape(p.name)}</span>
                <span style="color:var(--c-danger)">${p.stock} ${Util.escape(p.unit)}</span>
              </div>`).join('')}
          </div>
          <a href="#stok" class="btn btn-outline btn-sm btn-block mt-16">Kelola Stok</a>`}
        </div>
      </div>
    `;

    document.getElementById('dash-range').addEventListener('change', (e) => {
      currentRange = e.target.value;
      render(container);
    });

    UI.icons();
    renderChart();
  }

  function renderChart() {
    const canvas = document.getElementById('sales-chart');
    if (!canvas || !window.Chart) return;
    const data = Store.salesByDay(7);
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.map(d => Util.formatDate(d.date).split(' ').slice(0, 2).join(' ')),
        datasets: [{
          label: 'Pendapatan',
          data: data.map(d => d.total),
          backgroundColor: '#111111',
          borderRadius: 6,
          maxBarThickness: 42,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v) => 'Rp' + (v / 1000) + 'rb' }, grid: { color: '#F1F1F2' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  Modules.dashboard = {
    title: 'Dashboard',
    subtitle: 'Ringkasan operasional cafe & resto secara real-time',
    render,
  };
})();
