/* =========================================================================
   modules/anggaran.js — Anggaran / Budget Pengeluaran (Fitur CRUD tambahan #8)
   Menetapkan rencana anggaran per kategori pengeluaran per bulan, lalu
   dibandingkan otomatis dengan realisasi (data dari modul Pengeluaran).
   ========================================================================= */
(function () {
  let table = null;
  const CATEGORIES = ['Bahan Baku', 'Gaji Karyawan', 'Sewa Tempat', 'Listrik & Air', 'Marketing', 'Perawatan Alat', 'Lainnya'];

  function form(existing) {
    const b = existing || { category: CATEGORIES[0], period: Util.todayISO().slice(0, 7), planned_amount: 0 };
    return `
      <form id="bud-form" class="form-grid">
        <div class="field span-2"><label>Kategori *</label><select class="input" name="category" required>${CATEGORIES.map(c => `<option value="${c}" ${b.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Periode (Bulan) *</label><input class="input" type="month" name="period" required value="${b.period}" /></div>
        <div class="field"><label>Anggaran Direncanakan (Rp) *</label><input class="input" type="number" min="0" name="planned_amount" required value="${b.planned_amount}" /></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Anggaran' : 'Tambah Anggaran', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="bud-cancel">Batal</button><button class="btn btn-primary" id="bud-save">Simpan</button>`,
    });
    document.getElementById('bud-cancel').addEventListener('click', close);
    document.getElementById('bud-save').addEventListener('click', () => {
      const f = document.getElementById('bud-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.planned_amount = Number(data.planned_amount);
      if (existing) { Store.update('budgets', existing.id, data); UI.toast('Anggaran diperbarui.', 'success'); }
      else {
        const dup = Store.list('budgets').find(x => x.category === data.category && x.period === data.period);
        if (dup) { UI.toast('Anggaran kategori & periode ini sudah ada.', 'danger'); return; }
        Store.create('budgets', data, 'bud');
        UI.toast('Anggaran ditambahkan.', 'success');
      }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari kategori anggaran...',
      addLabel: 'Tambah Anggaran',
      emptyIcon: 'wallet-cards', emptyTitle: 'Belum ada anggaran',
      perPage: 8,
      getData: () => Store.list('budgets').slice().sort((a, b) => b.period.localeCompare(a.period)),
      searchFn: (row, q) => row.category.toLowerCase().includes(q),
      filters: [
        { key: 'category', label: 'Semua Kategori', options: CATEGORIES.map(c => ({ value: c, label: c })), filterFn: (r, v) => r.category === v },
      ],
      columns: [
        { label: 'Kategori', render: (r) => `<div class="cell-title">${Util.escape(r.category)}</div>` },
        { label: 'Periode', render: (r) => r.period },
        { label: 'Anggaran', render: (r) => `<span class="mono">${Util.formatCurrency(r.planned_amount)}</span>` },
        { label: 'Realisasi', render: (r) => { const spent = Store.budgetRealization(r.category, r.period); return `<span class="mono">${Util.formatCurrency(spent)}</span>`; } },
        { label: 'Sisa / Status', render: (r) => {
          const spent = Store.budgetRealization(r.category, r.period);
          const remaining = r.planned_amount - spent;
          const pct = r.planned_amount > 0 ? Math.round((spent / r.planned_amount) * 100) : 0;
          const cls = pct >= 100 ? 'badge-danger' : pct >= 80 ? 'badge-warning' : 'badge-success';
          return `${UI.badge(pct + '% terpakai', cls)}<div class="cell-sub mono">Sisa ${Util.formatCurrency(remaining)}</div>`;
        }},
      ],
      rowActions: (row) => [
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Anggaran', message: `Hapus anggaran "${row.category}" periode ${row.period}?`, danger: true });
          if (ok) { Store.remove('budgets', row.id); UI.toast('Anggaran dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Anggaran', 'Anggaran', rows.map(r => { const spent = Store.budgetRealization(r.category, r.period); return { Kategori: r.category, Periode: r.period, Anggaran: r.planned_amount, Realisasi: spent, Sisa: r.planned_amount - spent }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="bud-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('bud-table-root'));
  }

  Modules.anggaran = {
    title: 'Anggaran / Budget',
    subtitle: 'Rencana anggaran per kategori pengeluaran dan realisasinya',
    render,
  };
})();
