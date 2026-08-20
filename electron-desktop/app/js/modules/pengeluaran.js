/* =========================================================================
   modules/pengeluaran.js — Operational Expense (FR + CRUD)
   ========================================================================= */
(function () {
  let table = null;
  const CATEGORIES = ['Bahan Baku', 'Gaji Karyawan', 'Sewa Tempat', 'Listrik & Air', 'Marketing', 'Perawatan Alat', 'Lainnya'];
  const CATEGORY_BADGE = { 'Bahan Baku': 'badge-orange', 'Gaji Karyawan': 'badge-purple', 'Sewa Tempat': 'badge-info', 'Listrik & Air': 'badge-warning', 'Marketing': 'badge-success', 'Perawatan Alat': 'badge-gray', 'Lainnya': 'badge-gray' };

  function form(existing) {
    const e = existing || { category: CATEGORIES[0], description: '', amount: '', date: Util.todayISO() };
    return `
      <form id="expense-form" class="form-grid">
        <div class="field"><label>Kategori *</label>
          <select class="input" name="category" required>${CATEGORIES.map(c => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Tanggal *</label><input class="input" type="date" name="date" required value="${e.date}" /></div>
        <div class="field span-2"><label>Deskripsi *</label><input class="input" name="description" required value="${Util.escape(e.description)}" /></div>
        <div class="field span-2"><label>Jumlah (Rp) *</label><input class="input" type="number" min="0" name="amount" required value="${e.amount}" /></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran', size: 'sm',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="ef-cancel">Batal</button><button class="btn btn-primary" id="ef-save">Simpan</button>`,
    });
    document.getElementById('ef-cancel').addEventListener('click', close);
    document.getElementById('ef-save').addEventListener('click', () => {
      const f = document.getElementById('expense-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.amount = Number(data.amount);
      data.user_id = App.user.id;
      if (existing) { Store.update('expenses', existing.id, data); UI.toast('Pengeluaran diperbarui.', 'success'); }
      else { Store.create('expenses', data, 'exp'); UI.toast('Pengeluaran dicatat.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari deskripsi pengeluaran...',
      addLabel: 'Tambah Pengeluaran',
      emptyIcon: 'wallet', emptyTitle: 'Belum ada pengeluaran',
      perPage: 8,
      getData: () => Store.list('expenses').slice().sort((a, b) => b.date.localeCompare(a.date)),
      searchFn: (row, q) => row.description.toLowerCase().includes(q),
      filters: [
        { key: 'category', label: 'Semua Kategori', options: CATEGORIES.map(c => ({ value: c, label: c })), filterFn: (r, v) => r.category === v },
      ],
      columns: [
        { label: 'Tanggal', render: (r) => Util.formatDate(r.date) },
        { label: 'Kategori', render: (r) => UI.badge(r.category, CATEGORY_BADGE[r.category]) },
        { label: 'Deskripsi', render: (r) => Util.escape(r.description) },
        { label: 'Dicatat Oleh', render: (r) => { const u = Store.list('users').find(u => u.id === r.user_id); return u ? Util.escape(u.name) : '-'; } },
        { label: 'Jumlah', render: (r) => `<span class="mono cell-title">${Util.formatCurrency(r.amount)}</span>` },
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Pengeluaran', message: 'Hapus catatan pengeluaran ini?', danger: true });
          if (ok) { Store.remove('expenses', row.id); UI.toast('Pengeluaran dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Pengeluaran', 'Pengeluaran', rows.map(r => ({ Tanggal: r.date, Kategori: r.category, Deskripsi: r.description, Jumlah: r.amount }))),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const rows = Store.list('expenses');
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const thisMonth = rows.filter(r => r.date.slice(0, 7) === Util.todayISO().slice(0, 7)).reduce((s, r) => s + r.amount, 0);
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="wallet"></i></div><div class="stat-value">${Util.formatCurrency(total)}</div><div class="stat-label">Total Pengeluaran</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-orange"><i data-lucide="calendar"></i></div><div class="stat-value">${Util.formatCurrency(thisMonth)}</div><div class="stat-label">Pengeluaran Bulan Ini</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="list"></i></div><div class="stat-value">${rows.length}</div><div class="stat-label">Jumlah Catatan</div></div>
      </div>
      <div class="mt-16" id="pengeluaran-table-root"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('pengeluaran-table-root'));
    UI.icons();
  }

  Modules.pengeluaran = {
    title: 'Pengeluaran',
    subtitle: 'Catat dan pantau biaya operasional cafe & resto',
    render,
  };
})();
