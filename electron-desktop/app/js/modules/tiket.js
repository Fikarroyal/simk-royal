/* =========================================================================
   modules/tiket.js — Komplain & Saran / Tiket Layanan (Fitur CRUD tambahan #10)
   Menampung komplain maupun saran dari pelanggan/staff sebagai tiket yang
   bisa ditindaklanjuti hingga statusnya selesai.
   ========================================================================= */
(function () {
  let table = null;
  const TYPE_MAP = { complaint: ['Komplain', 'badge-danger'], suggestion: ['Saran', 'badge-info'] };
  const STATUS_MAP = { open: ['Terbuka', 'badge-warning'], in_progress: ['Diproses', 'badge-info'], closed: ['Selesai', 'badge-success'] };
  const PRIORITY_MAP = { low: ['Rendah', 'badge-gray'], normal: ['Normal', 'badge-info'], high: ['Tinggi', 'badge-danger'] };

  function form(existing) {
    const t = existing || { type: 'complaint', subject: '', reporter_name: '', description: '', priority: 'normal', status: 'open', response: '' };
    return `
      <form id="tik-form" class="form-grid">
        <div class="field"><label>Jenis *</label>
          <select class="input" name="type">
            ${Object.entries(TYPE_MAP).map(([k, v]) => `<option value="${k}" ${t.type === k ? 'selected' : ''}>${v[0]}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Prioritas</label>
          <select class="input" name="priority">
            ${Object.entries(PRIORITY_MAP).map(([k, v]) => `<option value="${k}" ${t.priority === k ? 'selected' : ''}>${v[0]}</option>`).join('')}
          </select>
        </div>
        <div class="field span-2"><label>Subjek *</label><input class="input" name="subject" required value="${Util.escape(t.subject)}" /></div>
        <div class="field span-2"><label>Nama Pelapor *</label><input class="input" name="reporter_name" required value="${Util.escape(t.reporter_name)}" /></div>
        <div class="field span-2"><label>Deskripsi *</label><textarea class="input" name="description" rows="3" required>${Util.escape(t.description || '')}</textarea></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            ${Object.entries(STATUS_MAP).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}
          </select>
        </div>
        <div class="field span-2"><label>Tanggapan / Tindak Lanjut</label><textarea class="input" name="response" rows="2">${Util.escape(t.response || '')}</textarea></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Tiket' : 'Buat Tiket Baru', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="tik-cancel">Batal</button><button class="btn btn-primary" id="tik-save">Simpan</button>`,
    });
    document.getElementById('tik-cancel').addEventListener('click', close);
    document.getElementById('tik-save').addEventListener('click', () => {
      const f = document.getElementById('tik-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      if (existing) { Store.update('tickets', existing.id, data); UI.toast('Tiket diperbarui.', 'success'); }
      else { data.created_at = new Date().toISOString(); Store.create('tickets', data, 'tik'); UI.toast('Tiket dibuat.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari subjek atau nama pelapor...',
      addLabel: 'Buat Tiket',
      emptyIcon: 'message-square-warning', emptyTitle: 'Belum ada tiket',
      perPage: 8,
      getData: () => Store.list('tickets').slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
      searchFn: (row, q) => row.subject.toLowerCase().includes(q) || row.reporter_name.toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v[0] })), filterFn: (r, v) => r.status === v },
        { key: 'type', label: 'Semua Jenis', options: Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v[0] })), filterFn: (r, v) => r.type === v },
      ],
      columns: [
        { label: 'Tiket', render: (r) => `<div class="cell-title">${Util.escape(r.subject)}</div><div class="cell-sub">${Util.escape(r.reporter_name)}</div>` },
        { label: 'Jenis', render: (r) => UI.badge(TYPE_MAP[r.type][0], TYPE_MAP[r.type][1]) },
        { label: 'Prioritas', render: (r) => UI.badge(PRIORITY_MAP[r.priority][0], PRIORITY_MAP[r.priority][1]) },
        { label: 'Tanggal', render: (r) => Util.formatDateTime(r.created_at) },
        { label: 'Status', render: (r) => UI.badge(STATUS_MAP[r.status][0], STATUS_MAP[r.status][1]) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit / Tanggapi', cls: 'btn-blue', onClick: () => openModal(row) },
        ...(row.status !== 'closed' ? [{ icon: 'circle-check', title: 'Tandai Selesai', cls: 'btn-green', onClick: () => { Store.update('tickets', row.id, { status: 'closed' }); UI.toast('Tiket ditandai selesai.', 'success'); table.refresh(); } }] : []),
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Tiket', message: `Hapus tiket "${row.subject}"?`, danger: true });
          if (ok) { Store.remove('tickets', row.id); UI.toast('Tiket dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Tiket', 'Tiket', rows.map(r => ({ Jenis: TYPE_MAP[r.type][0], Subjek: r.subject, Pelapor: r.reporter_name, Deskripsi: r.description, Prioritas: r.priority, Status: STATUS_MAP[r.status][0], Tanggapan: r.response }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const tickets = Store.list('tickets');
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="message-square-warning"></i></div><div class="stat-value">${tickets.filter(t => t.status === 'open').length}</div><div class="stat-label">Tiket Terbuka</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="loader"></i></div><div class="stat-value">${tickets.filter(t => t.status === 'in_progress').length}</div><div class="stat-label">Sedang Diproses</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-success"><i data-lucide="circle-check"></i></div><div class="stat-value">${tickets.filter(t => t.status === 'closed').length}</div><div class="stat-label">Selesai</div></div>
      </div>
      <div id="tik-table-root" class="mt-16"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('tik-table-root'));
  }

  Modules.tiket = {
    title: 'Komplain & Saran',
    subtitle: 'Tiket layanan untuk menindaklanjuti komplain dan saran',
    render,
  };
})();
