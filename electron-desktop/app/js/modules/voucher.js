/* =========================================================================
   modules/voucher.js — Voucher & Gift Card (Fitur CRUD tambahan #3)
   Kupon bersaldo nominal (berbeda dari kode Promo % / Rp di modul Promo),
   bisa dipakai bertahap sampai saldo habis, dengan riwayat pemakaian
   otomatis via aksi "Redeem".
   ========================================================================= */
(function () {
  let table = null;

  function form(existing) {
    const v = existing || { code: '', owner_name: '', initial_balance: 50000, balance: 50000, expiry_date: '', status: 'active' };
    return `
      <form id="vch-form" class="form-grid">
        <div class="field"><label>Kode Voucher *</label><input class="input" name="code" required style="text-transform:uppercase;" value="${Util.escape(v.code)}" ${existing ? 'disabled' : ''} /></div>
        <div class="field"><label>Nama Pemilik</label><input class="input" name="owner_name" value="${Util.escape(v.owner_name || '')}" placeholder="Kosongkan jika untuk umum" /></div>
        <div class="field"><label>Nilai Awal (Rp) *</label><input class="input" type="number" min="0" name="initial_balance" required value="${v.initial_balance}" /></div>
        <div class="field"><label>Tanggal Kedaluwarsa *</label><input class="input" type="date" name="expiry_date" required value="${v.expiry_date}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${v.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="used" ${v.status === 'used' ? 'selected' : ''}>Sudah Habis Dipakai</option>
            <option value="expired" ${v.status === 'expired' ? 'selected' : ''}>Kedaluwarsa</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Voucher' : 'Terbitkan Voucher Baru', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="vch-cancel">Batal</button><button class="btn btn-primary" id="vch-save">Simpan</button>`,
    });
    document.getElementById('vch-cancel').addEventListener('click', close);
    document.getElementById('vch-save').addEventListener('click', () => {
      const f = document.getElementById('vch-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.code = data.code.toUpperCase();
      data.initial_balance = Number(data.initial_balance);
      if (existing) {
        Store.update('vouchers', existing.id, data);
        UI.toast('Voucher diperbarui.', 'success');
      } else {
        const dup = Store.list('vouchers').find(x => x.code === data.code);
        if (dup) { UI.toast('Kode voucher sudah digunakan.', 'danger'); return; }
        data.balance = data.initial_balance;
        data.type = 'giftcard';
        Store.create('vouchers', data, 'vch');
        UI.toast('Voucher diterbitkan.', 'success');
      }
      close(); table.refresh();
    });
  }

  function openRedeemModal(voucher) {
    const { close } = UI.openModal({
      title: `Gunakan Voucher ${voucher.code}`, size: 'sm',
      body: `
        <p class="confirm-text" style="margin-bottom:12px;">Sisa saldo: <strong>${Util.formatCurrency(voucher.balance)}</strong></p>
        <div class="field"><label>Nominal yang Digunakan (Rp) *</label><input class="input" type="number" min="1" max="${voucher.balance}" id="redeem-amount" value="${voucher.balance}" /></div>
      `,
      footer: `<button class="btn btn-gray" id="rd-cancel">Batal</button><button class="btn btn-primary" id="rd-confirm">Gunakan</button>`,
    });
    document.getElementById('rd-cancel').addEventListener('click', close);
    document.getElementById('rd-confirm').addEventListener('click', () => {
      const amount = Number(document.getElementById('redeem-amount').value) || 0;
      if (amount <= 0) { UI.toast('Nominal tidak valid.', 'danger'); return; }
      const result = Store.redeemVoucher(voucher.code, amount);
      if (!result.ok) { UI.toast(result.message, 'danger'); return; }
      UI.toast(`Voucher terpakai ${Util.formatCurrency(result.used)}. Sisa saldo ${Util.formatCurrency(result.voucher.balance)}.`, 'success');
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari kode voucher atau pemilik...',
      addLabel: 'Terbitkan Voucher',
      emptyIcon: 'gift', emptyTitle: 'Belum ada voucher',
      perPage: 8,
      getData: () => Store.list('vouchers'),
      searchFn: (row, q) => row.code.toLowerCase().includes(q) || (row.owner_name || '').toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'active', label: 'Aktif' }, { value: 'used', label: 'Habis' }, { value: 'expired', label: 'Kedaluwarsa' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Kode', render: (r) => `<div class="cell-title mono">${Util.escape(r.code)}</div><div class="cell-sub">${Util.escape(r.owner_name || 'Untuk umum')}</div>` },
        { label: 'Saldo', render: (r) => `<span class="mono">${Util.formatCurrency(r.balance)}</span> / ${Util.formatCurrency(r.initial_balance)}` },
        { label: 'Kedaluwarsa', render: (r) => Util.formatDate(r.expiry_date) },
        { label: 'Status', render: (r) => r.status === 'active' ? UI.badge('Aktif', 'badge-success') : r.status === 'used' ? UI.badge('Habis', 'badge-gray') : UI.badge('Kedaluwarsa', 'badge-danger') },
      ],
      rowActions: (row) => [
        ...(row.status === 'active' && row.balance > 0 ? [{ icon: 'ticket-check', title: 'Gunakan Voucher', cls: 'btn-green', onClick: () => openRedeemModal(row) }] : []),
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Voucher', message: `Hapus voucher "${row.code}"?`, danger: true });
          if (ok) { Store.remove('vouchers', row.id); UI.toast('Voucher dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Voucher', 'Voucher', rows.map(r => ({ Kode: r.code, Pemilik: r.owner_name, SaldoAwal: r.initial_balance, SaldoSisa: r.balance, Kedaluwarsa: r.expiry_date, Status: r.status }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="vch-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('vch-table-root'));
  }

  Modules.voucher = {
    title: 'Voucher & Gift Card',
    subtitle: 'Terbitkan dan gunakan voucher bersaldo nominal untuk pelanggan',
    render,
  };
})();
