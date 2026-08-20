/* =========================================================================
   modules/user.js — User Management (FR + Role Permission)
   ========================================================================= */
(function () {
  let table = null;

  function form(existing) {
    const employees = Store.list('employees');
    const u = existing || { username: '', password: '', name: '', email: '', role: 'staff', status: 'active', employee_id: '' };
    return `
      <form id="user-form" class="form-grid">
        <div class="field span-2"><label>Nama Lengkap *</label><input class="input" name="name" required value="${Util.escape(u.name)}" /></div>
        <div class="field"><label>Username *</label><input class="input" name="username" required value="${Util.escape(u.username)}" /></div>
        <div class="field"><label>Password ${existing ? '(kosongkan jika tidak diubah)' : '*'}</label><input class="input" type="text" name="password" ${existing ? '' : 'required'} placeholder="${existing ? '••••••••' : ''}" /></div>
        <div class="field span-2"><label>Email</label><input class="input" type="email" name="email" value="${Util.escape(u.email || '')}" /></div>
        <div class="field"><label>Role *</label>
          <select class="input" name="role" required>
            <option value="administrator" ${u.role === 'administrator' ? 'selected' : ''}>Administrator</option>
            <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
            <option value="kasir" ${u.role === 'kasir' ? 'selected' : ''}>Kasir</option>
            <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
          </select>
        </div>
        <div class="field"><label>Tautkan ke Karyawan</label>
          <select class="input" name="employee_id">
            <option value="">Tidak ditautkan</option>
            ${employees.map(e => `<option value="${e.id}" ${u.employee_id === e.id ? 'selected' : ''}>${Util.escape(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field span-2"><label>Status</label>
          <select class="input" name="status">
            <option value="active" ${u.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="pending" ${u.status === 'pending' ? 'selected' : ''}>Menunggu Persetujuan</option>
            <option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit User' : 'Tambah User', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="uf-cancel">Batal</button><button class="btn btn-primary" id="uf-save">Simpan</button>`,
    });
    document.getElementById('uf-cancel').addEventListener('click', close);
    document.getElementById('uf-save').addEventListener('click', () => {
      const f = document.getElementById('user-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      const dup = Store.list('users').find(u => u.username.toLowerCase() === data.username.toLowerCase() && (!existing || u.id !== existing.id));
      if (dup) { UI.toast('Username sudah digunakan.', 'danger'); return; }
      if (existing) {
        if (!data.password) delete data.password;
        Store.update('users', existing.id, data);
        UI.toast('User berhasil diperbarui.', 'success');
      } else {
        data.created_at = Util.todayISO();
        Store.create('users', data, 'usr');
        UI.toast('User baru berhasil dibuat.', 'success');
      }
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama atau username...',
      addLabel: 'Tambah User',
      emptyIcon: 'user-cog', emptyTitle: 'Belum ada user',
      perPage: 8,
      getData: () => Store.list('users'),
      searchFn: (row, q) => row.name.toLowerCase().includes(q) || row.username.toLowerCase().includes(q),
      filters: [
        { key: 'role', label: 'Semua Role', options: Object.entries(ROLE_LABEL).map(([v, l]) => ({ value: v, label: l })), filterFn: (r, v) => r.role === v },
        { key: 'status', label: 'Semua Status', options: [{ value: 'active', label: 'Aktif' }, { value: 'pending', label: 'Menunggu Persetujuan' }, { value: 'inactive', label: 'Nonaktif' }], filterFn: (r, v) => r.status === v },
      ],
      columns: [
        { label: 'User', render: (r) => `<div class="cell-title">${Util.escape(r.name)}</div><div class="cell-sub mono">@${Util.escape(r.username)}</div>` },
        { label: 'Email', render: (r) => Util.escape(r.email || '-') },
        { label: 'Role', render: (r) => UI.badge(ROLE_LABEL[r.role] || r.role, ROLE_BADGE_CLASS[r.role]) },
        { label: 'Status', render: (r) => UI.statusBadge(r.status) },
      ],
      rowActions: (row) => [
        ...(row.status === 'pending' ? [
          { icon: 'check', title: 'Setujui Akun', cls: 'btn-green', onClick: async () => {
            const ok = await UI.confirm({ title: 'Setujui Akun', message: `Setujui pendaftaran "${row.name}" sebagai ${ROLE_LABEL[row.role] || row.role}?` });
            if (ok) { Store.update('users', row.id, { status: 'active' }); UI.toast('Akun disetujui & sudah bisa login.', 'success'); table.refresh(); }
          }},
          { icon: 'x', title: 'Tolak Akun', cls: 'btn-danger', onClick: async () => {
            const ok = await UI.confirm({ title: 'Tolak Pendaftaran', message: `Tolak & hapus pendaftaran "${row.name}"?`, danger: true });
            if (ok) { Store.remove('users', row.id); UI.toast('Pendaftaran ditolak & dihapus.', 'success'); table.refresh(); }
          }},
        ] : []),
        { icon: 'pencil', title: 'Edit', cls: 'btn-blue', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          if (row.id === App.user.id) { UI.toast('Anda tidak dapat menghapus akun sendiri.', 'warning'); return; }
          const ok = await UI.confirm({ title: 'Hapus User', message: `Hapus akun "${row.name}"?`, danger: true });
          if (ok) { Store.remove('users', row.id); UI.toast('User dihapus.', 'success'); table.refresh(); }
        }},
      ],
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const pendingCount = Store.list('users').filter(u => u.status === 'pending').length;
    container.innerHTML = `
      ${pendingCount > 0 ? `
      <div class="card" style="margin-bottom:16px;border:1.5px solid var(--c-warning);background:var(--c-warning-bg);">
        <div class="flex items-center gap-8" style="display:flex;align-items:center;gap:10px;">
          <i data-lucide="user-round-plus" style="color:var(--c-warning);flex-shrink:0;"></i>
          <span style="font-size:13.5px;color:var(--c-text);">
            <strong>${pendingCount} pendaftaran baru</strong> sedang menunggu persetujuan Anda.
          </span>
        </div>
      </div>` : ''}
      <div class="card" style="margin-bottom:16px;">
        <div class="section-title">Hak Akses per Role</div>
        <div class="grid grid-4">
          ${Object.entries(ROLE_LABEL).map(([role, label]) => `
            <div class="card" style="box-shadow:none;">
              <div class="flex items-center gap-8" style="margin-bottom:8px;">${UI.badge(label, ROLE_BADGE_CLASS[role])}</div>
              <p class="cell-sub" style="line-height:1.6;">${ROLE_ACCESS[role].modules.length} fitur dapat diakses${ROLE_ACCESS[role].readonly.length ? `, ${ROLE_ACCESS[role].readonly.length} di antaranya hanya lihat` : ''}.</p>
            </div>`).join('')}
        </div>
      </div>
      <div id="user-table-root"></div>
    `;
    UI.icons();
    table = buildTable();
    table.mount(document.getElementById('user-table-root'));
  }

  Modules.user = {
    title: 'User Management',
    subtitle: 'Kelola akun pengguna sistem dan hak akses role',
    render,
  };
})();
