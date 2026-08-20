/* =========================================================================
   modules/perizinan.js — Perizinan & Dokumen Legal (Fitur CRUD tambahan #18)
   Melacak izin usaha, sertifikat, dan dokumen legal beserta masa
   berlakunya — status "akan kedaluwarsa"/"kedaluwarsa" dihitung otomatis
   dari tanggal berakhir supaya tidak ada izin yang telat diperpanjang.
   ========================================================================= */
(function () {
  let table = null;

  function computeStatus(l) {
    const today = Util.todayISO();
    const daysLeft = Math.round((new Date(l.expiry_date) - new Date(today)) / 86400000);
    if (daysLeft < 0) return { label: 'Kedaluwarsa', cls: 'badge-danger' };
    if (daysLeft <= 60) return { label: `Segera Berakhir (${daysLeft}h)`, cls: 'badge-warning' };
    return { label: 'Aktif', cls: 'badge-success' };
  }

  function form(existing) {
    const l = existing || { name: '', number: '', issued_by: '', issue_date: Util.todayISO(), expiry_date: Util.todayISO() };
    return `
      <form id="lic-form" class="form-grid">
        <div class="field span-2"><label>Nama Dokumen / Izin *</label><input class="input" name="name" required placeholder="mis. Izin Usaha (NIB), Sertifikat Halal" value="${Util.escape(l.name)}" /></div>
        <div class="field"><label>Nomor Dokumen *</label><input class="input" name="number" required value="${Util.escape(l.number)}" /></div>
        <div class="field"><label>Diterbitkan Oleh *</label><input class="input" name="issued_by" required value="${Util.escape(l.issued_by)}" /></div>
        <div class="field"><label>Tanggal Terbit *</label><input class="input" type="date" name="issue_date" required value="${l.issue_date}" /></div>
        <div class="field"><label>Tanggal Berakhir *</label><input class="input" type="date" name="expiry_date" required value="${l.expiry_date}" /></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Dokumen' : 'Tambah Dokumen Legal', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="lic-cancel">Batal</button><button class="btn btn-primary" id="lic-save">Simpan</button>`,
    });
    document.getElementById('lic-cancel').addEventListener('click', close);
    document.getElementById('lic-save').addEventListener('click', () => {
      const f = document.getElementById('lic-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      if (existing) { Store.update('licenses', existing.id, data); UI.toast('Dokumen diperbarui.', 'success'); }
      else { Store.create('licenses', data, 'lic'); UI.toast('Dokumen ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama dokumen atau nomor...',
      addLabel: 'Tambah Dokumen',
      emptyIcon: 'file-badge', emptyTitle: 'Belum ada dokumen legal',
      perPage: 8,
      getData: () => Store.list('licenses').slice().sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.number.toLowerCase().includes(q),
      filters: [
        { key: 'level', label: 'Semua Status', options: [{ value: 'expired', label: 'Kedaluwarsa' }, { value: 'soon', label: 'Segera Berakhir' }, { value: 'active', label: 'Aktif' }], filterFn: (r, v) => {
          const s = computeStatus(r);
          if (v === 'expired') return s.label === 'Kedaluwarsa';
          if (v === 'soon') return s.label.startsWith('Segera');
          return s.label === 'Aktif';
        }},
      ],
      columns: [
        { label: 'Dokumen', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub">${Util.escape(r.number)}</div>` },
        { label: 'Penerbit', render: (r) => Util.escape(r.issued_by) },
        { label: 'Terbit', render: (r) => Util.formatDate(r.issue_date) },
        { label: 'Berakhir', render: (r) => Util.formatDate(r.expiry_date) },
        { label: 'Status', render: (r) => { const s = computeStatus(r); return UI.badge(s.label, s.cls); } },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Dokumen', message: `Hapus dokumen "${row.name}"?`, danger: true });
          if (ok) { Store.remove('licenses', row.id); UI.toast('Dokumen dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Perizinan', 'Perizinan', rows.map(r => ({ Dokumen: r.name, Nomor: r.number, Penerbit: r.issued_by, TanggalTerbit: r.issue_date, TanggalBerakhir: r.expiry_date, Status: computeStatus(r).label }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const all = Store.list('licenses');
    const expiring = all.filter(r => computeStatus(r).label.startsWith('Segera')).length;
    const expired = all.filter(r => computeStatus(r).label === 'Kedaluwarsa').length;
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="file-badge"></i></div><div class="stat-value">${all.length}</div><div class="stat-label">Total Dokumen</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="clock-alert"></i></div><div class="stat-value">${expiring}</div><div class="stat-label">Segera Berakhir (≤60 hari)</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="triangle-alert"></i></div><div class="stat-value">${expired}</div><div class="stat-label">Sudah Kedaluwarsa</div></div>
      </div>
      <div id="lic-table-root" class="mt-16"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('lic-table-root'));
  }

  Modules.perizinan = {
    title: 'Perizinan & Dokumen Legal',
    subtitle: 'Izin usaha, sertifikat, dan masa berlakunya',
    render,
  };
})();
