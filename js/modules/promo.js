/* =========================================================================
   modules/promo.js — Diskon dan Promo (FR + CRUD)
   ========================================================================= */
(function () {
  let table = null;

  function form(existing) {
    const p = existing || { name: '', code: '', type: 'percent', value: '', start_date: Util.todayISO(), end_date: Util.todayISO(), minimum_transaction: 0, status: 'active' };
    return `
      <form id="promo-form" class="form-grid">
        <div class="field span-2"><label>Nama Promo *</label><input class="input" name="name" required value="${Util.escape(p.name)}" /></div>
        <div class="field"><label>Kode Promo *</label><input class="input" name="code" required value="${Util.escape(p.code)}" style="text-transform:uppercase;" /></div>
        <div class="field"><label>Jenis Diskon *</label>
          <select class="input" name="type">
            <option value="percent" ${p.type === 'percent' ? 'selected' : ''}>Persentase (%)</option>
            <option value="nominal" ${p.type === 'nominal' ? 'selected' : ''}>Nominal (Rp)</option>
          </select>
        </div>
        <div class="field"><label>Nilai Diskon *</label><input class="input" type="number" min="0" name="value" required value="${p.value}" /></div>
        <div class="field"><label>Minimal Transaksi (Rp)</label><input class="input" type="number" min="0" name="minimum_transaction" value="${p.minimum_transaction || 0}" /></div>
        <div class="field"><label>Tanggal Mulai *</label><input class="input" type="date" name="start_date" required value="${p.start_date}" /></div>
        <div class="field"><label>Tanggal Berakhir *</label><input class="input" type="date" name="end_date" required value="${p.end_date}" /></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Promo' : 'Tambah Promo', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="prf-cancel">Batal</button><button class="btn btn-primary" id="prf-save">Simpan</button>`,
    });
    document.getElementById('prf-cancel').addEventListener('click', close);
    document.getElementById('prf-save').addEventListener('click', () => {
      const f = document.getElementById('promo-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.code = data.code.toUpperCase();
      data.value = Number(data.value); data.minimum_transaction = Number(data.minimum_transaction) || 0;
      const dup = Store.list('promotions').find(p => p.code === data.code && (!existing || p.id !== existing.id));
      if (dup) { UI.toast('Kode promo sudah digunakan.', 'danger'); return; }
      if (existing) { Store.update('promotions', existing.id, data); UI.toast('Promo diperbarui.', 'success'); }
      else { Store.create('promotions', data, 'promo'); UI.toast('Promo ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau kode promo...',
      addLabel: 'Tambah Promo',
      emptyIcon: 'badge-percent', emptyTitle: 'Belum ada promo',
      perPage: 8,
      getData: () => Store.list('promotions'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Promo', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub mono">${Util.escape(r.code)}</div>` },
        { label: 'Diskon', render: (r) => r.type === 'percent' ? `${r.value}%` : Util.formatCurrency(r.value) },
        { label: 'Min. Transaksi', render: (r) => Util.formatCurrency(r.minimum_transaction || 0) },
        { label: 'Periode', render: (r) => `${Util.formatDate(r.start_date)} s/d ${Util.formatDate(r.end_date)}` },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Promo', message: `Hapus promo "${row.name}"?`, danger: true });
          if (ok) { Store.remove('promotions', row.id); UI.toast('Promo dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Promo', 'Promo', rows.map(r => ({ Nama: r.name, Kode: r.code, Jenis: r.type, Nilai: r.value, MinTransaksi: r.minimum_transaction, Mulai: r.start_date, Selesai: r.end_date, Status: r.status }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="promo-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('promo-table-root'));
  }

  Modules.promo = {
    title: 'Promo',
    subtitle: 'Kelola diskon, kode promo, dan periode berlaku',
    render,
  };
})();
