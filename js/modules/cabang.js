/* =========================================================================
   modules/cabang.js — Cabang / Outlet (Fitur CRUD tambahan #6)
   Data multi-cabang: nama, alamat, PIC, dan status buka/tutup. Aset dan
   karyawan pada modul lain dapat dikaitkan ke cabang tertentu.
   ========================================================================= */
(function () {
  let table = null;

  function form(existing) {
    const b = existing || { name: '', address: '', phone: '', pic_name: '', status: 'active' };
    return `
      <form id="brc-form" class="form-grid">
        <div class="field span-2"><label>Nama Cabang *</label><input class="input" name="name" required value="${Util.escape(b.name)}" /></div>
        <div class="field span-2"><label>Alamat *</label><textarea class="input" name="address" rows="2" required>${Util.escape(b.address || '')}</textarea></div>
        <div class="field"><label>No. Telepon *</label><input class="input" name="phone" required value="${Util.escape(b.phone)}" /></div>
        <div class="field"><label>Penanggung Jawab (PIC) *</label><input class="input" name="pic_name" required value="${Util.escape(b.pic_name)}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${b.status === 'active' ? 'selected' : ''}>Buka / Aktif</option>
            <option value="inactive" ${b.status === 'inactive' ? 'selected' : ''}>Tutup / Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Cabang' : 'Tambah Cabang', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="brc-cancel">Batal</button><button class="btn btn-primary" id="brc-save">Simpan</button>`,
    });
    document.getElementById('brc-cancel').addEventListener('click', close);
    document.getElementById('brc-save').addEventListener('click', () => {
      const f = document.getElementById('brc-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      if (existing) { Store.update('branches', existing.id, data); UI.toast('Cabang diperbarui.', 'success'); }
      else { Store.create('branches', data, 'brc'); UI.toast('Cabang ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama cabang atau PIC...',
      addLabel: 'Tambah Cabang',
      emptyIcon: 'store', emptyTitle: 'Belum ada cabang',
      perPage: 8,
      getData: () => Store.list('branches'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || (row.pic_name || '').toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'active', label: 'Buka' }, { value: 'inactive', label: 'Tutup' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Cabang', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub">${Util.escape(r.address)}</div>` },
        { label: 'Telepon', render: (r) => Util.escape(r.phone) },
        { label: 'PIC', render: (r) => Util.escape(r.pic_name) },
        { label: 'Aset', render: (r) => `${Store.list('assets').filter(a => a.location === r.id).length} unit` },
        { label: 'Status', render: (r) => r.status === 'active' ? UI.badge('Buka', 'badge-success') : UI.badge('Tutup', 'badge-gray') },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Cabang', message: `Hapus cabang "${row.name}"?`, danger: true });
          if (ok) { Store.remove('branches', row.id); UI.toast('Cabang dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Cabang', 'Cabang', rows.map(r => ({ Nama: r.name, Alamat: r.address, Telepon: r.phone, PIC: r.pic_name, Status: r.status }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="brc-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('brc-table-root'));
  }

  Modules.cabang = {
    title: 'Cabang / Outlet',
    subtitle: 'Kelola data multi-cabang dan penanggung jawabnya',
    render,
  };
})();
