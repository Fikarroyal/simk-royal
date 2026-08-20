/* =========================================================================
   modules/insentif.js — Insentif & Bonus Kinerja Karyawan (Fitur CRUD tambahan #17)
   Berbeda dari Penggajian (gaji rutin bulanan): modul ini khusus mencatat
   bonus/insentif berbasis pencapaian target kinerja per periode.
   ========================================================================= */
(function () {
  let table = null;

  function employeeOptions(selectedId) {
    return Store.list('employees').filter(e => e.status === 'active').map(e => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${Util.escape(e.name)} (${Util.escape(e.position)})</option>`).join('');
  }

  function form(existing) {
    const i = existing || { employee_id: '', period: Util.todayISO().slice(0, 7), target_description: '', achievement: '', bonus_amount: 0, status: 'pending' };
    return `
      <form id="inc-form" class="form-grid">
        <div class="field span-2"><label>Karyawan *</label><select class="input" name="employee_id" required>${employeeOptions(i.employee_id)}</select></div>
        <div class="field"><label>Periode (Bulan) *</label><input class="input" type="month" name="period" required value="${i.period}" /></div>
        <div class="field"><label>Bonus (Rp) *</label><input class="input" type="number" min="0" name="bonus_amount" required value="${i.bonus_amount}" /></div>
        <div class="field span-2"><label>Target Kinerja *</label><input class="input" name="target_description" required value="${Util.escape(i.target_description)}" /></div>
        <div class="field span-2"><label>Pencapaian *</label><input class="input" name="achievement" required value="${Util.escape(i.achievement)}" /></div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="pending" ${i.status === 'pending' ? 'selected' : ''}>Belum Dibayar</option>
            <option value="paid" ${i.status === 'paid' ? 'selected' : ''}>Sudah Dibayar</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Insentif' : 'Tambah Insentif', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="inc-cancel">Batal</button><button class="btn btn-primary" id="inc-save">Simpan</button>`,
    });
    document.getElementById('inc-cancel').addEventListener('click', close);
    document.getElementById('inc-save').addEventListener('click', () => {
      const f = document.getElementById('inc-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.bonus_amount = Number(data.bonus_amount);
      if (existing) { Store.update('incentives', existing.id, data); UI.toast('Insentif diperbarui.', 'success'); }
      else { Store.create('incentives', data, 'inc'); UI.toast('Insentif ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama karyawan...',
      addLabel: 'Tambah Insentif',
      emptyIcon: 'trophy', emptyTitle: 'Belum ada data insentif',
      perPage: 8,
      getData: () => Store.list('incentives').slice().sort((a, b) => b.period.localeCompare(a.period)),
      searchFn: (row, q) => { const e = Store.get('employees', row.employee_id); return e ? e.name.toLowerCase().includes(q) : false; },
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'paid', label: 'Sudah Dibayar' }, { value: 'pending', label: 'Belum Dibayar' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Karyawan', render: (r) => { const e = Store.get('employees', r.employee_id); return `<div class="cell-title">${e ? Util.escape(e.name) : '-'}</div><div class="cell-sub">${e ? Util.escape(e.position) : ''}</div>`; } },
        { label: 'Periode', render: (r) => r.period },
        { label: 'Target & Pencapaian', render: (r) => `<div style="max-width:260px;white-space:normal;">${Util.escape(r.target_description)}</div><div class="cell-sub">${Util.escape(r.achievement)}</div>` },
        { label: 'Bonus', render: (r) => `<span class="mono">${Util.formatCurrency(r.bonus_amount)}</span>` },
        { label: 'Status', render: (r) => r.status === 'paid' ? UI.badge('Dibayar', 'badge-success') : UI.badge('Belum Dibayar', 'badge-warning') },
      ],
      rowActions: (row) => [
        ...(row.status !== 'paid' ? [{ icon: 'circle-check', title: 'Tandai Dibayar', cls: 'btn-green', onClick: () => { Store.update('incentives', row.id, { status: 'paid' }); UI.toast('Insentif ditandai sudah dibayar.', 'success'); table.refresh(); } }] : []),
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Insentif', message: 'Hapus data insentif ini?', danger: true });
          if (ok) { Store.remove('incentives', row.id); UI.toast('Insentif dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Insentif', 'Insentif', rows.map(r => { const e = Store.get('employees', r.employee_id); return { Karyawan: e ? e.name : '-', Periode: r.period, Target: r.target_description, Pencapaian: r.achievement, Bonus: r.bonus_amount, Status: r.status }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="inc-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('inc-table-root'));
  }

  Modules.insentif = {
    title: 'Insentif & Bonus Karyawan',
    subtitle: 'Bonus kinerja karyawan berdasarkan pencapaian target',
    render,
  };
})();
