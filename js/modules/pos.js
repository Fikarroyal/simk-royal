/* =========================================================================
   modules/pos.js — Point of Sale (FR-03 POS, FR-04 Payment, FR-05 Receipt, FR-09 QRIS)
   ========================================================================= */
(function () {
  let cart = [];
  let activeCategory = 'all';
  let searchTerm = '';
  let selectedTableId = '';
  let selectedCustomerId = '';
  let manualDiscount = 0;
  let appliedPromo = null;
  let promoInputVal = '';

  function calcTotals() {
    const settings = Store.data.settings;
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    let promoDiscount = 0;
    if (appliedPromo && subtotal >= (appliedPromo.minimum_transaction || 0)) {
      promoDiscount = appliedPromo.type === 'percent'
        ? Math.round(subtotal * appliedPromo.value / 100)
        : appliedPromo.value;
    }
    const totalDiscount = Number(manualDiscount || 0) + promoDiscount;
    const taxable = Math.max(subtotal - totalDiscount, 0);
    const tax = Math.round(taxable * (settings.tax_percent || 0) / 100);
    const service = Math.round(taxable * (settings.service_charge_percent || 0) / 100);
    const total = taxable + tax + service;
    return { subtotal, promoDiscount, totalDiscount, tax, service, total };
  }

  function productCard(p) {
    const cat = Store.get('categories', p.category_id);
    const out = p.stock <= 0;
    const low = !out && p.stock <= p.minimum_stock;
    return `
      <button class="pos-product-card" data-add="${p.id}" ${out ? 'disabled' : ''}>
        ${low ? `<span class="pos-low-tag">${UI.badge('Menipis', 'badge-warning')}</span>` : ''}
        ${out ? `<span class="pos-low-tag">${UI.badge('Habis', 'badge-danger')}</span>` : ''}
        <div class="pos-product-icon"><i data-lucide="${cat ? cat.icon : 'package'}"></i></div>
        <div class="pname">${Util.escape(p.name)}</div>
        <div class="pprice mono">${Util.formatCurrency(p.price)}</div>
        <div class="pstock">Stok: ${p.stock} ${Util.escape(p.unit)}</div>
      </button>`;
  }

  function renderCatalog(container) {
    const categories = Store.list('categories').filter(c => c.status === 'active');
    let products = Store.list('products').filter(p => p.status === 'active');
    if (activeCategory !== 'all') products = products.filter(p => p.category_id === activeCategory);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }

    container.innerHTML = `
      <div class="pos-catalog-head">
        <div class="pos-search">
          <i data-lucide="search"></i>
          <input class="input" id="pos-search-input" placeholder="Cari produk atau SKU..." value="${Util.escape(searchTerm)}" />
        </div>
      </div>
      <div class="pos-category-scroller mt-8" id="pos-cats">
        <button class="chip ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">Semua</button>
        ${categories.map(c => `<button class="chip ${activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}">${Util.escape(c.name)}</button>`).join('')}
      </div>
      <div class="pos-product-grid mt-16" id="pos-grid">
        ${products.length ? products.map(productCard).join('') : `<div style="grid-column:1/-1;">${UI.emptyState('search-x', 'Produk tidak ditemukan', 'Coba kata kunci atau kategori lain.')}</div>`}
      </div>
    `;

    document.getElementById('pos-search-input').addEventListener('input', Util.debounce((e) => {
      searchTerm = e.target.value; renderCatalog(container);
    }, 200));
    container.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => { activeCategory = btn.dataset.cat; renderCatalog(container); });
    });
    container.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => addToCart(btn.dataset.add));
    });
    UI.icons();
  }

  function addToCart(productId) {
    const product = Store.get('products', productId);
    if (!product || product.stock <= 0) return;
    const existing = cart.find(i => i.id === productId);
    const qtyInCart = existing ? existing.qty : 0;
    if (qtyInCart + 1 > product.stock) {
      UI.toast(`Stok ${product.name} tidak mencukupi.`, 'warning');
      return;
    }
    if (existing) existing.qty += 1;
    else cart.push({ id: product.id, name: product.name, price: product.price, qty: 1, item_discount: 0 });
    renderCart();
  }

  function changeQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    const product = Store.get('products', productId);
    const newQty = item.qty + delta;
    if (newQty <= 0) { cart = cart.filter(i => i.id !== productId); renderCart(); return; }
    if (product && newQty > product.stock) { UI.toast('Melebihi stok tersedia.', 'warning'); return; }
    item.qty = newQty;
    renderCart();
  }

  function renderCartPanel(root) {
    const customers = Store.list('customers');
    const tables = Store.list('tables');
    const requiresCashOpen = App.user.role === 'kasir' && !Store.activeCashSession(cashierIdOf(App.user));
    const heldOrders = Store.heldOrdersFor(cashierIdOf(App.user));

    root.innerHTML = `
      <div class="pos-cart">
        <div class="pos-cart-head">
          <div class="pos-cart-head-row">
            <h3>Keranjang</h3>
            <div class="flex gap-8">
              <button class="btn btn-outline btn-sm" id="btn-held-orders"><i data-lucide="list-restart"></i> Ditahan${heldOrders.length ? ` (${heldOrders.length})` : ''}</button>
              <button class="btn btn-gray btn-sm" id="btn-clear-cart" ${cart.length ? '' : 'disabled'}><i data-lucide="trash-2"></i> Kosongkan</button>
            </div>
          </div>
          <div class="pos-meta-row">
            <select class="input" id="pos-customer" style="flex:1;">
              <option value="">Pelanggan (Guest)</option>
              ${customers.map(c => `<option value="${c.id}" ${selectedCustomerId === c.id ? 'selected' : ''}>${Util.escape(c.name)} (${c.membership})</option>`).join('')}
            </select>
            <select class="input" id="pos-table" style="flex:1;">
              <option value="">Take Away</option>
              ${tables.map(t => `<option value="${t.id}" ${selectedTableId === t.id ? 'selected' : ''}>${Util.escape(t.table_number)} (${t.status === 'available' || t.id === selectedTableId ? 'Tersedia' : 'Terisi'})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="pos-cart-items" id="pos-cart-items">
          ${cart.length === 0 ? UI.emptyState('shopping-cart', 'Keranjang kosong', 'Pilih produk di sebelah kiri untuk mulai.') :
        cart.map(i => `
              <div class="cart-item">
                <div class="ci-info">
                  <div class="ci-name">${Util.escape(i.name)}</div>
                  <div class="ci-price">${Util.formatCurrency(i.price)}</div>
                </div>
                <div class="qty-control">
                  <button data-qty-minus="${i.id}"><i data-lucide="minus"></i></button>
                  <span>${i.qty}</span>
                  <button data-qty-plus="${i.id}"><i data-lucide="plus"></i></button>
                </div>
                <button class="ci-remove" data-remove="${i.id}"><i data-lucide="x"></i></button>
              </div>`).join('')}
        </div>

        <div class="pos-cart-summary">
          <div class="pos-promo-row">
            <input class="input" id="pos-promo-code" placeholder="Kode promo" value="${Util.escape(promoInputVal)}" />
            <button class="btn btn-gray btn-sm" id="btn-apply-promo">Terapkan</button>
          </div>
          <div class="field" style="margin-bottom:10px;">
            <label style="font-size:12px;">Diskon Manual (Rp)</label>
            <input class="input" type="number" min="0" id="pos-manual-discount" value="${manualDiscount || ''}" placeholder="0" />
          </div>
          <div id="pos-summary-body"></div>
        </div>

        <div class="pos-cart-actions">
          <button class="btn btn-gray" id="btn-hold-cart" ${cart.length ? '' : 'disabled'}><i data-lucide="pause"></i></button>
          <button class="btn btn-primary btn-block" id="btn-pay" ${cart.length && !requiresCashOpen ? '' : 'disabled'}><i data-lucide="credit-card"></i> Bayar</button>
        </div>
        ${requiresCashOpen ? `<div class="pos-cash-warning"><i data-lucide="alert-triangle"></i> Buka kasir terlebih dahulu sebelum menerima pembayaran.</div>` : ''}
      </div>
    `;

    renderSummary();

    root.querySelector('#pos-customer').addEventListener('change', (e) => { selectedCustomerId = e.target.value; });
    root.querySelector('#pos-table').addEventListener('change', (e) => {
      if (selectedTableId) { const prev = Store.get('tables', selectedTableId); if (prev) { prev.status = 'available'; Store.save(); } }
      selectedTableId = e.target.value;
      if (selectedTableId) { const t = Store.get('tables', selectedTableId); if (t) { t.status = 'occupied'; Store.save(); } }
    });
    root.querySelector('#btn-clear-cart').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Kosongkan Keranjang', message: 'Semua item di keranjang akan dihapus.', danger: true });
      if (ok) { cart = []; appliedPromo = null; promoInputVal = ''; manualDiscount = 0; renderCart(); }
    });
    root.querySelectorAll('[data-qty-plus]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.qtyPlus, 1)));
    root.querySelectorAll('[data-qty-minus]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.qtyMinus, -1)));
    root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { cart = cart.filter(i => i.id !== b.dataset.remove); renderCart(); }));
    root.querySelector('#btn-apply-promo').addEventListener('click', () => {
      const code = root.querySelector('#pos-promo-code').value.trim();
      promoInputVal = code;
      if (!code) { appliedPromo = null; renderSummary(); return; }
      const promo = Store.list('promotions').find(p => p.code.toLowerCase() === code.toLowerCase());
      if (!promo || promo.status !== 'active') { UI.toast('Kode promo tidak valid atau tidak aktif.', 'danger'); appliedPromo = null; }
      else {
        const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
        if (subtotal < (promo.minimum_transaction || 0)) {
          UI.toast(`Minimal transaksi ${Util.formatCurrency(promo.minimum_transaction)} untuk promo ini.`, 'warning');
          appliedPromo = null;
        } else { appliedPromo = promo; UI.toast(`Promo "${promo.name}" diterapkan.`, 'success'); }
      }
      renderSummary();
    });
    const discountInput = root.querySelector('#pos-manual-discount');
    discountInput.addEventListener('input', (e) => {
      manualDiscount = Number(e.target.value) || 0; renderSummary();
    });
    discountInput.addEventListener('blur', async (e) => {
      const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
      const autoLimit = subtotal * 0.2;
      if (App.user.role === 'kasir' && subtotal > 0 && manualDiscount > autoLimit) {
        const authorized = await UI.requestManagerOverride({
          reason: `Diskon manual ${Util.formatCurrency(manualDiscount)} melebihi batas otomatis kasir (20% dari subtotal, maks ${Util.formatCurrency(autoLimit)}). Minta persetujuan Manager/Administrator untuk melanjutkan.`,
        });
        if (!authorized) {
          manualDiscount = 0; e.target.value = '';
          UI.toast('Diskon dibatalkan karena tidak ada otorisasi.', 'warning');
        } else {
          UI.toast(`Diskon disetujui oleh ${authorized.name}.`, 'success');
          Store.logActivity({ type: 'discount_override', actor_id: authorized.id, actor_name: authorized.name, detail: `Menyetujui diskon manual ${Util.formatCurrency(manualDiscount)} untuk kasir ${App.user.name}` });
        }
        renderSummary();
      }
    });
    root.querySelector('#btn-hold-cart').addEventListener('click', () => {
      if (!cart.length) return;
      const { close } = UI.openModal({
        title: 'Tahan Pesanan',
        size: 'sm',
        body: `
          <p class="confirm-text" style="margin-bottom:12px;">Keranjang saat ini (${cart.length} item) akan ditahan sementara dan bisa dilanjutkan lagi nanti.</p>
          <div class="field"><label>Catatan (opsional)</label><input class="input" id="ho-note" placeholder="mis. Meja 4, tunggu tambahan pesanan" /></div>
        `,
        footer: `
          <button class="btn btn-gray" id="ho-cancel">Batal</button>
          <button class="btn btn-primary" id="ho-confirm"><i data-lucide="pause"></i> Tahan Pesanan</button>
        `,
      });
      UI.icons();
      document.getElementById('ho-cancel').addEventListener('click', close);
      document.getElementById('ho-confirm').addEventListener('click', () => {
        Store.holdOrder({
          cashier_id: cashierIdOf(App.user), cashier_name: App.user.name,
          cart: cart.map(i => ({ ...i })), table_id: selectedTableId || null, customer_id: selectedCustomerId || null,
          note: document.getElementById('ho-note').value.trim(),
        });
        cart = []; manualDiscount = 0; appliedPromo = null; promoInputVal = ''; selectedTableId = ''; selectedCustomerId = '';
        close();
        UI.toast('Pesanan berhasil ditahan.', 'success');
        renderCart();
      });
    });
    root.querySelector('#btn-held-orders').addEventListener('click', openHeldOrdersModal);
    root.querySelector('#btn-pay').addEventListener('click', openPaymentModal);
    UI.icons();
  }

  function openHeldOrdersModal() {
    const orders = Store.heldOrdersFor(cashierIdOf(App.user));
    const { root: modalRoot } = UI.openModal({
      title: 'Pesanan Ditahan',
      size: 'md',
      body: orders.length ? `
        <div class="held-order-list">
          ${orders.map(o => `
            <div class="held-order-item">
              <div>
                <strong>${o.cart.length} item · ${Util.formatCurrency(o.cart.reduce((s, i) => s + i.price * i.qty, 0))}</strong>
                <div class="cell-sub">${Util.formatDateTime(o.created_at)}${o.note ? ' · ' + Util.escape(o.note) : ''}</div>
              </div>
              <div class="flex gap-8">
                <button class="btn btn-primary btn-sm" data-resume="${o.id}"><i data-lucide="play"></i> Lanjutkan</button>
                <button class="btn btn-gray btn-sm" data-discard="${o.id}"><i data-lucide="trash-2"></i></button>
              </div>
            </div>`).join('')}
        </div>
      ` : UI.emptyState('list-restart', 'Belum ada pesanan ditahan', 'Pesanan yang ditahan dari keranjang akan muncul di sini.'),
      footer: `<button class="btn btn-gray" id="ho-list-close">Tutup</button>`,
    });
    UI.icons();
    document.getElementById('ho-list-close').addEventListener('click', UI.closeModal);
    modalRoot.querySelectorAll('[data-resume]').forEach(btn => btn.addEventListener('click', () => {
      const order = Store.list('held_orders').find(o => o.id === btn.dataset.resume);
      if (!order) return;
      if (cart.length) UI.toast('Keranjang saat ini digantikan pesanan yang ditahan.', 'info');
      cart = order.cart;
      selectedTableId = order.table_id || '';
      selectedCustomerId = order.customer_id || '';
      Store.removeHeldOrder(order.id);
      UI.closeModal();
      renderCart();
      UI.toast('Pesanan dilanjutkan.', 'success');
    }));
    modalRoot.querySelectorAll('[data-discard]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Buang Pesanan Ditahan', message: 'Pesanan yang ditahan ini akan dihapus permanen. Lanjutkan?', danger: true });
      if (!ok) return;
      Store.removeHeldOrder(btn.dataset.discard);
      openHeldOrdersModal();
    }));
  }

  function renderSummary() {
    const el = document.getElementById('pos-summary-body');
    if (!el) return;
    const t = calcTotals();
    el.innerHTML = `
      <div class="summary-row"><span>Subtotal</span><span class="mono">${Util.formatCurrency(t.subtotal)}</span></div>
      <div class="summary-row"><span>Diskon</span><span class="mono">- ${Util.formatCurrency(t.totalDiscount)}</span></div>
      <div class="summary-row"><span>Pajak (${Store.data.settings.tax_percent}%)</span><span class="mono">${Util.formatCurrency(t.tax)}</span></div>
      <div class="summary-row"><span>Service Charge (${Store.data.settings.service_charge_percent}%)</span><span class="mono">${Util.formatCurrency(t.service)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${Util.formatCurrency(t.total)}</span></div>
    `;
  }

  function renderCart() {
    const root = document.getElementById('pos-cart-root');
    if (root) renderCartPanel(root);
  }

  function cashPresets(total) {
    const rounds = [5000, 10000, 20000, 50000, 100000];
    const presets = new Set([total]);
    rounds.forEach(r => { const val = Math.ceil(total / r) * r; if (val > total) presets.add(val); });
    return Array.from(presets).sort((a, b) => a - b).slice(0, 5);
  }

  /* ------------------------------ Pembayaran ------------------------------ */
  function openPaymentModal() {
    if (App.user.role === 'kasir' && !Store.activeCashSession(cashierIdOf(App.user))) {
      UI.toast('Buka kasir terlebih dahulu sebelum menerima pembayaran.', 'warning');
      return;
    }
    const totals = calcTotals();
    const methods = Store.list('payment_methods').filter(m => m.enabled);
    // Midtrans dikecualikan dari opsi split payment: konfirmasinya async lewat
    // popup, tidak cocok dengan alur split yang butuh konfirmasi instan.
    const splitMethods = methods.filter(m => m.id !== 'midtrans');
    const methodIcon = { cash: 'banknote', qris: 'qr-code', debit: 'credit-card', credit: 'credit-card', transfer: 'landmark', ewallet: 'wallet', midtrans: 'credit-card' };
    let selectedMethod = methods[0] ? methods[0].id : 'cash';
    let splitMode = false;

    const { close } = UI.openModal({
      title: 'Proses Pembayaran',
      size: 'md',
      body: `
        <div class="kv-list" style="margin-bottom:16px;">
          <div class="kv-row"><span>Total Tagihan</span><span style="font-size:20px;" class="mono">${Util.formatCurrency(totals.total)}</span></div>
        </div>
        ${splitMethods.length > 1 ? `
        <label class="checkbox-row" style="margin-bottom:12px;">
          <input type="checkbox" id="pm-split-toggle" /> Bagi Pembayaran (Split) dengan 2 metode sekaligus
        </label>` : ''}
        <div id="pm-single-wrap">
          <div class="field">
            <label>Metode Pembayaran</label>
            <div class="pos-category-scroller" id="pm-methods">
              ${methods.map(m => `<button type="button" class="chip ${m.id === selectedMethod ? 'active' : ''}" data-method="${m.id}"><i data-lucide="${methodIcon[m.id] || 'wallet'}" style="width:14px;height:14px;"></i> ${Util.escape(m.name)}</button>`).join('')}
            </div>
          </div>
          <div id="pm-body" class="mt-16"></div>
        </div>
        <div id="pm-split-wrap" class="hidden">
          <div class="field">
            <label>Metode 1</label>
            <select class="input" id="pm-split-method1">${splitMethods.map(m => `<option value="${m.id}">${Util.escape(m.name)}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Jumlah Metode 1 (Rp)</label>
            <input class="input" type="number" min="0" max="${totals.total}" id="pm-split-amount1" value="${Math.round(totals.total / 2)}" />
          </div>
          <div class="field">
            <label>Metode 2</label>
            <select class="input" id="pm-split-method2">${splitMethods.map((m, idx) => `<option value="${m.id}" ${idx === 1 ? 'selected' : ''}>${Util.escape(m.name)}</option>`).join('')}</select>
          </div>
          <div class="kv-row"><span>Jumlah Metode 2 (otomatis)</span><span class="mono" id="pm-split-amount2">${Util.formatCurrency(Math.round(totals.total / 2))}</span></div>
        </div>
      `,
      footer: `
        <button class="btn btn-gray" id="pm-cancel">Batal</button>
        <button class="btn btn-primary" id="pm-confirm"><i data-lucide="check"></i> Konfirmasi Pembayaran</button>
      `,
    });

    function renderMethodBody() {
      const body = document.getElementById('pm-body');
      if (selectedMethod === 'cash') {
        body.innerHTML = `
          <div class="field">
            <label>Uang Diterima</label>
            <input class="input" type="number" id="pm-cash-amount" min="0" placeholder="0" value="${totals.total}" />
          </div>
          <div class="cash-preset-row">
            ${cashPresets(totals.total).map(v => `<button type="button" class="chip" data-preset="${v}">${v === totals.total ? 'Uang Pas' : Util.formatCurrency(v)}</button>`).join('')}
          </div>
          <div class="kv-row"><span>Kembalian</span><span class="mono" id="pm-change">${Util.formatCurrency(0)}</span></div>
        `;
        const input = document.getElementById('pm-cash-amount');
        const updateChange = () => {
          const val = Number(input.value) || 0;
          document.getElementById('pm-change').textContent = Util.formatCurrency(Math.max(val - totals.total, 0));
        };
        input.addEventListener('input', updateChange);
        document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => {
          input.value = btn.dataset.preset; updateChange();
        }));
        updateChange();
      } else if (selectedMethod === 'qris') {
        body.innerHTML = `
          <div class="qris-box">
            <div id="qrcode-canvas-wrap"><div id="qrcode-canvas"></div></div>
            <p class="text-muted" style="font-size:12.5px;">Pindai QRIS di atas menggunakan m-banking / e-wallet apa pun.</p>
            <p class="mono" style="font-size:12px;">Merchant: ${Util.escape(Store.data.settings.qris_merchant_name)}</p>
            <div class="qris-timer" id="qris-timer">05:00</div>
          </div>
        `;
        if (window.QRCode) {
          new QRCode(document.getElementById('qrcode-canvas'), {
            text: `SIMKROYAL|QRIS|${Store.data.settings.qris_merchant_name}|${totals.total}|${Date.now()}`,
            width: 168, height: 168,
          });
        }
        let seconds = 300;
        const timerEl = document.getElementById('qris-timer');
        const timerInt = setInterval(() => {
          seconds--;
          if (!document.getElementById('qris-timer')) { clearInterval(timerInt); return; }
          const m = String(Math.floor(seconds / 60)).padStart(2, '0');
          const s = String(seconds % 60).padStart(2, '0');
          timerEl.textContent = `${m}:${s}`;
          if (seconds <= 0) clearInterval(timerInt);
        }, 1000);
      } else if (selectedMethod === 'midtrans') {
        const configured = window.MidtransPay && MidtransPay.isConfigured();
        body.innerHTML = configured ? `
          <div class="empty-state">
            <i data-lucide="credit-card"></i>
            <h4>Bayar dengan Midtrans</h4>
            <p>Pelanggan bisa membayar dengan QRIS, kartu, e-wallet, atau virtual account lewat popup Midtrans. Transaksi baru tercatat otomatis setelah pembayaran dikonfirmasi.</p>
          </div>
          <button type="button" class="btn btn-primary btn-block mt-16" id="pm-midtrans-pay"><i data-lucide="external-link"></i> Buka Popup Pembayaran Midtrans</button>
          <div id="pm-midtrans-status" class="mt-16"></div>
        ` : `
          <div class="empty-state">
            <i data-lucide="settings"></i>
            <h4>Midtrans Belum Dikonfigurasi</h4>
            <p>Aktifkan & isi Client Key + URL backend di menu <strong>Pengaturan → Payment Gateway (Midtrans)</strong> terlebih dahulu.</p>
          </div>
        `;
        if (configured) {
          document.getElementById('pm-midtrans-pay').addEventListener('click', () => startMidtransPayment(totals));
        }
      } else {
        const labelMap = { debit: 'Gesek kartu debit pada mesin EDC.', credit: 'Gesek kartu kredit pada mesin EDC.', transfer: 'Terima konfirmasi transfer bank pelanggan.', ewallet: 'Terima pembayaran melalui aplikasi e-wallet.' };
        body.innerHTML = `<div class="empty-state"><i data-lucide="check-circle-2"></i><h4>${Util.escape(labelMap[selectedMethod] || 'Konfirmasi pembayaran')}</h4><p>Tekan konfirmasi setelah pembayaran diterima.</p></div>`;
      }
      UI.icons();
    }

    document.getElementById('pm-methods').querySelectorAll('[data-method]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMethod = btn.dataset.method;
        document.querySelectorAll('#pm-methods .chip').forEach(c => c.classList.toggle('active', c.dataset.method === selectedMethod));
        renderMethodBody();
        updateConfirmButtonVisibility();
      });
    });

    // Untuk metode Midtrans, konfirmasi transaksi terjadi otomatis setelah
    // pembayaran diverifikasi (async, lewat tombol khusus di atas) — bukan
    // lewat tombol "Konfirmasi Pembayaran" generik, supaya kasir tidak bisa
    // meloloskan transaksi tanpa pembayaran benar-benar diterima.
    function updateConfirmButtonVisibility() {
      const confirmBtn = document.getElementById('pm-confirm');
      if (!confirmBtn) return;
      const shouldHide = !splitMode && selectedMethod === 'midtrans';
      confirmBtn.classList.toggle('hidden', shouldHide);
    }
    updateConfirmButtonVisibility();
    renderMethodBody();

    const splitToggle = document.getElementById('pm-split-toggle');
    const singleWrap = document.getElementById('pm-single-wrap');
    const splitWrap = document.getElementById('pm-split-wrap');
    const split1 = document.getElementById('pm-split-amount1');
    const split2El = document.getElementById('pm-split-amount2');
    const updateSplit2 = () => {
      const a1 = Util.clamp(Number(split1.value) || 0, 0, totals.total);
      split2El.textContent = Util.formatCurrency(totals.total - a1);
    };
    if (split1) split1.addEventListener('input', updateSplit2);
    if (splitToggle) {
      splitToggle.addEventListener('change', () => {
        splitMode = splitToggle.checked;
        singleWrap.classList.toggle('hidden', splitMode);
        splitWrap.classList.toggle('hidden', !splitMode);
        updateConfirmButtonVisibility();
      });
    }

    function finalizeSale(finalMethod, paymentAmount, splits, extra) {
      const trx = Store.completeTransaction({
        cart, customer_id: selectedCustomerId, table_id: selectedTableId,
        cashier_id: App.user.employeeId || App.user.id, discount: manualDiscount,
        payment_method: finalMethod, payment_amount: paymentAmount, promo_code: appliedPromo ? appliedPromo.code : null,
        splits, ...extra,
      });
      close();
      cart = []; appliedPromo = null; promoInputVal = ''; manualDiscount = 0; selectedTableId = ''; selectedCustomerId = '';
      UI.toast(`Transaksi ${trx.invoice_number} berhasil.`, 'success');
      App.refresh();
      window.Receipt.showModal(trx.id);
    }

    // Alur pembayaran Midtrans: async lewat popup Snap, transaksi baru
    // difinalisasi setelah backend mengonfirmasi status pembayaran (yang
    // datanya berasal dari webhook Midtrans, bukan sekadar sinyal browser).
    async function startMidtransPayment(totalsArg) {
      const statusEl = document.getElementById('pm-midtrans-status');
      const payBtn = document.getElementById('pm-midtrans-pay');
      if (payBtn) payBtn.disabled = true;
      const orderId = `SIMK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const customer = selectedCustomerId ? Store.get('customers', selectedCustomerId) : null;
      try {
        const result = await MidtransPay.pay({
          order_id: orderId,
          gross_amount: Math.round(totalsArg.total),
          items: cart.map(i => ({ id: i.id, name: i.name, price: Math.round(i.price), quantity: i.qty })),
          customer: customer ? { first_name: customer.name, phone: customer.phone, email: customer.email } : undefined,
        }, {
          onWaiting: () => {
            if (statusEl) statusEl.innerHTML = `<div class="empty-state"><i data-lucide="loader"></i><h4>Menunggu Konfirmasi Pembayaran…</h4><p>Jangan tutup jendela ini sampai status terkonfirmasi.</p></div>`;
            UI.icons();
          },
        });

        if (result.ok) {
          finalizeSale('midtrans', totalsArg.total, null, { midtrans_order_id: orderId, midtrans_status: result.status });
        } else if (result.status === 'closed') {
          if (payBtn) payBtn.disabled = false;
          if (statusEl) statusEl.innerHTML = '';
        } else {
          UI.toast(`Pembayaran Midtrans tidak berhasil (status: ${result.status}). Silakan coba lagi.`, 'danger');
          if (payBtn) payBtn.disabled = false;
          if (statusEl) statusEl.innerHTML = '';
        }
      } catch (err) {
        UI.toast(err.message || 'Gagal memproses pembayaran Midtrans.', 'danger');
        if (payBtn) payBtn.disabled = false;
      }
    }

    document.getElementById('pm-cancel').addEventListener('click', close);
    document.getElementById('pm-confirm').addEventListener('click', () => {
      let paymentAmount = totals.total;
      let splits = null;
      let finalMethod = selectedMethod;

      if (splitMode) {
        const method1 = document.getElementById('pm-split-method1').value;
        const method2 = document.getElementById('pm-split-method2').value;
        const amount1 = Util.clamp(Number(split1.value) || 0, 0, totals.total);
        const amount2 = totals.total - amount1;
        if (method1 === method2) { UI.toast('Pilih dua metode pembayaran yang berbeda.', 'warning'); return; }
        if (amount1 <= 0 || amount2 <= 0) { UI.toast('Jumlah tiap metode harus lebih dari 0.', 'warning'); return; }
        splits = [{ method: method1, amount: amount1 }, { method: method2, amount: amount2 }];
        finalMethod = 'split';
        paymentAmount = totals.total;
      } else if (selectedMethod === 'cash') {
        paymentAmount = Number(document.getElementById('pm-cash-amount').value) || 0;
        if (paymentAmount < totals.total) { UI.toast('Uang diterima kurang dari total tagihan.', 'danger'); return; }
      }

      finalizeSale(finalMethod, paymentAmount, splits);
    });
  }

  /* ------------------------------ Kas Kasir (Buka/Tutup) ------------------------------ */
  function cashierIdOf(user) {
    return user.employeeId || user.id;
  }

  function renderCashBar(barEl) {
    const cashierId = cashierIdOf(App.user);
    const session = Store.activeCashSession(cashierId);

    if (session) {
      const salesTotal = Store.cashSessionSalesTotal(session);
      const { cashIn, cashOut } = Store.cashSessionInOutTotal(session);
      const expected = Store.cashSessionExpected(session);
      const limit = Store.data.settings.cash_drawer_limit || 0;
      const overLimit = limit > 0 && expected > limit;
      barEl.innerHTML = `
        <div class="cash-bar is-open">
          <div class="cash-bar-info">
            <div class="cash-bar-icon"><i data-lucide="wallet"></i></div>
            <div class="cash-bar-text">
              <strong>Kasir sedang dibuka</strong>
              <span>Dibuka ${Util.formatDateTime(session.opened_at)}</span>
            </div>
          </div>
          <div class="cash-bar-stats">
            <div class="cash-bar-stat">Kas Awal<strong>${Util.formatCurrency(session.opening_cash)}</strong></div>
            <div class="cash-bar-stat">Penjualan Tunai<strong>${Util.formatCurrency(salesTotal)}</strong></div>
            ${cashIn || cashOut ? `<div class="cash-bar-stat">Kas Masuk/Keluar<strong>+${Util.formatCurrency(cashIn)} / -${Util.formatCurrency(cashOut)}</strong></div>` : ''}
            <div class="cash-bar-stat">Estimasi Kas Saat Ini<strong>${Util.formatCurrency(expected)}</strong></div>
          </div>
          <div class="cash-bar-actions">
            <button class="btn btn-outline btn-sm" id="btn-cash-movement"><i data-lucide="arrow-left-right"></i> Kas Masuk/Keluar</button>
            <button class="btn btn-outline btn-sm" id="btn-cash-history"><i data-lucide="history"></i> Kas &amp; Aktivitas</button>
            <button class="btn btn-danger btn-sm" id="btn-close-cash"><i data-lucide="lock"></i> Tutup Kasir</button>
          </div>
        </div>
        ${overLimit ? `<div class="pos-cash-warning"><i data-lucide="shield-alert"></i> Kas di laci sudah ${Util.formatCurrency(expected)}, melebihi batas ${Util.formatCurrency(limit)}. Sebaiknya lakukan cash drop (setor sebagian ke brankas).</div>` : ''}`;
    } else {
      barEl.innerHTML = `
        <div class="cash-bar is-closed">
          <div class="cash-bar-info">
            <div class="cash-bar-icon"><i data-lucide="wallet"></i></div>
            <div class="cash-bar-text">
              <strong>Kasir belum dibuka</strong>
              <span>Catat modal awal terlebih dahulu sebelum mulai melayani transaksi.</span>
            </div>
          </div>
          <div class="cash-bar-actions">
            <button class="btn btn-outline btn-sm" id="btn-cash-history"><i data-lucide="history"></i> Kas &amp; Aktivitas</button>
            <button class="btn btn-primary btn-sm" id="btn-open-cash"><i data-lucide="unlock"></i> Buka Kasir</button>
          </div>
        </div>`;
    }
    UI.icons();

    const openBtn = document.getElementById('btn-open-cash');
    if (openBtn) openBtn.addEventListener('click', () => openCashModal(barEl));
    const closeBtn = document.getElementById('btn-close-cash');
    if (closeBtn) closeBtn.addEventListener('click', () => closeCashModal(session, barEl));
    const moveBtn = document.getElementById('btn-cash-movement');
    if (moveBtn) moveBtn.addEventListener('click', () => openCashMovementModal(session));
    document.getElementById('btn-cash-history').addEventListener('click', openCashHistoryModal);
  }

  function refreshCashArea() {
    const barEl = document.getElementById('pos-cash-bar');
    if (barEl) renderCashBar(barEl);
    renderCart();
  }

  function openCashModal(barEl) {
    const { close } = UI.openModal({
      title: 'Buka Kasir',
      size: 'sm',
      body: `
        <div class="field">
          <label>Kas Awal / Modal (Rp) *</label>
          <input class="input" type="number" min="0" id="oc-amount" placeholder="mis. 500000" />
        </div>
        <div class="field">
          <label>Catatan (opsional)</label>
          <input class="input" id="oc-note" placeholder="mis. Shift pagi" />
        </div>
      `,
      footer: `
        <button class="btn btn-gray" id="oc-cancel">Batal</button>
        <button class="btn btn-primary" id="oc-confirm"><i data-lucide="unlock"></i> Buka Kasir</button>
      `,
    });
    document.getElementById('oc-cancel').addEventListener('click', close);
    document.getElementById('oc-confirm').addEventListener('click', () => {
      const amountInput = document.getElementById('oc-amount').value;
      if (amountInput === '') { UI.toast('Isi jumlah kas awal terlebih dahulu.', 'warning'); return; }
      Store.openCashSession({
        cashier_id: cashierIdOf(App.user),
        cashier_name: App.user.name,
        opening_cash: Number(amountInput),
        note: document.getElementById('oc-note').value.trim(),
      });
      close();
      UI.toast('Kasir berhasil dibuka.', 'success');
      refreshCashArea();
    });
  }

  const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];

  function closeCashModal(session, barEl) {
    if (!session) return;
    const salesTotal = Store.cashSessionSalesTotal(session);
    const { cashIn, cashOut } = Store.cashSessionInOutTotal(session);
    const expected = Store.cashSessionExpected(session);
    const { close } = UI.openModal({
      title: 'Tutup Kasir',
      size: 'md',
      body: `
        <div class="kv-list" style="margin-bottom:16px;">
          <div class="kv-row"><span>Kas Awal</span><span>${Util.formatCurrency(session.opening_cash)}</span></div>
          <div class="kv-row"><span>Penjualan Tunai</span><span>${Util.formatCurrency(salesTotal)}</span></div>
          ${cashIn || cashOut ? `<div class="kv-row"><span>Kas Masuk/Keluar</span><span>+${Util.formatCurrency(cashIn)} / -${Util.formatCurrency(cashOut)}</span></div>` : ''}
          <div class="kv-row"><span>Estimasi Kas Sistem</span><span>${Util.formatCurrency(expected)}</span></div>
        </div>
        <div class="field">
          <label>Rincian Pecahan Uang Fisik (opsional, otomatis dijumlah)</label>
          <div class="denom-grid">
            ${DENOMS.map(d => `
              <div class="denom-row">
                <span class="denom-label">${Util.formatCurrency(d)}</span>
                <span class="denom-x">x</span>
                <input class="input" type="number" min="0" data-denom="${d}" placeholder="0" />
                <span class="denom-subtotal mono" data-denom-subtotal="${d}">Rp 0</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="field">
          <label>Total Uang Tunai Fisik (Rp) *</label>
          <input class="input" type="number" min="0" id="cc-amount" placeholder="mis. 1250000" />
        </div>
        <div class="field">
          <label>Catatan (opsional)</label>
          <input class="input" id="cc-note" placeholder="mis. selisih kembalian" />
        </div>
      `,
      footer: `
        <button class="btn btn-gray" id="cc-cancel">Batal</button>
        <button class="btn btn-danger" id="cc-confirm"><i data-lucide="lock"></i> Tutup Kasir</button>
      `,
    });
    UI.icons();
    const amountInputEl = document.getElementById('cc-amount');
    document.querySelectorAll('[data-denom]').forEach(input => {
      input.addEventListener('input', () => {
        let total = 0;
        document.querySelectorAll('[data-denom]').forEach(inp => {
          const qty = Number(inp.value) || 0;
          const denom = Number(inp.dataset.denom);
          document.querySelector(`[data-denom-subtotal="${denom}"]`).textContent = Util.formatCurrency(qty * denom);
          total += qty * denom;
        });
        amountInputEl.value = total;
      });
    });
    document.getElementById('cc-cancel').addEventListener('click', close);
    document.getElementById('cc-confirm').addEventListener('click', () => {
      const amountInput = amountInputEl.value;
      if (amountInput === '') { UI.toast('Isi jumlah kas fisik yang dihitung.', 'warning'); return; }
      const denominations = {};
      document.querySelectorAll('[data-denom]').forEach(inp => {
        const qty = Number(inp.value) || 0;
        if (qty > 0) denominations[inp.dataset.denom] = qty;
      });
      const closed = Store.closeCashSession(session.id, Number(amountInput), document.getElementById('cc-note').value.trim(), Object.keys(denominations).length ? denominations : null);
      close();
      if (closed.difference === 0) UI.toast('Kasir ditutup, kas sesuai catatan sistem.', 'success');
      else if (closed.difference > 0) UI.toast(`Kasir ditutup, kas lebih ${Util.formatCurrency(closed.difference)}.`, 'warning');
      else UI.toast(`Kasir ditutup, kas kurang ${Util.formatCurrency(Math.abs(closed.difference))}.`, 'danger');
      refreshCashArea();
    });
  }

  function openCashMovementModal(session) {
    if (!session) return;
    let selectedType = 'in';
    const { close } = UI.openModal({
      title: 'Kas Masuk / Kas Keluar',
      size: 'sm',
      body: `
        <div class="field">
          <label>Jenis *</label>
          <div class="pos-category-scroller" id="cm-type-scroller">
            <button type="button" class="chip active" data-move-type="in"><i data-lucide="arrow-down-circle" style="width:14px;height:14px;"></i> Kas Masuk</button>
            <button type="button" class="chip" data-move-type="out"><i data-lucide="arrow-up-circle" style="width:14px;height:14px;"></i> Kas Keluar</button>
          </div>
        </div>
        <div class="field">
          <label>Jumlah (Rp) *</label>
          <input class="input" type="number" min="0" id="cm-amount" placeholder="mis. 100000" />
        </div>
        <div class="field">
          <label>Keterangan *</label>
          <input class="input" id="cm-reason" placeholder="mis. Tambahan modal / beli galon air" />
        </div>
      `,
      footer: `
        <button class="btn btn-gray" id="cm-cancel">Batal</button>
        <button class="btn btn-primary" id="cm-confirm"><i data-lucide="arrow-left-right"></i> Simpan</button>
      `,
    });
    UI.icons();
    document.querySelectorAll('[data-move-type]').forEach(btn => btn.addEventListener('click', () => {
      selectedType = btn.dataset.moveType;
      document.querySelectorAll('[data-move-type]').forEach(b => b.classList.toggle('active', b === btn));
    }));
    document.getElementById('cm-cancel').addEventListener('click', close);
    document.getElementById('cm-confirm').addEventListener('click', () => {
      const amount = Number(document.getElementById('cm-amount').value);
      const reason = document.getElementById('cm-reason').value.trim();
      if (!amount) { UI.toast('Isi jumlah kas terlebih dahulu.', 'warning'); return; }
      if (!reason) { UI.toast('Isi keterangan kas masuk/keluar.', 'warning'); return; }
      Store.addCashMovement({ session_id: session.id, cashier_id: session.cashier_id, cashier_name: session.cashier_name, type: selectedType, amount, reason });
      close();
      UI.toast(selectedType === 'in' ? 'Kas masuk berhasil dicatat.' : 'Kas keluar berhasil dicatat.', 'success');
      refreshCashArea();
    });
  }

  const ACTIVITY_ICON = {
    open_session: 'unlock', close_session: 'lock', cash_in: 'arrow-down-circle',
    cash_out: 'arrow-up-circle', refund: 'undo-2', hold_order: 'pause', void: 'ban',
    discount_override: 'shield-check',
  };
  let cashModalTab = 'sesi';

  function openCashHistoryModal() {
    cashModalTab = 'sesi';
    renderCashHistoryModal();
  }

  function renderCashHistoryModal() {
    const canSeeAll = App.user.role === 'administrator' || App.user.role === 'manager';
    const myId = cashierIdOf(App.user);

    const { root } = UI.openModal({
      title: 'Kas & Aktivitas Kasir',
      size: 'lg',
      body: `
        <div class="tabs" style="margin-bottom:14px;">
          <button class="tab-btn ${cashModalTab === 'sesi' ? 'active' : ''}" data-ctab="sesi">Sesi Kasir</button>
          <button class="tab-btn ${cashModalTab === 'kas' ? 'active' : ''}" data-ctab="kas">Kas Masuk/Keluar</button>
          <button class="tab-btn ${cashModalTab === 'log' ? 'active' : ''}" data-ctab="log">Log Aktivitas</button>
        </div>
        <div id="ch-tab-content"></div>
      `,
      footer: `<button class="btn btn-gray" id="ch-close">Tutup</button>`,
    });
    document.getElementById('ch-close').addEventListener('click', UI.closeModal);
    root.querySelectorAll('[data-ctab]').forEach(btn => btn.addEventListener('click', () => { cashModalTab = btn.dataset.ctab; renderCashHistoryModal(); }));

    const content = document.getElementById('ch-tab-content');

    if (cashModalTab === 'sesi') {
      const sessions = Store.list('cash_sessions').filter(s => canSeeAll || s.cashier_id === myId).slice().sort((a, b) => b.opened_at.localeCompare(a.opened_at));
      const closedToday = sessions.filter(s => s.status === 'closed' && s.closed_at && s.closed_at.slice(0, 10) === Util.todayISO());
      const totalSelisihHariIni = closedToday.reduce((s, x) => s + x.difference, 0);
      content.innerHTML = `
        ${canSeeAll ? `
        <div class="grid grid-3" style="margin-bottom:14px;">
          <div class="card" style="box-shadow:none;"><div class="cell-sub">Sesi Ditutup Hari Ini</div><div class="cell-title mono">${closedToday.length}</div></div>
          <div class="card" style="box-shadow:none;"><div class="cell-sub">Total Selisih Hari Ini</div><div class="cell-title mono">${Util.formatCurrency(totalSelisihHariIni)}</div></div>
          <div class="card" style="box-shadow:none;"><div class="cell-sub">Sesi Sedang Berjalan</div><div class="cell-title mono">${sessions.filter(s => s.status === 'open').length}</div></div>
        </div>` : ''}
        ${sessions.length ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Kasir</th><th>Dibuka</th><th>Ditutup</th><th>Kas Awal</th><th>Kas Akhir</th><th>Selisih</th><th>Status</th></tr></thead>
            <tbody>
              ${sessions.map(s => `
                <tr>
                  <td>${Util.escape(s.cashier_name)}</td>
                  <td class="cell-sub">${Util.formatDateTime(s.opened_at)}</td>
                  <td class="cell-sub">${s.closed_at ? Util.formatDateTime(s.closed_at) : '-'}</td>
                  <td class="mono">${Util.formatCurrency(s.opening_cash)}</td>
                  <td class="mono">${s.closing_cash === null ? '-' : Util.formatCurrency(s.closing_cash)}</td>
                  <td class="mono">${s.difference === null ? '-' : (s.difference === 0 ? 'Pas' : (s.difference > 0 ? '+' : '-') + Util.formatCurrency(Math.abs(s.difference)))}</td>
                  <td>${s.status === 'open' ? UI.badge('Berjalan', 'badge-info') : UI.badge('Ditutup', 'badge-gray')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : UI.emptyState('wallet', 'Belum ada riwayat kasir', 'Riwayat buka/tutup kasir akan muncul di sini.')}
      `;
    } else if (cashModalTab === 'kas') {
      const moves = Store.list('cash_movements').filter(m => canSeeAll || m.cashier_id === myId).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
      content.innerHTML = moves.length ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Waktu</th><th>Kasir</th><th>Jenis</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${moves.map(m => `
                <tr>
                  <td class="cell-sub">${Util.formatDateTime(m.created_at)}</td>
                  <td>${Util.escape(m.cashier_name)}</td>
                  <td>${m.type === 'in' ? UI.badge('Kas Masuk', 'badge-success') : UI.badge('Kas Keluar', 'badge-danger')}</td>
                  <td class="mono">${Util.formatCurrency(m.amount)}</td>
                  <td class="cell-sub">${Util.escape(m.reason)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : UI.emptyState('arrow-left-right', 'Belum ada kas masuk/keluar', 'Pencatatan kas masuk/keluar akan muncul di sini.');
    } else {
      const logs = Store.list('activity_logs').filter(l => canSeeAll || l.actor_id === myId).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150);
      content.innerHTML = logs.length ? `
        <div class="activity-log-list">
          ${logs.map(l => `
            <div class="activity-log-item">
              <div class="activity-log-icon"><i data-lucide="${ACTIVITY_ICON[l.type] || 'circle'}"></i></div>
              <div>
                <div class="cell-title" style="font-size:13px;">${Util.escape(l.detail)}</div>
                <div class="cell-sub">${Util.escape(l.actor_name)} · ${Util.formatDateTime(l.created_at)}</div>
              </div>
            </div>`).join('')}
        </div>
      ` : UI.emptyState('history', 'Belum ada aktivitas', 'Aktivitas kasir seperti buka/tutup kasir, kas masuk/keluar, retur, dan void akan tercatat di sini.');
    }
    UI.icons();
  }

  function render(container) {
    // Resolusi cashier employee id dari user login (jika ada relasi employee_id)
    const userRecord = Store.list('users').find(u => u.id === App.user.id);
    App.user.employeeId = userRecord ? userRecord.employee_id : null;

    container.innerHTML = `
      <div id="pos-cash-bar"></div>
      <div class="pos-layout">
        <div id="pos-catalog-root"></div>
        <div id="pos-cart-root"></div>
      </div>
    `;
    renderCashBar(document.getElementById('pos-cash-bar'));
    renderCatalog(document.getElementById('pos-catalog-root'));
    renderCartPanel(document.getElementById('pos-cart-root'));
  }

  Modules.pos = {
    title: 'Kasir (POS)',
    subtitle: 'Buat transaksi penjualan baru dengan cepat',
    render,
  };

  /* ============================ Struk / Receipt ============================ */
  function paymentLabel(trx) {
    if (trx.payment_method === 'split' && Array.isArray(trx.splits)) {
      const names = trx.splits.map(s => {
        const m = Store.list('payment_methods').find(x => x.id === s.method);
        return (m ? m.name : s.method).toUpperCase();
      });
      return `SPLIT (${names.join(' + ')})`;
    }
    return trx.payment_method.toUpperCase();
  }

  window.Receipt = {
    build(trxId) {
      const detail = Store.transactionDetail(trxId);
      if (!detail) return '';
      const s = Store.data.settings;
      const { trx, items, cashier, customer, table } = detail;
      return `
        <div class="receipt-preview">
          <div class="r-center">
            <h3>${Util.escape(s.business_name)}</h3>
            <div>${Util.escape(s.address)}</div>
            <div>${Util.escape(s.phone)}</div>
          </div>
          <hr/>
          <table>
            <tr><td>No. Invoice</td><td>: ${trx.invoice_number}</td></tr>
            <tr><td>Tanggal</td><td>: ${Util.formatDateTime(trx.created_at)}</td></tr>
            <tr><td>Kasir</td><td>: ${cashier ? Util.escape(cashier.name) : '-'}</td></tr>
            <tr><td>Pelanggan</td><td>: ${customer ? Util.escape(customer.name) : 'Guest'}</td></tr>
            <tr><td>Meja</td><td>: ${table ? Util.escape(table.table_number) : 'Take Away'}</td></tr>
          </table>
          <hr/>
          <table>
            ${items.map(i => `
              <tr><td colspan="2">${Util.escape(i.product ? i.product.name : '-')}</td></tr>
              <tr>
                <td>${i.quantity} x ${Util.formatCurrency(i.price)}</td>
                <td class="text-right">${Util.formatCurrency(i.subtotal)}</td>
              </tr>`).join('')}
          </table>
          <hr/>
          <table>
            <tr><td>Subtotal</td><td class="text-right">${Util.formatCurrency(trx.subtotal)}</td></tr>
            <tr><td>Diskon</td><td class="text-right">- ${Util.formatCurrency(trx.discount)}</td></tr>
            <tr><td>Pajak</td><td class="text-right">${Util.formatCurrency(trx.tax)}</td></tr>
            <tr><td>Service</td><td class="text-right">${Util.formatCurrency(trx.service_charge)}</td></tr>
            <tr><td><strong>TOTAL</strong></td><td class="text-right"><strong>${Util.formatCurrency(trx.total)}</strong></td></tr>
            <tr><td>Bayar (${paymentLabel(trx)})</td><td class="text-right">${Util.formatCurrency(trx.payment_amount)}</td></tr>
            <tr><td>Kembali</td><td class="text-right">${Util.formatCurrency(trx.change)}</td></tr>
          </table>
          <hr/>
          <div class="r-center">${Util.escape(s.receipt_footer)}</div>
        </div>
      `;
    },

    showModal(trxId) {
      const html = this.build(trxId);
      UI.openModal({
        title: 'Struk Transaksi',
        size: 'sm',
        body: html,
        footer: `
          <button class="btn btn-gray" id="btn-receipt-close">Tutup</button>
          <button class="btn btn-outline" id="btn-receipt-pdf"><i data-lucide="file-down"></i> PDF</button>
          <button class="btn btn-primary" id="btn-receipt-print"><i data-lucide="printer"></i> Cetak</button>
        `,
      });
      document.getElementById('btn-receipt-close').addEventListener('click', UI.closeModal);
      document.getElementById('btn-receipt-print').addEventListener('click', () => this.print(trxId));
      document.getElementById('btn-receipt-pdf').addEventListener('click', () => this.pdf(trxId));
    },

    print(trxId) {
      UI.printSection(this.build(trxId), 'Struk Transaksi');
    },

    pdf(trxId) {
      const detail = Store.transactionDetail(trxId);
      if (!detail || !window.jspdf) return;
      const { jsPDF } = window.jspdf;
      const { trx, items, cashier, customer, table } = detail;
      const s = Store.data.settings;
      const lineHeight = 5;
      const headerLines = 8;
      const itemLines = items.length * 2;
      const footerLines = 10;
      const totalHeight = 40 + (headerLines + itemLines + footerLines) * lineHeight;
      const doc = new jsPDF({ unit: 'mm', format: [80, totalHeight] });
      let y = 8;
      doc.setFont('courier', 'bold'); doc.setFontSize(11);
      doc.text(s.business_name, 40, y, { align: 'center' }); y += 5;
      doc.setFont('courier', 'normal'); doc.setFontSize(8);
      doc.text(s.address, 40, y, { align: 'center' }); y += 4;
      doc.text(s.phone, 40, y, { align: 'center' }); y += 5;
      doc.text('--------------------------------', 40, y, { align: 'center' }); y += 4;
      const kv = (k, v) => { doc.text(`${k}: ${v}`, 5, y); y += 4; };
      kv('Invoice', trx.invoice_number);
      kv('Tanggal', Util.formatDateTime(trx.created_at));
      kv('Kasir', cashier ? cashier.name : '-');
      kv('Pelanggan', customer ? customer.name : 'Guest');
      kv('Meja', table ? table.table_number : 'Take Away');
      doc.text('--------------------------------', 40, y, { align: 'center' }); y += 4;
      items.forEach(i => {
        doc.text(i.product ? i.product.name : '-', 5, y); y += 4;
        doc.text(`${i.quantity} x ${Util.formatCurrency(i.price)}`, 5, y);
        doc.text(Util.formatCurrency(i.subtotal), 75, y, { align: 'right' }); y += 4;
      });
      doc.text('--------------------------------', 40, y, { align: 'center' }); y += 4;
      const row = (k, v, bold) => { doc.setFont('courier', bold ? 'bold' : 'normal'); doc.text(k, 5, y); doc.text(v, 75, y, { align: 'right' }); y += 4; };
      row('Subtotal', Util.formatCurrency(trx.subtotal));
      row('Diskon', '-' + Util.formatCurrency(trx.discount));
      row('Pajak', Util.formatCurrency(trx.tax));
      row('Service', Util.formatCurrency(trx.service_charge));
      row('TOTAL', Util.formatCurrency(trx.total), true);
      row(paymentLabel(trx), Util.formatCurrency(trx.payment_amount));
      row('Kembali', Util.formatCurrency(trx.change));
      y += 2;
      doc.setFont('courier', 'normal'); doc.setFontSize(7.5);
      doc.text(s.receipt_footer, 40, y, { align: 'center', maxWidth: 70 });
      doc.save(`Struk-${trx.invoice_number}.pdf`);
    },
  };
})();
