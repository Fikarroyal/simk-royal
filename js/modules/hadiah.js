/* =========================================================================
   modules/hadiah.js — Hadiah & Penukaran Poin (Fitur CRUD tambahan #14)
   Melengkapi sistem poin membership yang sudah ada di modul Pelanggan:
   katalog hadiah yang bisa ditukar dengan poin, plus riwayat penukarannya.
   ========================================================================= */
(function () {
  let activeTab = 'katalog';
  let rewardTable = null;
  let redemptionTable = null;

  /* ------------------------------- KATALOG ------------------------------- */
  function rewardForm(existing) {
    const r = existing || { name: '', points_cost: 100, stock: 10, status: 'active' };
    return `
      <form id="rwd-form" class="form-grid">
        <div class="field span-2"><label>Nama Hadiah *</label><input class="input" name="name" required value="${Util.escape(r.name)}" /></div>
        <div class="field"><label>Biaya Poin *</label><input class="input" type="number" min="1" name="points_cost" required value="${r.points_cost}" /></div>
        <div class="field"><label>Stok Hadiah *</label><input class="input" type="number" min="0" name="stock" required value="${r.stock}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${r.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${r.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openRewardModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Hadiah' : 'Tambah Hadiah', size: 'md',
      body: rewardForm(existing),
      footer: `<button class="btn btn-gray" id="rwd-cancel">Batal</button><button class="btn btn-primary" id="rwd-save">Simpan</button>`,
    });
    document.getElementById('rwd-cancel').addEventListener('click', close);
    document.getElementById('rwd-save').addEventListener('click', () => {
      const f = document.getElementById('rwd-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.points_cost = Number(data.points_cost); data.stock = Number(data.stock);
      if (existing) { Store.update('rewards', existing.id, data); UI.toast('Hadiah diperbarui.', 'success'); }
      else { Store.create('rewards', data, 'rwd'); UI.toast('Hadiah ditambahkan.', 'success'); }
      close(); rewardTable.refresh();
    });
  }

  function buildRewardTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama hadiah...',
      addLabel: 'Tambah Hadiah',
      emptyIcon: 'gift', emptyTitle: 'Belum ada katalog hadiah',
      perPage: 8,
      getData: () => Store.list('rewards'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q),
      columns: [
        { label: 'Hadiah', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div>` },
        { label: 'Biaya Poin', render: (r) => `<span class="mono">${Util.formatNumber(r.points_cost)} poin</span>` },
        { label: 'Stok', render: (r) => Util.formatNumber(r.stock) },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openRewardModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Hadiah', message: `Hapus hadiah "${row.name}"?`, danger: true });
          if (ok) { Store.remove('rewards', row.id); UI.toast('Hadiah dihapus.', 'success'); rewardTable.refresh(); }
        }},
      ],
      onAdd: () => openRewardModal(null),
    });
  }

  /* ----------------------------- PENUKARAN ----------------------------- */
  function customerOptions() {
    return Store.list('customers').map(c => `<option value="${c.id}">${Util.escape(c.name)} (${c.points || 0} poin)</option>`).join('');
  }
  function rewardOptions() {
    return Store.list('rewards').filter(r => r.status === 'active' && r.stock > 0).map(r => `<option value="${r.id}">${Util.escape(r.name)} (${r.points_cost} poin)</option>`).join('');
  }

  function openRedeemModal() {
    const { close } = UI.openModal({
      title: 'Tukarkan Poin Pelanggan', size: 'md',
      body: `
        <form id="rdm-form" class="form-grid">
          <div class="field span-2"><label>Pelanggan *</label><select class="input" name="customer_id" required>${customerOptions()}</select></div>
          <div class="field span-2"><label>Hadiah *</label><select class="input" name="reward_id" required>${rewardOptions()}</select></div>
        </form>`,
      footer: `<button class="btn btn-gray" id="rdm-cancel">Batal</button><button class="btn btn-primary" id="rdm-confirm">Tukarkan</button>`,
    });
    document.getElementById('rdm-cancel').addEventListener('click', close);
    document.getElementById('rdm-confirm').addEventListener('click', () => {
      const f = document.getElementById('rdm-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      const result = Store.redeemReward(data.customer_id, data.reward_id);
      if (!result.ok) { UI.toast(result.message, 'danger'); return; }
      UI.toast(`Poin berhasil ditukar. Sisa poin: ${result.customer.points}.`, 'success');
      close(); redemptionTable.refresh();
    });
  }

  function buildRedemptionTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama pelanggan...',
      addLabel: 'Tukarkan Poin',
      emptyIcon: 'ticket-check', emptyTitle: 'Belum ada penukaran poin',
      perPage: 8,
      getData: () => Store.list('redemptions').slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      searchFn: (row, q) => { const c = Store.get('customers', row.customer_id); return c ? c.name.toLowerCase().includes(q) : false; },
      columns: [
        { label: 'Pelanggan', render: (r) => { const c = Store.get('customers', r.customer_id); return c ? Util.escape(c.name) : '-'; } },
        { label: 'Hadiah', render: (r) => { const rw = Store.get('rewards', r.reward_id); return rw ? Util.escape(rw.name) : '-'; } },
        { label: 'Poin Terpakai', render: (r) => `<span class="mono">${Util.formatNumber(r.points_used)}</span>` },
        { label: 'Tanggal', render: (r) => Util.formatDate(r.date) },
      ],
      rowActions: (row) => [
        { icon: 'trash-2', title: 'Hapus Riwayat', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Riwayat', message: 'Menghapus riwayat ini TIDAK mengembalikan poin/stok hadiah. Lanjutkan?', danger: true });
          if (ok) { Store.remove('redemptions', row.id); UI.toast('Riwayat dihapus.', 'success'); redemptionTable.refresh(); }
        }},
      ],
      onAdd: () => openRedeemModal(),
    });
  }

  function render(container) {
    container.innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${activeTab === 'katalog' ? 'active' : ''}" data-tab="katalog">Katalog Hadiah</button>
        <button class="tab-btn ${activeTab === 'penukaran' ? 'active' : ''}" data-tab="penukaran">Riwayat Penukaran</button>
      </div>
      <div id="hdh-tab-content" class="mt-16"></div>
    `;
    container.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(container); }));
    const content = document.getElementById('hdh-tab-content');
    if (activeTab === 'katalog') { rewardTable = buildRewardTable(); rewardTable.mount(content); }
    else { redemptionTable = buildRedemptionTable(); redemptionTable.mount(content); }
    UI.icons();
  }

  Modules.hadiah = {
    title: 'Hadiah & Penukaran Poin',
    subtitle: 'Katalog hadiah loyalitas dan riwayat penukaran poin pelanggan',
    render,
  };
})();
