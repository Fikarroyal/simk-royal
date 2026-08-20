/* =========================================================================
   modules/laporan.js — Business Reporting (FR-06, Reporting Requirements)
   ========================================================================= */
(function () {
  const state = {
    from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })(),
    to: Util.todayISO(),
    cashier: '', method: '', category: '', product: '', page: 1,
  };
  const perPage = 8;

  function filteredTransactions() {
    let rows = Store.list('transactions').filter(t => t.status !== 'void');
    rows = rows.filter(t => { const d = t.created_at.slice(0, 10); return d >= state.from && d <= state.to; });
    if (state.cashier) rows = rows.filter(t => t.cashier_id === state.cashier);
    if (state.method) rows = rows.filter(t => t.payment_method === state.method);
    if (state.category || state.product) {
      const itemsByTrx = {};
      Store.list('transaction_items').forEach(i => { (itemsByTrx[i.transaction_id] = itemsByTrx[i.transaction_id] || []).push(i); });
      rows = rows.filter(t => {
        const items = itemsByTrx[t.id] || [];
        return items.some(i => {
          const p = Store.get('products', i.product_id);
          if (!p) return false;
          if (state.product && p.id !== state.product) return false;
          if (state.category && p.category_id !== state.category) return false;
          return true;
        });
      });
    }
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  function summary(rows) {
    const revenue = rows.reduce((s, t) => s + t.total, 0);
    const itemsSold = Store.list('transaction_items').filter(i => rows.some(t => t.id === i.transaction_id)).reduce((s, i) => s + i.quantity, 0);
    const avg = rows.length ? Math.round(revenue / rows.length) : 0;
    const expenses = Store.list('expenses').filter(e => e.date >= state.from && e.date <= state.to).reduce((s, e) => s + e.amount, 0);
    return { revenue, count: rows.length, itemsSold, avg, expenses, profit: revenue - expenses };
  }

  function renderFilterBar(container) {
    const employees = Store.list('employees');
    const categories = Store.list('categories');
    const products = Store.list('products');
    container.innerHTML = `
      <div class="card">
        <div class="section-title">Filter Laporan</div>
        <div class="form-grid">
          <div class="field"><label>Dari Tanggal</label><input class="input" type="date" id="lf-from" value="${state.from}" /></div>
          <div class="field"><label>Sampai Tanggal</label><input class="input" type="date" id="lf-to" value="${state.to}" /></div>
          <div class="field"><label>Kasir</label>
            <select class="input" id="lf-cashier"><option value="">Semua Kasir</option>${employees.map(e => `<option value="${e.id}" ${state.cashier === e.id ? 'selected' : ''}>${Util.escape(e.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Metode Pembayaran</label>
            <select class="input" id="lf-method"><option value="">Semua Metode</option>${Store.list('payment_methods').map(m => `<option value="${m.id}" ${state.method === m.id ? 'selected' : ''}>${Util.escape(m.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Kategori</label>
            <select class="input" id="lf-category"><option value="">Semua Kategori</option>${categories.map(c => `<option value="${c.id}" ${state.category === c.id ? 'selected' : ''}>${Util.escape(c.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Produk</label>
            <select class="input" id="lf-product"><option value="">Semua Produk</option>${products.map(p => `<option value="${p.id}" ${state.product === p.id ? 'selected' : ''}>${Util.escape(p.name)}</option>`).join('')}</select>
          </div>
        </div>
        <button class="btn btn-primary mt-16" id="lf-apply"><i data-lucide="filter"></i> Terapkan Filter</button>
      </div>
    `;
    UI.icons();
    document.getElementById('lf-apply').addEventListener('click', () => {
      state.from = document.getElementById('lf-from').value || state.from;
      state.to = document.getElementById('lf-to').value || state.to;
      state.cashier = document.getElementById('lf-cashier').value;
      state.method = document.getElementById('lf-method').value;
      state.category = document.getElementById('lf-category').value;
      state.product = document.getElementById('lf-product').value;
      state.page = 1;
      renderResults();
    });
  }

  function statCard(icon, iconBg, label, value) {
    return `<div class="card stat-card"><div class="stat-icon ${iconBg}"><i data-lucide="${icon}"></i></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  }

  function renderResults() {
    const root = document.getElementById('laporan-results');
    if (!root) return;
    const rows = filteredTransactions();
    const s = summary(rows);
    const top = (() => {
      const map = {};
      Store.list('transaction_items').filter(i => rows.some(t => t.id === i.transaction_id)).forEach(i => { map[i.product_id] = (map[i.product_id] || 0) + i.quantity; });
      return Object.entries(map).map(([pid, qty]) => ({ product: Store.get('products', pid), qty })).filter(x => x.product).sort((a, b) => b.qty - a.qty).slice(0, 5);
    })();

    const { items, page, totalPages, total } = UI.paginate(rows, state.page, perPage);

    root.innerHTML = `
      <div class="grid grid-4 mt-16">
        ${statCard('banknote', 'icon-bg-black', 'Total Pendapatan', Util.formatCurrency(s.revenue))}
        ${statCard('receipt-text', 'icon-bg-info', 'Jumlah Transaksi', Util.formatNumber(s.count))}
        ${statCard('shopping-basket', 'icon-bg-purple', 'Produk Terjual', Util.formatNumber(s.itemsSold))}
        ${statCard('scale', 'icon-bg-warning', 'Rata-rata / Transaksi', Util.formatCurrency(s.avg))}
      </div>

      <div class="grid grid-main-side mt-16">
        <div class="table-card mt-16" id="laporan-table-card">
          <div class="table-toolbar">
            <strong style="font-size:14px;">Daftar Transaksi (${Util.formatDate(state.from)} s/d ${Util.formatDate(state.to)})</strong>
            <div class="table-filters">
              <button class="btn btn-outline btn-sm" id="lr-print"><i data-lucide="printer"></i> Print</button>
              <button class="btn btn-outline btn-sm" id="lr-excel"><i data-lucide="file-spreadsheet"></i> Excel</button>
              <button class="btn btn-outline btn-sm" id="lr-pdf"><i data-lucide="file-text"></i> PDF</button>
            </div>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Invoice</th><th>Kasir</th><th>Metode</th><th>Waktu</th><th>Total</th></tr></thead>
              <tbody>
                ${items.length ? items.map(t => {
      const emp = Store.list('employees').find(e => e.id === t.cashier_id);
      return `<tr><td class="mono">${t.invoice_number}</td><td>${emp ? Util.escape(emp.name) : '-'}</td><td>${UI.badge(t.payment_method.toUpperCase(), 'badge-info')}</td><td class="cell-sub">${Util.formatDateTime(t.created_at)}</td><td class="mono cell-title">${Util.formatCurrency(t.total)}</td></tr>`;
    }).join('') : `<tr><td colspan="5">${UI.emptyState('search-x', 'Tidak ada transaksi pada periode/filter ini')}</td></tr>`}
              </tbody>
            </table>
          </div>
          <div class="table-footer">${UI.paginationHTML(page, totalPages, total, perPage)}</div>
        </div>
      </div>

      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="section-title">Produk Terlaris (Periode Ini)</div>
          ${top.length ? `<div class="kv-list">${top.map((t, i) => `<div class="kv-row"><span>${i + 1}. ${Util.escape(t.product.name)}</span><span>${Util.formatNumber(t.qty)} terjual</span></div>`).join('')}</div>` : UI.emptyState('package-search', 'Belum ada data')}
        </div>
        <div class="card">
          <div class="section-title">Ringkasan Laba Rugi Estimasi</div>
          <div class="kv-list">
            <div class="kv-row"><span>Pendapatan</span><span>${Util.formatCurrency(s.revenue)}</span></div>
            <div class="kv-row"><span>Pengeluaran</span><span>${Util.formatCurrency(s.expenses)}</span></div>
            <div class="kv-row"><span>Laba Bersih</span><span style="color:${s.profit >= 0 ? 'var(--c-success)' : 'var(--c-danger)'}">${Util.formatCurrency(s.profit)}</span></div>
          </div>
        </div>
      </div>
    `;

    UI.icons();
    UI.bindPagination(document.getElementById('laporan-table-card').querySelector('.table-footer'), (p) => { state.page = p; renderResults(); });

    document.getElementById('lr-excel').addEventListener('click', () => {
      UI.exportExcel('Laporan-Transaksi', 'Laporan', rows.map(t => {
        const emp = Store.list('employees').find(e => e.id === t.cashier_id);
        return { Invoice: t.invoice_number, Kasir: emp ? emp.name : '-', Metode: t.payment_method, Waktu: t.created_at, Subtotal: t.subtotal, Diskon: t.discount, Pajak: t.tax, Service: t.service_charge, Total: t.total };
      }));
    });
    document.getElementById('lr-pdf').addEventListener('click', () => {
      UI.exportPDFTable({
        filename: 'Laporan-Transaksi',
        title: 'Laporan Transaksi ' + Store.data.settings.business_name,
        meta: [`Periode: ${Util.formatDate(state.from)} s/d ${Util.formatDate(state.to)}`, `Total Pendapatan: ${Util.formatCurrency(s.revenue)} | Transaksi: ${s.count}`],
        head: [['Invoice', 'Kasir', 'Metode', 'Waktu', 'Total']],
        body: rows.map(t => { const emp = Store.list('employees').find(e => e.id === t.cashier_id); return [t.invoice_number, emp ? emp.name : '-', t.payment_method.toUpperCase(), Util.formatDateTime(t.created_at), Util.formatCurrency(t.total)]; }),
      });
    });
    document.getElementById('lr-print').addEventListener('click', () => {
      const html = `
        <h2 class="center">${Util.escape(Store.data.settings.business_name)}</h2>
        <p class="center">Laporan Transaksi Periode ${Util.formatDate(state.from)} s/d ${Util.formatDate(state.to)}</p>
        <div class="receipt-line"></div>
        <table>
          <thead><tr><td><strong>Invoice</strong></td><td><strong>Kasir</strong></td><td class="text-right"><strong>Total</strong></td></tr></thead>
          <tbody>
            ${rows.map(t => { const emp = Store.list('employees').find(e => e.id === t.cashier_id); return `<tr><td>${t.invoice_number}</td><td>${emp ? emp.name : '-'}</td><td class="text-right">${Util.formatCurrency(t.total)}</td></tr>`; }).join('')}
          </tbody>
        </table>
        <div class="receipt-line"></div>
        <table><tr><td><strong>TOTAL PENDAPATAN</strong></td><td class="text-right"><strong>${Util.formatCurrency(s.revenue)}</strong></td></tr></table>
      `;
      UI.printSection(html, 'Laporan Transaksi');
    });
  }

  function render(container) {
    container.innerHTML = `<div id="laporan-filter"></div><div id="laporan-results"></div>`;
    renderFilterBar(document.getElementById('laporan-filter'));
    renderResults();
  }

  Modules.laporan = {
    title: 'Laporan',
    subtitle: 'Laporan bisnis dengan filter, export Excel, PDF, dan cetak',
    render,
  };
})();
