/* =========================================================================
   modules/referral.js — Program Referral Pelanggan (Fitur CRUD tambahan #20)
   Pelanggan mengajak teman baru; saat berhasil (converted), poin loyalitas
   otomatis ditambahkan ke akun pelanggan yang mereferensikan.
   ========================================================================= */
(function () {
  let table = null;
  const STATUS_MAP = { pending: ['Menunggu', 'badge-warning'], converted: ['Berhasil Datang', 'badge-info'], rewarded: ['Sudah Diberi Reward', 'badge-success'] };
  const statusBadge = (s) => { const [l, cls] = STATUS_MAP[s] || [s, 'badge-gray']; return UI.badge(l, cls); };

  function customerOptions(selectedId) {
    return Store.list('customers').map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${Util.escape(c.name)} (${c.points || 0} poin)</option>`).join('');
  }

  function form(existing) {
    const r = existing || { referrer_customer_id: '', referred_name: '', referred_phone: '', status: 'pending', reward_points: 50, date: Util.todayISO() };
    return `
      <form id="ref-form" class="form-grid">
        <div class="field span-2"><label>Pelanggan Pereferensi *</label><select class="input" name="referrer_customer_id" required ${existing ? 'disabled' : ''}>${customerOptions(r.referrer_customer_id)}</select></div>
        <div class="field"><label>Nama Teman yang Diajak *</label><input class="input" name="referred_name" required value="${Util.escape(r.referred_name)}" /></div>
        <div class="field"><label>No. Telepon Teman *</label><input class="input" name="referred_phone" required value="${Util.escape(r.referred_phone)}" /></div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="date" required value="${r.date}" /></div>
        <div class="field"><label>Poin Reward *</label><input class="input" type="number" min="0" name="reward_points" required value="${r.reward_points}" /></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Referral' : 'Tambah Referral', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="ref-cancel">Batal</button><button class="btn btn-primary" id="ref-save">Simpan</button>`,
    });
    document.getElementById('ref-cancel').addEventListener('click', close);
    document.getElementById('ref-save').addEventListener('click', () => {
      const f = document.getElementById('ref-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.reward_points = Number(data.reward_points);
      if (existing) {
        const { referrer_customer_id, ...patch } = data;
        Store.update('referrals', existing.id, patch);
        UI.toast('Referral diperbarui.', 'success');
      } else {
        data.status = 'pending';
        Store.create('referrals', data, 'ref');
        UI.toast('Referral ditambahkan.', 'success');
      }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama teman yang diajak...',
      addLabel: 'Tambah Referral',
      emptyIcon: 'users-round', emptyTitle: 'Belum ada data referral',
      perPage: 8,
      getData: () => Store.list('referrals').slice().sort((a, b) => b.date.localeCompare(a.date)),
      searchFn: (row, q) => row.referred_name.toLowerCase().includes(q) || (row.referred_phone || '').includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: Object.keys(STATUS_MAP).map(k => ({ value: k, label: STATUS_MAP[k][0] })), filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Pereferensi', render: (r) => { const c = Store.get('customers', r.referrer_customer_id); return `<div class="cell-title">${c ? Util.escape(c.name) : '-'}</div>`; } },
        { label: 'Teman Diajak', render: (r) => `<div class="cell-title">${Util.escape(r.referred_name)}</div><div class="cell-sub">${Util.escape(r.referred_phone)}</div>` },
        { label: 'Tanggal', render: (r) => Util.formatDate(r.date) },
        { label: 'Poin Reward', render: (r) => `<span class="mono">${Util.formatNumber(r.reward_points)}</span>` },
        { label: 'Status', render: (r) => statusBadge(r.status) },
      ],
      rowActions: (row) => [
        ...(row.status === 'pending' ? [{ icon: 'check', title: 'Tandai Berhasil Datang', cls: 'btn-blue', onClick: () => { Store.update('referrals', row.id, { status: 'converted' }); UI.toast('Referral ditandai berhasil.', 'success'); table.refresh(); } }] : []),
        ...(row.status === 'converted' ? [{ icon: 'gift', title: 'Berikan Reward Poin', cls: 'btn-green', onClick: async () => {
          const ok = await UI.confirm({ title: 'Berikan Reward', message: `Tambahkan ${row.reward_points} poin ke pelanggan pereferensi?` });
          if (ok) {
            const result = Store.markReferralRewarded(row.id);
            if (!result.ok) { UI.toast(result.message, 'danger'); return; }
            UI.toast('Poin reward berhasil diberikan.', 'success'); table.refresh();
          }
        }}] : []),
        { icon: 'pencil', title: 'Edit', cls: 'btn-gray', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Referral', message: `Hapus data referral "${row.referred_name}"?`, danger: true });
          if (ok) { Store.remove('referrals', row.id); UI.toast('Referral dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Referral', 'Referral', rows.map(r => { const c = Store.get('customers', r.referrer_customer_id); return { Pereferensi: c ? c.name : '-', TemanDiajak: r.referred_name, Telepon: r.referred_phone, Tanggal: r.date, PoinReward: r.reward_points, Status: STATUS_MAP[r.status][0] }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="ref-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('ref-table-root'));
  }

  Modules.referral = {
    title: 'Program Referral',
    subtitle: 'Pelanggan mengajak teman baru, dapat reward poin',
    render,
  };
})();
