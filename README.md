# SIMK Royal: Sistem Informasi Manajemen Kasir Cafe & Resto

Aplikasi manajemen kafe & resto (HTML/CSS/Vanilla JS, tanpa framework/build
step) yang bisa dijalankan sebagai **web, aplikasi ter-install di HP/tablet/
Mac/Windows (PWA)**, **APK Android** (lewat project Capacitor yang sudah
disiapkan), maupun **aplikasi desktop Mac/Windows/Linux** (lewat project
Electron yang sudah disiapkan).

Database memakai **IndexedDB** (database embedded asli di browser, otomatis
turun ke localStorage bila IndexedDB tidak tersedia) — aktif penuh dengan
CRUD (Tambah/Lihat/Ubah/Hapus) di **34 modul**, seluruhnya berjalan 100% di
sisi klien tanpa server/backend.

## 🆕 Yang Baru Ditambahkan

1. **Database aktif nyata (IndexedDB)** menggantikan localStorage polos —
   kuota jauh lebih besar, tetap bekerja offline, otomatis fallback ke
   localStorage jika browser tidak mendukung (lihat `js/db.js`).
2. **10 modul CRUD baru**:
   - **Reservasi Meja** — booking meja pelanggan (tanggal/jam/jumlah tamu/status).
   - **Bahan Baku & Resep (BOM)** — stok bahan baku terpisah dari stok produk,
     resep memetakan produk → bahan baku, **otomatis terpotong saat transaksi
     POS selesai**.
   - **Voucher & Gift Card** — kupon bersaldo nominal, bisa dipakai bertahap.
   - **Penggajian Karyawan** — slip gaji bulanan (gaji pokok, tunjangan,
     lembur, potongan → gaji bersih otomatis).
   - **Ulasan & Rating Pelanggan** — rating bintang + komentar + balasan admin.
   - **Cabang / Outlet** — data multi-cabang & penanggung jawabnya.
   - **Aset & Maintenance** — daftar peralatan cafe + riwayat perawatan.
   - **Anggaran / Budget** — target anggaran per kategori pengeluaran per
     bulan, dibandingkan otomatis dengan realisasi.
   - **Pengumuman Internal** — papan info staff dengan target role & prioritas.
   - **Komplain & Saran (Tiket)** — tiket layanan dari pelanggan/staff dengan
     status & tindak lanjut.
3. **10 modul CRUD baru (gelombang 2)**:
   - **Paket Bundling** — kombo beberapa produk dengan satu harga spesial.
   - **Limbah & Kerugian Stok** — catat bahan baku/produk terbuang, **stok
     otomatis terpotong** & kerugian biaya terhitung otomatis.
   - **Booking Acara** — sewa tempat/ruang privat untuk acara pelanggan,
     lengkap dengan uang muka (DP).
   - **Hadiah & Penukaran Poin** — katalog hadiah loyalitas + penukaran poin
     pelanggan (melengkapi sistem poin membership yang sudah ada).
   - **Kontrak Supplier** — masa berlaku & syarat pembayaran kerjasama
     supplier, status kedaluwarsa terhitung otomatis.
   - **Checklist SOP & Kebersihan** — tugas operasional harian per shift,
     bisa ditandai selesai.
   - **Insentif & Bonus Karyawan** — bonus berbasis pencapaian target kinerja
     (terpisah dari gaji rutin bulanan).
   - **Perizinan & Dokumen Legal** — izin usaha/sertifikat dengan status
     "segera berakhir"/"kedaluwarsa" otomatis dari tanggal berakhir.
   - **Log Suhu Penyimpanan** — pemantauan suhu kulkas/freezer untuk
     kepatuhan keamanan pangan, status normal/waspada/kritis otomatis.
   - **Program Referral** — pelanggan mengajak teman baru, dapat reward poin
     otomatis saat berhasil.
4. **Bisa di-"Install" langsung dari browser (PWA)** di Android, iPhone/iPad,
   Mac, dan Windows — jadi aplikasi mandiri dengan ikon sendiri, berjalan
   offline (lihat `manifest.webmanifest` & `sw.js`).
5. **Project Android (Capacitor)** siap build jadi file `.apk` asli — folder
   `capacitor-android/` (lihat README di dalamnya).
6. **Project Desktop (Electron)** siap build jadi aplikasi `.dmg` (Mac),
   `.exe` (Windows), `.AppImage` (Linux) — folder `electron-desktop/` (lihat
   README di dalamnya).

## Cara Menjalankan (Web / PWA)

Cara termudah, jalankan lewat server lokal (disarankan, agar Service
Worker & IndexedDB bekerja optimal — bukan sekadar dobel-klik file):

```bash
cd simk-royal   # folder ini
python3 -m http.server 8080
# atau: npx serve .
```

Lalu buka `http://localhost:8080` di browser (Chrome/Edge/Safari terbaru).

### Install sebagai Aplikasi (PWA) — di HP, Tablet, Mac, maupun Windows

- **Android/Chrome (HP, tablet, atau desktop):** buka aplikasi di Chrome →
  akan muncul ikon **"Install"** di address bar, atau menu ⋮ → **Install
  aplikasi / Tambahkan ke layar utama**.
- **iPhone/iPad (Safari):** tombol **Share** (kotak dengan panah ke atas) →
  **Tambah ke Layar Utama**.
- **Mac/Windows (Chrome/Edge):** ikon **Install** di ujung kanan address bar,
  atau menu ⋮ → **Install SIMK Royal**. Aplikasi akan muncul di
  Dock/Applications (Mac) atau Start Menu (Windows) sebagai jendela mandiri.

Setelah ter-install sekali secara online, aplikasi tetap bisa dibuka & dipakai
**sepenuhnya offline** (data tersimpan lokal di perangkat via IndexedDB).

> **Catatan:** Aplikasi memuat beberapa pustaka pihak ketiga (ikon Lucide,
> SheetJS untuk export Excel, jsPDF untuk export PDF, QRCode.js untuk QRIS,
> dan Chart.js untuk grafik dashboard) dari CDN — dibutuhkan koneksi internet
> minimal saat pertama kali membuka & meng-install aplikasi; sesudah itu
> Service Worker menyimpannya untuk pemakaian offline.

## Build Jadi APK Android

Lihat **`capacitor-android/README.md`** — project Android (Capacitor) sudah
lengkap disiapkan (termasuk project Gradle native-nya), tinggal dibuka di
Android Studio dan klik **Build APK**.

## Build Jadi Aplikasi Desktop (Mac / Windows / Linux)

Lihat **`electron-desktop/README.md`** — project Electron sudah lengkap
disiapkan, tinggal `npm install && npm start` untuk mencoba, atau
`npm run dist:mac` / `dist:win` / `dist:linux` untuk membangun installer.

## Registrasi Akun & Login

Data demo/dummy sudah dihapus — database dimulai bersih. Satu-satunya akun
bawaan adalah **admin** (tidak ditampilkan di halaman manapun):

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |

Alur untuk karyawan/manager baru:
1. Buka **`register.html`** → isi Nama, Username, No. Telepon, pilih peran
   (Kasir/Staff/Manager), buat password.
2. Akun tersimpan berstatus **"Menunggu Persetujuan"** — belum bisa login.
3. Login sebagai `admin` → menu **User Management** → akan ada notifikasi
   jumlah pendaftar baru, klik **Setujui** (atau **Tolak** untuk menolak).
4. Setelah disetujui, akun bisa langsung login sesuai perannya.

Role **Administrator** tidak bisa didapat lewat registrasi mandiri — hanya
admin yang bisa menaikkan role user lain lewat menu edit di User Management.

Halaman login (`index.html`) dan registrasi (`register.html`) dilengkapi
ilustrasi kasir animasi (CSS/SVG, tanpa file GIF) yang mengikuti tema warna
aplikasi.

## Struktur Folder

```
simk-royal/
├─ index.html              Halaman login (+ registrasi Service Worker PWA)
├─ app.html                Shell aplikasi (sidebar, topbar, SPA router)
├─ manifest.webmanifest    Manifest PWA (nama, ikon, warna tema)
├─ sw.js                   Service Worker (cache offline & installability)
├─ assets/                 Ikon aplikasi (PWA/Android/desktop)
├─ css/
│  └─ style.css            Design system (warna, komponen, responsive)
├─ js/
│  ├─ db.js                 Adapter database: IndexedDB + fallback localStorage
│  ├─ store.js               Data layer: seed data, CRUD generik, logika bisnis
│  ├─ auth.js                 Login, session, matriks hak akses role
│  ├─ ui.js                    Komponen UI reusable (modal, toast, tabel CRUD, dsb)
│  ├─ app.js                    Router SPA & inisialisasi shell
│  └─ modules/                  Satu file per modul fitur (34 modul)
├─ capacitor-android/       Project Android siap build jadi .apk (lihat README-nya)
├─ electron-desktop/        Project desktop siap build .dmg/.exe/.AppImage (lihat README-nya)
└─ payment-server/          Backend Midtrans Snap (WAJIB jalan untuk pembayaran otomatis, lihat README-nya)
```

## Ringkasan Fitur per Modul

- **Dashboard**: ringkasan pendapatan, transaksi, stok, grafik penjualan 7 hari, produk terlaris.
- **Kasir (POS)**: katalog produk per kategori, keranjang, pilih meja/pelanggan, kode promo, tahan/lanjutkan pesanan, split pembayaran, kalkulator kembalian, cetak/PDF struk.
- **Buka/Tutup Kasir, Kas Masuk/Keluar, Otorisasi Manager, Retur, Log Aktivitas**: alur kasir end-to-end lengkap dengan jejak audit.
- **Produk & Kategori**, **Meja**, **Pelanggan**, **Karyawan & Shift**, **Absensi**, **Stok/Supplier/Pembelian**, **Promo**, **Pengeluaran**, **Transaksi & Pembayaran**, **Laporan**, **User Management**, **Pengaturan** — modul inti operasional & administrasi.
- **10 modul baru gelombang 1**: Reservasi Meja, Bahan Baku & Resep, Voucher & Gift Card, Penggajian, Ulasan & Rating, Cabang/Outlet, Aset & Maintenance, Anggaran/Budget, Pengumuman Internal, Komplain & Saran.
- **10 modul baru gelombang 2**: Paket Bundling, Limbah & Kerugian Stok, Booking Acara, Hadiah & Penukaran Poin, Kontrak Supplier, Checklist SOP & Kebersihan, Insentif & Bonus Karyawan, Perizinan & Dokumen Legal, Log Suhu Penyimpanan, Program Referral.

## 💳 Integrasi Payment Gateway (Midtrans)

Kasir (POS) sekarang bisa menerima pembayaran otomatis lewat **Midtrans
Snap** (QRIS, kartu, e-wallet, virtual account — semua dalam satu popup),
dengan konfirmasi transaksi otomatis begitu pembayaran diterima (tidak perlu
input manual oleh kasir).

**Ini butuh satu komponen tambahan yang WAJIB dijalankan:** backend kecil di
folder **`payment-server/`**, yang menyimpan Server Key Midtrans dengan
aman (kunci rahasia ini tidak boleh dan tidak pernah ada di kode
frontend/browser). Lihat **`payment-server/README.md`** untuk panduan
lengkap setup `.env`, menjalankan server, dan mendaftarkan webhook di
Midtrans Dashboard.

Setelah backend jalan, aktifkan & hubungkan lewat menu **Pengaturan →
Payment Gateway (Midtrans)** di aplikasi (isi Client Key + URL backend,
lalu klik Tes Koneksi). Metode "Midtrans (Semua Metode)" akan otomatis
muncul di layar Kasir setelah dikonfigurasi.

## Catatan Penting

- **QRIS** pada modul POS adalah simulasi tampilan (generate QR + alur
  konfirmasi) agar alur kasir dapat diuji end-to-end. Untuk pembayaran QRIS
  nyata, sistem perlu diintegrasikan dengan payment gateway resmi.
- Data awal (produk, karyawan, pelanggan, dsb.) adalah data contoh untuk demo.
  Gunakan tombol **Reset ke Data Awal** di halaman Pengaturan bila ingin
  mengembalikan ke kondisi semula.
- Karena seluruh data tersimpan lokal per-perangkat (IndexedDB), gunakan menu
  **Pengaturan → Cadangkan Data (Backup)** secara berkala jika ingin
  memindahkan data ke perangkat/browser lain.
- Modul **Bahan Baku & Resep** hanya memotong stok bahan baku untuk produk
  yang sudah didaftarkan resepnya; produk tanpa resep hanya memotong stok
  produk jadi seperti biasa (tidak wajib membuat resep untuk semua produk).
