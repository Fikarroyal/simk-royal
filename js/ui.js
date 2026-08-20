/* =========================================================================
   ui.js
   Komponen antarmuka yang dipakai ulang di semua modul: toast, modal,
   dialog konfirmasi, pagination, badge, empty state, dan export data.
   ========================================================================= */

const UI = {
  /* ---------------------------- Icon refresh ---------------------------- */
  icons() {
    if (window.lucide) window.lucide.createIcons();
  },

  /* --------------------------------- Toast -------------------------------- */
  toast(message, type = 'success', duration = 3200) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const iconMap = { success: 'circle-check', danger: 'circle-x', warning: 'triangle-alert', info: 'info' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}"></i>
      <span>${Util.escape(message)}</span>
      <button class="toast-close" aria-label="Tutup"><i data-lucide="x"></i></button>
    `;
    root.appendChild(el);
    this.icons();
    requestAnimationFrame(() => el.classList.add('show'));
    const remove = () => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, duration);
  },

  /* --------------------------------- Modal -------------------------------- */
  openModal({ title, body, footer = '', size = 'md', onClose } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-box modal-${size}" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3>${Util.escape(title || '')}</h3>
            <button class="icon-btn modal-close" aria-label="Tutup"><i data-lucide="x"></i></button>
          </div>
          <div class="modal-body">${body || ''}</div>
          ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
        </div>
      </div>`;
    this.icons();
    const overlay = root.querySelector('.modal-overlay');
    requestAnimationFrame(() => overlay.classList.add('show'));
    const close = () => {
      overlay.classList.remove('show');
      setTimeout(() => { root.innerHTML = ''; if (onClose) onClose(); }, 180);
    };
    root.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
    });
    return { close, root };
  },

  closeModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
  },

  confirm({ title = 'Konfirmasi', message = 'Anda yakin?', confirmText = 'Ya, Lanjutkan', cancelText = 'Batal', danger = false } = {}) {
    return new Promise((resolve) => {
      const { close } = this.openModal({
        title,
        size: 'sm',
        body: `<p class="confirm-text">${Util.escape(message)}</p>`,
        footer: `
          <button class="btn btn-gray" id="btn-cancel-confirm">${Util.escape(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="btn-ok-confirm">${Util.escape(confirmText)}</button>
        `,
        onClose: () => resolve(false),
      });
      document.getElementById('btn-ok-confirm').addEventListener('click', () => { resolve(true); close(); });
      document.getElementById('btn-cancel-confirm').addEventListener('click', () => { resolve(false); close(); });
    });
  },

  /* --------------------------- Otorisasi Manager --------------------------- */
  // Minta persetujuan Manager/Administrator (username + password) untuk tindakan sensitif,
  // tanpa mengubah sesi login kasir yang sedang aktif.
  requestManagerOverride({ reason = 'Tindakan ini memerlukan persetujuan Manager/Administrator.' } = {}) {
    return new Promise((resolve) => {
      const { close } = this.openModal({
        title: 'Otorisasi Diperlukan',
        size: 'sm',
        body: `
          <p class="confirm-text" style="margin-bottom:14px;">${Util.escape(reason)}</p>
          <div class="field"><label>Username Manager/Admin *</label><input class="input" id="ov-username" autocomplete="off" /></div>
          <div class="field"><label>Password *</label><input class="input" type="password" id="ov-password" /></div>
          <p class="form-error" id="ov-error" style="display:none;"></p>
        `,
        footer: `
          <button class="btn btn-gray" id="ov-cancel">Batal</button>
          <button class="btn btn-primary" id="ov-confirm"><i data-lucide="shield-check"></i> Otorisasi</button>
        `,
        onClose: () => resolve(null),
      });
      this.icons();
      document.getElementById('ov-cancel').addEventListener('click', () => { resolve(null); close(); });
      document.getElementById('ov-confirm').addEventListener('click', () => {
        const username = document.getElementById('ov-username').value.trim();
        const password = document.getElementById('ov-password').value;
        const result = Auth.verifyOverride(username, password);
        const errEl = document.getElementById('ov-error');
        if (!result.ok) {
          errEl.textContent = result.message;
          errEl.style.display = 'block';
          return;
        }
        resolve(result.user);
        close();
      });
    });
  },

  /* --------------------------------- Badge -------------------------------- */
  badge(text, cls = 'badge-gray') {
    return `<span class="badge ${cls}">${Util.escape(text)}</span>`;
  },

  statusBadge(status) {
    const map = {
      active: ['Aktif', 'badge-success'], inactive: ['Nonaktif', 'badge-gray'],
      available: ['Tersedia', 'badge-success'], occupied: ['Terisi', 'badge-danger'], reserved: ['Dipesan', 'badge-warning'],
      paid: ['Lunas', 'badge-success'], pending: ['Pending', 'badge-warning'], void: ['Dibatalkan', 'badge-danger'],
      received: ['Diterima', 'badge-success'], ordered: ['Dipesan', 'badge-warning'],
      present: ['Hadir', 'badge-success'], late: ['Terlambat', 'badge-warning'], absent: ['Tidak Hadir', 'badge-danger'],
    };
    const [label, cls] = map[status] || [status, 'badge-gray'];
    return this.badge(label, cls);
  },

  /* ------------------------------ Empty state ------------------------------ */
  emptyState(icon = 'inbox', title = 'Belum ada data', desc = '') {
    return `
      <div class="empty-state">
        <i data-lucide="${icon}"></i>
        <h4>${Util.escape(title)}</h4>
        ${desc ? `<p>${Util.escape(desc)}</p>` : ''}
      </div>`;
  },

  skeletonRows(cols = 5, rows = 5) {
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr>' + Array.from({ length: cols }).map(() => '<td><div class="skeleton-line"></div></td>').join('') + '</tr>';
    }
    return html;
  },

  /* ------------------------------- Pagination ------------------------------ */
  paginate(arr, page, perPage) {
    const total = arr.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const p = Util.clamp(page, 1, totalPages);
    const start = (p - 1) * perPage;
    return { items: arr.slice(start, start + perPage), page: p, totalPages, total };
  },

  paginationHTML(page, totalPages, total, perPage) {
    if (totalPages <= 1) return `<div class="pagination-info">Menampilkan ${total} data</div>`;
    let buttons = '';
    const maxBtns = 5;
    let startP = Math.max(1, page - 2);
    let endP = Math.min(totalPages, startP + maxBtns - 1);
    startP = Math.max(1, endP - maxBtns + 1);
    for (let i = startP; i <= endP; i++) {
      buttons += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    return `
      <div class="pagination-info">Halaman ${page} dari ${totalPages} &middot; ${total} data</div>
      <div class="pagination-controls">
        <button class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}><i data-lucide="chevron-left"></i></button>
        ${buttons}
        <button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}><i data-lucide="chevron-right"></i></button>
      </div>`;
  },

  bindPagination(container, onChange) {
    container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        onChange(Number(btn.dataset.page));
      });
    });
  },

  /* --------------------------------- Export -------------------------------- */
  exportExcel(filename, sheetName, rows) {
    if (!window.XLSX) { this.toast('Pustaka Excel belum siap, coba lagi.', 'warning'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${filename}.xlsx`);
    this.toast('Data berhasil diekspor ke Excel.', 'success');
  },

  exportPDFTable({ filename, title, head, body, meta = [] }) {
    if (!window.jspdf) { this.toast('Pustaka PDF belum siap, coba lagi.', 'warning'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: head[0].length > 6 ? 'landscape' : 'portrait' });
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    doc.setFontSize(9);
    meta.forEach((line, i) => doc.text(line, 14, 23 + i * 5));
    doc.autoTable({
      head, body,
      startY: 23 + meta.length * 5 + 3,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [17, 17, 17] },
      theme: 'grid',
    });
    doc.save(`${filename}.pdf`);
    this.toast('Laporan PDF berhasil dibuat.', 'success');
  },

  printSection(innerHTML, title = 'Cetak') {
    const win = window.open('', '_blank', 'width=420,height=650');
    win.document.write(`
      <!doctype html><html><head><title>${Util.escape(title)}</title>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Space Mono', monospace; padding: 16px; color: #111; font-size: 12px; }
        .receipt-line { border-top: 1px dashed #111; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .text-right { text-align: right; }
        .center { text-align: center; }
        h2, h3 { margin: 4px 0; }
      </style></head><body onload="window.print();">${innerHTML}</body></html>
    `);
    win.document.close();
  },

  /* ------------------------------ Form helpers ------------------------------ */
  serializeForm(form) {
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    return data;
  },

  validateRequired(form) {
    const invalid = [];
    form.querySelectorAll('[required]').forEach(el => {
      if (!String(el.value).trim()) invalid.push(el);
    });
    invalid.forEach(el => el.classList.add('input-error'));
    if (invalid.length && invalid[0].focus) invalid[0].focus();
    return invalid.length === 0;
  },
};

/* =========================================================================
   CrudTable — komponen tabel generik (search, filter, pagination, aksi baris,
   export) dipakai oleh modul Produk, Meja, Pelanggan, Karyawan, Supplier,
   Promo, Pengeluaran, User, dsb agar konsisten & tidak duplikasi kode.

   config = {
     getData(): array data terbaru dari Store (dipanggil tiap render)
     searchFn(row, query): boolean
     filters: [{ key, label, options:[{value,label}], filterFn(row, val) }]
     columns: [{ label, render(row) }]
     rowActions(row): [{ icon, title, cls, onClick(row, api) }]
     onAdd(api): function saat tombol tambah diklik
     addLabel: string
     exportHandlers: { excel(rows), pdf(rows) }
     emptyIcon/emptyTitle/emptyDesc
     perPage: number
   }
   ========================================================================= */
function createCrudTable(config) {
  const state = { search: '', filters: {}, page: 1 };
  const perPage = config.perPage || 8;
  let containerEl = null;

  function getFiltered() {
    let rows = config.getData();
    if (state.search && config.searchFn) {
      const q = state.search.toLowerCase();
      rows = rows.filter(r => config.searchFn(r, q));
    }
    (config.filters || []).forEach(f => {
      const val = state.filters[f.key];
      if (val) rows = rows.filter(r => f.filterFn(r, val));
    });
    return rows;
  }

  function renderInner() {
    if (!containerEl) return;
    const all = getFiltered();
    const { items, page, totalPages, total } = UI.paginate(all, state.page, perPage);
    const hasActions = typeof config.rowActions === 'function';

    containerEl.innerHTML = `
      <div class="table-card">
        <div class="table-toolbar">
          <div class="table-search">
            <i data-lucide="search"></i>
            <input class="input" id="ct-search" placeholder="${Util.escape(config.searchPlaceholder || 'Cari data...')}" value="${Util.escape(state.search)}" />
          </div>
          <div class="table-filters">
            ${(config.filters || []).map(f => `
              <select class="input" data-filter-key="${f.key}">
                <option value="">${Util.escape(f.label)}</option>
                ${f.options.map(o => `<option value="${Util.escape(o.value)}" ${state.filters[f.key] === o.value ? 'selected' : ''}>${Util.escape(o.label)}</option>`).join('')}
              </select>`).join('')}
            ${config.exportHandlers && config.exportHandlers.excel ? `<button class="btn btn-outline btn-sm" id="ct-export-excel"><i data-lucide="file-spreadsheet"></i> Excel</button>` : ''}
            ${config.exportHandlers && config.exportHandlers.pdf ? `<button class="btn btn-outline btn-sm" id="ct-export-pdf"><i data-lucide="file-text"></i> PDF</button>` : ''}
            ${config.onAdd ? `<button class="btn btn-primary btn-sm" id="ct-add"><i data-lucide="plus"></i> ${Util.escape(config.addLabel || 'Tambah')}</button>` : ''}
          </div>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr>${config.columns.map(c => `<th>${Util.escape(c.label)}</th>`).join('')}${hasActions ? '<th></th>' : ''}</tr></thead>
            <tbody>
              ${items.length ? items.map(row => `
                <tr>
                  ${config.columns.map(c => `<td>${c.render(row)}</td>`).join('')}
                  ${hasActions ? `<td class="cell-actions">${config.rowActions(row).map((a, ai) => `<button type="button" class="btn btn-sm ${a.cls || 'btn-gray'} btn-icon-only" data-row="${row.id}" data-action="${ai}" title="${Util.escape(a.title || '')}"><i data-lucide="${a.icon}"></i></button>`).join('')}</td>` : ''}
                </tr>`).join('') : `<tr><td colspan="${config.columns.length + (hasActions ? 1 : 0)}">${UI.emptyState(config.emptyIcon || 'inbox', config.emptyTitle || 'Belum ada data', config.emptyDesc || '')}</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="table-footer">${UI.paginationHTML(page, totalPages, total, perPage)}</div>
      </div>
    `;

    const searchInput = containerEl.querySelector('#ct-search');
    searchInput.addEventListener('input', Util.debounce((e) => { state.search = e.target.value; state.page = 1; renderInner(); }, 250));
    containerEl.querySelectorAll('[data-filter-key]').forEach(sel => {
      sel.addEventListener('change', () => { state.filters[sel.dataset.filterKey] = sel.value; state.page = 1; renderInner(); });
    });
    if (config.onAdd) containerEl.querySelector('#ct-add').addEventListener('click', () => config.onAdd(api));
    if (config.exportHandlers && config.exportHandlers.excel) {
      containerEl.querySelector('#ct-export-excel').addEventListener('click', () => config.exportHandlers.excel(getFiltered()));
    }
    if (config.exportHandlers && config.exportHandlers.pdf) {
      containerEl.querySelector('#ct-export-pdf').addEventListener('click', () => config.exportHandlers.pdf(getFiltered()));
    }
    UI.bindPagination(containerEl.querySelector('.table-footer'), (p) => { state.page = p; renderInner(); });

    if (hasActions) {
      items.forEach(row => {
        const actions = config.rowActions(row);
        containerEl.querySelectorAll(`[data-row="${row.id}"]`).forEach(btn => {
          const idx = Number(btn.dataset.action);
          btn.addEventListener('click', () => actions[idx].onClick(row, api));
        });
      });
    }
    UI.icons();
  }

  const api = {
    mount(container) { containerEl = container; renderInner(); },
    refresh() { renderInner(); },
    resetPage() { state.page = 1; renderInner(); },
  };
  return api;
}

/* Registry modul harus tersedia sebelum semua file js/modules/*.js dimuat,
   karena tiap modul langsung mendaftarkan dirinya (Modules.xxx = {...}) saat file dibaca. */
window.Modules = window.Modules || {};
