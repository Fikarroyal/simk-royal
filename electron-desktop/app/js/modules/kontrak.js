/* =========================================================================
   modules/kontrak.js — Kontrak Supplier (Fitur CRUD tambahan #15)
   Melengkapi modul Stok/Supplier yang sudah ada dengan pencatatan kontrak
   kerjasama resmi: nomor kontrak, masa berlaku, dan syarat pembayaran.
   ========================================================================= */
(function () {
  let table = null;

  function supplierOptions(selectedId) {
    return Store.list('suppliers').map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${Util.escape(s.name)}</option>`).join('');
  }

  function computeStatus(k) {
    if (k.status === 'terminated') return { label: 'Diputus', cls: 'badge-danger' };
    if (k.end_date < Util.todayISO()) return { label: 'Kedaluwarsa', cls: 'badge-gray' };
    return { label: 'Aktif', cls: 'badge-success' };
  }

  function form(existing) {
    const k = existing || { supplier_id: '', contract_number: '', start_date: Util.todayISO(), end_date: Util.todayISO(), payment_terms: 'Net 30 hari', value: 0, status: 'active' };
    return `
      <form id="ktr-form" class="form-grid">
        <div class="field span-2"><label>Supplier *</label><select class="input" name="supplier_id" required>${supplierOptions(k.supplier_id)}</select></div>
        <div class="field"><label>Nomor Kontrak *</label><input class="input" name="contract_number" required value="${Util.escape(k.contract_number)}" /></div>
        <div class="field"><label>Nilai Kontrak (Rp) *</label><input class="input" type="number" min="0" name="value" required value="${k.value}" /></div>
        <div class="field"><label>Mulai *</label><input class="input" type="date" name="start_date" required value="${k.start_date}" /></div>
        <div class="field"><label>Berakhir *</label><input class="input" type="date" name="end_date" required value="${k.end_date}" /></div>
        <div class="field"><label>Syarat Pembayaran</label><input class="input" name="payment_terms" value="${Util.escape(k.payment_terms)}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${k.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="terminated" ${k.status === 'terminated' ? 'selected' : ''}>Diputus / Dibatalkan</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Kontrak' : 'Tambah Kontrak Supplier', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="ktr-cancel">Batal</button><button class="btn btn-primary" id="ktr-save">Simpan</button>`,
    });
    document.getElementById('ktr-cancel').addEventListener('click', close);
    document.getElementById('ktr-save').addEventListener('click', () => {
      const f = document.getElementById('ktr-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.value = Number(data.value);
      if (existing) { Store.update('supplier_contracts', existing.id, data); UI.toast('Kontrak diperbarui.', 'success'); }
      else { Store.create('supplier_contracts', data, 'ktr'); UI.toast('Kontrak ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nomor kontrak atau supplier...',
      addLabel: 'Tambah Kontrak',
      emptyIcon: 'file-signature', emptyTitle: 'Belum ada kontrak supplier',
      perPage: 8,
      getData: () => Store.list('supplier_contracts').slice().sort((a, b) => b.end_date.localeCompare(a.end_date)),
      searchFn: (row, q) => { const s = Store.get('suppliers', row.supplier_id); return row.contract_number.toLowerCase().includes(q) || (s ? s.name.toLowerCase().includes(q) : false); },
      columns: [
        { label: 'Supplier', render: (r) => { const s = Store.get('suppliers', r.supplier_id); return `<div class="cell-title">${s ? Util.escape(s.name) : '-'}</div><div class="cell-sub">${Util.escape(r.contract_number)}</div>`; } },
        { label: 'Masa Berlaku', render: (r) => `${Util.formatDate(r.start_date)} – ${Util.formatDate(r.end_date)}` },
        { label: 'Nilai Kontrak', render: (r) => `<span class="mono">${Util.formatCurrency(r.value)}</span>` },
        { label: 'Syarat Bayar', render: (r) => Util.escape(r.payment_terms) },
        { label: 'Status', render: (r) => { const s = computeStatus(r); return UI.badge(s.label, s.cls); } },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Kontrak', message: `Hapus kontrak "${row.contract_number}"?`, danger: true });
          if (ok) { Store.remove('supplier_contracts', row.id); UI.toast('Kontrak dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-KontrakSupplier', 'Kontrak', rows.map(r => { const s = Store.get('suppliers', r.supplier_id); return { Supplier: s ? s.name : '-', NomorKontrak: r.contract_number, Mulai: r.start_date, Berakhir: r.end_date, Nilai: r.value, SyaratBayar: r.payment_terms, Status: computeStatus(r).label }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="ktr-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('ktr-table-root'));
  }

  Modules.kontrak = {
    title: 'Kontrak Supplier',
    subtitle: 'Perjanjian kerjasama & masa berlaku kontrak dengan supplier',
    render,
  };
})();
