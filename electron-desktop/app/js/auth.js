/* =========================================================================
   auth.js
   Login, session, dan role permission untuk SIMK Royal.
   Role: administrator, manager, kasir, staff
   ========================================================================= */

const ROLE_LABEL = {
  administrator: 'Administrator',
  manager: 'Manager',
  kasir: 'Kasir',
  staff: 'Staff',
};

const ROLE_BADGE_CLASS = {
  administrator: 'badge-purple',
  manager: 'badge-info',
  kasir: 'badge-success',
  staff: 'badge-gray',
};

// Daftar seluruh modul menu (key dipakai untuk routing & sidebar)
const ALL_MODULES = [
  'dashboard', 'pos', 'produk', 'meja', 'pelanggan', 'karyawan',
  'absensi', 'stok', 'promo', 'pengeluaran', 'transaksi', 'laporan',
  'user', 'pengaturan',
  // --- 10 modul CRUD tambahan (gelombang 1) ---
  'reservasi', 'bahanbaku', 'voucher', 'penggajian', 'ulasan',
  'cabang', 'aset', 'anggaran', 'pengumuman', 'tiket',
  // --- 10 modul CRUD tambahan (gelombang 2) ---
  'bundling', 'limbah', 'acara', 'hadiah', 'kontrak',
  'checklist', 'insentif', 'perizinan', 'suhu', 'referral',
];

// Modul yang boleh diakses tiap role. Administrator selalu penuh.
const ROLE_ACCESS = {
  administrator: { modules: ALL_MODULES, readonly: [] },
  manager: {
    modules: [
      'dashboard', 'pos', 'produk', 'meja', 'pelanggan', 'karyawan', 'absensi', 'stok', 'promo', 'pengeluaran', 'transaksi', 'laporan',
      'reservasi', 'bahanbaku', 'voucher', 'penggajian', 'ulasan', 'cabang', 'aset', 'anggaran', 'pengumuman', 'tiket',
      'bundling', 'limbah', 'acara', 'hadiah', 'kontrak', 'checklist', 'insentif', 'perizinan', 'suhu', 'referral',
    ],
    readonly: [],
  },
  kasir: {
    modules: ['dashboard', 'pos', 'pelanggan', 'absensi', 'transaksi', 'reservasi', 'voucher', 'ulasan', 'pengumuman', 'tiket', 'acara', 'hadiah', 'checklist', 'suhu', 'referral'],
    readonly: ['dashboard', 'transaksi', 'pengumuman'],
  },
  staff: {
    modules: ['dashboard', 'produk', 'pelanggan', 'absensi', 'reservasi', 'ulasan', 'pengumuman', 'tiket', 'checklist', 'suhu'],
    readonly: ['dashboard', 'produk', 'pelanggan', 'pengumuman'],
  },
};

const Auth = {
  login(username, password) {
    const user = Store.list('users').find(
      u => u.username.toLowerCase() === String(username).toLowerCase() && u.password === password
    );
    if (!user) return { ok: false, message: 'Username atau password salah.' };
    if (user.status === 'pending') return { ok: false, message: 'Akun Anda masih menunggu persetujuan administrator.' };
    if (user.status !== 'active') return { ok: false, message: 'Akun ini tidak aktif. Hubungi administrator.' };
    Session.set(user);
    return { ok: true, user };
  },

  // Registrasi mandiri untuk karyawan/manager baru. Akun dibuat berstatus
  // "pending" (belum bisa dipakai login) sampai disetujui administrator
  // lewat menu User Management — role "administrator" sengaja tidak bisa
  // dipilih lewat form registrasi demi keamanan.
  register({ name, username, phone, role, password }) {
    name = String(name || '').trim();
    username = String(username || '').trim();
    phone = String(phone || '').trim();
    password = String(password || '');
    const allowedRoles = ['kasir', 'staff', 'manager'];
    if (!allowedRoles.includes(role)) role = 'staff';

    if (!name || !username || !phone || !password) return { ok: false, message: 'Semua kolom wajib diisi.' };
    if (password.length < 6) return { ok: false, message: 'Password minimal 6 karakter.' };

    const dup = Store.list('users').find(u => u.username.toLowerCase() === username.toLowerCase());
    if (dup) return { ok: false, message: 'Username sudah digunakan, silakan pilih yang lain.' };

    const user = Store.create('users', {
      name, username, phone, role, password,
      email: '', employee_id: '', status: 'pending',
      created_at: new Date().toISOString(),
    }, 'usr');

    return { ok: true, user };
  },

  logout() {
    Session.clear();
    window.location.href = 'index.html';
  },

  currentUser() {
    return Session.get();
  },

  hasModule(role, key) {
    const rule = ROLE_ACCESS[role];
    if (!rule) return false;
    return rule.modules.includes(key);
  },

  isReadOnly(role, key) {
    const rule = ROLE_ACCESS[role];
    if (!rule) return true;
    return rule.readonly.includes(key);
  },

  guardPage() {
    const user = this.currentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  },

  // Verifikasi kredensial Manager/Administrator untuk otorisasi tindakan sensitif
  // (mis. void transaksi, diskon manual besar) TANPA mengganti sesi login yang aktif.
  verifyOverride(username, password) {
    const user = Store.list('users').find(
      u => u.username.toLowerCase() === String(username).toLowerCase() && u.password === password
    );
    if (!user) return { ok: false, message: 'Username atau password salah.' };
    if (user.status !== 'active') return { ok: false, message: 'Akun ini tidak aktif.' };
    if (user.role !== 'administrator' && user.role !== 'manager') return { ok: false, message: 'Akun ini tidak memiliki wewenang otorisasi.' };
    return { ok: true, user };
  },
};
