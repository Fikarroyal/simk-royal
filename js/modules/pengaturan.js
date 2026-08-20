/* =========================================================================
   modules/pengaturan.js — System Configuration
   ========================================================================= */
(function () {
  function renderBusinessForm(container) {
    const s = Store.data.settings;
    container.innerHTML = `
      <div class="card">
        <div class="section-title">Informasi Bisnis</div>
        <form id="settings-form" class="form-grid">
          <div class="field span-2"><label>Nama Bisnis *</label><input class="input" name="business_name" required value="${Util.escape(s.business_name)}" /></div>
          <div class="field span-2"><label>Alamat *</label><input class="input" name="address" required value="${Util.escape(s.address)}" /></div>
          <div class="field"><label>No. Telepon *</label><input class="input" name="phone" required value="${Util.escape(s.phone)}" /></div>
          <div class="field"><label>Nama Merchant QRIS</label><input class="input" name="qris_merchant_name" value="${Util.escape(s.qris_merchant_name)}" /></div>
          <div class="field"><label>Pajak (%)</label><input class="input" type="number" min="0" max="100" name="tax_percent" value="${s.tax_percent}" /></div>
          <div class="field"><label>Service Charge (%)</label><input class="input" type="number" min="0" max="100" name="service_charge_percent" value="${s.service_charge_percent}" /></div>
          <div class="field"><label>Batas Kas Laci (Rp)</label><input class="input" type="number" min="0" name="cash_drawer_limit" value="${s.cash_drawer_limit || 0}" /></div>
          <div class="field span-2"><label>Catatan Kaki Struk</label><textarea class="input" name="receipt_footer" rows="2">${Util.escape(s.receipt_footer)}</textarea></div>
          <div class="field span-2">
            <label class="checkbox-row" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="low_stock_alert" ${s.low_stock_alert ? 'checked' : ''} style="width:16px;height:16px;margin:0;flex-shrink:0;" /><span>Aktifkan notifikasi stok menipis</span></label>
          </div>
        </form>
        <button class="btn btn-primary mt-16" id="btn-save-settings"><i data-lucide="save"></i> Simpan Pengaturan</button>
      </div>
    `;
    UI.icons();
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      const f = document.getElementById('settings-form');
      if (!UI.validateRequired(f)) return;
      const data = UI.serializeForm(f);
      data.tax_percent = Number(data.tax_percent) || 0;
      data.service_charge_percent = Number(data.service_charge_percent) || 0;
      data.cash_drawer_limit = Number(data.cash_drawer_limit) || 0;
      data.low_stock_alert = f.querySelector('[name=low_stock_alert]').checked;
      Object.assign(Store.data.settings, data);
      Store.save();
      UI.toast('Pengaturan berhasil disimpan.', 'success');
      document.getElementById('business-name-tag').textContent = data.business_name;
      document.title = `${data.business_name} | SIMK Royal`;
    });
  }

  function renderSystemManagement(container) {
    container.innerHTML = `
      <div class="grid grid-2 mt-16">
        <div class="card">
          <div class="section-title">Cadangkan Data (Backup)</div>
          <p class="cell-sub" style="margin-bottom:14px;">Unduh seluruh data SIMK Royal (produk, transaksi, karyawan, dsb) sebagai berkas JSON.</p>
          <button class="btn btn-outline" id="btn-backup"><i data-lucide="download"></i> Unduh Backup JSON</button>
        </div>
        <div class="card">
          <div class="section-title">Pulihkan Data (Restore)</div>
          <p class="cell-sub" style="margin-bottom:14px;">Unggah berkas backup JSON untuk memulihkan data sebelumnya. Data saat ini akan tertimpa.</p>
          <input type="file" id="input-restore" accept="application/json" class="hidden" />
          <button class="btn btn-outline" id="btn-restore"><i data-lucide="upload"></i> Pilih Berkas Backup</button>
        </div>
      </div>
      <div class="card mt-16">
        <div class="section-title" style="color:var(--c-danger);">Zona Berbahaya</div>
        <p class="cell-sub" style="margin-bottom:14px;">Mengembalikan seluruh data ke kondisi awal (dummy data demo). Semua transaksi dan perubahan akan hilang.</p>
        <button class="btn btn-danger" id="btn-reset"><i data-lucide="rotate-ccw"></i> Reset ke Data Awal</button>
      </div>
    `;
    UI.icons();

    document.getElementById('btn-backup').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `simk-royal-backup-${Util.todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      UI.toast('Backup data berhasil diunduh.', 'success');
    });

    document.getElementById('btn-restore').addEventListener('click', () => document.getElementById('input-restore').click());
    document.getElementById('input-restore').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await UI.confirm({ title: 'Pulihkan Data', message: 'Data saat ini akan digantikan dengan isi berkas backup. Lanjutkan?', danger: true });
      if (!ok) { e.target.value = ''; return; }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        Store.data = parsed;
        Store.save();
        UI.toast('Data berhasil dipulihkan.', 'success');
        App.refresh();
      } catch (err) {
        UI.toast('Berkas backup tidak valid.', 'danger');
      }
      e.target.value = '';
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Reset Seluruh Data', message: 'Tindakan ini akan menghapus semua data dan mengembalikan ke kondisi demo awal. Tindakan tidak dapat dibatalkan.', confirmText: 'Ya, Reset', danger: true });
      if (ok) { Store.resetToSeed(); UI.toast('Data berhasil direset ke kondisi awal.', 'success'); App.refresh(); }
    });
  }

  function renderPaymentGatewayForm(container) {
    const m = Store.data.settings.midtrans || { enabled: false, is_production: false, client_key: '', backend_url: '' };
    container.innerHTML = `
      <div class="card">
        <div class="section-title">Payment Gateway (Midtrans)</div>
        <p class="cell-sub" style="margin-bottom:14px;">
          Aktifkan pembayaran otomatis lewat Midtrans Snap (QRIS, kartu, e-wallet, virtual account) di Kasir (POS).
          <strong>Server Key TIDAK diisi di sini</strong> — kunci itu hanya disimpan aman di file <code>.env</code>
          pada backend (folder <code>payment-server/</code>), demi keamanan. Di sini hanya Client Key (kunci publik)
          dan alamat backend Anda.
        </p>
        <form id="midtrans-form" class="form-grid">
          <div class="field span-2">
            <label class="checkbox-row" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="enabled" ${m.enabled ? 'checked' : ''} style="width:16px;height:16px;margin:0;flex-shrink:0;" /><span>Aktifkan Midtrans sebagai metode pembayaran di Kasir</span></label>
          </div>
          <div class="field span-2">
            <label class="checkbox-row" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="is_production" ${m.is_production ? 'checked' : ''} style="width:16px;height:16px;margin:0;flex-shrink:0;" /><span>Mode Production (live) — biarkan tidak dicentang untuk Sandbox/testing</span></label>
          </div>
          <div class="field span-2"><label>Client Key *</label><input class="input" name="client_key" placeholder="SB-Mid-client-xxxxxxxxxxxxxxxx" value="${Util.escape(m.client_key || '')}" /></div>
          <div class="field span-2"><label>URL Backend Payment Server *</label><input class="input" name="backend_url" placeholder="https://api.tokocafe-anda.com" value="${Util.escape(m.backend_url || '')}" /></div>
        </form>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-save-midtrans"><i data-lucide="save"></i> Simpan Konfigurasi</button>
          <button class="btn btn-outline" id="btn-test-midtrans"><i data-lucide="plug-zap"></i> Tes Koneksi Backend</button>
        </div>
        <div id="midtrans-test-result" class="mt-16"></div>
      </div>
    `;
    UI.icons();

    document.getElementById('btn-save-midtrans').addEventListener('click', () => {
      const f = document.getElementById('midtrans-form');
      const data = UI.serializeForm(f);
      data.enabled = f.querySelector('[name=enabled]').checked;
      data.is_production = f.querySelector('[name=is_production]').checked;
      if (data.enabled && (!data.client_key || !data.backend_url)) {
        UI.toast('Isi Client Key dan URL Backend terlebih dahulu sebelum mengaktifkan.', 'danger');
        return;
      }
      Store.data.settings.midtrans = { ...Store.data.settings.midtrans, ...data };
      const midtransMethod = Store.list('payment_methods').find(pm => pm.id === 'midtrans');
      if (midtransMethod) midtransMethod.enabled = data.enabled;
      Store.save();
      UI.toast('Konfigurasi Midtrans disimpan.', 'success');
    });

    document.getElementById('btn-test-midtrans').addEventListener('click', async () => {
      const f = document.getElementById('midtrans-form');
      const backendUrl = f.querySelector('[name=backend_url]').value.trim();
      const resultEl = document.getElementById('midtrans-test-result');
      if (!backendUrl) { UI.toast('Isi URL Backend terlebih dahulu.', 'danger'); return; }
      resultEl.innerHTML = `<p class="cell-sub">Menghubungi backend…</p>`;
      try {
        const res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        resultEl.innerHTML = `<p style="color:var(--c-success);">✔ Terhubung. Backend merespons: ${Util.escape(JSON.stringify(body))}</p>`;
      } catch (err) {
        resultEl.innerHTML = `<p style="color:var(--c-danger);">✘ Gagal terhubung ke backend (${Util.escape(err.message)}). Pastikan payment-server sudah berjalan & URL benar.</p>`;
      }
    });
  }

  function render(container) {
    container.innerHTML = `<div id="settings-business"></div><div id="settings-midtrans"></div><div id="settings-system"></div>`;
    renderBusinessForm(document.getElementById('settings-business'));
    renderPaymentGatewayForm(document.getElementById('settings-midtrans'));
    renderSystemManagement(document.getElementById('settings-system'));
  }

  Modules.pengaturan = {
    title: 'Pengaturan',
    subtitle: 'Konfigurasi bisnis, pajak, struk, dan manajemen sistem',
    render,
  };
})();