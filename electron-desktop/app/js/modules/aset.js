/* =========================================================================
   modules/aset.js — Aset & Maintenance Peralatan (Fitur CRUD tambahan #7)
   Daftar aset/peralatan cafe (mesin kopi, kulkas, dsb) beserta riwayat
   perawatan/perbaikannya per aset.
   ========================================================================= */
(function () {
  let activeTab = 'aset';
  let asetTable = null;
  let maintTable = null;

  const COND_MAP = { good: ['Baik', 'badge-success'], needs_repair: ['Perlu Perbaikan', 'badge-warning'], broken: ['Rusak', 'badge-danger'] };
  const condBadge = (c) => { const [l, cls] = COND_MAP[c] || [c, 'badge-gray']; return UI.badge(l, cls); };
  const MTN_STATUS = { scheduled: ['Terjadwal', 'badge-warning'], in_progress: ['Dikerjakan', 'badge-info'], done: ['Selesai', 'badge-success'] };
  const mtnBadge = (s) => { const [l, cls] = MTN_STATUS[s] || [s, 'badge-gray']; return UI.badge(l, cls); };

  function branchOptions(selectedId) {
    return Store.list('branches').map(b => `<option value="${b.id}" ${b.id === selectedId ? 'selected' : ''}>${Util.escape(b.name)}</option>`).join('');
  }
  function assetOptions(selectedId) {
    return Store.list('assets').map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${Util.escape(a.name)}</option>`).join('');
  }

  /* --------------------------------- ASET --------------------------------- */
  function asetForm(existing) {
    const a = existing || { name: '', category: '', purchase_date: Util.todayISO(), purchase_cost: 0, condition: 'good', location: '', status: 'active' };
    return `
      <form id="ast-form" class="form-grid">
        <div class="field span-2"><label>Nama Aset *</label><input class="input" name="name" required value="${Util.escape(a.name)}" /></div>
        <div class="field"><label>Kategori *</label><input class="input" name="category" required placeholder="mis. Peralatan Dapur" value="${Util.escape(a.category)}" /></div>
        <div class="field"><label>Cabang *</label><select class="input" name="location" required>${branchOptions(a.location)}</select></div>
        <div class="field"><label>Tanggal Beli *</label><input class="input" type="date" name="purchase_date" required value="${a.purchase_date}" /></div>
        <div class="field"><label>Harga Beli (Rp) *</label><input class="input" type="number" min="0" name="purchase_cost" required value="${a.purchase_cost}" /></div>
        <div class="field"><label>Kondisi</label>
          <select class="input" name="condition">
            ${Object.keys(COND_MAP).map(k => `<option value="${k}" ${a.condition === k ? 'selected' : ''}>${COND_MAP[k][0]}</option>`).join('')}
          </select>
        </div>
      </form>`;
  }

  function openAsetModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Aset' : 'Tambah Aset', size: 'md',
      body: asetForm(existing),
      footer: `<button class="btn btn-gray" id="ast-cancel">Batal</button><button class="btn btn-primary" id="ast-save">Simpan</button>`,
    });
    document.getElementById('ast-cancel').addEventListener('click', close);
    document.getElementById('ast-save').addEventListener('click', () => {
      const f = document.getElementById('ast-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.purchase_cost = Number(data.purchase_cost);
      data.status = 'active';
      if (existing) { Store.update('assets', existing.id, data); UI.toast('Aset diperbarui.', 'success'); }
      else { Store.create('assets', data, 'ast'); UI.toast('Aset ditambahkan.', 'success'); }
      close(); asetTable.refresh();
    });
  }

  function buildAsetTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau kategori aset...',
      addLabel: 'Tambah Aset',
      emptyIcon: 'wrench', emptyTitle: 'Belum ada aset',
      perPage: 8,
      getData: () => Store.list('assets'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.category.toLowerCase().includes(q),
      filters: [
        { key: 'condition', label: 'Semua Kondisi', options: Object.keys(COND_MAP).map(k => ({ value: k, label: COND_MAP[k][0] })), filterFn: (r, v) => r.condition === v },
      ],
      columns: [
        { label: 'Aset', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub">${Util.escape(r.category)}</div>` },
        { label: 'Cabang', render: (r) => { const b = Store.get('branches', r.location); return b ? Util.escape(b.name) : '-'; } },
        { label: 'Tgl Beli', render: (r) => Util.formatDate(r.purchase_date) },
        { label: 'Harga Beli', render: (r) => Util.formatCurrency(r.purchase_cost) },
        { label: 'Kondisi', render: (r) => condBadge(r.condition) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openAsetModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Aset', message: `Hapus aset "${row.name}"?`, danger: true });
          if (ok) { Store.remove('assets', row.id); UI.toast('Aset dihapus.', 'success'); asetTable.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Aset', 'Aset', rows.map(r => { const b = Store.get('branches', r.location); return { Nama: r.name, Kategori: r.category, Cabang: b ? b.name : '-', TanggalBeli: r.purchase_date, HargaBeli: r.purchase_cost, Kondisi: r.condition }; })),
      },
      onAdd: () => openAsetModal(null),
    });
  }

  /* ------------------------------ MAINTENANCE ------------------------------ */
  function maintForm(existing) {
    const m = existing || { asset_id: '', date: Util.todayISO(), issue: '', action: '', cost: 0, status: 'scheduled' };
    return `
      <form id="mtn-form" class="form-grid">
        <div class="field span-2"><label>Aset *</label><select class="input" name="asset_id" required>${assetOptions(m.asset_id)}</select></div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="date" required value="${m.date}" /></div>
        <div class="field"><label>Biaya (Rp)</label><input class="input" type="number" min="0" name="cost" value="${m.cost || 0}" /></div>
        <div class="field span-2"><label>Kendala/Keluhan *</label><textarea class="input" name="issue" rows="2" required>${Util.escape(m.issue || '')}</textarea></div>
        <div class="field span-2"><label>Tindakan</label><textarea class="input" name="action" rows="2">${Util.escape(m.action || '')}</textarea></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            ${Object.keys(MTN_STATUS).map(k => `<option value="${k}" ${m.status === k ? 'selected' : ''}>${MTN_STATUS[k][0]}</option>`).join('')}
          </select>
        </div>
      </form>`;
  }

  function openMaintModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Riwayat Maintenance' : 'Tambah Riwayat Maintenance', size: 'md',
      body: maintForm(existing),
      footer: `<button class="btn btn-gray" id="mtn-cancel">Batal</button><button class="btn btn-primary" id="mtn-save">Simpan</button>`,
    });
    document.getElementById('mtn-cancel').addEventListener('click', close);
    document.getElementById('mtn-save').addEventListener('click', () => {
      const f = document.getElementById('mtn-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.cost = Number(data.cost) || 0;
      if (existing) { Store.update('asset_maintenance', existing.id, data); UI.toast('Riwayat maintenance diperbarui.', 'success'); }
      else { Store.create('asset_maintenance', data, 'mtn'); UI.toast('Riwayat maintenance ditambahkan.', 'success'); }
      close(); maintTable.refresh();
    });
  }

  function buildMaintTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama aset atau kendala...',
      addLabel: 'Tambah Maintenance',
      emptyIcon: 'clipboard-list', emptyTitle: 'Belum ada riwayat maintenance',
      perPage: 8,
      getData: () => Store.list('asset_maintenance').slice().sort((a, b) => b.date.localeCompare(a.date)),
      searchFn: (row, q) => { const a = Store.get('assets', row.asset_id); return (a ? a.name.toLowerCase().includes(q) : false) || row.issue.toLowerCase().includes(q); },
      filters: [
        { key: 'status', label: 'Semua Status', options: Object.keys(MTN_STATUS).map(k => ({ value: k, label: MTN_STATUS[k][0] })), filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Aset', render: (r) => { const a = Store.get('assets', r.asset_id); return `<div class="cell-title">${a ? Util.escape(a.name) : '-'}</div>`; } },
        { label: 'Tanggal', render: (r) => Util.formatDate(r.date) },
        { label: 'Kendala', render: (r) => `<div style="max-width:220px;white-space:normal;">${Util.escape(r.issue)}</div>` },
        { label: 'Biaya', render: (r) => Util.formatCurrency(r.cost) },
        { label: 'Status', render: (r) => mtnBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openMaintModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Riwayat', message: 'Hapus riwayat maintenance ini?', danger: true });
          if (ok) { Store.remove('asset_maintenance', row.id); UI.toast('Riwayat dihapus.', 'success'); maintTable.refresh(); }
        }},
      ],
      onAdd: () => openMaintModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="wrench"></i></div><div class="stat-value">${Store.list('assets').length}</div><div class="stat-label">Total Aset</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="triangle-alert"></i></div><div class="stat-value">${Store.list('assets').filter(a => a.condition !== 'good').length}</div><div class="stat-label">Perlu Perhatian</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-success"><i data-lucide="clipboard-list"></i></div><div class="stat-value">${Store.list('asset_maintenance').length}</div><div class="stat-label">Riwayat Maintenance</div></div>
      </div>
      <div class="tabs mt-16">
        <button class="tab-btn ${activeTab === 'aset' ? 'active' : ''}" data-tab="aset">Daftar Aset</button>
        <button class="tab-btn ${activeTab === 'maint' ? 'active' : ''}" data-tab="maint">Riwayat Maintenance</button>
      </div>
      <div id="ast-tab-content"></div>
    `;
    container.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(container); }));
    const content = document.getElementById('ast-tab-content');
    if (activeTab === 'aset') { asetTable = buildAsetTable(); asetTable.mount(content); }
    else { maintTable = buildMaintTable(); maintTable.mount(content); }
    UI.icons();
  }

  Modules.aset = {
    title: 'Aset & Maintenance',
    subtitle: 'Kelola peralatan cafe dan riwayat perawatannya',
    render,
  };
})();
