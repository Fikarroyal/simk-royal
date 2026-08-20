/* =========================================================================
   modules/bundling.js — Paket Bundling / Combo Menu (Fitur CRUD tambahan #11)
   Menggabungkan beberapa produk jadi satu paket dengan harga spesial,
   memudahkan promosi kombo tanpa perlu membuat produk baru manual.
   ========================================================================= */
(function () {
  let table = null;

  function productChecklist(selectedIds) {
    const selected = selectedIds || [];
    return Store.list('products').filter(p => p.status === 'active').map(p => `
      <label class="checklist-item" style="display:flex;align-items:center;gap:8px;padding:6px 0;">
        <input type="checkbox" class="bundle-product-cb" value="${p.id}" ${selected.includes(p.id) ? 'checked' : ''} />
        <span>${Util.escape(p.name)} <span class="cell-sub">(${Util.formatCurrency(p.price)})</span></span>
      </label>`).join('');
  }

  function form(existing) {
    const b = existing || { name: '', bundle_price: 0, status: 'active', description: '' };
    return `
      <form id="bdl-form" class="form-grid">
        <div class="field span-2"><label>Nama Paket *</label><input class="input" name="name" required value="${Util.escape(b.name)}" /></div>
        <div class="field span-2"><label>Deskripsi</label><textarea class="input" name="description" rows="2">${Util.escape(b.description || '')}</textarea></div>
        <div class="field"><label>Harga Paket (Rp) *</label><input class="input" type="number" min="0" name="bundle_price" required value="${b.bundle_price}" /></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${b.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${b.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>
      <div class="mt-16"><strong>Pilih Produk dalam Paket *</strong></div>
      <div id="bundle-products" style="max-height:220px;overflow-y:auto;border:1px solid var(--c-border);border-radius:8px;padding:8px 12px;margin-top:8px;">
        ${productChecklist(existing ? existing.product_ids : [])}
      </div>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Paket Bundling' : 'Tambah Paket Bundling', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="bdl-cancel">Batal</button><button class="btn btn-primary" id="bdl-save">Simpan</button>`,
    });
    document.getElementById('bdl-cancel').addEventListener('click', close);
    document.getElementById('bdl-save').addEventListener('click', () => {
      const f = document.getElementById('bdl-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.bundle_price = Number(data.bundle_price);
      data.product_ids = Array.from(document.querySelectorAll('.bundle-product-cb:checked')).map(cb => cb.value);
      if (!data.product_ids.length) { UI.toast('Pilih minimal satu produk untuk paket ini.', 'danger'); return; }
      if (existing) { Store.update('bundles', existing.id, data); UI.toast('Paket bundling diperbarui.', 'success'); }
      else { Store.create('bundles', data, 'bdl'); UI.toast('Paket bundling ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function originalPrice(bundle) {
    return bundle.product_ids.reduce((sum, id) => { const p = Store.get('products', id); return sum + (p ? p.price : 0); }, 0);
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama paket...',
      addLabel: 'Tambah Paket',
      emptyIcon: 'package-plus', emptyTitle: 'Belum ada paket bundling',
      perPage: 8,
      getData: () => Store.list('bundles'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Paket', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub">${r.product_ids.length} produk</div>` },
        { label: 'Isi Paket', render: (r) => `<div style="max-width:260px;white-space:normal;">${r.product_ids.map(id => { const p = Store.get('products', id); return p ? Util.escape(p.name) : ''; }).filter(Boolean).join(', ')}</div>` },
        { label: 'Harga Normal', render: (r) => `<span class="mono" style="text-decoration:line-through;color:var(--c-text-muted);">${Util.formatCurrency(originalPrice(r))}</span>` },
        { label: 'Harga Paket', render: (r) => `<span class="mono" style="font-weight:700;">${Util.formatCurrency(r.bundle_price)}</span>` },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Paket', message: `Hapus paket "${row.name}"?`, danger: true });
          if (ok) { Store.remove('bundles', row.id); UI.toast('Paket dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Bundling', 'Bundling', rows.map(r => ({ Nama: r.name, Isi: r.product_ids.map(id => { const p = Store.get('products', id); return p ? p.name : ''; }).join(', '), HargaNormal: originalPrice(r), HargaPaket: r.bundle_price, Status: r.status }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="bdl-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('bdl-table-root'));
  }

  Modules.bundling = {
    title: 'Paket Bundling',
    subtitle: 'Kombo beberapa produk dengan harga spesial',
    render,
  };
})();
