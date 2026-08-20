/* =========================================================================
   modules/ulasan.js — Ulasan & Rating Pelanggan (Fitur CRUD tambahan #5)
   Feedback pelanggan atas menu/produk (rating bintang 1-5 + komentar),
   dengan fitur balasan admin dan status tayang/sembunyikan.
   ========================================================================= */
(function () {
  let table = null;

  function stars(n) {
    return `<span style="color:#f5a623;letter-spacing:1px;">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
  }

  function productOptions(selectedId) {
    return Store.list('products').map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${Util.escape(p.name)}</option>`).join('');
  }

  function form(existing) {
    const r = existing || { customer_name: '', product_id: '', rating: 5, comment: '', status: 'published' };
    return `
      <form id="rev-form" class="form-grid">
        <div class="field span-2"><label>Nama Pelanggan *</label><input class="input" name="customer_name" required value="${Util.escape(r.customer_name)}" /></div>
        <div class="field span-2"><label>Produk *</label><select class="input" name="product_id" required>${productOptions(r.product_id)}</select></div>
        <div class="field"><label>Rating *</label>
          <select class="input" name="rating">
            ${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${r.rating == n ? 'selected' : ''}>${n} Bintang</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select class="input" name="status">
            <option value="published" ${r.status === 'published' ? 'selected' : ''}>Tayang</option>
            <option value="hidden" ${r.status === 'hidden' ? 'selected' : ''}>Disembunyikan</option>
          </select>
        </div>
        <div class="field span-2"><label>Komentar</label><textarea class="input" name="comment" rows="3">${Util.escape(r.comment || '')}</textarea></div>
      </form>`;
  }

  function openModal(existing) {
    const { close } = UI.openModal({
      title: existing ? 'Edit Ulasan' : 'Tambah Ulasan', size: 'md',
      body: form(existing),
      footer: `<button class="btn btn-gray" id="rev-cancel">Batal</button><button class="btn btn-primary" id="rev-save">Simpan</button>`,
    });
    document.getElementById('rev-cancel').addEventListener('click', close);
    document.getElementById('rev-save').addEventListener('click', () => {
      const f = document.getElementById('rev-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.rating = Number(data.rating);
      if (existing) { Store.update('reviews', existing.id, data); UI.toast('Ulasan diperbarui.', 'success'); }
      else { data.reply = ''; data.created_at = new Date().toISOString(); Store.create('reviews', data, 'rev'); UI.toast('Ulasan ditambahkan.', 'success'); }
      close(); table.refresh();
    });
  }

  function openReplyModal(existing) {
    const { close } = UI.openModal({
      title: 'Balas Ulasan', size: 'sm',
      body: `
        <p class="confirm-text" style="margin-bottom:10px;">${stars(existing.rating)}<br>"${Util.escape(existing.comment)}"</p>
        <div class="field"><label>Balasan Admin</label><textarea class="input" id="reply-text" rows="3">${Util.escape(existing.reply || '')}</textarea></div>
      `,
      footer: `<button class="btn btn-gray" id="rp-cancel">Batal</button><button class="btn btn-primary" id="rp-save">Kirim Balasan</button>`,
    });
    document.getElementById('rp-cancel').addEventListener('click', close);
    document.getElementById('rp-save').addEventListener('click', () => {
      const reply = document.getElementById('reply-text').value.trim();
      Store.update('reviews', existing.id, { reply });
      UI.toast('Balasan tersimpan.', 'success');
      close(); table.refresh();
    });
  }

  function buildTable() {
    return createCrudTable({
      searchPlaceholder: 'Cari nama pelanggan atau komentar...',
      addLabel: 'Tambah Ulasan',
      emptyIcon: 'star', emptyTitle: 'Belum ada ulasan',
      perPage: 8,
      getData: () => Store.list('reviews').slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
      searchFn: (row, q) => row.customer_name.toLowerCase().includes(q) || (row.comment || '').toLowerCase().includes(q),
      filters: [
        { key: 'rating', label: 'Semua Rating', options: [5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} Bintang` })), filterFn: (r, v) => String(r.rating) === v },
      ],
      columns: [
        { label: 'Pelanggan', render: (r) => `<div class="cell-title">${Util.escape(r.customer_name)}</div>` },
        { label: 'Produk', render: (r) => { const p = Store.get('products', r.product_id); return p ? Util.escape(p.name) : '-'; } },
        { label: 'Rating', render: (r) => stars(r.rating) },
        { label: 'Komentar', render: (r) => `<div style="max-width:260px;white-space:normal;">${Util.escape(r.comment || '-')}</div>${r.reply ? `<div class="cell-sub" style="margin-top:4px;">↳ Admin: ${Util.escape(r.reply)}</div>` : ''}` },
        { label: 'Status', render: (r) => r.status === 'published' ? UI.badge('Tayang', 'badge-success') : UI.badge('Disembunyikan', 'badge-gray') },
      ],
      rowActions: (row) => [
        { icon: 'reply', title: 'Balas', cls: 'btn-blue', onClick: () => openReplyModal(row) },
        { icon: 'pencil', title: 'Edit', cls: 'btn-gray', onClick: () => openModal(row) },
        { icon: 'trash-2', title: 'Hapus', cls: 'btn-danger', onClick: async () => {
          const ok = await UI.confirm({ title: 'Hapus Ulasan', message: 'Hapus ulasan ini?', danger: true });
          if (ok) { Store.remove('reviews', row.id); UI.toast('Ulasan dihapus.', 'success'); table.refresh(); }
        }},
      ],
      exportHandlers: {
        excel: (rows) => UI.exportExcel('Data-Ulasan', 'Ulasan', rows.map(r => { const p = Store.get('products', r.product_id); return { Pelanggan: r.customer_name, Produk: p ? p.name : '-', Rating: r.rating, Komentar: r.comment, Balasan: r.reply, Status: r.status }; })),
      },
      onAdd: () => openModal(null),
    });
  }

  function render(container) {
    const reviews = Store.list('reviews');
    const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
    container.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="stat-icon icon-bg-warning"><i data-lucide="star"></i></div><div class="stat-value">${avg} / 5</div><div class="stat-label">Rata-rata Rating</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-info"><i data-lucide="message-square"></i></div><div class="stat-value">${reviews.length}</div><div class="stat-label">Total Ulasan</div></div>
        <div class="card stat-card"><div class="stat-icon icon-bg-danger"><i data-lucide="triangle-alert"></i></div><div class="stat-value">${reviews.filter(r => r.rating <= 2).length}</div><div class="stat-label">Rating Rendah (≤2)</div></div>
      </div>
      <div id="rev-table-root" class="mt-16"></div>
    `;
    table = buildTable();
    table.mount(document.getElementById('rev-table-root'));
  }

  Modules.ulasan = {
    title: 'Ulasan & Rating',
    subtitle: 'Feedback pelanggan atas menu dan pelayanan',
    render,
  };
})();
