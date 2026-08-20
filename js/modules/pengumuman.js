/* =========================================================================
   modules/pengumuman.js — Pengumuman Internal / Papan Info Staff
   (Fitur CRUD tambahan #9)
   Papan pengumuman untuk tim: judul, isi, target role, dan prioritas.
   ========================================================================= */
(function () {
  let table = null;
  const ROLE_TARGET = { all: 'Semua Karyawan', administrator: 'Administrator', manager: 'Manager', kasir: 'Kasir', staff: 'Staff' };
  const PRIORITY = { low: ['Rendah', 'badge-gray'], normal: ['Normal', 'badge-info'], high: ['Penting', 'badge-danger'] };
  const prioBadge = (p) => { const [l, cls] = PRIORITY[p] || [p, 'badge-gray']; return UI.badge(l, cls); };

  function form(existing) {
    const a = existing || { title: '', content: '', target_role: 'all', priority: 'normal', status: 'published' };
    return `
      <form id="ann-form" class="form-grid">
        <div class="field span-2"><label>Judul *</label><input class="input" name="title" required value="${Util.escape(a.title)}" /></div>
        <div class="field"><label>Target</label>
          <select class="input" name="target_role">
            ${Object.entries(ROLE_TARGET).map(([k, v]) => `<option value="${k}" ${a.target_role === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Prioritas</label>
          <select class="input" name="priority">
            ${Object.keys(PRIORITY).map(k => `<option value="${k}" ${a.priority === k ? 'selected' : ''}>${PRIORITY[k][0]}</option>`).join('')}
          </select>
        </div>
        <div class="field span-2"><label>Isi Pengumuman *</label><textarea class="input" name="content" rows="4" required>${Util.escape(a.content || '')}</textarea></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="published" ${a.status === 'published' ? 'selected' : ''}>Tayang</option>
            <option value="draft" ${a.status === 'draft' ? 'selected' : ''}>Draf</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Pengumuman' : 'Buat Pengumuman', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="ann-cancel">Batal</button><button class="btn btn-primary" id="ann-save">Simpan</button>`,
    });
    document.getElementById('ann-cancel').addEventListener('click', close);
    document.getElementById('ann-save').addEventListener('click', () => {
      const f = document.getElementById('ann-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      if (existing) { Store.update('announcements', existing.id, data); UI.toast('Pengumuman diperbarui.', 'success'); }
      else { data.created_at = new Date().toISOString(); Store.create('announcements', data, 'ann'); UI.toast('Pengumuman diterbitkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable(ctx) {
    const isStaffLike = ctx.user.role === 'kasir' || ctx.user.role === 'staff';
    return createCrudTable({
      searchPlaceholder: 'Cari judul pengumuman...',
      addLabel: 'Buat Pengumuman',
      emptyIcon: 'megaphone', emptyTitle: 'Belum ada pengumuman',
      perPage: 8,
      getData: () => {
        let rows = Store.list('announcements').slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        if (isStaffLike) rows = rows.filter(r => r.status === 'published' && (r.target_role === 'all' || r.target_role === ctx.user.role));
        return rows;
      },
      searchFn: (row, q) => row.title.toLowerCase().includes(q) || row.content.toLowerCase().includes(q),
      columns: [
        { label: 'Judul', render: (r) => `<div class="cell-title">${Util.escape(r.title)}</div><div class="cell-sub" style="max-width:320px;white-space:normal;">${Util.escape(r.content)}</div>` },
        { label: 'Target', render: (r) => ROLE_TARGET[r.target_role] || r.target_role },
        { label: 'Prioritas', render: (r) => prioBadge(r.priority) },
        { label: 'Tanggal', render: (r) => Util.formatDateTime(r.created_at) },
        ...(isStaffLike ? [] : [{ label: 'Status', render: (r) => r.status === 'published' ? UI.badge('Tayang', 'badge-success') : UI.badge('Draf', 'badge-gray') }]),
      ],
      rowActions: isStaffLike ? undefined : (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Pengumuman', message: `Hapus pengumuman "${row.title}"?`, danger: true });
          if (ok) { Store.remove('announcements', row.id); UI.toast('Pengumuman dihapus.', 'success'); table.refresh(); }
        }},
      ],
      onAdd: isStaffLike ? undefined : () => openModal(null),
    });
  }

  function render(container, ctx) {
    container.innerHTML = `<div id="ann-table-root"></div>`;
    table = buildTable(ctx);
    table.mount(document.getElementById('ann-table-root'));
  }

  Modules.pengumuman = {
    title: 'Pengumuman Internal',
    subtitle: 'Papan info untuk seluruh tim atau role tertentu',
    render,
  };
})();
