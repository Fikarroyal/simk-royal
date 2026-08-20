/* =========================================================================
   modules/reservasi.js — Reservasi Meja (Fitur CRUD tambahan #1)
   Booking meja untuk pelanggan lengkap dengan tanggal/jam, jumlah tamu, dan
   status (pending, dikonfirmasi, selesai, dibatalkan).
   ========================================================================= */
(function () {
  let table = null;

  const STATUS_MAP = {
    pending: ['Menunggu Konfirmasi', 'badge-warning'],
    confirmed: ['Dikonfirmasi', 'badge-info'],
    completed: ['Selesai', 'badge-success'],
    cancelled: ['Dibatalkan', 'badge-danger'],
  };
  const statusBadge = (s) => { const [label, cls] = STATUS_MAP[s] || [s, 'badge-gray']; return UI.badge(label, cls); };

  function tableOptions(selectedId) {
    return Store.list('tables').map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>Meja ${Util.escape(t.table_number)} (${t.capacity} org)</option>`).join('');
  }

  function form(existing) {
    const r = existing || { customer_name: '', phone: '', table_id: '', party_size: 2, reservation_date: Util.todayISO(), reservation_time: '18:00', status: 'pending', note: '' };
    return `
      <form id="rsv-form" class="form-grid">
        <div class="field span-2"><label>Nama Pelanggan *</label><input class="input" name="customer_name" required value="${Util.escape(r.customer_name)}" /></div>
        <div class="field"><label>No. Telepon *</label><input class="input" name="phone" required value="${Util.escape(r.phone)}" /></div>
        <div class="field"><label>Jumlah Tamu *</label><input class="input" type="number" min="1" name="party_size" required value="${r.party_size}" /></div>
        <div class="field"><label>Meja *</label><select class="input" name="table_id" required>${tableOptions(r.table_id)}</select></div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="reservation_date" required value="${r.reservation_date}" /></div>
        <div class="field"><label>Jam *</label><input class="input" type="time" name="reservation_time" required value="${r.reservation_time}" /></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            ${Object.keys(STATUS_MAP).map(k => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${STATUS_MAP[k][0]}</option>`).join('')}
          </select>
        </div>
        <div class="field span-2"><label>Catatan</label><textarea class="input" name="note" rows="2">${Util.escape(r.note || '')}</textarea></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Reservasi' : 'Tambah Reservasi', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="rsv-cancel">Batal</button><button class="btn btn-primary" id="rsv-save">Simpan</button>`,
    });
    document.getElementById('rsv-cancel').addEventListener('click', close);
    document.getElementById('rsv-save').addEventListener('click', () => {
      const f = document.getElementById('rsv-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.party_size = Number(data.party_size);
      if (existing) { Store.update('reservations', existing.id, data); UI.toast('Reservasi diperbarui.', 'success'); }
      else { Store.create('reservations', data, 'rsv'); UI.toast('Reservasi ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama pelanggan atau telepon...',
      addLabel: 'Tambah Reservasi',
      emptyIcon: 'calendar-clock', emptyTitle: 'Belum ada reservasi',
      perPage: 8,
      getData: () => Store.list('reservations').slice().sort((a, b) => (b.reservation_date + b.reservation_time).localeCompare(a.reservation_date + a.reservation_time)),
      searchFn: (row, q) => row.customer_name.toLowerCase().includes(q) || (row.phone || '').includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: Object.keys(STATUS_MAP).map(k => ({ value: k, label: STATUS_MAP[k][0] })), filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Pelanggan', render: (r) => `<div class="cell-title">${Util.escape(r.customer_name)}</div><div class="cell-sub">${Util.escape(r.phone)}</div>` },
        { label: 'Meja', render: (r) => { const t = Store.get('tables', r.table_id); return t ? `Meja ${Util.escape(t.table_number)}` : '-'; } },
        { label: 'Tamu', render: (r) => `${r.party_size} orang` },
        { label: 'Jadwal', render: (r) => `${Util.formatDate(r.reservation_date)}, ${Util.escape(r.reservation_time)}` },
        { label: 'Status', render: (r) => statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Reservasi', message: `Hapus reservasi atas nama "${row.customer_name}"?`, danger: true });
          if (ok) { Store.remove('reservations', row.id); UI.toast('Reservasi dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Reservasi', 'Reservasi', rows.map(r => { const t = Store.get('tables', r.table_id); return { Pelanggan: r.customer_name, Telepon: r.phone, Meja: t ? t.table_number : '-', Tamu: r.party_size, Tanggal: r.reservation_date, Jam: r.reservation_time, Status: r.status, Catatan: r.note }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="rsv-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('rsv-table-root'));
  }

  Modules.reservasi = {
    title: 'Reservasi Meja',
    subtitle: 'Kelola pemesanan meja pelanggan sebelum kedatangan',
    render,
  };
})();
