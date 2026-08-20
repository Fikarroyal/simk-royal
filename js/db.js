/* =========================================================================
   db.js
   Adapter database nyata untuk SIMK Royal, menggantikan localStorage polos
   dengan IndexedDB (database embedded asli di browser, kuota jauh lebih
   besar, async, dan didukung penuh di Chrome/Edge/Safari/Firefox — termasuk
   saat aplikasi dibungkus sebagai PWA/Capacitor/Electron).

   Jika IndexedDB tidak tersedia (mis. mode privasi ketat), adapter otomatis
   turun ke localStorage supaya aplikasi tetap berjalan (graceful fallback).

   API yang diekspos hanya dua fungsi async sederhana:
     DBAdapter.load(key)         -> Promise<any|null>
     DBAdapter.persist(key, val) -> Promise<void>
   Sengaja dibuat minim supaya lapisan di atasnya (store.js) tidak perlu
   diubah besar-besaran: seluruh data tetap disimpan sebagai satu blob
   JSON di memori (this.data) dan hanya dibaca/ditulis lewat dua fungsi ini.
   ========================================================================= */
const DBAdapter = (() => {
  const IDB_NAME = 'simkroyal_idb';
  const IDB_STORE = 'kv';
  const IDB_VERSION = 1;
  let idbPromise = null;
  let mode = null; // 'indexeddb' | 'localstorage'

  function openIDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB tidak tersedia')); return; }
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB terblokir'));
    });
    return idbPromise;
  }

  async function idbGet(key) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function detectMode() {
    if (mode) return mode;
    try {
      await openIDB();
      mode = 'indexeddb';
    } catch (e) {
      console.warn('[SIMK Royal] IndexedDB tidak tersedia, memakai localStorage sebagai cadangan.', e);
      mode = 'localstorage';
    }
    return mode;
  }

  return {
    async load(key) {
      const m = await detectMode();
      if (m === 'indexeddb') {
        try { return await idbGet(key); }
        catch (e) { console.warn('[SIMK Royal] Gagal membaca IndexedDB, fallback localStorage.', e); mode = 'localstorage'; }
      }
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },

    async persist(key, value) {
      const m = await detectMode();
      if (m === 'indexeddb') {
        try { await idbSet(key, value); return; }
        catch (e) { console.warn('[SIMK Royal] Gagal menulis IndexedDB, fallback localStorage.', e); mode = 'localstorage'; }
      }
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (e) { console.error('[SIMK Royal] Gagal menyimpan data (kuota penuh?).', e); }
    },

    async currentMode() { return detectMode(); },
  };
})();
