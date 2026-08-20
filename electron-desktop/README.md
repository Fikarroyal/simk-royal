# SIMK Royal: Aplikasi Desktop (Mac / Windows / Linux) via Electron

Folder ini membungkus aplikasi web SIMK Royal (folder `app/`) menjadi
**aplikasi desktop mandiri** yang bisa di-install dan dibuka seperti aplikasi
biasa — ada di Dock (Mac) / Start Menu (Windows), punya jendela sendiri,
dan database (IndexedDB) tetap aktif & tersimpan permanen di komputer.

Sudah terbukti berjalan (paket Electron & electron-builder berhasil
diunduh dan diverifikasi saat project ini dibuat).

## Menjalankan di Mode Pengembangan (coba dulu tanpa build)

```bash
cd electron-desktop
npm install
npm start
```

Jendela aplikasi SIMK Royal akan langsung terbuka di komputer Anda (Mac,
Windows, atau Linux — Electron berjalan lintas platform).

## Build Jadi Aplikasi Installer (.dmg untuk Mac, .exe untuk Windows)

Jalankan perintah sesuai platform tempat Anda membangunnya. **Build untuk
Mac (.dmg) sebaiknya dijalankan di komputer Mac** (batasan dari Apple untuk
code signing/notarization); build Windows & Linux bisa dari platform mana
saja.

```bash
cd electron-desktop
npm install

# Di Mac:
npm run dist:mac      # menghasilkan .dmg dan .zip di folder release/

# Di Windows:
npm run dist:win      # menghasilkan installer .exe di folder release/

# Di Linux:
npm run dist:linux    # menghasilkan .AppImage di folder release/
```

Hasil build ada di folder `release/` — tinggal dibagikan/diinstall.

> **Catatan soal Mac:** hasil `.dmg` yang dibangun tanpa Apple Developer
> ID akan ditandai "unidentified developer" oleh macOS Gatekeeper. Ini
> normal untuk aplikasi internal — pengguna Mac bisa tetap membukanya lewat
> klik kanan pada file `.app` → **Open**, lalu konfirmasi sekali. Untuk
> distribusi publik tanpa peringatan ini, diperlukan akun Apple Developer
> ($99/tahun) untuk code signing & notarization (lihat dokumentasi
> electron-builder: https://www.electron.build/code-signing).

## Update Isi Aplikasi

Jika Anda mengubah file di folder web app utama (index.html, app.html, css/,
js/), salin ulang ke folder `app/` di sini sebelum build ulang:

```bash
# dari folder project utama (di luar electron-desktop/)
cp -r index.html app.html css js assets manifest.webmanifest sw.js electron-desktop/app/
```

## Struktur

```
electron-desktop/
├─ package.json     Konfigurasi Electron + electron-builder (target mac/win/linux)
├─ main.js           Proses utama: membuka jendela aplikasi & menu bar
└─ app/              Salinan aplikasi web SIMK Royal (yang dibungkus)
```

## Database & Data

Sama seperti versi web/PWA: menggunakan **IndexedDB** (`js/db.js`), aktif
penuh di dalam jendela Electron (berbasis Chromium), data tersimpan permanen
di profil aplikasi pada komputer masing-masing pengguna — tidak perlu server
maupun koneksi internet setelah aplikasi terpasang.
