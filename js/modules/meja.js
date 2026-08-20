/* =========================================================================
   modules/meja.js — Manajemen Meja
   ========================================================================= */
(function () {
  let table = null;

  function form(existing) {
    const t = existing || { table_number: '', capacity: 2, status: 'available' };
    return `
      <form id="table-form" class="form-grid">
        <div class="field"><label>Nomor Meja *</label><input class="input" name="table_number" required value="${Util.escape(t.table_number)}" placeholder="mis. M01" /></div>
        <div class="field"><label>Kapasitas (orang) *</label><input class="input" type="number" min="1" name="capacity" required value="${t.capacity}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="available" ${t.status === 'available' ? 'selected' : ''}>Tersedia</option>
            <option value="occupied" ${t.status === 'occupied' ? 'selected' : ''}>Terisi</option>
            <option value="reserved" ${t.status === 'reserved' ? 'selected' : ''}>Dipesan</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Meja' : 'Tambah Meja', size: 'sm',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="tf-cancel">Batal</button><button class="btn btn-primary" id="tf-save">Simpan</button>`,
    });
    document.getElementById('tf-cancel').addEventListener('click', close);
    document.getElementById('tf-save').addEventListener('click', () => {
      const f = document.getElementById('table-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.capacity = Number(data.capacity);
      const dup = Store.list('tables').find(t => t.table_number.toLowerCase() === data.table_number.toLowerCase() && (!existing || t.id !== existing.id));
      if (dup) { UI.toast('Nomor meja sudah dipakai.', 'danger'); return; }
      if (existing) { Store.update('tables', existing.id, data); UI.toast('Meja diperbarui.', 'success'); }
      else { Store.create('tables', data, 'tbl'); UI.toast('Meja ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nomor meja...',
      addLabel: 'Tambah Meja',
      emptyIcon: 'armchair', emptyTitle: 'Belum ada meja',
      perPage: 8,
      getData: () => Store.list('tables').sort((a, b) => a.table_number.localeCompare(b.table_number)),
      searchFn: (row, q) => row.table_number.toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'available', label: 'Tersedia' }, { value: 'occupied', label: 'Terisi' }, { value: 'reserved', label: 'Dipesan' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Nomor Meja', render: (r) => `<span class="cell-title mono">${Util.escape(r.table_number)}</span>` },
        { label: 'Kapasitas', render: (r) => `${r.capacity} orang` },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'circle-check', title: 'Tandai Tersedia', cls: 'btn-green', onClick: () => { Store.update('tables', row.id, { status: 'available' }); table.refresh(); UI.toast('Status meja diperbarui.', 'success'); } },
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Meja', message: `Hapus meja "${row.table_number}"?`, danger: true });
          if (ok) { Store.remove('tables', row.id); UI.toast('Meja dihapus.', 'success'); table.refresh(); }
        }},
      ],
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const tables = Store.list('tables');
    const counts = { available: 0, occupied: 0, reserved: 0 };
    tables.forEach(t => counts[t.status]++);
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-success"><i data-lucide="circle-check"></i></div><div class="stat-value">${counts.available}</div><div class="stat-label">Meja Tersedia</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="users"></i></div><div class="stat-value">${counts.occupied}</div><div class="stat-label">Meja Terisi</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="calendar-clock"></i></div><div class="stat-value">${counts.reserved}</div><div class="stat-label">Meja Dipesan</div></div>
      </div>
      <div class="mt-16" id="meja-table-root"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('meja-table-root'));
    UI.icons();
  }

  Modules.meja = {
    title: 'Manajemen Meja',
    subtitle: 'Atur nomor meja, kapasitas, dan status ketersediaan',
    render,
  };
})();
