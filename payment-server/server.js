/* =========================================================================
   server.js — Backend Payment Gateway (Midtrans Snap) untuk SIMK Royal
   =========================================================================
   Server kecil ini adalah SATU-SATUNYA tempat Server Key Midtrans boleh
   berada. Tugasnya:
   1. Membuat transaksi Snap (POST /api/payment/create-transaction)
   2. Menerima notifikasi/webhook dari Midtrans saat status pembayaran
      berubah (POST /api/payment/notification) — INI SUMBER KEBENARAN.
   3. Memberi tahu status transaksi ke frontend saat diminta
      (GET /api/payment/status/:orderId), dipakai frontend untuk polling.

   Penyimpanan status transaksi memakai file JSON sederhana (data/transactions.json)
   supaya server ini ringan dan mudah dijalankan tanpa setup database
   terpisah. Untuk skala lebih besar / multi-cabang, ganti readDb()/writeDb()
   di bawah dengan database sungguhan (PostgreSQL/MySQL/dst).
   ========================================================================= */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const midtransClient = require('midtrans-client');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY;

if (!SERVER_KEY || !CLIENT_KEY) {
  console.warn('\n⚠️  MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY belum diset di file .env');
  console.warn('   Salin .env.example menjadi .env lalu isi kedua kunci tersebut.\n');
}

const snap = new midtransClient.Snap({
  isProduction: IS_PRODUCTION,
  serverKey: SERVER_KEY,
  clientKey: CLIENT_KEY,
});

/* ---------------------------- Penyimpanan status ---------------------------- */
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'transactions.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

function readDb() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return {}; }
}
function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

/* --------------------------------- Routes --------------------------------- */

// Endpoint sederhana untuk tombol "Tes Koneksi Backend" di menu Pengaturan SIMK Royal.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: IS_PRODUCTION ? 'production' : 'sandbox', time: new Date().toISOString() });
});

// Dipanggil oleh POS (js/midtrans.js) saat kasir membuka popup pembayaran Midtrans.
app.post('/api/payment/create-transaction', async (req, res) => {
  try {
    const { order_id, gross_amount, items, customer } = req.body || {};
    if (!order_id || !gross_amount) {
      return res.status(400).json({ message: 'order_id dan gross_amount wajib diisi.' });
    }

    // Pastikan total item_details sama persis dengan gross_amount, kalau tidak
    // Midtrans akan menolak request (item_details bersifat opsional tapi harus
    // konsisten jika disertakan). Jika ada selisih pembulatan, kita drop item
    // details supaya transaksi tetap bisa dibuat.
    const roundedAmount = Math.round(gross_amount);
    let itemDetails = Array.isArray(items) ? items.map(i => ({ ...i, price: Math.round(i.price) })) : undefined;
    if (itemDetails) {
      const itemSum = itemDetails.reduce((s, i) => s + i.price * i.quantity, 0);
      if (itemSum !== roundedAmount) itemDetails = undefined;
    }

    const parameter = {
      transaction_details: { order_id, gross_amount: roundedAmount },
      item_details: itemDetails,
      customer_details: customer,
      credit_card: { secure: true },
    };

    const transaction = await snap.createTransaction(parameter);

    const db = readDb();
    db[order_id] = {
      order_id, gross_amount: roundedAmount,
      status: 'pending', transaction_status: 'pending',
      created_at: new Date().toISOString(),
    };
    writeDb(db);

    res.json({ token: transaction.token, redirect_url: transaction.redirect_url, order_id });
  } catch (err) {
    console.error('[create-transaction] error:', err.message);
    res.status(500).json({ message: err.message || 'Gagal membuat transaksi Midtrans.' });
  }
});

// Dipoll oleh frontend (js/midtrans.js) sampai statusnya final. Data di sini
// hanya berubah lewat webhook /api/payment/notification di bawah, jadi ini
// aman dari manipulasi sisi klien.
app.get('/api/payment/status/:orderId', (req, res) => {
  const db = readDb();
  const record = db[req.params.orderId];
  if (!record) return res.status(404).json({ message: 'Order tidak ditemukan.' });
  res.json(record);
});

// Webhook resmi Midtrans. WAJIB didaftarkan di:
// Midtrans Dashboard -> Settings -> Configuration -> Payment Notification URL
// Contoh: https://domain-anda.com/api/payment/notification
app.post('/api/payment/notification', async (req, res) => {
  try {
    const statusResponse = await snap.transaction.notification(req.body);
    const { order_id, transaction_status, fraud_status } = statusResponse;

    // Normalisasi status akhir: transaksi kartu kredit dengan status "capture"
    // hanya dianggap lunas jika fraud_status "accept".
    let finalStatus = transaction_status;
    if (transaction_status === 'capture') {
      finalStatus = fraud_status === 'accept' ? 'capture' : 'deny';
    }

    const db = readDb();
    db[order_id] = {
      ...(db[order_id] || {}),
      order_id,
      status: finalStatus,
      transaction_status,
      fraud_status: fraud_status || null,
      updated_at: new Date().toISOString(),
      raw: statusResponse,
    };
    writeDb(db);

    console.log(`[Midtrans notification] ${order_id} -> ${finalStatus}`);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[notification] error:', err.message);
    res.status(500).send('Error memproses notifikasi.');
  }
});

function start() {
  return app.listen(PORT, () => {
    console.log(`\n✅ SIMK Royal Payment Server (Midtrans) berjalan di http://localhost:${PORT}`);
    console.log(`   Mode: ${IS_PRODUCTION ? 'PRODUCTION (live)' : 'SANDBOX (testing)'}`);
    console.log(`   Daftarkan webhook URL publik Anda + "/api/payment/notification" di Midtrans Dashboard.\n`);
  });
}

// Auto-start hanya saat file ini dijalankan langsung (node server.js / npm start),
// bukan saat di-require sebagai modul (mis. dari skrip pengujian otomatis).
if (require.main === module) {
  start();
}

module.exports = { app, start };