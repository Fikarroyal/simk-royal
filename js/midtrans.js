/* =========================================================================
   midtrans.js — Integrasi Midtrans Snap (sisi klien)
   Menangani pemuatan Snap.js, pembuatan transaksi lewat backend
   (payment-server/), pembukaan popup Snap, dan verifikasi status
   pembayaran final ke backend (sumber kebenaran = webhook Midtrans, bukan
   sekadar callback onSuccess di browser — supaya tidak bisa dipalsukan).

   PENTING: Server Key Midtrans TIDAK PERNAH ada di file ini atau file
   manapun di frontend. Hanya Client Key (kunci publik) yang dipakai di
   sisi klien, dan semua permintaan sensitif (create transaction, cek
   status) diteruskan lewat backend di folder payment-server/.
   ========================================================================= */
const MidtransPay = (() => {
  let snapLoadPromise = null;

  function config() {
    return (Store.data.settings && Store.data.settings.midtrans) || { enabled: false };
  }

  function isConfigured() {
    const c = config();
    return !!(c.enabled && c.client_key && c.backend_url);
  }

  function loadSnap() {
    if (window.snap) return Promise.resolve(window.snap);
    if (snapLoadPromise) return snapLoadPromise;
    const c = config();
    const src = c.is_production ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
    snapLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.setAttribute('data-client-key', c.client_key);
      script.onload = () => resolve(window.snap);
      script.onerror = () => reject(new Error('Gagal memuat Snap.js dari Midtrans. Cek koneksi internet.'));
      document.head.appendChild(script);
    });
    return snapLoadPromise;
  }

  async function apiFetch(path, options) {
    const c = config();
    const url = `${c.backend_url.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      let message = `Backend payment server error (${res.status})`;
      try { const body = await res.json(); if (body && body.message) message = body.message; } catch (e) { /* ignore */ }
      throw new Error(message);
    }
    return res.json();
  }

  function createTransaction(payload) {
    return apiFetch('/api/payment/create-transaction', { method: 'POST', body: JSON.stringify(payload) });
  }

  function getStatus(orderId) {
    return apiFetch(`/api/payment/status/${encodeURIComponent(orderId)}`, { method: 'GET' });
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  // Poll backend (yang datanya diperbarui oleh webhook Midtrans) sampai
  // status final tercapai, atau timeout. Ini mencegah aplikasi menganggap
  // "lunas" hanya dari sinyal client-side yang bisa terputus/dipalsukan.
  async function waitForConfirmation(orderId, { intervalMs = 3000, timeoutMs = 180000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = await getStatus(orderId).catch(() => null);
      if (result && ['settlement', 'capture'].includes(result.status)) return { ok: true, status: result.status, raw: result };
      if (result && ['deny', 'cancel', 'expire', 'failure'].includes(result.status)) return { ok: false, status: result.status, raw: result };
      await sleep(intervalMs);
    }
    return { ok: false, status: 'timeout', raw: null };
  }

  // Alur utama: buat transaksi -> buka popup Snap -> tunggu konfirmasi
  // final dari backend. `callbacks.onWaiting(orderId)` dipanggil begitu
  // popup selesai (sukses/pending) untuk menampilkan status "menunggu
  // konfirmasi" di UI kasir sebelum status final didapat.
  async function pay(orderPayload, callbacks = {}) {
    if (!isConfigured()) throw new Error('Midtrans belum dikonfigurasi. Atur di menu Pengaturan.');
    await loadSnap();
    const { token, order_id } = await createTransaction(orderPayload);
    if (!token) throw new Error('Backend tidak mengembalikan Snap token.');

    return new Promise((resolve) => {
      window.snap.pay(token, {
        onSuccess: async () => {
          if (callbacks.onWaiting) callbacks.onWaiting(order_id);
          const result = await waitForConfirmation(order_id);
          resolve(result);
        },
        onPending: async () => {
          if (callbacks.onWaiting) callbacks.onWaiting(order_id);
          const result = await waitForConfirmation(order_id);
          resolve(result);
        },
        onError: () => resolve({ ok: false, status: 'error', raw: null }),
        onClose: () => resolve({ ok: false, status: 'closed', raw: null }),
      });
    });
  }

  return { isConfigured, loadSnap, createTransaction, getStatus, waitForConfirmation, pay, config };
})();
