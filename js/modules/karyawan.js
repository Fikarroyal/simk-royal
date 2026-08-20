/* =========================================================================
   modules/karyawan.js — Manajemen Karyawan dan Jadwal Shift
   ========================================================================= */
(function () {
  let activeTab = 'karyawan';
  let karyawanTable = null;
  let shiftTable = null;
  const POSITION_BADGE = { Administrator: 'badge-purple', Manager: 'badge-info', Kasir: 'badge-success', Staff: 'badge-gray' };

  /* -------------------------------- KARYAWAN -------------------------------- */
  function employeeForm(existing) {
    const e = existing || { employee_code: '', name: '', position: 'Kasir', phone: '', email: '', address: '', join_date: Util.todayISO(), status: 'active' };
    return `
      <form id="employee-form" class="form-grid">
        <div class="field"><label>Kode Karyawan *</label><input class="input" name="employee_code" required value="${Util.escape(e.employee_code)}" /></div>
        <div class="field"><label>Nama Lengkap *</label><input class="input" name="name" required value="${Util.escape(e.name)}" /></div>
        <div class="field"><label>Posisi *</label>
          <select class="input" name="position" required>
            ${['Administrator', 'Manager', 'Kasir', 'Staff'].map(p => `<option value="${p}" ${e.position === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Tanggal Bergabung *</label><input class="input" type="date" name="join_date" required value="${e.join_date}" /></div>
        <div class="field"><label>No. Telepon *</label><input class="input" name="phone" required value="${Util.escape(e.phone)}" /></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="email" value="${Util.escape(e.email || '')}" /></div>
        <div class="field span-2"><label>Alamat</label><textarea class="input" name="address" rows="2">${Util.escape(e.address || '')}</textarea></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${e.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${e.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openEmployeeModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Karyawan' : 'Tambah Karyawan', size: 'md',
      body: employeeForm(existing),
      footer: `<button class="btn btn-gray" id="ef-cancel">Batal</button><button class="btn btn-primary" id="ef-save">Simpan</button>`,
    });
    document.getElementById('ef-cancel').addEventListener('click', close);
    document.getElementById('ef-save').addEventListener('click', () => {
      const f = document.getElementById('employee-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      const dup = Store.list('employees').find(e => e.employee_code.toLowerCase() === data.employee_code.toLowerCase() && (!existing || e.id !== existing.id));
      if (dup) { UI.toast('Kode karyawan sudah digunakan.', 'danger'); return; }
      if (existing) { Store.update('employees', existing.id, data); UI.toast('Data karyawan diperbarui.', 'success'); }
      else { Store.create('employees', data, 'emp'); UI.toast('Karyawan ditambahkan.', 'success'); }
      close(); karyawanTable.refresh();
    });
  }

  function buildEmployeeTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau kode karyawan...',
      addLabel: 'Tambah Karyawan',
      emptyIcon: 'id-card', emptyTitle: 'Belum ada karyawan',
      perPage: 8,
      getData: () => Store.list('employees'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.employee_code.toLowerCase().includes(q),
      filters: [
        { key: 'position', label: 'Semua Posisi', options: ['Administrator', 'Manager', 'Kasir', 'Staff'].map(p => ({ value: p, label: p })), filterFn: (r, v) => r.position === v },
        { key: 'status', label: 'Semua Status', options: [{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Karyawan', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub mono">${Util.escape(r.employee_code)}</div>` },
        { label: 'Posisi', render: (r) => UI.badge(r.position, POSITION_BADGE[r.position] || 'badge-gray') },
        { label: 'Telepon', render: (r) => `<span class="mono">${Util.escape(r.phone)}</span>` },
        { label: 'Bergabung', render: (r) => Util.formatDate(r.join_date) },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openEmployeeModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Karyawan', message: `Hapus data "${row.name}"?`, danger: true });
          if (ok) { Store.remove('employees', row.id); UI.toast('Karyawan dihapus.', 'success'); karyawanTable.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Karyawan', 'Karyawan', rows.map(r => ({ Kode: r.employee_code, Nama: r.name, Posisi: r.position, Telepon: r.phone, Email: r.email, Bergabung: r.join_date, Status: r.status }))),
      },
      onAdd: () => openEmployeeModal(null),
    });
  }

  /* ---------------------------------- SHIFT ---------------------------------- */
  function shiftForm(existing) {
    const s = existing || { name: '', start_time: '07:00', end_time: '15:00', employee_ids: [] };
    const employees = Store.list('employees').filter(e => e.status === 'active');
    return `
      <form id="shift-form" class="form-grid">
        <div class="field span-2"><label>Nama Shift *</label><input class="input" name="name" required value="${Util.escape(s.name)}" placeholder="mis. Shift Pagi" /></div>
        <div class="field"><label>Jam Mulai *</label><input class="input" type="time" name="start_time" required value="${s.start_time}" /></div>
        <div class="field"><label>Jam Selesai *</label><input class="input" type="time" name="end_time" required value="${s.end_time}" /></div>
        <div class="field span-2"><label>Karyawan Bertugas</label>
          <select class="input" name="employee_ids" multiple size="5">
            ${employees.map(e => `<option value="${e.id}" ${s.employee_ids.includes(e.id) ? 'selected' : ''}>${Util.escape(e.name)} (${e.position})</option>`).join('')}
          </select>
          <div class="field-hint">Tahan Ctrl/Cmd untuk memilih lebih dari satu karyawan.</div>
        </div>
      </form>`;
  }

  function openShiftModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Shift' : 'Tambah Shift', size: 'md',
      body: shiftForm(existing),
      footer: `<button class="btn btn-gray" id="sf-cancel">Batal</button><button class="btn btn-primary" id="sf-save">Simpan</button>`,
    });
    document.getElementById('sf-cancel').addEventListener('click', close);
    document.getElementById('sf-save').addEventListener('click', () => {
      const f = document.getElementById('shift-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.employee_ids = Array.from(f.querySelector('[name=employee_ids]').selectedOptions).map(o => o.value);
      if (existing) { Store.update('shifts', existing.id, data); UI.toast('Shift diperbarui.', 'success'); }
      else { Store.create('shifts', data, 'shift'); UI.toast('Shift ditambahkan.', 'success'); }
      close(); shiftTable.refresh();
    });
  }

  function buildShiftTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama shift...',
      addLabel: 'Tambah Shift',
      emptyIcon: 'calendar-range', emptyTitle: 'Belum ada shift',
      perPage: 8,
      getData: () => Store.list('shifts'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q),
      columns: [
        { label: 'Nama Shift', render: (r) => `<span class="cell-title">${Util.escape(r.name)}</span>` },
        { label: 'Jam Kerja', render: (r) => `<span class="mono">${r.start_time} - ${r.end_time}</span>` },
        { label: 'Karyawan', render: (r) => r.employee_ids.length ? r.employee_ids.map(id => { const e = Store.get('employees', id); return e ? Util.escape(e.name) : ''; }).filter(Boolean).join(', ') : '<span class="text-muted">Belum ditugaskan</span>' },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openShiftModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Shift', message: `Hapus shift "${row.name}"?`, danger: true });
          if (ok) { Store.remove('shifts', row.id); UI.toast('Shift dihapus.', 'success'); shiftTable.refresh(); }
        }},
      ],
      onAdd: () => openShiftModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${activeTab === 'karyawan' ? 'active' : ''}" data-tab="karyawan">Karyawan</button>
        <button class="tab-btn ${activeTab === 'shift' ? 'active' : ''}" data-tab="shift">Jadwal Shift</button>
      </div>
      <div id="karyawan-tab-content"></div>
    `;
    container.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(container); }));
    const content = document.getElementById('karyawan-tab-content');
    if (activeTab === 'karyawan') { karyawanTable = buildEmployeeTable(); karyawanTable.mount(content); }
    else { shiftTable = buildShiftTable(); shiftTable.mount(content); }
    UI.icons();
  }

  Modules.karyawan = {
    title: 'Karyawan & Shift',
    subtitle: 'Data karyawan dan pengaturan jadwal kerja',
    render,
  };
})();
