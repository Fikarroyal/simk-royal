/* =========================================================================
   modules/bahanbaku.js — Bahan Baku & Resep / BOM (Fitur CRUD tambahan #2)
   Stok bahan baku terpisah dari stok produk jadi, dipadukan dengan resep
   (Bill of Materials) yang memetakan 1 produk -> beberapa bahan baku +
   takaran. Saat transaksi POS selesai, stok bahan baku otomatis berkurang
   mengikuti resep produk yang terjual (lihat Store.deductRawMaterialsForSale).
   ========================================================================= */
(function () {
  let activeTab = 'bahan';
  let bahanTable = null;
  let resepTable = null;

  /* ------------------------------- BAHAN BAKU ------------------------------- */
  function bahanForm(existing) {
    const b = existing || { name: '', unit: '', stock: 0, minimum_stock: 0, cost: 0, status: 'active' };
    return `
      <form id="bahan-form" class="form-grid">
        <div class="field span-2"><label>Nama Bahan Baku *</label><input class="input" name="name" required value="${Util.escape(b.name)}" /></div>
        <div class="field"><label>Satuan *</label><input class="input" name="unit" required placeholder="gram / ml / pcs" value="${Util.escape(b.unit)}" /></div>
        <div class="field"><label>Harga per Satuan (Rp) *</label><input class="input" type="number" min="0" name="cost" required value="${b.cost}" /></div>
        <div class="field"><label>Stok Saat Ini *</label><input class="input" type="number" min="0" name="stock" required value="${b.stock}" /></div>
        <div class="field"><label>Stok Minimum *</label><input class="input" type="number" min="0" name="minimum_stock" required value="${b.minimum_stock}" /></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${b.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${b.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openBahanModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Bahan Baku' : 'Tambah Bahan Baku', size: 'md',
      body: bahanForm(existing),
      footer: `<button class="btn btn-gray" id="bb-cancel">Batal</button><button class="btn btn-primary" id="bb-save">Simpan</button>`,
    });
    document.getElementById('bb-cancel').addEventListener('click', close);
    document.getElementById('bb-save').addEventListener('click', () => {
      const f = document.getElementById('bahan-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.stock = Number(data.stock); data.minimum_stock = Number(data.minimum_stock); data.cost = Number(data.cost);
      if (existing) { Store.update('raw_materials', existing.id, data); UI.toast('Bahan baku diperbarui.', 'success'); }
      else { Store.create('raw_materials', data, 'bb'); UI.toast('Bahan baku ditambahkan.', 'success'); }
      close(); bahanTable.refresh();
    });
  }

  function buildBahanTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama bahan baku...',
      addLabel: 'Tambah Bahan Baku',
      emptyIcon: 'wheat', emptyTitle: 'Belum ada bahan baku',
      perPage: 8,
      getData: () => Store.list('raw_materials'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q),
      filters: [
        { key: 'level', label: 'Semua Level Stok', options: [{ value: 'low', label: 'Stok Menipis' }, { value: 'ok', label: 'Stok Aman' }], filterFn: (r, v) => v === 'low' ? r.stock <= r.minimum_stock : r.stock > r.minimum_stock },
      ],
      columns: [
        { label: 'Bahan Baku', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div>` },
        { label: 'Stok', render: (r) => `<span class="mono" style="${r.stock <= r.minimum_stock ? 'color:var(--c-danger);font-weight:700;' : ''}">${Util.formatNumber(r.stock)} ${Util.escape(r.unit)}</span>` },
        { label: 'Min. Stok', render: (r) => `${Util.formatNumber(r.minimum_stock)} ${Util.escape(r.unit)}` },
        { label: 'Harga/Satuan', render: (r) => Util.formatCurrency(r.cost) },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openBahanModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Bahan Baku', message: `Hapus bahan baku "${row.name}"?`, danger: true });
          if (ok) { Store.remove('raw_materials', row.id); UI.toast('Bahan baku dihapus.', 'success'); bahanTable.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-BahanBaku', 'BahanBaku', rows.map(r => ({ Nama: r.name, Satuan: r.unit, Stok: r.stock, StokMinimum: r.minimum_stock, HargaSatuan: r.cost, Status: r.status }))),
      },
      onAdd: () => openBahanModal(null),
    });
  }

  /* --------------------------------- RESEP --------------------------------- */
  function productOptions(selectedId) {
    return Store.list('products').map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${Util.escape(p.name)}</option>`).join('');
  }
  function materialOptions(selectedId) {
    return Store.list('raw_materials').map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${Util.escape(m.name)} (${Util.escape(m.unit)})</option>`).join('');
  }

  function ingredientRowHTML(item) {
    const it = item || { raw_material_id: '', qty: '' };
    return `
      <div class="form-grid resep-row" style="grid-template-columns: 1fr 110px 40px; align-items:end;">
        <div class="field"><label>Bahan Baku</label><select class="input ing-material">${materialOptions(it.raw_material_id)}</select></div>
        <div class="field"><label>Takaran</label><input class="input ing-qty" type="number" min="0" step="0.01" value="${it.qty}" /></div>
        <button type="button" class="btn btn-danger btn-sm btn-icon-only ing-remove" title="Hapus baris" style="margin-bottom:14px;"><i data-lucide="x"></i></button>
      </div>`;
  }

  function openResepModal(existing) {
    const r = existing || { product_id: '', items: [{ raw_material_id: '', qty: '' }] };
    const { close } = UI.openModal({
      title: existing ? 'Edit Resep' : 'Tambah Resep', size: 'lg',
      body: `
        <form id="resep-form" class="form-grid">
          <div class="field span-2"><label>Produk *</label><select class="input" name="product_id" required ${existing ? 'disabled' : ''}>${productOptions(r.product_id)}</select></div>
        </form>
        <div class="mt-16"><strong>Komposisi Bahan Baku</strong></div>
        <div id="resep-rows">${r.items.map(ingredientRowHTML).join('')}</div>
        <button type="button" class="btn btn-outline btn-sm mt-8" id="resep-add-row"><i data-lucide="plus"></i> Tambah Bahan</button>
      `,
      footer: `<button class="btn btn-gray" id="resep-cancel">Batal</button><button class="btn btn-primary" id="resep-save">Simpan</button>`,
    });
    UI.icons();
    document.getElementById('resep-cancel').addEventListener('click', close);
    document.getElementById('resep-add-row').addEventListener('click', () => {
      document.getElementById('resep-rows').insertAdjacentHTML('beforeend', ingredientRowHTML(null));
      UI.icons();
      bindRowRemovers();
    });
    function bindRowRemovers() {
      document.querySelectorAll('.ing-remove').forEach(btn => {
        btn.onclick = () => { if (document.querySelectorAll('.resep-row').length > 1) btn.closest('.resep-row').remove(); };
      });
    }
    bindRowRemovers();

    document.getElementById('resep-save').addEventListener('click', () => {
      const f = document.getElementById('resep-form');
      if (!existing && !UI.validateRequired(f)) return;
      const product_id = existing ? r.product_id : UI.serializeForm(f).product_id;
      const items = Array.from(document.querySelectorAll('.resep-row')).map(row => ({
        raw_material_id: row.querySelector('.ing-material').value,
        qty: Number(row.querySelector('.ing-qty').value) || 0,
      })).filter(it => it.raw_material_id && it.qty > 0);
      if (!items.length) { UI.toast('Tambahkan minimal satu bahan baku dengan takaran valid.', 'danger'); return; }
      const dup = Store.list('recipes').find(x => x.product_id === product_id && (!existing || x.id !== existing.id));
      if (dup) { UI.toast('Produk ini sudah punya resep. Edit resep yang sudah ada.', 'danger'); return; }
      if (existing) { Store.update('recipes', existing.id, { items }); UI.toast('Resep diperbarui.', 'success'); }
      else { Store.create('recipes', { product_id, items }, 'rcp'); UI.toast('Resep ditambahkan.', 'success'); }
      close(); resepTable.refresh();
    });
  }

  function buildResepTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama produk...',
      addLabel: 'Tambah Resep',
      emptyIcon: 'book-open', emptyTitle: 'Belum ada resep',
      perPage: 8,
      getData: () => Store.list('recipes'),
      searchFn: (row, q) => { const p = Store.get('products', row.product_id); return p ? p.name.toLowerCase().includes(q) : false; },
      columns: [
        { label: 'Produk', render: (r) => { const p = Store.get('products', r.product_id); return `<div class="cell-title">${p ? Util.escape(p.name) : '-'}</div>`; } },
        { label: 'Komposisi', render: (r) => r.items.map(it => { const m = Store.get('raw_materials', it.raw_material_id); return m ? `${Util.escape(m.name)} ${it.qty}${Util.escape(m.unit)}` : ''; }).filter(Boolean).join(', ') },
        { label: 'Jumlah Bahan', render: (r) => `${r.items.length} item` },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openResepModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Resep', message: 'Hapus resep ini?', danger: true });
          if (ok) { Store.remove('recipes', row.id); UI.toast('Resep dihapus.', 'success'); resepTable.refresh(); }
        }},
      ],
      onAdd: () => openResepModal(null),
    });
  }

  function render(container) {
    const lowCount = Store.lowStockRawMaterials().length;
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="wheat"></i></div><div class="stat-value">${Store.list('raw_materials').length}</div><div class="stat-label">Jenis Bahan Baku</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="triangle-alert"></i></div><div class="stat-value">${lowCount}</div><div class="stat-label">Bahan Baku Menipis</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="book-open"></i></div><div class="stat-value">${Store.list('recipes').length}</div><div class="stat-label">Resep Terdaftar</div></div>
      </div>
      <div class="tabs mt-16">
        <button class="tab-btn ${activeTab === 'bahan' ? 'active' : ''}" data-tab="bahan">Bahan Baku</button>
        <button class="tab-btn ${activeTab === 'resep' ? 'active' : ''}" data-tab="resep">Resep (BOM)</button>
      </div>
      <div id="bb-tab-content"></div>
    `;
    container.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(container); }));
    const content = document.getElementById('bb-tab-content');
    if (activeTab === 'bahan') { bahanTable = buildBahanTable(); bahanTable.mount(content); }
    else { resepTable = buildResepTable(); resepTable.mount(content); }
    UI.icons();
  }

  Modules.bahanbaku = {
    title: 'Bahan Baku & Resep',
    subtitle: 'Stok bahan baku dan resep (BOM) yang otomatis terpotong saat transaksi',
    render,
  };
})();
