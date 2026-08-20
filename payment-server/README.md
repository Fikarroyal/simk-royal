# SIMK Royal — Payment Server (Integrasi Midtrans Snap)

Backend kecil yang menjadi perantara aman antara aplikasi kasir SIMK Royal
dan Midtrans. **Wajib dijalankan** kalau Anda ingin mengaktifkan pembayaran
otomatis (QRIS/kartu/e-wallet/VA) lewat Midtrans di menu Kasir (POS).

## Kenapa butuh server terpisah?

Midtrans butuh **Server Key** untuk membuat transaksi & memverifikasi
notifikasi pembayaran. Server Key ini **rahasia** — kalau ditaruh di kode
JavaScript yang jalan di browser/HP pelanggan, siapapun bisa mencurinya lewat
"View Source" lalu menyalahgunakannya. Karena itu Server Key hanya boleh
hidup di backend (file `.env` di folder ini), tidak pernah di frontend.

## 1. Setup Awal

```bash
cd payment-server
npm install
cp .env.example .env
```

Buka file `.env`, lalu isi dengan API key dari Midtrans Dashboard Anda
(**Settings → Access Keys**, gunakan yang **Sandbox** dulu untuk testing):

```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
PORT=4000
```

## 2. Jalankan Server

```bash
npm start
```

Kalau berhasil, akan muncul pesan:
```
✅ SIMK Royal Payment Server (Midtrans) berjalan di http://localhost:4000
   Mode: SANDBOX (testing)
```

## 3. Hubungkan ke Aplikasi SIMK Royal

1. Buka aplikasi SIMK Royal → login sebagai admin → menu **Pengaturan**.
2. Di bagian **Payment Gateway (Midtrans)**:
   - Centang **Aktifkan Midtrans**
   - **Client Key**: isi dengan Client Key yang sama seperti di `.env`
   - **URL Backend**: alamat server ini (mis. `http://localhost:4000` saat
     testing lokal, atau `https://api.tokocafe-anda.com` kalau sudah
     di-deploy ke server Anda)
   - Klik **Tes Koneksi Backend** untuk memastikan aplikasi bisa menjangkau
     server ini.
   - Klik **Simpan Konfigurasi**.
3. Buka menu **Kasir (POS)**, tambahkan item ke keranjang, klik **Bayar**,
   lalu pilih metode **Midtrans (Semua Metode)** — akan muncul tombol
   "Buka Popup Pembayaran Midtrans".

## 4. Daftarkan Webhook (WAJIB agar status pembayaran terkonfirmasi otomatis)

Midtrans perlu tahu ke mana harus mengirim notifikasi saat status pembayaran
berubah (misalnya QRIS sudah dibayar). Karena server Anda sudah punya
alamat publik sendiri, daftarkan URL webhook berikut di:

**Midtrans Dashboard → Settings → Configuration → Payment Notification URL**

```
https://alamat-server-anda.com/api/payment/notification
```

> ⚠️ URL ini **harus bisa diakses dari internet** (bukan `localhost`), karena
> Midtrans yang akan memanggilnya dari server mereka. Kalau server Anda
> sudah online/live, tinggal pakai domain/IP publiknya. Untuk testing lokal
> sebelum deploy, Anda bisa memakai tool tunnel seperti `ngrok` sementara:
> ```bash
> ngrok http 4000
> ```
> lalu daftarkan URL ngrok (`https://xxxx.ngrok-free.app/api/payment/notification`)
> di Dashboard Midtrans selama sesi testing berlangsung.

## Cara Kerja Alur Pembayaran

```
Kasir klik "Bayar dengan Midtrans"
        │
        ▼
Frontend (js/midtrans.js) → POST /api/payment/create-transaction ──► Server ini ──► Midtrans (buat transaksi)
        │                                                                                    │
        ▼                                                                          token Snap dikembalikan
Popup Snap terbuka, pelanggan bayar (QRIS/kartu/e-wallet/VA)
        │
        ▼
Midtrans mengirim webhook ──► POST /api/payment/notification (server ini) ──► status disimpan
        │
        ▼
Frontend polling GET /api/payment/status/:orderId setiap 3 detik
        │
        ▼
Begitu status = settlement/capture → transaksi otomatis tercatat di SIMK Royal,
struk langsung tampil.
```

Status pembayaran **hanya dianggap sah setelah dikonfirmasi lewat webhook**
(bukan cuma sinyal dari popup di browser), supaya tidak bisa dimanipulasi
dari sisi klien.

## Endpoint yang Tersedia

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek server hidup & mode sandbox/production |
| POST | `/api/payment/create-transaction` | Dipanggil frontend saat kasir mulai bayar |
| GET | `/api/payment/status/:orderId` | Dipoll frontend untuk cek status terbaru |
| POST | `/api/payment/notification` | Webhook dari Midtrans (didaftarkan di Dashboard) |

## Penyimpanan Data

Status transaksi disimpan sederhana di `data/transactions.json` (file JSON).
Ini cukup untuk 1 cafe/outlet dengan volume transaksi normal. Kalau nanti
butuh skala lebih besar (multi-cabang dengan banyak kasir bersamaan),
folder ini bisa diganti dengan database sungguhan (PostgreSQL/MySQL) —
fungsi `readDb()`/`writeDb()` di `server.js` adalah satu-satunya tempat
yang perlu diubah.

## Deploy ke Server Sendiri

Karena Anda sudah punya server/hosting sendiri, langkah umumnya:

1. Upload folder `payment-server/` ke server Anda.
2. Jalankan `npm install --production`.
3. Buat file `.env` di server (isi sama seperti di atas, ganti
   `MIDTRANS_IS_PRODUCTION=true` dan pakai Server/Client Key **Production**
   kalau sudah siap live — jangan campur kunci sandbox & production).
4. Jalankan dengan process manager agar tetap hidup, misalnya
   [PM2](https://pm2.keymetrics.io/):
   ```bash
   npm install -g pm2
   pm2 start server.js --name simk-royal-payment
   pm2 save
   ```
5. Arahkan domain/reverse proxy (Nginx/Apache) ke port `4000` (atau sesuai
   `PORT` di `.env`), pastikan HTTPS aktif (Midtrans mewajibkan webhook URL
   berupa HTTPS untuk mode production).
6. Update URL Backend di menu **Pengaturan** SIMK Royal ke domain server ini.
7. Daftarkan webhook URL production di Midtrans Dashboard (lihat bagian 4).

## Keamanan

- **Jangan pernah** commit file `.env` ke Git (sudah ada di `.gitignore`).
- Jangan pernah menaruh `MIDTRANS_SERVER_KEY` di kode frontend manapun.
- Gunakan HTTPS untuk server production (wajib untuk webhook Midtrans mode live).
