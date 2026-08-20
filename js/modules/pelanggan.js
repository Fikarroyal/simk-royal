/* =========================================================================
   modules/pelanggan.js — Database Pelanggan
   ========================================================================= */
(function () {
  let table = null;
  const MEMBERSHIP_BADGE = { regular: 'badge-gray', silver: 'badge-info', gold: 'badge-warning' };

  function form(existing) {
    const c = existing || { name: '', phone: '', email: '', address: '', membership: 'regular', points: 0 };
    return `
      <form id="customer-form" class="form-grid">
        <div class="field span-2"><label>Nama Lengkap *</label><input class="input" name="name" required value="${Util.escape(c.name)}" /></div>
        <div class="field"><label>No. Telepon *</label><input class="input" name="phone" required value="${Util.escape(c.phone)}" /></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="email" value="${Util.escape(c.email || '')}" /></div>
        <div class="field span-2"><label>Alamat</label><textarea class="input" name="address" rows="2">${Util.escape(c.address || '')}</textarea></div>
        <div class="field"><label>Membership</label>
          <select class="input" name="membership">
            <option value="regular" ${c.membership === 'regular' ? 'selected' : ''}>Regular</option>
            <option value="silver" ${c.membership === 'silver' ? 'selected' : ''}>Silver</option>
            <option value="gold" ${c.membership === 'gold' ? 'selected' : ''}>Gold</option>
          </select>
        </div>
        <div class="field"><label>Poin</label><input class="input" type="number" min="0" name="points" value="${c.points || 0}" /></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Pelanggan' : 'Tambah Pelanggan', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="cf-cancel">Batal</button><button class="btn btn-primary" id="cf-save">Simpan</button>`,
    });
    document.getElementById('cf-cancel').addEventListener('click', close);
    document.getElementById('cf-save').addEventListener('click', () => {
      const f = document.getElementById('customer-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.points = Number(data.points) || 0;
      if (existing) { Store.update('customers', existing.id, data); UI.toast('Data pelanggan diperbarui.', 'success'); }
      else { Store.create('customers', data, 'cust'); UI.toast('Pelanggan ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function openHistory(customer) {
    const trx = Store.list('transactions').filter(t => t.customer_id === customer.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    UI.openModal({
      title: `Riwayat Transaksi ${customer.name}`, size: 'lg',
      body: trx.length ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Invoice</th><th>Tanggal</th><th>Metode</th><th>Total</th></tr></thead>
            <tbody>${trx.map(t => `<tr><td class="mono">${t.invoice_number}</td><td class="cell-sub">${Util.formatDateTime(t.created_at)}</td><td>${UI.badge(t.payment_method.toUpperCase(), 'badge-info')}</td><td class="mono cell-title">${Util.formatCurrency(t.total)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      ` : UI.emptyState('receipt', 'Belum ada transaksi', 'Pelanggan ini belum pernah bertransaksi.'),
      footer: `<button class="btn btn-gray" id="hist-close">Tutup</button>`,
    });
    document.getElementById('hist-close').addEventListener('click', UI.closeModal);
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau telepon...',
      addLabel: 'Tambah Pelanggan',
      emptyIcon: 'users', emptyTitle: 'Belum ada pelanggan',
      perPage: 8,
      getData: () => Store.list('customers'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.phone.includes(q),
      filters: [
        { key: 'membership', label: 'Semua Membership', options: [{ value: 'regular', label: 'Regular' }, { value: 'silver', label: 'Silver' }, { value: 'gold', label: 'Gold' }], filterFn: (r, v) => r.membership === v },
      ],
      columns: [
        { label: 'Nama', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub">${Util.escape(r.email || '-')}</div>` },
        { label: 'Telepon', render: (r) => `<span class="mono">${Util.escape(r.phone)}</span>` },
        { label: 'Membership', render: (r) => UI.badge(r.membership.toUpperCase(), MEMBERSHIP_BADGE[r.membership]) },
        { label: 'Poin', render: (r) => `<span class="mono">${Util.formatNumber(r.points || 0)}</span>` },
      ],
      rowActions: (row) => [
        { icon: 'history', title: 'Riwayat Transaksi', cls: 'btn-gray', onClick: () => openHistory(row) },
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Pelanggan', message: `Hapus data "${row.name}"?`, danger: true });
          if (ok) { Store.remove('customers', row.id); UI.toast('Pelanggan dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Pelanggan', 'Pelanggan', rows.map(r => ({ Nama: r.name, Telepon: r.phone, Email: r.email, Alamat: r.address, Membership: r.membership, Poin: r.points }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="pelanggan-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('pelanggan-table-root'));
  }

  Modules.pelanggan = {
    title: 'Pelanggan',
    subtitle: 'Database pelanggan, membership, dan poin loyalitas',
    render,
  };
})();
