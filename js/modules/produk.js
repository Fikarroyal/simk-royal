/* =========================================================================
   modules/produk.js — Manajemen Produk (FR + CRUD) dan Kategori
   ========================================================================= */
(function () {
  let activeTab = 'produk';
  const ICON_OPTIONS = ['coffee', 'cup-soda', 'utensils', 'cookie', 'ice-cream-cone', 'pizza', 'sandwich', 'soup', 'wine', 'beer', 'salad', 'cake', 'package'];

  let produkTable = null;
  let kategoriTable = null;

  /* --------------------------------- PRODUK -------------------------------- */
  function productForm(existing) {
    const categories = Store.list('categories');
    const p = existing || { sku: '', name: '', category_id: categories[0] ? categories[0].id : '', price: '', cost: '', stock: '', minimum_stock: '', unit: 'pcs', status: 'active' };
    return `
      <form id="product-form" class="form-grid">
        <div class="field"><label>SKU *</label><input class="input" name="sku" required value="${Util.escape(p.sku)}" /></div>
        <div class="field"><label>Nama Produk *</label><input class="input" name="name" required value="${Util.escape(p.name)}" /></div>
        <div class="field"><label>Kategori *</label>
          <select class="input" name="category_id" required>
            ${categories.map(c => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${Util.escape(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Satuan *</label><input class="input" name="unit" required value="${Util.escape(p.unit)}" placeholder="cup / porsi / pcs" /></div>
        <div class="field"><label>Harga Jual (Rp) *</label><input class="input" type="number" min="0" name="price" required value="${p.price}" /></div>
        <div class="field"><label>Harga Modal (Rp) *</label><input class="input" type="number" min="0" name="cost" required value="${p.cost}" /></div>
        <div class="field"><label>Stok *</label><input class="input" type="number" min="0" name="stock" required value="${p.stock}" /></div>
        <div class="field"><label>Stok Minimum *</label><input class="input" type="number" min="0" name="minimum_stock" required value="${p.minimum_stock}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>
    `;
  }

  function openProductModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Produk' : 'Tambah Produk',
      size: 'md',
      body: productForm(existing),
      footer: `<button class="btn btn-gray" id="pf-cancel">Batal</button><button class="btn btn-primary" id="pf-save">Simpan</button>`,
    });
    document.getElementById('pf-cancel').addEventListener('click', close);
    document.getElementById('pf-save').addEventListener('click', () => {
      const form = document.getElementById('product-form');
      if (!UI.validateRequired(form)) return;
      const data = UI.serializeForm(form);
      data.price = Number(data.price); data.cost = Number(data.cost);
      data.stock = Number(data.stock); data.minimum_stock = Number(data.minimum_stock);
      const dupSku = Store.list('products').find(pr => pr.sku.toLowerCase() === data.sku.toLowerCase() && (!existing || pr.id !== existing.id));
      if (dupSku) { UI.toast('SKU sudah digunakan produk lain.', 'danger'); return; }
      if (existing) { Store.update('products', existing.id, data); UI.toast('Produk berhasil diperbarui.', 'success'); }
      else { Store.create('products', data, 'prod'); UI.toast('Produk berhasil ditambahkan.', 'success'); }
      close();
      produkTable.refresh();
      App.updateLowStockBadge();
    });
  }

  function buildProductTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau SKU produk...',
      addLabel: 'Tambah Produk',
      emptyIcon: 'package', emptyTitle: 'Belum ada produk', emptyDesc: 'Tambahkan produk pertama Anda.',
      perPage: 8,
      getData: () => Store.list('products'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q),
      filters: [
        { key: 'category_id', label: 'Semua Kategori', options: Store.list('categories').map(c => ({ value: c.id, label: c.name })), filterFn: (r, v) => r.category_id === v },
        { key: 'status', label: 'Semua Status', options: [{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Produk', render: (r) => `<div class="cell-title mono">${Util.escape(r.sku)}</div><div class="cell-sub">${Util.escape(r.name)}</div>` },
        { label: 'Kategori', render: (r) => { const c = Store.get('categories', r.category_id); return c ? Util.escape(c.name) : '-'; } },
        { label: 'Harga', render: (r) => `<span class="mono">${Util.formatCurrency(r.price)}</span>` },
        { label: 'Stok', render: (r) => `<span class="mono" style="${r.stock <= r.minimum_stock ? 'color:var(--c-danger);font-weight:700;' : ''}">${r.stock} ${Util.escape(r.unit)}</span>` },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openProductModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Produk', message: `Hapus produk "${row.name}"? Tindakan ini tidak dapat dibatalkan.`, danger: true });
          if (ok) { Store.remove('products', row.id); UI.toast('Produk dihapus.', 'success'); produkTable.refresh(); App.updateLowStockBadge(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Produk', 'Produk', rows.map(r => ({
          SKU: r.sku, Nama: r.name, Kategori: (Store.get('categories', r.category_id) || {}).name || '-',
          Harga: r.price, Modal: r.cost, Stok: r.stock, Minimum: r.minimum_stock, Satuan: r.unit, Status: r.status,
        }))),
      },
      onAdd: () => openProductModal(null),
    });
  }

  /* -------------------------------- KATEGORI -------------------------------- */
  function categoryForm(existing) {
    const c = existing || { name: '', description: '', icon: 'package', status: 'active' };
    return `
      <form id="category-form" class="form-grid">
        <div class="field span-2"><label>Nama Kategori *</label><input class="input" name="name" required value="${Util.escape(c.name)}" /></div>
        <div class="field span-2"><label>Deskripsi</label><input class="input" name="description" value="${Util.escape(c.description || '')}" /></div>
        <div class="field"><label>Ikon</label>
          <select class="input" name="icon">${ICON_OPTIONS.map(i => `<option value="${i}" ${c.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${c.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openCategoryModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Kategori' : 'Tambah Kategori', size: 'sm',
      body: categoryForm(existing),
      footer: `<button class="btn btn-gray" id="cf-cancel">Batal</button><button class="btn btn-primary" id="cf-save">Simpan</button>`,
    });
    document.getElementById('cf-cancel').addEventListener('click', close);
    document.getElementById('cf-save').addEventListener('click', () => {
      const form = document.getElementById('category-form');
      if (!UI.validateRequired(form)) return;
      const data = UI.serializeForm(form);
      if (existing) { Store.update('categories', existing.id, data); UI.toast('Kategori diperbarui.', 'success'); }
      else { Store.create('categories', data, 'cat'); UI.toast('Kategori ditambahkan.', 'success'); }
      close();
      kategoriTable.refresh();
    });
  }

  function buildCategoryTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari kategori...',
      addLabel: 'Tambah Kategori',
      emptyIcon: 'shapes', emptyTitle: 'Belum ada kategori',
      perPage: 8,
      getData: () => Store.list('categories'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q),
      columns: [
        { label: 'Ikon', render: (r) => `<div class="avatar-sq"><i data-lucide="${r.icon}"></i></div>` },
        { label: 'Nama', render: (r) => `<span class="cell-title">${Util.escape(r.name)}</span>` },
        { label: 'Deskripsi', render: (r) => `<span class="cell-sub">${Util.escape(r.description || '-')}</span>` },
        { label: 'Jumlah Produk', render: (r) => Store.list('products').filter(p => p.category_id === r.id).length },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openCategoryModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const used = Store.list('products').some(p => p.category_id === row.id);
          if (used) { UI.toast('Kategori masih dipakai produk, tidak dapat dihapus.', 'warning'); return; }
          const ok = await UI.confirm({ title: 'Hapus Kategori', message: `Hapus kategori "${row.name}"?`, danger: true });
          if (ok) { Store.remove('categories', row.id); UI.toast('Kategori dihapus.', 'success'); kategoriTable.refresh(); }
        }},
      ],
      onAdd: () => openCategoryModal(null),
    });
  }

  function render(container, ctx) {
    container.innerHTML = `
      <div class="page-header">
        <div></div>
        <div class="page-actions"></div>
      </div>
      <div class="tabs">
        <button class="tab-btn ${activeTab === 'produk' ? 'active' : ''}" data-tab="produk">Produk</button>
        <button class="tab-btn ${activeTab === 'kategori' ? 'active' : ''}" data-tab="kategori">Kategori</button>
      </div>
      <div id="produk-tab-content"></div>
    `;
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(container, ctx); });
    });
    const content = document.getElementById('produk-tab-content');
    if (activeTab === 'produk') { produkTable = buildProductTable(); produkTable.mount(content); }
    else { kategoriTable = buildCategoryTable(); kategoriTable.mount(content); }
    UI.icons();
  }

  Modules.produk = {
    title: 'Produk & Kategori',
    subtitle: 'Kelola menu, harga, stok, dan kategori produk',
    render,
  };
})();
