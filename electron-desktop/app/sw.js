/* =========================================================================
   sw.js — Service Worker SIMK Royal
   Membuat aplikasi bisa dipasang ("Install App") dan dipakai penuh offline
   di HP, tablet, maupun komputer (Windows/Mac/Linux). Setelah dibuka sekali
   secara online, seluruh file aplikasi (HTML/CSS/JS) dan pustaka pihak
   ketiga (Lucide, XLSX, jsPDF, QRCode, Chart.js) tersimpan di cache
   sehingga aplikasi tetap jalan tanpa koneksi internet.

   CATATAN: database (IndexedDB) tidak disentuh oleh service worker ini —
   Store/db.js menyimpan data langsung ke IndexedDB, bukan lewat cache.
   ========================================================================= */

const CACHE_VERSION = 'simkroyal-v4';
const APP_SHELL = [
  './index.html',
  './register.html',
  './app.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/db.js',
  './js/store.js',
  './js/auth.js',
  './js/ui.js',
  './js/midtrans.js',
  './js/app.js',
  './js/modules/dashboard.js',
  './js/modules/pos.js',
  './js/modules/produk.js',
  './js/modules/bundling.js',
  './js/modules/meja.js',
  './js/modules/reservasi.js',
  './js/modules/bahanbaku.js',
  './js/modules/pelanggan.js',
  './js/modules/karyawan.js',
  './js/modules/absensi.js',
  './js/modules/penggajian.js',
  './js/modules/insentif.js',
  './js/modules/stok.js',
  './js/modules/kontrak.js',
  './js/modules/limbah.js',
  './js/modules/promo.js',
  './js/modules/voucher.js',
  './js/modules/pengeluaran.js',
  './js/modules/anggaran.js',
  './js/modules/transaksi.js',
  './js/modules/aset.js',
  './js/modules/ulasan.js',
  './js/modules/hadiah.js',
  './js/modules/referral.js',
  './js/modules/acara.js',
  './js/modules/tiket.js',
  './js/modules/pengumuman.js',
  './js/modules/cabang.js',
  './js/modules/checklist.js',
  './js/modules/suhu.js',
  './js/modules/perizinan.js',
  './js/modules/laporan.js',
  './js/modules/user.js',
  './js/modules/pengaturan.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './assets/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // App shell (file lokal): cache-first, supaya buka aplikasi tetap instan & offline.
  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // Pustaka CDN pihak ketiga (Lucide/XLSX/jsPDF/Chart.js/QRCode): cache setelah
  // berhasil diambil sekali, supaya kunjungan berikutnya tetap jalan offline.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
