/* =========================================================================
   modules/penggajian.js — Penggajian Karyawan / Payroll (Fitur CRUD tambahan #4)
   Slip gaji per periode (bulan) per karyawan: gaji pokok, tunjangan, lembur,
   potongan, dan gaji bersih terhitung otomatis, dengan status dibayar/belum.
   ========================================================================= */
(function () {
  let table = null;

  function employeeOptions(selectedId) {
    return Store.list('employees').filter(e => e.status === 'active').map(e => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${Util.escape(e.name)} (${Util.escape(e.position)})</option>`).join('');
  }

  function form(existing) {
    const p = existing || { employee_id: '', period: Util.todayISO().slice(0, 7), base_salary: 0, allowance: 0, overtime: 0, deduction: 0, status: 'unpaid' };
    return `
      <form id="pay-form" class="form-grid">
        <div class="field span-2"><label>Karyawan *</label><select class="input" name="employee_id" required ${existing ? 'disabled' : ''}>${employeeOptions(p.employee_id)}</select></div>
        <div class="field"><label>Periode (Bulan) *</label><input class="input" type="month" name="period" required value="${p.period}" /></div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="unpaid" ${p.status === 'unpaid' ? 'selected' : ''}>Belum Dibayar</option>
            <option value="paid" ${p.status === 'paid' ? 'selected' : ''}>Sudah Dibayar</option>
          </select>
        </div>
        <div class="field"><label>Gaji Pokok (Rp) *</label><input class="input" type="number" min="0" name="base_salary" required value="${p.base_salary}" /></div>
        <div class="field"><label>Tunjangan (Rp)</label><input class="input" type="number" min="0" name="allowance" value="${p.allowance || 0}" /></div>
        <div class="field"><label>Lembur (Rp)</label><input class="input" type="number" min="0" name="overtime" value="${p.overtime || 0}" /></div>
        <div class="field"><label>Potongan (Rp)</label><input class="input" type="number" min="0" name="deduction" value="${p.deduction || 0}" /></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Slip Gaji' : 'Tambah Slip Gaji', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="pay-cancel">Batal</button><button class="btn btn-primary" id="pay-save">Simpan</button>`,
    });
    document.getElementById('pay-cancel').addEventListener('click', close);
    document.getElementById('pay-save').addEventListener('click', () => {
      const f = document.getElementById('pay-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      ['base_salary', 'allowance', 'overtime', 'deduction'].forEach(k => data[k] = Number(data[k]) || 0);
      data.net_salary = data.base_salary + data.allowance + data.overtime - data.deduction;
      if (data.status === 'paid') data.paid_at = new Date().toISOString(); else data.paid_at = null;
      if (existing) { Store.update('payroll', existing.id, data); UI.toast('Slip gaji diperbarui.', 'success'); }
      else {
        const dup = Store.list('payroll').find(x => x.employee_id === data.employee_id && x.period === data.period);
        if (dup) { UI.toast('Slip gaji karyawan ini untuk periode tersebut sudah ada.', 'danger'); return; }
        Store.create('payroll', data, 'pay');
        UI.toast('Slip gaji ditambahkan.', 'success');
      }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama karyawan...',
      addLabel: 'Tambah Slip Gaji',
      emptyIcon: 'banknote', emptyTitle: 'Belum ada data penggajian',
      perPage: 8,
      getData: () => Store.list('payroll').slice().sort((a, b) => b.period.localeCompare(a.period)),
      searchFn: (row, q) => { const e = Store.get('employees', row.employee_id); return e ? e.name.toLowerCase().includes(q) : false; },
      filters: [
        { key: 'status', label: 'Semua Status', options: [{ value: 'paid', label: 'Sudah Dibayar' }, { value: 'unpaid', label: 'Belum Dibayar' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'Karyawan', render: (r) => { const e = Store.get('employees', r.employee_id); return `<div class="cell-title">${e ? Util.escape(e.name) : '-'}</div><div class="cell-sub">${e ? Util.escape(e.position) : ''}</div>`; } },
        { label: 'Periode', render: (r) => r.period },
        { label: 'Gaji Bersih', render: (r) => `<span class="mono">${Util.formatCurrency(r.net_salary)}</span>` },
        { label: 'Status', render: (r) => r.status === 'paid' ? UI.badge('Dibayar', 'badge-success') : UI.badge('Belum Dibayar', 'badge-warning') },
      ],
      rowActions: (row) => [
        ...(row.status !== 'paid' ? [{ icon: 'circle-check', title: 'Tandai Dibayar', cls: 'btn-green', onClick: async () => {
          const ok = await UI.confirm({ title: 'Tandai Dibayar', message: 'Tandai slip gaji ini sebagai sudah dibayar?' });
          if (ok) { Store.update('payroll', row.id, { status: 'paid', paid_at: new Date().toISOString() }); UI.toast('Gaji ditandai sudah dibayar.', 'success'); table.refresh(); }
        }}] : []),
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Slip Gaji', message: 'Hapus slip gaji ini?', danger: true });
          if (ok) { Store.remove('payroll', row.id); UI.toast('Slip gaji dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Penggajian', 'Penggajian', rows.map(r => { const e = Store.get('employees', r.employee_id); return { Karyawan: e ? e.name : '-', Periode: r.period, GajiPokok: r.base_salary, Tunjangan: r.allowance, Lembur: r.overtime, Potongan: r.deduction, GajiBersih: r.net_salary, Status: r.status }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    container.innerHTML = `<div id="pay-table-root"></div>`;
    table = buildTable();
    table.mount(document.getElementById('pay-table-root'));
  }

  Modules.penggajian = {
    title: 'Penggajian Karyawan',
    subtitle: 'Kelola slip gaji bulanan: gaji pokok, tunjangan, lembur, dan potongan',
    render,
  };
})();
