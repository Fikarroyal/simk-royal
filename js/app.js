/* =========================================================================
   app.js
   Router hash-based + inisialisasi shell aplikasi (sidebar, topbar, session).
   Setiap modul mendaftarkan dirinya ke objek global `Modules`:
     Modules['dashboard'] = { title, subtitle, render(container) }
   ========================================================================= */

const App = {
  user: null,
  currentKey: 'dashboard',

  async init() {
    await Store.init();
    this.user = Auth.guardPage();
    if (!this.user) return;

    this.setupSidebarUser();
    this.setupSidebarFilter();
    this.setupSidebarToggle();
    this.setupClock();
    this.setupNotif();
    this.setupLogout();
    this.setupRefreshBtn();

    window.addEventListener('hashchange', () => this.render());
    this.render();
    UI.icons();
  },

  setupSidebarUser() {
    document.getElementById('user-name').textContent = this.user.name;
    document.getElementById('user-role').textContent = ROLE_LABEL[this.user.role] || this.user.role;
    const initials = this.user.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
    const settings = Store.data.settings;
    if (settings && settings.business_name) {
      document.getElementById('business-name-tag').textContent = settings.business_name;
      document.title = `${settings.business_name} | SIMK Royal`;
    }
  },

  setupSidebarFilter() {
    document.querySelectorAll('.nav-item[data-module]').forEach(item => {
      const key = item.dataset.module;
      if (!Auth.hasModule(this.user.role, key)) {
        item.remove();
      }
    });
  },

  setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const openSidebar = () => { sidebar.classList.add('open'); overlay.classList.add('show'); };
    const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };
    document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
    overlay.addEventListener('click', closeSidebar);
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.nav-item') && window.innerWidth <= 1023) closeSidebar();
    });
    this._closeSidebar = closeSidebar;
  },

  setupClock() {
    const el = document.getElementById('topbar-clock');
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        + ' WIB';
    };
    tick();
    setInterval(tick, 1000);
  },

  setupNotif() {
    document.getElementById('btn-notif').addEventListener('click', () => {
      const low = Store.lowStockProducts();
      if (!low.length) { UI.toast('Semua stok produk dalam kondisi aman.', 'success'); return; }
      UI.toast(`${low.length} produk hampir habis: ${low.slice(0, 3).map(p => p.name).join(', ')}${low.length > 3 ? ', ...' : ''}`, 'warning', 5000);
      window.location.hash = '#stok';
    });
  },

  setupLogout() {
    document.getElementById('btn-logout').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Keluar Akun', message: 'Anda akan keluar dari sesi SIMK Royal ini. Lanjutkan?', confirmText: 'Ya, Keluar', danger: true });
      if (ok) Auth.logout();
    });
  },

  setupRefreshBtn() {
    document.getElementById('btn-refresh').addEventListener('click', () => {
      this.render();
      UI.toast('Data telah disegarkan.', 'info', 1500);
    });
  },

  updateLowStockBadge() {
    const badge = document.getElementById('low-stock-badge');
    const count = Store.lowStockProducts().length;
    if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
  },

  render() {
    let key = (window.location.hash || '#dashboard').replace('#', '').split('/')[0];
    if (!ALL_MODULES.includes(key)) key = 'dashboard';

    if (!Auth.hasModule(this.user.role, key)) {
      UI.toast('Anda tidak memiliki akses ke halaman tersebut.', 'danger');
      key = 'dashboard';
      window.location.hash = '#dashboard';
    }

    this.currentKey = key;
    const mod = Modules[key];
    const container = document.getElementById('page-content');

    document.querySelectorAll('.nav-item[data-module]').forEach(item => {
      item.classList.toggle('active', item.dataset.module === key);
    });

    if (!mod) {
      container.innerHTML = UI.emptyState('construction', 'Modul belum tersedia', 'Halaman ini sedang dalam pengembangan.');
      UI.icons();
      return;
    }

    document.getElementById('page-title').textContent = mod.title;
    document.getElementById('page-subtitle').textContent = mod.subtitle || '';

    container.innerHTML = '<div class="empty-state"><div class="skeleton-line" style="width:120px;height:20px;margin:0 auto 8px;"></div></div>';
    try {
      mod.render(container, { user: this.user, readonly: Auth.isReadOnly(this.user.role, key) });
    } catch (err) {
      console.error(err);
      container.innerHTML = UI.emptyState('alert-triangle', 'Terjadi kesalahan', 'Gagal memuat modul ini. Coba segarkan halaman.');
    }
    this.updateLowStockBadge();
    UI.icons();
  },

  refresh() { this.render(); },
  navigate(key) { window.location.hash = '#' + key; },
};

document.addEventListener('DOMContentLoaded', () => App.init());
