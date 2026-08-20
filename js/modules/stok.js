/* =========================================================================
   modules/stok.js — Inventory (FR-07), Supplier, dan Pembelian
   ========================================================================= */
(function () {
  let activeTab = 'stok';
  let stokTable = null;
  let supplierTable = null;
  let pembelianTable = null;

  /* ---------------------------------- STOK ---------------------------------- */
  function openAdjustModal(product) {
    const { close } = UI.openModal({
      title: `Sesuaikan Stok ${product.name}`, size: 'sm',
      body: `
        <form id="adjust-form" class="form-grid">
          <div class="field span-2"><label>Stok Saat Ini</label><input class="input" disabled value="${product.stock} ${Util.escape(product.unit)}" /></div>
          <div class="field span-2"><label>Jenis Penyesuaian *</label>
            <select class="input" name="type">
              <option value="in">Tambah Stok (Masuk)</option>
              <option value="out">Kurangi Stok (Keluar/Rusak)</option>
              <option value="set">Set ke Jumlah Tertentu (Stok Opname)</option>
            </select>
          </div>
          <div class="field span-2"><label>Jumlah *</label><input class="input" type="number" min="0" name="qty" required value="0" /></div>
          <div class="field span-2"><label>Catatan</label><input class="input" name="note" placeholder="mis. hasil stok opname / barang rusak" /></div>
        </form>`,
      footer: `<button class="btn btn-gray" id="ad-cancel">Batal</button><button class="btn btn-primary" id="ad-save">Simpan</button>`,
    });
    document.getElementById('ad-cancel').addEventListener('click', close);
    document.getElementById('ad-save').addEventListener('click', () => {
      const f = document.getElementById('adjust-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      const qty = Number(data.qty);
      let newStock = product.stock;
      if (data.type === 'in') newStock = product.stock + qty;
      else if (data.type === 'out') newStock = Math.max(0, product.stock - qty);
      else newStock = qty;
      Store.update('products', product.id, { stock: newStock });
      UI.toast('Stok berhasil disesuaikan.', 'success');
      close(); stokTable.refresh(); App.updateLowStockBadge();
    });
  }

  function buildStokTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau SKU produk...',
      emptyIcon: 'boxes', emptyTitle: 'Belum ada produk',
      perPage: 8,
      getData: () => Store.list('products'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q),
      filters: [
        { key: 'level', label: 'Semua Level Stok', options: [{ value: 'low', label: 'Stok Menipis' }, { value: 'ok', label: 'Stok Aman' }], filterFn: (r, v) => v === 'low' ? r.stock <= r.minimum_stock : r.stock > r.minimum_stock },
      ],
      columns: [
        { label: 'Produk', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub mono">${Util.escape(r.sku)}</div>` },
        { label: 'Stok', render: (r) => `<span class="mono" style="${r.stock <= r.minimum_stock ? 'color:var(--c-danger);font-weight:700;' : ''}">${r.stock} ${Util.escape(r.unit)}</span>` },
        { label: 'Stok Minimum', render: (r) => `${r.minimum_stock} ${Util.escape(r.unit)}` },
        { label: 'Nilai Stok', render: (r) => `<span class="mono">${Util.formatCurrency(r.stock * r.cost)}</span>` },
        { label: 'Status', render: (r) => r.stock <= r.minimum_stock ? UI.badge('Menipis', 'badge-danger') : UI.badge('Aman', 'badge-success') },
      ],
      rowActions: (row) => [
        { icon: 'settings-2', title: 'Sesuaikan Stok', cls: 'btn-blue', onClick: () => openAdjustModal(row) },
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Stok', 'Stok', rows.map(r => ({ SKU: r.sku, Nama: r.name, Stok: r.stock, Minimum: r.minimum_stock, Satuan: r.unit, NilaiStok: r.stock * r.cost }))),
      },
    });
  }

  /* -------------------------------- SUPPLIER -------------------------------- */
  function supplierForm(existing) {
    const s = existing || { name: '', company: '', phone: '', email: '', address: '', status: 'active' };
    return `
      <form id="supplier-form" class="form-grid">
        <div class="field span-2"><label>Nama Kontak *</label><input class="input" name="name" required value="${Util.escape(s.name)}" /></div>
        <div class="field span-2"><label>Nama Perusahaan *</label><input class="input" name="company" required value="${Util.escape(s.company)}" /></div>
        <div class="field"><label>No. Telepon *</label><input class="input" name="phone" required value="${Util.escape(s.phone)}" /></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="email" value="${Util.escape(s.email || '')}" /></div>
        <div class="field span-2"><label>Alamat</label><textarea class="input" name="address" rows="2">${Util.escape(s.address || '')}</textarea></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${s.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openSupplierModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Supplier' : 'Tambah Supplier', size: 'md',
      body: supplierForm(existing),
      footer: `<button class="btn btn-gray" id="sf-cancel">Batal</button><button class="btn btn-primary" id="sf-save">Simpan</button>`,
    });
    document.getElementById('sf-cancel').addEventListener('click', close);
    document.getElementById('sf-save').addEventListener('click', () => {
      const f = document.getElementById('supplier-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      if (existing) { Store.update('suppliers', existing.id, data); UI.toast('Supplier diperbarui.', 'success'); }
      else { Store.create('suppliers', data, 'sup'); UI.toast('Supplier ditambahkan.', 'success'); }
      close(); supplierTable.refresh();
    });
  }

  function buildSupplierTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau perusahaan...',
      addLabel: 'Tambah Supplier',
      emptyIcon: 'truck', emptyTitle: 'Belum ada supplier',
      perPage: 8,
      getData: () => Store.list('suppliers'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.company.toLowerCase().includes(q),
      columns: [
        { label: 'Kontak', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub">${Util.escape(r.company)}</div>` },
        { label: 'Telepon', render: (r) => `<span class="mono">${Util.escape(r.phone)}</span>` },
        { label: 'Email', render: (r) => Util.escape(r.email || '-') },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openSupplierModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Supplier', message: `Hapus supplier "${row.company}"?`, danger: true });
          if (ok) { Store.remove('suppliers', row.id); UI.toast('Supplier dihapus.', 'success'); supplierTable.refresh(); }
        }},
      ],
      onAdd: () => openSupplierModal(null),
    });
  }

  /* -------------------------------- PEMBELIAN -------------------------------- */
  function openPurchaseModal() {
    const suppliers = Store.list('suppliers').filter(s => s.status === 'active');
    const products = Store.list('products');
    let items = [{ product_id: products[0] ? products[0].id : '', quantity: 1, price: products[0] ? products[0].cost : 0 }];

    const { close } = UI.openModal({
      title: 'Buat Pembelian Baru', size: 'lg',
      body: `
        <form id="purchase-form" class="form-grid">
          <div class="field"><label>Supplier *</label>
            <select class="input" name="supplier_id" required>${suppliers.map(s => `<option value="${s.id}">${Util.escape(s.company)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>No. Invoice Supplier *</label><input class="input" name="invoice" required placeholder="mis. SUP-INV-001" /></div>
          <div class="field span-2"><label>Tanggal Pembelian *</label><input class="input" type="date" name="purchase_date" required value="${Util.todayISO()}" /></div>
        </form>
        <div class="section-title mt-16">Item Pembelian</div>
        <div id="purchase-items"></div>
        <button class="btn btn-gray btn-sm mt-8" id="btn-add-item" type="button"><i data-lucide="plus"></i> Tambah Item</button>
        <div class="kv-row mt-16"><span>Total Pembelian</span><span class="mono" id="purchase-total" style="font-size:16px;">${Util.formatCurrency(0)}</span></div>
      `,
      footer: `<button class="btn btn-gray" id="pu-cancel">Batal</button><button class="btn btn-primary" id="pu-save">Simpan Pembelian</button>`,
    });

    function renderItems() {
      const wrap = document.getElementById('purchase-items');
      wrap.innerHTML = items.map((it, idx) => `
        <div class="flex gap-8 mt-8" data-item-row="${idx}">
          <select class="input" data-field="product_id" data-idx="${idx}" style="flex:2;">
            ${products.map(p => `<option value="${p.id}" ${it.product_id === p.id ? 'selected' : ''}>${Util.escape(p.name)}</option>`).join('')}
          </select>
          <input class="input" type="number" min="1" data-field="quantity" data-idx="${idx}" value="${it.quantity}" style="flex:1;" placeholder="Qty" />
          <input class="input" type="number" min="0" data-field="price" data-idx="${idx}" value="${it.price}" style="flex:1;" placeholder="Harga" />
          <button type="button" class="icon-btn" data-remove-item="${idx}"><i data-lucide="x"></i></button>
        </div>
      `).join('');
      wrap.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input', () => {
          const idx = Number(el.dataset.idx);
          const field = el.dataset.field;
          items[idx][field] = field === 'product_id' ? el.value : Number(el.value);
          if (field === 'product_id') {
            const p = Store.get('products', el.value);
            items[idx].price = p ? p.cost : 0;
            renderItems();
          }
          updateTotal();
        });
      });
      wrap.querySelectorAll('[data-remove-item]').forEach(btn => {
        btn.addEventListener('click', () => { items.splice(Number(btn.dataset.removeItem), 1); renderItems(); updateTotal(); });
      });
      UI.icons();
    }

    function updateTotal() {
      const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0);
      document.getElementById('purchase-total').textContent = Util.formatCurrency(total);
    }

    renderItems(); updateTotal();

    document.getElementById('btn-add-item').addEventListener('click', () => {
      items.push({ product_id: products[0] ? products[0].id : '', quantity: 1, price: products[0] ? products[0].cost : 0 });
      renderItems(); updateTotal();
    });
    document.getElementById('pu-cancel').addEventListener('click', close);
    document.getElementById('pu-save').addEventListener('click', () => {
      const f = document.getElementById('purchase-form');
      if (!UI.validateRequired(f)) return;
      if (!items.length) { UI.toast('Tambahkan minimal satu item.', 'danger'); return; }
      const data = UI.serializeForm(f);
      const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0);
      const purchase = Store.create('purchases', { ...data, total, status: 'ordered' }, 'pur');
      items.forEach(it => {
        Store.create('purchase_items', { purchase_id: purchase.id, product_id: it.product_id, quantity: it.quantity, price: it.price, subtotal: it.quantity * it.price }, 'pi');
      });
      UI.toast('Pembelian berhasil dibuat. Terima barang untuk menambah stok.', 'success');
      close(); pembelianTable.refresh();
    });
  }

  function viewPurchaseDetail(purchase) {
    const supplier = Store.get('suppliers', purchase.supplier_id);
    const items = Store.list('purchase_items').filter(i => i.purchase_id === purchase.id);
    UI.openModal({
      title: `Detail Pembelian ${purchase.invoice}`, size: 'lg',
      body: `
        <div class="kv-list" style="margin-bottom:14px;">
          <div class="kv-row"><span>Supplier</span><span>${supplier ? Util.escape(supplier.company) : '-'}</span></div>
          <div class="kv-row"><span>Tanggal</span><span>${Util.formatDate(purchase.purchase_date)}</span></div>
          <div class="kv-row"><span>Status</span><span>${UI.statusBadge(purchase.status)}</span></div>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
            <tbody>${items.map(i => { const p = Store.get('products', i.product_id); return `<tr><td>${p ? Util.escape(p.name) : '-'}</td><td>${i.quantity}</td><td class="mono">${Util.formatCurrency(i.price)}</td><td class="mono">${Util.formatCurrency(i.subtotal)}</td></tr>`; }).join('')}</tbody>
          </table>
        </div>
        <div class="kv-row mt-16"><span>Total</span><span class="mono" style="font-size:16px;">${Util.formatCurrency(purchase.total)}</span></div>
      `,
      footer: `<button class="btn btn-gray" id="pd-close">Tutup</button>`,
    });
    document.getElementById('pd-close').addEventListener('click', UI.closeModal);
  }

  function buildPembelianTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari no. invoice...',
      addLabel: 'Buat Pembelian',
      emptyIcon: 'shopping-bag', emptyTitle: 'Belum ada pembelian',
      perPage: 8,
      getData: () => Store.list('purchases').slice().sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)),
      searchFn: (row, q) => row.invoice.toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'ordered', label: 'Dipesan' }, { value: 'received', label: 'Diterima' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Invoice', render: (r) => `<span class="cell-title mono">${Util.escape(r.invoice)}</span>` },
        { label: 'Supplier', render: (r) => { const s = Store.get('suppliers', r.supplier_id); return s ? Util.escape(s.company) : '-'; } },
        { label: 'Tanggal', render: (r) => Util.formatDate(r.purchase_date) },
        { label: 'Total', render: (r) => `<span class="mono">${Util.formatCurrency(r.total)}</span>` },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'eye', title: 'Detail', cls: 'btn-gray', onClick: () => viewPurchaseDetail(row) },
        ...(row.status === 'ordered' ? [{ icon: 'package-check', title: 'Terima Barang', cls: 'btn-green', onClick: async () => {
          const ok = await UI.confirm({ title: 'Terima Barang', message: 'Stok produk akan bertambah sesuai item pembelian ini. Lanjutkan?' });
          if (ok) { Store.receivePurchase(row.id); UI.toast('Barang diterima, stok diperbarui.', 'success'); pembelianTable.refresh(); App.updateLowStockBadge(); }
        }}] : []),
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Pembelian', message: `Hapus data pembelian "${row.invoice}"?`, danger: true });
          if (ok) { Store.remove('purchases', row.id); UI.toast('Pembelian dihapus.', 'success'); pembelianTable.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Pembelian', 'Pembelian', rows.map(r => { const s = Store.get('suppliers', r.supplier_id); return { Invoice: r.invoice, Supplier: s ? s.company : '-', Tanggal: r.purchase_date, Total: r.total, Status: r.status }; })),
      },
      onAdd: () => openPurchaseModal(),
    });
  }

  function render(container) {
    const stats = Store.dashboardStats(null, null);
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="warehouse"></i></div><div class="stat-value">${Util.formatCurrency(stats.stockValue)}</div><div class="stat-label">Total Nilai Stok</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="triangle-alert"></i></div><div class="stat-value">${stats.lowStockCount}</div><div class="stat-label">Produk Stok Menipis</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="truck"></i></div><div class="stat-value">${Store.list('suppliers').filter(s => s.status === 'active').length}</div><div class="stat-label">Supplier Aktif</div></div>
      </div>
      <div class="tabs mt-16">
        <button class="tab-btn ${activeTab === 'stok' ? 'active' : ''}" data-tab="stok">Stok Produk</button>
        <button class="tab-btn ${activeTab === 'supplier' ? 'active' : ''}" data-tab="supplier">Supplier</button>
        <button class="tab-btn ${activeTab === 'pembelian' ? 'active' : ''}" data-tab="pembelian">Pembelian</button>
      </div>
      <div id="stok-tab-content"></div>
    `;
    container.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(container); }));
    const content = document.getElementById('stok-tab-content');
    if (activeTab === 'stok') { stokTable = buildStokTable(); stokTable.mount(content); }
    else if (activeTab === 'supplier') { supplierTable = buildSupplierTable(); supplierTable.mount(content); }
    else { pembelianTable = buildPembelianTable(); pembelianTable.mount(content); }
    UI.icons();
  }

  Modules.stok = {
    title: 'Stok, Supplier & Pembelian',
    subtitle: 'Inventori produk, data supplier, dan pembelian bahan',
    render,
  };
})();
