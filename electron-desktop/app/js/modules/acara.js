/* =========================================================================
   modules/acara.js — Booking Acara / Sewa Tempat (Fitur CRUD tambahan #13)
   Berbeda dari Reservasi Meja (per-meja, walk-in dining): modul ini untuk
   penyewaan area/ruang privat untuk acara (ulang tahun, meeting, gathering)
   lengkap dengan uang muka (DP) dan status penyelenggaraan.
   ========================================================================= */
(function () {
  let table = null;
  const STATUS_MAP = { pending: ['Menunggu Konfirmasi', 'badge-warning'], confirmed: ['Terkonfirmasi', 'badge-info'], completed: ['Selesai', 'badge-success'], cancelled: ['Dibatalkan', 'badge-danger'] };
  const statusBadge = (s) => { const [l, cls] = STATUS_MAP[s] || [s, 'badge-gray']; return UI.badge(l, cls); };

  function form(existing) {
    const e = existing || { event_name: '', customer_name: '', phone: '', event_date: Util.todayISO(), start_time: '10:00', end_time: '13:00', guest_count: 10, package: '', total_price: 0, down_payment: 0, status: 'pending', notes: '' };
    return `
      <form id="evt-form" class="form-grid">
        <div class="field span-2"><label>Nama Acara *</label><input class="input" name="event_name" required value="${Util.escape(e.event_name)}" /></div>
        <div class="field"><label>Nama Pemesan *</label><input class="input" name="customer_name" required value="${Util.escape(e.customer_name)}" /></div>
        <div class="field"><label>No. Telepon *</label><input class="input" name="phone" required value="${Util.escape(e.phone)}" /></div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="event_date" required value="${e.event_date}" /></div>
        <div class="field"><label>Jumlah Tamu *</label><input class="input" type="number" min="1" name="guest_count" required value="${e.guest_count}" /></div>
        <div class="field"><label>Jam Mulai *</label><input class="input" type="time" name="start_time" required value="${e.start_time}" /></div>
        <div class="field"><label>Jam Selesai *</label><input class="input" type="time" name="end_time" required value="${e.end_time}" /></div>
        <div class="field span-2"><label>Paket</label><input class="input" name="package" placeholder="mis. Paket Silver, Paket Meeting" value="${Util.escape(e.package || '')}" /></div>
        <div class="field"><label>Total Biaya (Rp) *</label><input class="input" type="number" min="0" name="total_price" required value="${e.total_price}" /></div>
        <div class="field"><label>Uang Muka / DP (Rp)</label><input class="input" type="number" min="0" name="down_payment" value="${e.down_payment || 0}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            ${Object.keys(STATUS_MAP).map(k => `<option value="${k}" ${e.status === k ? 'selected' : ''}>${STATUS_MAP[k][0]}</option>`).join('')}
          </select>
        </div>
        <div class="field span-2"><label>Catatan</label><textarea class="input" name="notes" rows="2">${Util.escape(e.notes || '')}</textarea></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Booking Acara' : 'Tambah Booking Acara', size: 'lg',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="evt-cancel">Batal</button><button class="btn btn-primary" id="evt-save">Simpan</button>`,
    });
    document.getElementById('evt-cancel').addEventListener('click', close);
    document.getElementById('evt-save').addEventListener('click', () => {
      const f = document.getElementById('evt-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.guest_count = Number(data.guest_count);
      data.total_price = Number(data.total_price);
      data.down_payment = Number(data.down_payment) || 0;
      if (existing) { Store.update('events', existing.id, data); UI.toast('Booking acara diperbarui.', 'success'); }
      else { Store.create('events', data, 'evt'); UI.toast('Booking acara ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama acara atau pemesan...',
      addLabel: 'Tambah Booking',
      emptyIcon: 'party-popper', emptyTitle: 'Belum ada booking acara',
      perPage: 8,
      getData: () => Store.list('events').slice().sort((a, b) => b.event_date.localeCompare(a.event_date)),
      searchFn: (row, q) => row.event_name.toLowerCase().includes(q) || row.customer_name.toLowerCase().includes(q),
      filters: [
        { key: 'status', label: 'Semua Status', options: Object.keys(STATUS_MAP).map(k => ({ value: k, label: STATUS_MAP[k][0] })), filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Acara', render: (r) => `<div class="cell-title">${Util.escape(r.event_name)}</div><div class="cell-sub">${Util.escape(r.customer_name)} · ${Util.escape(r.phone)}</div>` },
        { label: 'Jadwal', render: (r) => `${Util.formatDate(r.event_date)}<div class="cell-sub">${Util.escape(r.start_time)}–${Util.escape(r.end_time)}</div>` },
        { label: 'Tamu', render: (r) => `${r.guest_count} orang` },
        { label: 'Total / DP', render: (r) => `<span class="mono">${Util.formatCurrency(r.total_price)}</span><div class="cell-sub">DP ${Util.formatCurrency(r.down_payment)}</div>` },
        { label: 'Status', render: (r) => statusBadge(r.status) },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Booking', message: `Hapus booking acara "${row.event_name}"?`, danger: true });
          if (ok) { Store.remove('events', row.id); UI.toast('Booking dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-BookingAcara', 'Acara', rows.map(r => ({ Acara: r.event_name, Pemesan: r.customer_name, Telepon: r.phone, Tanggal: r.event_date, Jam: `${r.start_time}-${r.end_time}`, Tamu: r.guest_count, Paket: r.package, Total: r.total_price, DP: r.down_payment, Status: r.status }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="evt-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('evt-table-root'));
  }

  Modules.acara = {
    title: 'Booking Acara',
    subtitle: 'Penyewaan tempat/ruang privat untuk acara pelanggan',
    render,
  };
})();
