/* =========================================================================
   modules/absensi.js — Absensi Karyawan (FR-08 Check In / Check Out)
   ========================================================================= */
(function () {
  let table = null;

  function myEmployee(user) {
    const userRecord = Store.list('users').find(u => u.id === user.id);
    if (!userRecord || !userRecord.employee_id) return null;
    return Store.get('employees', userRecord.employee_id);
  }

  function selfCard(container, user) {
    const emp = myEmployee(user);
    const today = Util.todayISO();
    const att = emp ? Store.list('attendance').find(a => a.employee_id === emp.id && a.date === today) : null;

    if (!emp) {
      container.innerHTML = `<div class="card">${UI.emptyState('user-x', 'Akun tidak terhubung ke data karyawan', 'Hubungi administrator untuk menautkan akun Anda ke data karyawan.')}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="section-title">Absensi Saya Hari Ini, ${Util.formatDate(today)}</div>
        <div class="grid grid-3">
          <div class="kv-list">
            <div class="kv-row"><span>Nama</span><span>${Util.escape(emp.name)}</span></div>
            <div class="kv-row"><span>Jam Masuk</span><span>${att && att.check_in ? att.check_in : '-'}</span></div>
            <div class="kv-row"><span>Jam Keluar</span><span>${att && att.check_out ? att.check_out : '-'}</span></div>
            <div class="kv-row"><span>Status</span><span>${att ? UI.statusBadge(att.status) : UI.badge('Belum Absen', 'badge-gray')}</span></div>
          </div>
          <div style="display:flex; align-items:center; justify-content:center; gap:10px; grid-column: span 2;">
            <button class="btn btn-green" id="btn-checkin" ${att && att.check_in ? 'disabled' : ''}><i data-lucide="log-in"></i> Check In</button>
            <button class="btn btn-danger" id="btn-checkout" ${!att || !att.check_in || att.check_out ? 'disabled' : ''}><i data-lucide="log-out"></i> Check Out</button>
          </div>
        </div>
      </div>
    `;
    UI.icons();
    document.getElementById('btn-checkin').addEventListener('click', () => {
      Store.checkIn(emp.id);
      UI.toast('Check-in berhasil dicatat.', 'success');
      App.refresh();
    });
    document.getElementById('btn-checkout').addEventListener('click', () => {
      Store.checkOut(emp.id);
      UI.toast('Check-out berhasil dicatat.', 'success');
      App.refresh();
    });
  }

  function manualForm(existing) {
    const employees = Store.list('employees').filter(e => e.status === 'active');
    const a = existing || { employee_id: employees[0] ? employees[0].id : '', date: Util.todayISO(), check_in: '08:00', check_out: '', status: 'present', late_minutes: 0 };
    return `
      <form id="att-form" class="form-grid">
        <div class="field span-2"><label>Karyawan *</label>
          <select class="input" name="employee_id" required>${employees.map(e => `<option value="${e.id}" ${a.employee_id === e.id ? 'selected' : ''}>${Util.escape(e.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="date" required value="${a.date}" /></div>
        <div class="field"><label>Status *</label>
          <select class="input" name="status">
            <option value="present" ${a.status === 'present' ? 'selected' : ''}>Hadir</option>
            <option value="late" ${a.status === 'late' ? 'selected' : ''}>Terlambat</option>
            <option value="absent" ${a.status === 'absent' ? 'selected' : ''}>Tidak Hadir</option>
          </select>
        </div>
        <div class="field"><label>Jam Masuk</label><input class="input" type="time" name="check_in" value="${a.check_in || ''}" /></div>
        <div class="field"><label>Jam Keluar</label><input class="input" type="time" name="check_out" value="${a.check_out || ''}" /></div>
      </form>`;
  }

  function openManualModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Absensi' : 'Tambah Absensi Manual', size: 'md',
      body: manualForm(existing),
      footer: `<button class="btn btn-gray" id="af-cancel">Batal</button><button class="btn btn-primary" id="af-save">Simpan</button>`,
    });
    document.getElementById('af-cancel').addEventListener('click', close);
    document.getElementById('af-save').addEventListener('click', () => {
      const f = document.getElementById('att-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      if (existing) { Store.update('attendance', existing.id, data); UI.toast('Absensi diperbarui.', 'success'); }
      else { Store.create('attendance', data, 'att'); UI.toast('Absensi ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable(scopeEmployeeId) {
    return createCrudTable({
      searchPlaceholder: 'Cari nama karyawan...',
      addLabel: scopeEmployeeId ? undefined : 'Tambah Manual',
      emptyIcon: 'calendar-x', emptyTitle: 'Belum ada data absensi',
      perPage: 8,
      getData: () => {
        let rows = Store.list('attendance').slice().sort((a, b) => b.date.localeCompare(a.date));
        if (scopeEmployeeId) rows = rows.filter(r => r.employee_id === scopeEmployeeId);
        return rows;
      },
      searchFn: (row, q) => { const e = Store.get('employees', row.employee_id); return e ? e.name.toLowerCase().includes(q) : false; },
      filters: scopeEmployeeId ? [] : [
        { key: 'status', label: 'Semua Status', options: [{ value: 'present', label: 'Hadir' }, { value: 'late', label: 'Terlambat' }, { value: 'absent', label: 'Tidak Hadir' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Karyawan', render: (r) => { const e = Store.get('employees', r.employee_id); return e ? Util.escape(e.name) : '-'; } },
        { label: 'Tanggal', render: (r) => Util.formatDate(r.date) },
        { label: 'Masuk', render: (r) => `<span class="mono">${r.check_in || '-'}</span>` },
        { label: 'Keluar', render: (r) => `<span class="mono">${r.check_out || '-'}</span>` },
        { label: 'Terlambat', render: (r) => r.late_minutes ? `${r.late_minutes} menit` : '-' },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: scopeEmployeeId ? undefined : (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openManualModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Absensi', message: 'Hapus catatan absensi ini?', danger: true });
          if (ok) { Store.remove('attendance', row.id); UI.toast('Data absensi dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: scopeEmployeeId ? undefined : {
        excel: (rows) => UI.exportExcel('Data-Absensi', 'Absensi', rows.map(r => { const e = Store.get('employees', r.employee_id); return { Karyawan: e ? e.name : '-', Tanggal: r.date, Masuk: r.check_in, Keluar: r.check_out, Terlambat: r.late_minutes, Status: r.status }; })),
      },
      onAdd: scopeEmployeeId ? undefined : () => openManualModal(null),
    });
  }

  function render(container, ctx) {
    const isManager = ctx.user.role === 'administrator' || ctx.user.role === 'manager';
    container.innerHTML = `<div id="absensi-self-root"></div><div class="mt-16" id="absensi-table-root"></div>`;
    selfCard(document.getElementById('absensi-self-root'), ctx.user);

    const tableRoot = document.getElementById('absensi-table-root');
    if (isManager) {
      tableRoot.insertAdjacentHTML('beforebegin', `<div class="section-title mt-16">Rekap Absensi Seluruh Karyawan</div>`);
      table = buildTable(null);
    } else {
      const emp = myEmployee(ctx.user);
      tableRoot.insertAdjacentHTML('beforebegin', `<div class="section-title mt-16">Riwayat Absensi Saya</div>`);
      table = buildTable(emp ? emp.id : '__none__');
    }
    table.mount(tableRoot);
  }

  Modules.absensi = {
    title: 'Absensi',
    subtitle: 'Check-in / check-out dan rekap kehadiran karyawan',
    render,
  };
})();
