/* =========================================================================
   modules/transaksi.js — Riwayat Transaksi dan Payment Management
   ========================================================================= */
(function () {
  let activeTab = 'riwayat';
  let trxTable = null;
  const METHOD_ICON = { cash: 'banknote', qris: 'qr-code', debit: 'credit-card', credit: 'credit-card', transfer: 'landmark', ewallet: 'wallet', split: 'split' };

  /* ------------------------------ RIWAYAT TRANSAKSI ------------------------------ */
  function viewDetail(trx) {
    UI.openModal({
      title: `Detail Transaksi ${trx.invoice_number}`, size: 'sm',
      body: window.Receipt.build(trx.id),
      footer: `
        <button class="btn btn-gray" id="td-close">Tutup</button>
        <button class="btn btn-outline" id="td-pdf"><i data-lucide="file-down"></i> PDF</button>
        <button class="btn btn-primary" id="td-print"><i data-lucide="printer"></i> Cetak</button>
      `,
    });
    document.getElementById('td-close').addEventListener('click', UI.closeModal);
    document.getElementById('td-print').addEventListener('click', () => window.Receipt.print(trx.id));
    document.getElementById('td-pdf').addEventListener('click', () => window.Receipt.pdf(trx.id));
  }

  function buildTrxTable(canVoid, restrictToSelf, myCashierId) {
    return createCrudTable({
      searchPlaceholder: 'Cari nomor invoice...',
      emptyIcon: 'receipt', emptyTitle: 'Belum ada transaksi',
      perPage: 8,
      getData: () => Store.list('transactions')
        .filter(t => !restrictToSelf || t.cashier_id === myCashierId)
        .slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
      searchFn: (row, q) => row.invoice_number.toLowerCase().includes(q),
      filters: [
        { key: 'payment_method', label: 'Semua Metode', options: Store.list('payment_methods').map(m => ({ value: m.id, label: m.name })), filterFn: (r, v) => r.payment_method === v },
        { key: 'status', label: 'Semua Status', options: [{ value: 'paid', label: 'Lunas' }, { value: 'void', label: 'Dibatalkan' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Invoice', render: (r) => `<span class="cell-title mono">${r.invoice_number}</span>` },
        { label: 'Kasir', render: (r) => { const e = Store.list('employees').find(e => e.id === r.cashier_id); return e ? Util.escape(e.name) : '-'; } },
        { label: 'Pelanggan', render: (r) => { const c = r.customer_id ? Store.get('customers', r.customer_id) : null; return c ? Util.escape(c.name) : 'Guest'; } },
        { label: 'Metode', render: (r) => {
          if (r.payment_method === 'split' && Array.isArray(r.splits)) {
            const names = r.splits.map(s => (Store.list('payment_methods').find(m => m.id === s.method) || { name: s.method }).name.toUpperCase()).join(' + ');
            return `<i data-lucide="split" style="width:14px;height:14px;display:inline;vertical-align:-2px;"></i> SPLIT (${names})`;
          }
          return `<i data-lucide="${METHOD_ICON[r.payment_method] || 'wallet'}" style="width:14px;height:14px;display:inline;vertical-align:-2px;"></i> ${r.payment_method.toUpperCase()}`;
        } },
        { label: 'Total', render: (r) => `<span class="mono cell-title">${Util.formatCurrency(r.total)}</span>` },
        { label: 'Waktu', render: (r) => `<span class="cell-sub">${Util.formatDateTime(r.created_at)}</span>` },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'eye', title: 'Detail / Cetak', cls: 'btn-gray', onClick: () => viewDetail(row) },
        ...(canVoid && row.status !== 'void' ? [{ icon: 'undo-2', title: 'Retur Sebagian Item', cls: 'btn-gray', onClick: () => openRefundModal(row, myCashierId) }] : []),
        ...(canVoid && row.status !== 'void' ? [{ icon: 'ban', title: 'Batalkan Transaksi', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Batalkan Transaksi', message: `Transaksi ${row.invoice_number} akan dibatalkan dan stok item dikembalikan. Lanjutkan?`, danger: true });
          if (ok) {
            Store.list('transaction_items').filter(i => i.transaction_id === row.id).forEach(i => {
              const p = Store.get('products', i.product_id);
              if (p) p.stock += i.quantity;
            });
            Store.update('transactions', row.id, { status: 'void' });
            Store.save();
            Store.logActivity({ type: 'void', actor_id: App.user.employeeId || App.user.id, actor_name: App.user.name, ref_id: row.id, detail: `Membatalkan transaksi ${row.invoice_number}` });
            UI.toast('Transaksi dibatalkan, stok dikembalikan.', 'success');
            trxTable.refresh();
            App.updateLowStockBadge();
          }
        }}] : []),
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Transaksi', 'Transaksi', rows.map(r => ({ Invoice: r.invoice_number, Total: r.total, Metode: r.payment_method, Status: r.status, Waktu: r.created_at }))),
      },
    });
  }

  function openRefundModal(row, myCashierId) {
    const items = Store.list('transaction_items').filter(i => i.transaction_id === row.id);
    const priorRefunds = Store.refundsForTransaction(row.id);
    const refundedQty = {};
    priorRefunds.forEach(r => r.items.forEach(i => { refundedQty[i.product_id] = (refundedQty[i.product_id] || 0) + i.qty; }));

    const rows = items.map(i => {
      const product = Store.get('products', i.product_id);
      const already = refundedQty[i.product_id] || 0;
      const remaining = i.quantity - already;
      return { product_id: i.product_id, name: product ? product.name : '-', price: i.price, remaining };
    }).filter(r => r.remaining > 0);

    if (!rows.length) {
      UI.toast('Semua item pada transaksi ini sudah diretur sepenuhnya.', 'info');
      return;
    }

    const { root: modalRoot } = UI.openModal({
      title: `Retur Sebagian ${row.invoice_number}`,
      size: 'md',
      body: `
        <div class="table-scroll" style="margin-bottom:14px;">
          <table class="data-table">
            <thead><tr><th>Item</th><th>Harga</th><th>Sisa Bisa Diretur</th><th>Qty Retur</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${Util.escape(r.name)}</td>
                  <td class="mono">${Util.formatCurrency(r.price)}</td>
                  <td class="mono">${r.remaining}</td>
                  <td><input class="input" type="number" min="0" max="${r.remaining}" value="0" data-refund-qty="${r.product_id}" data-price="${r.price}" data-name="${Util.escape(r.name)}" style="width:80px;" /></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="kv-row" style="margin-bottom:14px;"><span>Total Retur</span><span class="mono" id="rf-total">${Util.formatCurrency(0)}</span></div>
        <div class="field"><label>Alasan Retur *</label><input class="input" id="rf-reason" placeholder="mis. Item salah pesan / rusak" /></div>
      `,
      footer: `
        <button class="btn btn-gray" id="rf-cancel">Batal</button>
        <button class="btn btn-danger" id="rf-confirm"><i data-lucide="undo-2"></i> Proses Retur</button>
      `,
    });
    UI.icons();

    const updateTotal = () => {
      let total = 0;
      modalRoot.querySelectorAll('[data-refund-qty]').forEach(inp => { total += (Number(inp.value) || 0) * Number(inp.dataset.price); });
      document.getElementById('rf-total').textContent = Util.formatCurrency(total);
    };
    modalRoot.querySelectorAll('[data-refund-qty]').forEach(inp => inp.addEventListener('input', () => {
      const max = Number(inp.max);
      if (Number(inp.value) > max) inp.value = max;
      if (Number(inp.value) < 0) inp.value = 0;
      updateTotal();
    }));

    document.getElementById('rf-cancel').addEventListener('click', UI.closeModal);
    document.getElementById('rf-confirm').addEventListener('click', () => {
      const reason = document.getElementById('rf-reason').value.trim();
      if (!reason) { UI.toast('Isi alasan retur terlebih dahulu.', 'warning'); return; }
      const refundItems = [];
      modalRoot.querySelectorAll('[data-refund-qty]').forEach(inp => {
        const qty = Number(inp.value) || 0;
        if (qty > 0) refundItems.push({ product_id: inp.dataset.refundQty, name: inp.dataset.name, price: Number(inp.dataset.price), qty });
      });
      if (!refundItems.length) { UI.toast('Isi minimal 1 item yang diretur.', 'warning'); return; }
      Store.createRefund({ transaction_id: row.id, items: refundItems, reason, processed_by: myCashierId, processed_by_name: App.user.name });
      UI.closeModal();
      UI.toast('Retur berhasil diproses, stok dikembalikan.', 'success');
      trxTable.refresh();
      App.updateLowStockBadge();
    });
  }

  /* ------------------------------ METODE PEMBAYARAN ------------------------------ */
  function renderPaymentMethods(container, readonly) {
    const methods = Store.list('payment_methods');
    const stats = Store.list('transactions').filter(t => t.status !== 'void');
    container.innerHTML = `
      <div class="card">
        <div class="section-title">Metode Pembayaran Aktif</div>
        <div class="grid grid-3">
          ${methods.map(m => {
      const revenue = Store.revenueByMethod(m.id, stats);
      return `
              <div class="card" style="box-shadow:none;">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-8">
                    <div class="avatar-sq"><i data-lucide="${METHOD_ICON[m.id] || 'wallet'}"></i></div>
                    <div>
                      <div class="cell-title">${Util.escape(m.name)}</div>
                      <div class="cell-sub mono">${Util.formatCurrency(revenue)}</div>
                    </div>
                  </div>
                  <label class="checkbox-row">
                    <input type="checkbox" data-toggle-method="${m.id}" ${m.enabled ? 'checked' : ''} ${readonly ? 'disabled' : ''} />
                  </label>
                </div>
              </div>`;
    }).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('[data-toggle-method]').forEach(chk => {
      chk.addEventListener('change', () => {
        const method = Store.list('payment_methods').find(m => m.id === chk.dataset.toggleMethod);
        if (method) { method.enabled = chk.checked; Store.save(); UI.toast(`${method.name} ${chk.checked ? 'diaktifkan' : 'dinonaktifkan'} untuk POS.`, 'info'); }
      });
    });
    UI.icons();
  }

  function render(container, ctx) {
    const canVoid = ctx.user.role === 'administrator' || ctx.user.role === 'manager';
    const restrictToSelf = ctx.user.role === 'kasir';
    const userRecord = Store.list('users').find(u => u.id === ctx.user.id);
    const myCashierId = (userRecord && userRecord.employee_id) || ctx.user.id;
    container.innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${activeTab === 'riwayat' ? 'active' : ''}" data-tab="riwayat">Riwayat Transaksi</button>
        <button class="tab-btn ${activeTab === 'pembayaran' ? 'active' : ''}" data-tab="pembayaran">Metode Pembayaran</button>
      </div>
      <div id="trx-tab-content"></div>
    `;
    container.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(container, ctx); }));
    const content = document.getElementById('trx-tab-content');
    if (activeTab === 'riwayat') { trxTable = buildTrxTable(canVoid, restrictToSelf, myCashierId); trxTable.mount(content); }
    else renderPaymentMethods(content, ctx.readonly);
    UI.icons();
  }

  Modules.transaksi = {
    title: 'Transaksi & Pembayaran',
    subtitle: 'Riwayat penjualan dan pengaturan metode pembayaran',
    render,
  };
})();
