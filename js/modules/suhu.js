/* =========================================================================
   modules/suhu.js — Log Suhu Penyimpanan (Fitur CRUD tambahan #19)
   Pencatatan suhu kulkas/freezer berkala untuk kepatuhan keamanan pangan
   (food safety). Status normal/peringatan dihitung otomatis dari ambang
   batas suhu standar penyimpanan dingin & beku.
   ========================================================================= */
(function () {
  let table = null;

  function computeStatus(t) {
    const temp = Number(t.temperature_celsius);
    // Ambang umum: kulkas 0–5°C, freezer -18°C ke bawah. Di luar itu -> waspada.
    if (temp > 8 || temp > -10 && temp < -5) return { label: 'Kritis', cls: 'badge-danger' };
    if (temp > 5 && temp <= 8) return { label: 'Waspada', cls: 'badge-warning' };
    if (temp >= -5 && temp < 0) return { label: 'Waspada', cls: 'badge-warning' };
    return { label: 'Normal', cls: 'badge-success' };
  }

  function employeeOptions(selectedId) {
    return Store.list('employees').filter(e => e.status === 'active').map(e => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${Util.escape(e.name)}</option>`).join('');
  }

  function form(existing) {
    const t = existing || { equipment: '', date: Util.todayISO(), time: '08:00', temperature_celsius: 4, checked_by: '', note: '' };
    return `
      <form id="tmp-form" class="form-grid">
        <div class="field span-2"><label>Nama Peralatan *</label><input class="input" name="equipment" required placeholder="mis. Kulkas Showcase, Freezer Bahan Baku" value="${Util.escape(t.equipment)}" /></div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="date" required value="${t.date}" /></div>
        <div class="field"><label>Jam *</label><input class="input" type="time" name="time" required value="${t.time}" /></div>
        <div class="field"><label>Suhu (°C) *</label><input class="input" type="number" step="0.1" name="temperature_celsius" required value="${t.temperature_celsius}" /></div>
        <div class="field"><label>Diperiksa Oleh</label><select class="input" name="checked_by">${employeeOptions(t.checked_by)}</select></div>
        <div class="field span-2"><label>Catatan</label><textarea class="input" name="note" rows="2">${Util.escape(t.note || '')}</textarea></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Log Suhu' : 'Catat Suhu Penyimpanan', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="tmp-cancel">Batal</button><button class="btn btn-primary" id="tmp-save">Simpan</button>`,
    });
    document.getElementById('tmp-cancel').addEventListener('click', close);
    document.getElementById('tmp-save').addEventListener('click', () => {
      const f = document.getElementById('tmp-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.temperature_celsius = Number(data.temperature_celsius);
      data.status = computeStatus(data).label === 'Normal' ? 'normal' : computeStatus(data).label === 'Waspada' ? 'warning' : 'critical';
      if (existing) { Store.update('temperature_logs', existing.id, data); UI.toast('Log suhu diperbarui.', 'success'); }
      else { Store.create('temperature_logs', data, 'tmp'); UI.toast('Log suhu dicatat.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama peralatan...',
      addLabel: 'Catat Suhu',
      emptyIcon: 'thermometer', emptyTitle: 'Belum ada log suhu',
      perPage: 10,
      getData: () => Store.list('temperature_logs').slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
      searchFn: (row, q) => row.equipment.toLowerCase().includes(q),
      filters: [
        { key: 'level', label: 'Semua Status', options: [{ value: 'Normal', label: 'Normal' }, { value: 'Waspada', label: 'Waspada' }, { value: 'Kritis', label: 'Kritis' }], filterFn: (r, v) => computeStatus(r).label === v },
      ],
      columns: [
        { label: 'Peralatan', render: (r) => `<div class="cell-title">${Util.escape(r.equipment)}</div>` },
        { label: 'Tanggal & Jam', render: (r) => `${Util.formatDate(r.date)} · ${Util.escape(r.time)}` },
        { label: 'Suhu', render: (r) => `<span class="mono">${r.temperature_celsius}°C</span>` },
        { label: 'Diperiksa Oleh', render: (r) => { const e = Store.get('employees', r.checked_by); return e ? Util.escape(e.name) : '-'; } },
        { label: 'Status', render: (r) => { const s = computeStatus(r); return UI.badge(s.label, s.cls); } },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Log Suhu', message: 'Hapus catatan suhu ini?', danger: true });
          if (ok) { Store.remove('temperature_logs', row.id); UI.toast('Log suhu dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-LogSuhu', 'Suhu', rows.map(r => { const e = Store.get('employees', r.checked_by); return { Peralatan: r.equipment, Tanggal: r.date, Jam: r.time, Suhu: r.temperature_celsius, DiperiksaOleh: e ? e.name : '-', Status: computeStatus(r).label, Catatan: r.note }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const all = Store.list('temperature_logs');
    const critical = all.filter(r => computeStatus(r).label === 'Kritis').length;
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="thermometer"></i></div><div class="stat-value">${all.length}</div><div class="stat-label">Total Catatan</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="triangle-alert"></i></div><div class="stat-value">${critical}</div><div class="stat-label">Suhu Kritis</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-success"><i data-lucide="shield-check"></i></div><div class="stat-value">${all.length - critical}</div><div class="stat-label">Dalam Batas Aman</div></div>
      </div>
      <div id="tmp-table-root" class="mt-16"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('tmp-table-root'));
  }

  Modules.suhu = {
    title: 'Log Suhu Penyimpanan',
    subtitle: 'Pemantauan suhu kulkas & freezer untuk keamanan pangan',
    render,
  };
})();
