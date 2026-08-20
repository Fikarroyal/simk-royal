/* =========================================================================
   modules/checklist.js — Checklist SOP & Kebersihan Harian (Fitur CRUD tambahan #16)
   Daftar tugas operasional harian per shift (kebersihan, keamanan pangan,
   dsb) yang bisa ditandai selesai — membantu memastikan SOP dijalankan
   konsisten setiap hari.
   ========================================================================= */
(function () {
  let table = null;
  const CATEGORIES = ['Kebersihan', 'Keamanan Pangan', 'Operasional', 'Keamanan', 'Lainnya'];
  const SHIFTS = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

  function employeeOptions(selectedId) {
    return `<option value="">— Belum ditugaskan —</option>` + Store.list('employees').filter(e => e.status === 'active').map(e => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${Util.escape(e.name)}</option>`).join('');
  }

  function form(existing) {
    const s = existing || { task: '', category: CATEGORIES[0], shift: 'pagi', assigned_to: '', date: Util.todayISO(), status: 'pending' };
    return `
      <form id="sop-form" class="form-grid">
        <div class="field span-2"><label>Nama Tugas *</label><input class="input" name="task" required value="${Util.escape(s.task)}" /></div>
        <div class="field"><label>Kategori *</label><select class="input" name="category" required>${CATEGORIES.map(c => `<option value="${c}" ${s.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Shift *</label>
          <select class="input" name="shift" required>${Object.entries(SHIFTS).map(([k, v]) => `<option value="${k}" ${s.shift === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="date" required value="${s.date}" /></div>
        <div class="field"><label>Ditugaskan Kepada</label><select class="input" name="assigned_to">${employeeOptions(s.assigned_to)}</select></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Tugas Checklist' : 'Tambah Tugas Checklist', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="sop-cancel">Batal</button><button class="btn btn-primary" id="sop-save">Simpan</button>`,
    });
    document.getElementById('sop-cancel').addEventListener('click', close);
    document.getElementById('sop-save').addEventListener('click', () => {
      const f = document.getElementById('sop-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      if (existing) { Store.update('sop_checklist', existing.id, data); UI.toast('Tugas diperbarui.', 'success'); }
      else { data.status = 'pending'; data.completed_at = null; Store.create('sop_checklist', data, 'sop'); UI.toast('Tugas ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama tugas...',
      addLabel: 'Tambah Tugas',
      emptyIcon: 'clipboard-check', emptyTitle: 'Belum ada tugas checklist',
      perPage: 10,
      getData: () => Store.list('sop_checklist').slice().sort((a, b) => b.date.localeCompare(a.date)),
      searchFn: (row, q) => row.task.toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'pending', label: 'Belum Selesai' }, { value: 'done', label: 'Selesai' }], filterFn: (r, v) => r.status === v },
        { key: 'shift', label: 'Semua Shift', options: Object.entries(SHIFTS).map(([k, v]) => ({ value: k, label: v })), filterFn: (r, v) => r.shift === v },
        { key: 'category', label: 'Semua Kategori', options: CATEGORIES.map(c => ({ value: c, label: c })), filterFn: (r, v) => r.category === v },
      ],
      columns: [
        { label: 'Tugas', render: (r) => `<div class="cell-title">${Util.escape(r.task)}</div><div class="cell-sub">${Util.escape(r.category)} · Shift ${SHIFTS[r.shift] || r.shift}</div>` },
        { label: 'Tanggal', render: (r) => Util.formatDate(r.date) },
        { label: 'PIC', render: (r) => { const e = Store.get('employees', r.assigned_to); return e ? Util.escape(e.name) : '<span class="cell-sub">Belum ditugaskan</span>'; } },
        { label: 'Status', render: (r) => r.status === 'done' ? UI.badge('Selesai', 'badge-success') : UI.badge('Belum Selesai', 'badge-warning') },
      ],
      rowActions: (row) => [
        ...(row.status !== 'done' ? [{ icon: 'circle-check', title: 'Tandai Selesai', cls: 'btn-green', onClick: () => { Store.update('sop_checklist', row.id, { status: 'done', completed_at: new Date().toISOString() }); UI.toast('Tugas ditandai selesai.', 'success'); table.refresh(); } }] : [{ icon: 'rotate-ccw', title: 'Batalkan Selesai', cls: 'btn-gray', onClick: () => { Store.update('sop_checklist', row.id, { status: 'pending', completed_at: null }); table.refresh(); } }]),
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Tugas', message: `Hapus tugas "${row.task}"?`, danger: true });
          if (ok) { Store.remove('sop_checklist', row.id); UI.toast('Tugas dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-ChecklistSOP', 'Checklist', rows.map(r => { const e = Store.get('employees', r.assigned_to); return { Tugas: r.task, Kategori: r.category, Shift: SHIFTS[r.shift], Tanggal: r.date, PIC: e ? e.name : '-', Status: r.status === 'done' ? 'Selesai' : 'Belum Selesai' }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const today = Store.list('sop_checklist').filter(r => r.date === Util.todayISO());
    const done = today.filter(r => r.status === 'done').length;
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="clipboard-list"></i></div><div class="stat-value">${today.length}</div><div class="stat-label">Tugas Hari Ini</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-success"><i data-lucide="circle-check"></i></div><div class="stat-value">${done}</div><div class="stat-label">Selesai Hari Ini</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="triangle-alert"></i></div><div class="stat-value">${today.length - done}</div><div class="stat-label">Belum Selesai</div></div>
      </div>
      <div id="sop-table-root" class="mt-16"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('sop-table-root'));
  }

  Modules.checklist = {
    title: 'Checklist SOP & Kebersihan',
    subtitle: 'Tugas operasional harian per shift',
    render,
  };
})();
