/* =========================================================================
   modules/limbah.js — Limbah & Kerugian Stok (Fitur CRUD tambahan #12)
   Mencatat bahan baku/produk yang terbuang (kedaluwarsa, rusak, gagal
   produksi), otomatis memotong stok terkait & menghitung kerugian biaya
   sehingga bisa dipantau untuk pengendalian biaya (cost control).
   ========================================================================= */
(function () {
  let table = null;
  const REASONS = ['Kedaluwarsa', 'Rusak/Busuk', 'Gagal Produksi', 'Tumpah/Pecah', 'Lainnya'];

  function itemOptions(type, selectedId) {
    const coll = type === 'raw_material' ? 'raw_materials' : 'products';
    return Store.list(coll).map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${Util.escape(i.name)}</option>`).join('');
  }

  function itemUnitCost(type, id) {
    const coll = type === 'raw_material' ? 'raw_materials' : 'products';
    const item = Store.get(coll, id);
    if (!item) return { unit: '', cost: 0 };
    return type === 'raw_material' ? { unit: item.unit, cost: item.cost } : { unit: item.unit, cost: item.cost };
  }

  function form() {
    return `
      <form id="wst-form" class="form-grid">
        <div class="field"><label>Jenis Item *</label>
          <select class="input" name="item_type" id="wst-item-type" required>
            <option value="raw_material">Bahan Baku</option>
            <option value="product">Produk Jadi</option>
          </select>
        </div>
        <div class="field"><label>Item *</label><select class="input" name="item_id" id="wst-item-id" required>${itemOptions('raw_material')}</select></div>
        <div class="field"><label>Jumlah Terbuang *</label><input class="input" type="number" min="0.01" step="0.01" name="qty" required /></div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="date" required value="${Util.todayISO()}" /></div>
        <div class="field"><label>Alasan *</label>
          <select class="input" name="reason" required>${REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Dilaporkan Oleh *</label><input class="input" name="reported_by" required placeholder="Nama staff" /></div>
      </form>`;
  }

  function openModal() {
    const { close } = UI.openModal({
      title: 'Catat Limbah / Kerugian Stok', size: 'md',
      body: form(),
      footer: `<button class="btn btn-gray" id="wst-cancel">Batal</button><button class="btn btn-primary" id="wst-save">Simpan</button>`,
    });
    document.getElementById('wst-cancel').addEventListener('click', close);
    document.getElementById('wst-item-type').addEventListener('change', (e) => {
      document.getElementById('wst-item-id').innerHTML = itemOptions(e.target.value);
    });
    document.getElementById('wst-save').addEventListener('click', () => {
      const f = document.getElementById('wst-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.qty = Number(data.qty);
      const info = itemUnitCost(data.item_type, data.item_id);
      data.cost_loss = Math.round(data.qty * info.cost);
      Store.create('stock_waste', data, 'wst');
      Store.applyStockWaste(data.item_type, data.item_id, data.qty);
      Store.save();
      UI.toast('Limbah dicatat & stok otomatis dikurangi.', 'success');
      close(); table.refresh();
    });
  }

  function itemName(type, id) {
    const coll = type === 'raw_material' ? 'raw_materials' : 'products';
    const item = Store.get(coll, id);
    return item ? item.name : '-';
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama item atau alasan...',
      addLabel: 'Catat Limbah',
      emptyIcon: 'trash', emptyTitle: 'Belum ada catatan limbah',
      perPage: 8,
      getData: () => Store.list('stock_waste').slice().sort((a, b) => b.date.localeCompare(a.date)),
      searchFn: (row, q) => itemName(row.item_type, row.item_id).toLowerCase().includes(q) || row.reason.toLowerCase().includes(q),
      filters: [
        { key: 'item_type', label: 'Semua Jenis', options: [{ value: 'raw_material', label: 'Bahan Baku' }, { value: 'product', label: 'Produk Jadi' }], filterFn: (r, v) => r.item_type === v },
        { key: 'reason', label: 'Semua Alasan', options: REASONS.map(r => ({ value: r, label: r })), filterFn: (r, v) => r.reason === v },
      ],
      columns: [
        { label: 'Item', render: (r) => `<div class="cell-title">${Util.escape(itemName(r.item_type, r.item_id))}</div><div class="cell-sub">${r.item_type === 'raw_material' ? 'Bahan Baku' : 'Produk Jadi'}</div>` },
        { label: 'Jumlah', render: (r) => Util.formatNumber(r.qty) },
        { label: 'Alasan', render: (r) => UI.badge(r.reason, 'badge-danger') },
        { label: 'Tanggal', render: (r) => Util.formatDate(r.date) },
        { label: 'Kerugian', render: (r) => `<span class="mono">${Util.formatCurrency(r.cost_loss)}</span>` },
        { label: 'Pelapor', render: (r) => Util.escape(r.reported_by) },
      ],
      rowActions: (row) => [
        { icon: 'trash-2', title: 'Hapus Catatan', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Catatan Limbah', message: 'Menghapus catatan ini TIDAK mengembalikan stok yang sudah terpotong. Lanjutkan?', danger: true });
          if (ok) { Store.remove('stock_waste', row.id); UI.toast('Catatan limbah dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-LimbahStok', 'Limbah', rows.map(r => ({ Item: itemName(r.item_type, r.item_id), Jenis: r.item_type === 'raw_material' ? 'Bahan Baku' : 'Produk', Jumlah: r.qty, Alasan: r.reason, Tanggal: r.date, Kerugian: r.cost_loss, Pelapor: r.reported_by }))),
      },
      onAdd: () => openModal(),
    });
  }

  function render(container) {
    const totalLoss = Store.list('stock_waste').reduce((s, r) => s + (r.cost_loss || 0), 0);
    const thisMonth = Store.list('stock_waste').filter(r => r.date.slice(0, 7) === Util.todayISO().slice(0, 7)).length;
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="trash"></i></div><div class="stat-value">${Store.list('stock_waste').length}</div><div class="stat-label">Total Catatan Limbah</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="calendar"></i></div><div class="stat-value">${thisMonth}</div><div class="stat-label">Bulan Ini</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="trending-down"></i></div><div class="stat-value">${Util.formatCurrency(totalLoss)}</div><div class="stat-label">Total Kerugian</div></div>
      </div>
      <div id="wst-table-root" class="mt-16"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('wst-table-root'));
  }

  Modules.limbah = {
    title: 'Limbah & Kerugian Stok',
    subtitle: 'Catat bahan baku/produk terbuang untuk pengendalian biaya',
    render,
  };
})();
