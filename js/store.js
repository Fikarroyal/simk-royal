/* =========================================================================
   store.js
   Lapisan data SIMK Royal. Semua data disimpan di localStorage (browser)
   sehingga aplikasi berjalan penuh di sisi klien tanpa server/database.
   ========================================================================= */

const DB_KEY = 'simkroyal_db_v2';
const SESSION_KEY = 'simkroyal_session_v1';

/* -------------------------------------------------------------------------
   Util umum
   ------------------------------------------------------------------------- */
const Util = {
  uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  },
  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },
  nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },
  formatCurrency(n) {
    n = Math.round(Number(n) || 0);
    return 'Rp ' + n.toLocaleString('id-ID');
  },
  formatNumber(n) {
    return Number(n || 0).toLocaleString('id-ID');
  },
  formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  },
  escape(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },
  clamp(n, min, max) { return Math.min(Math.max(n, min), max); },
  debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  },
  slug(str) {
    return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
};

/* -------------------------------------------------------------------------
   Seed data awal (dummy data realistis untuk cafe & resto)
   ------------------------------------------------------------------------- */
function seedDatabase() {
  const cat = (id, name, description, icon) => ({ id, name, description, icon, status: 'active' });

  const categories = [
    cat('cat_kopi', 'Kopi', 'Minuman berbasis espresso & kopi susu', 'coffee'),
    cat('cat_nonkopi', 'Non-Kopi', 'Minuman selain kopi', 'cup-soda'),
    cat('cat_makanan', 'Makanan Berat', 'Menu makanan utama', 'utensils'),
    cat('cat_snack', 'Snack', 'Camilan & pendamping', 'cookie'),
    cat('cat_dessert', 'Dessert', 'Makanan penutup', 'ice-cream-cone'),
  ];

  const prod = (sku, name, category_id, price, cost, stock, min, unit) => ({
    id: Util.uid('prod'), sku, name, category_id, price, cost, stock,
    minimum_stock: min, unit, status: 'active'
  });

  const products = [
    prod('KP-001', 'Espresso', 'cat_kopi', 18000, 7000, 40, 10, 'cup'),
    prod('KP-002', 'Americano', 'cat_kopi', 20000, 8000, 40, 10, 'cup'),
    prod('KP-003', 'Kopi Susu Gula Aren', 'cat_kopi', 22000, 9000, 35, 10, 'cup'),
    prod('KP-004', 'Cappuccino', 'cat_kopi', 25000, 10000, 30, 8, 'cup'),
    prod('KP-005', 'Caffe Latte', 'cat_kopi', 25000, 10000, 30, 8, 'cup'),
    prod('KP-006', 'Vietnam Drip', 'cat_kopi', 21000, 8500, 20, 6, 'cup'),
    prod('NK-001', 'Matcha Latte', 'cat_nonkopi', 26000, 11000, 25, 8, 'cup'),
    prod('NK-002', 'Chocolate Latte', 'cat_nonkopi', 24000, 10000, 25, 8, 'cup'),
    prod('NK-003', 'Teh Tarik', 'cat_nonkopi', 18000, 6000, 30, 10, 'cup'),
    prod('NK-004', 'Lemon Tea', 'cat_nonkopi', 16000, 5000, 30, 10, 'cup'),
    prod('MK-001', 'Nasi Goreng Spesial', 'cat_makanan', 28000, 12000, 20, 5, 'porsi'),
    prod('MK-002', 'Ayam Geprek Sambal Matah', 'cat_makanan', 30000, 13000, 20, 5, 'porsi'),
    prod('MK-003', 'Spaghetti Aglio Olio', 'cat_makanan', 32000, 14000, 15, 5, 'porsi'),
    prod('MK-004', 'Chicken Katsu Curry', 'cat_makanan', 33000, 15000, 15, 5, 'porsi'),
    prod('SN-001', 'Kentang Goreng', 'cat_snack', 17000, 6000, 30, 8, 'porsi'),
    prod('SN-002', 'Pisang Goreng Keju', 'cat_snack', 16000, 6000, 25, 8, 'porsi'),
    prod('SN-003', 'Roti Bakar Coklat Keju', 'cat_snack', 18000, 7000, 20, 6, 'porsi'),
    prod('DS-001', 'Es Krim Vanilla', 'cat_dessert', 15000, 5000, 20, 6, 'cup'),
    prod('DS-002', 'Cheese Cake Slice', 'cat_dessert', 22000, 9000, 12, 4, 'slice'),
    prod('DS-003', 'Pudding Coklat', 'cat_dessert', 14000, 5000, 18, 6, 'cup'),

    // --- Tambahan menu Kopi ---
    prod('KP-007', 'Kopi Tubruk', 'cat_kopi', 15000, 6000, 35, 10, 'cup'),
    prod('KP-008', 'Kopi Susu Original', 'cat_kopi', 20000, 8000, 35, 10, 'cup'),
    prod('KP-009', 'Flat White', 'cat_kopi', 24000, 10000, 25, 8, 'cup'),
    prod('KP-010', 'Mocha Latte', 'cat_kopi', 26000, 11000, 25, 8, 'cup'),
    prod('KP-011', 'Piccolo Latte', 'cat_kopi', 22000, 9000, 20, 6, 'cup'),
    prod('KP-012', 'Affogato', 'cat_kopi', 27000, 11000, 15, 5, 'cup'),
    prod('KP-013', 'Kopi Susu Hazelnut', 'cat_kopi', 23000, 9500, 25, 8, 'cup'),
    prod('KP-014', 'Cold Brew', 'cat_kopi', 24000, 9000, 20, 6, 'cup'),
    prod('KP-015', 'Es Kopi Kelapa', 'cat_kopi', 25000, 10500, 20, 6, 'cup'),
    prod('KP-016', 'Macchiato', 'cat_kopi', 23000, 9000, 20, 6, 'cup'),
    prod('KP-017', 'Es Kopi Susu Aren Kekinian', 'cat_kopi', 21000, 8500, 25, 8, 'cup'),
    prod('KP-018', 'Long Black', 'cat_kopi', 20000, 7500, 20, 6, 'cup'),
    prod('KP-019', 'Kopi Susu Karamel', 'cat_kopi', 23000, 9500, 20, 6, 'cup'),
    prod('KP-020', 'Kopi Rempah Nusantara', 'cat_kopi', 22000, 9000, 15, 5, 'cup'),
    prod('KP-021', 'Es Kopi Kelapa', 'cat_kopi', 22000, 9000, 20, 6, 'cup'),
    prod('KP-022', 'Kopi Tubruk Klasik', 'cat_kopi', 15000, 5500, 25, 8, 'cup'),
    prod('KP-023', 'Es Kopi Susu Gula Merah', 'cat_kopi', 20000, 8000, 25, 8, 'cup'),
    prod('KP-024', 'Cappuccino Cinnamon', 'cat_kopi', 24000, 9500, 18, 6, 'cup'),
    prod('KP-025', 'Es Kopi Hazelnut', 'cat_kopi', 23000, 9000, 18, 6, 'cup'),
    prod('KP-026', 'Kopi Tarik', 'cat_kopi', 19000, 7500, 20, 6, 'cup'),
    prod('KP-027', 'Es Kopi Mocha', 'cat_kopi', 24000, 9500, 18, 6, 'cup'),
    prod('KP-028', 'Kopi Susu Original 1L', 'cat_kopi', 45000, 20000, 10, 3, 'botol'),
    prod('KP-029', 'Ristretto', 'cat_kopi', 19000, 7000, 15, 5, 'cup'),
    prod('KP-030', 'Es Kopi Pandan', 'cat_kopi', 22000, 8500, 18, 6, 'cup'),
    prod('KP-031', 'Kopi Susu Oat Milk', 'cat_kopi', 26000, 11000, 15, 5, 'cup'),
    prod('KP-032', 'Es Kopi Tiramisu', 'cat_kopi', 25000, 10000, 15, 5, 'cup'),
    prod('KP-033', 'Kopi Joss', 'cat_kopi', 17000, 6500, 20, 6, 'cup'),
    prod('KP-034', 'Flat White', 'cat_kopi', 24000, 9500, 18, 6, 'cup'),
    prod('KP-035', 'Es Kopi Salted Caramel', 'cat_kopi', 24000, 9500, 18, 6, 'cup'),
    prod('KP-036', 'Kopi Susu Regal', 'cat_kopi', 23000, 9000, 18, 6, 'cup'),
    prod('KP-037', 'Affogato', 'cat_kopi', 27000, 11500, 12, 4, 'cup'),
    prod('KP-038', 'Es Kopi Markisa', 'cat_kopi', 22000, 8500, 15, 5, 'cup'),
    prod('KP-039', 'Kopi Duo Espresso', 'cat_kopi', 25000, 10000, 15, 5, 'cup'),
    prod('KP-040', 'Es Kopi Susu Klasik Royal', 'cat_kopi', 21000, 8500, 25, 8, 'cup'),

    // --- Tambahan menu Non-Kopi ---
    prod('NK-005', 'Taro Latte', 'cat_nonkopi', 25000, 10500, 25, 8, 'cup'),
    prod('NK-006', 'Red Velvet Latte', 'cat_nonkopi', 26000, 11000, 20, 6, 'cup'),
    prod('NK-007', 'Thai Tea', 'cat_nonkopi', 20000, 8000, 30, 10, 'cup'),
    prod('NK-008', 'Wedang Jahe Susu', 'cat_nonkopi', 18000, 6500, 25, 8, 'cup'),
    prod('NK-009', 'Es Teh Manis', 'cat_nonkopi', 8000, 2500, 40, 12, 'cup'),
    prod('NK-010', 'Es Jeruk Peras', 'cat_nonkopi', 14000, 5000, 30, 10, 'cup'),
    prod('NK-011', 'Strawberry Milk', 'cat_nonkopi', 22000, 9000, 20, 6, 'cup'),
    prod('NK-012', 'Blue Ocean Soda', 'cat_nonkopi', 20000, 7500, 20, 6, 'cup'),
    prod('NK-013', 'Yakult Soda', 'cat_nonkopi', 18000, 7000, 20, 6, 'cup'),
    prod('NK-014', 'Susu Coklat Hangat', 'cat_nonkopi', 17000, 6000, 25, 8, 'cup'),
    prod('NK-015', 'Green Tea Latte', 'cat_nonkopi', 24000, 10000, 20, 6, 'cup'),
    prod('NK-016', 'Milkshake Vanilla', 'cat_nonkopi', 23000, 9500, 18, 6, 'cup'),
    prod('NK-017', 'Es Lemon Mint', 'cat_nonkopi', 16000, 6000, 25, 8, 'cup'),
    prod('NK-018', 'Wedang Uwuh', 'cat_nonkopi', 15000, 5500, 20, 6, 'cup'),
    prod('NK-019', 'Mango Smoothie', 'cat_nonkopi', 22000, 9000, 18, 6, 'cup'),
    prod('NK-020', 'Es Cincau Susu', 'cat_nonkopi', 17000, 6500, 20, 6, 'cup'),
    prod('NK-021', 'Es Teh Leci', 'cat_nonkopi', 15000, 5000, 25, 8, 'cup'),
    prod('NK-022', 'Chocolate Hazelnut', 'cat_nonkopi', 24000, 10000, 18, 6, 'cup'),
    prod('NK-023', 'Es Jeruk Peras', 'cat_nonkopi', 14000, 4500, 25, 8, 'cup'),
    prod('NK-024', 'Matcha Blend', 'cat_nonkopi', 25000, 10500, 18, 6, 'cup'),
    prod('NK-025', 'Es Susu Strawberry', 'cat_nonkopi', 20000, 8000, 20, 6, 'cup'),
    prod('NK-026', 'Wedang Jahe Susu', 'cat_nonkopi', 16000, 6000, 20, 6, 'cup'),
    prod('NK-027', 'Es Teh Tarik', 'cat_nonkopi', 15000, 5500, 25, 8, 'cup'),
    prod('NK-028', 'Taro Milk', 'cat_nonkopi', 22000, 9000, 18, 6, 'cup'),
    prod('NK-029', 'Es Yakult Lychee', 'cat_nonkopi', 17000, 6500, 20, 6, 'cup'),
    prod('NK-030', 'Red Velvet Latte', 'cat_nonkopi', 24000, 10000, 18, 6, 'cup'),
    prod('NK-031', 'Es Kelapa Muda Original', 'cat_nonkopi', 18000, 7000, 20, 6, 'cup'),
    prod('NK-032', 'Susu Kurma', 'cat_nonkopi', 19000, 7500, 18, 5, 'cup'),
    prod('NK-033', 'Es Blueberry Yogurt', 'cat_nonkopi', 23000, 9500, 15, 5, 'cup'),
    prod('NK-034', 'Thai Tea', 'cat_nonkopi', 19000, 7500, 22, 7, 'cup'),
    prod('NK-035', 'Es Semangka Mint', 'cat_nonkopi', 16000, 6000, 20, 6, 'cup'),
    prod('NK-036', 'Chocolate Malt', 'cat_nonkopi', 22000, 9000, 18, 6, 'cup'),
    prod('NK-037', 'Es Susu Melon', 'cat_nonkopi', 20000, 8000, 18, 6, 'cup'),
    prod('NK-038', 'Lemon Tea Madu', 'cat_nonkopi', 16000, 6000, 22, 7, 'cup'),
    prod('NK-039', 'Es Coklat Almond', 'cat_nonkopi', 23000, 9500, 15, 5, 'cup'),
    prod('NK-040', 'Susu Vanilla Dingin', 'cat_nonkopi', 18000, 7000, 20, 6, 'cup'),

    // --- Tambahan menu Makanan Berat ---
    prod('MK-005', 'Nasi Ayam Bakar Madu', 'cat_makanan', 30000, 13000, 18, 5, 'porsi'),
    prod('MK-006', 'Mie Goreng Jawa', 'cat_makanan', 24000, 10000, 20, 5, 'porsi'),
    prod('MK-007', 'Beef Burger', 'cat_makanan', 32000, 14000, 15, 5, 'porsi'),
    prod('MK-008', 'Chicken Cordon Bleu', 'cat_makanan', 34000, 15500, 12, 4, 'porsi'),
    prod('MK-009', 'Nasi Rendang Sapi', 'cat_makanan', 33000, 15000, 15, 5, 'porsi'),
    prod('MK-010', 'Soto Ayam Kampung', 'cat_makanan', 25000, 10500, 20, 5, 'porsi'),
    prod('MK-011', 'Bakmi Yun Yi', 'cat_makanan', 27000, 11500, 18, 5, 'porsi'),
    prod('MK-012', 'Ayam Bakar Kecap', 'cat_makanan', 29000, 12500, 18, 5, 'porsi'),
    prod('MK-013', 'Sop Buntut Sapi', 'cat_makanan', 38000, 18000, 10, 3, 'porsi'),
    prod('MK-014', 'Nasi Ayam Teriyaki', 'cat_makanan', 31000, 13500, 15, 5, 'porsi'),
    prod('MK-015', 'Nasi Goreng Seafood', 'cat_makanan', 32000, 14000, 15, 5, 'porsi'),
    prod('MK-016', 'Sate Ayam Bumbu Kacang', 'cat_makanan', 28000, 12000, 18, 5, 'porsi'),
    prod('MK-017', 'Gado-Gado Spesial', 'cat_makanan', 22000, 9000, 18, 5, 'porsi'),
    prod('MK-018', 'Nasi Bebek Bumbu Bali', 'cat_makanan', 35000, 16000, 12, 4, 'porsi'),
    prod('MK-019', 'Fettuccine Carbonara', 'cat_makanan', 33000, 14500, 15, 5, 'porsi'),
    prod('MK-020', 'Nasi Uduk Komplit', 'cat_makanan', 26000, 11000, 18, 5, 'porsi'),
    prod('MK-021', 'Nasi Rendang', 'cat_makanan', 34000, 15500, 15, 5, 'porsi'),
    prod('MK-022', 'Mie Goreng Jawa', 'cat_makanan', 24000, 10000, 20, 6, 'porsi'),
    prod('MK-023', 'Nasi Ayam Geprek Sambal Matah', 'cat_makanan', 27000, 11500, 18, 5, 'porsi'),
    prod('MK-024', 'Soto Ayam Lamongan', 'cat_makanan', 23000, 9500, 18, 5, 'porsi'),
    prod('MK-025', 'Nasi Goreng Kambing', 'cat_makanan', 33000, 15000, 12, 4, 'porsi'),
    prod('MK-026', 'Ayam Bakar Madu', 'cat_makanan', 30000, 13000, 15, 5, 'porsi'),
    prod('MK-027', 'Nasi Campur Bali', 'cat_makanan', 29000, 12500, 15, 5, 'porsi'),
    prod('MK-028', 'Spaghetti Aglio Olio', 'cat_makanan', 28000, 12000, 15, 5, 'porsi'),
    prod('MK-029', 'Sop Buntut', 'cat_makanan', 38000, 18000, 10, 4, 'porsi'),
    prod('MK-030', 'Nasi Liwet Komplit', 'cat_makanan', 27000, 11500, 15, 5, 'porsi'),
    prod('MK-031', 'Ayam Penyet Sambal Bawang', 'cat_makanan', 26000, 11000, 18, 5, 'porsi'),
    prod('MK-032', 'Bakso Sapi Urat Jumbo', 'cat_makanan', 22000, 9000, 20, 6, 'porsi'),
    prod('MK-033', 'Nasi Goreng Cakalang', 'cat_makanan', 30000, 13000, 15, 5, 'porsi'),
    prod('MK-034', 'Steak Ayam Lada Hitam', 'cat_makanan', 35000, 16000, 12, 4, 'porsi'),
    prod('MK-035', 'Sate Padang', 'cat_makanan', 27000, 11500, 15, 5, 'porsi'),
    prod('MK-036', 'Mie Ayam Yamin', 'cat_makanan', 21000, 8500, 20, 6, 'porsi'),
    prod('MK-037', 'Nasi Bakar Ayam Jamur', 'cat_makanan', 26000, 11000, 15, 5, 'porsi'),
    prod('MK-038', 'Gudeg Komplit', 'cat_makanan', 25000, 10500, 15, 5, 'porsi'),
    prod('MK-039', 'Rice Bowl Salmon Teriyaki', 'cat_makanan', 36000, 17000, 12, 4, 'porsi'),
    prod('MK-040', 'Nasi Ayam Suwir Pedas', 'cat_makanan', 25000, 10500, 18, 5, 'porsi'),

    // --- Tambahan menu Snack ---
    prod('SN-004', 'Onion Ring', 'cat_snack', 16000, 6000, 25, 8, 'porsi'),
    prod('SN-005', 'Cireng Bumbu Rujak', 'cat_snack', 14000, 5000, 25, 8, 'porsi'),
    prod('SN-006', 'Tahu Crispy', 'cat_snack', 13000, 4500, 25, 8, 'porsi'),
    prod('SN-007', 'Sosis Bakar', 'cat_snack', 15000, 6000, 25, 8, 'porsi'),
    prod('SN-008', 'Tempe Mendoan', 'cat_snack', 12000, 4000, 30, 10, 'porsi'),
    prod('SN-009', 'Risoles Mayo', 'cat_snack', 15000, 5500, 20, 6, 'porsi'),
    prod('SN-010', 'Churros Coklat', 'cat_snack', 18000, 7000, 20, 6, 'porsi'),
    prod('SN-011', 'Chicken Wings BBQ', 'cat_snack', 22000, 9500, 20, 6, 'porsi'),
    prod('SN-012', 'Mozarella Stick', 'cat_snack', 20000, 8500, 20, 6, 'porsi'),
    prod('SN-013', 'Kroket Kentang', 'cat_snack', 15000, 5500, 20, 6, 'porsi'),
    prod('SN-014', 'Siomay Bandung', 'cat_snack', 16000, 6000, 20, 6, 'porsi'),
    prod('SN-015', 'Pisang Nugget', 'cat_snack', 15000, 5500, 20, 6, 'porsi'),
    prod('SN-016', 'Dimsum Ayam', 'cat_snack', 19000, 8000, 20, 6, 'porsi'),
    prod('SN-017', 'French Fries Cheese', 'cat_snack', 18000, 7000, 20, 6, 'porsi'),
    prod('SN-018', 'Bakwan Jagung', 'cat_snack', 11000, 4000, 25, 8, 'porsi'),
    prod('SN-019', 'Lumpia Semarang', 'cat_snack', 15000, 5500, 20, 6, 'porsi'),
    prod('SN-020', 'Otak-Otak Bakar', 'cat_snack', 17000, 6500, 18, 6, 'porsi'),
    prod('SN-021', 'Tahu Crispy Sambal', 'cat_snack', 14000, 5000, 22, 7, 'porsi'),
    prod('SN-022', 'Cireng Isi Ayam', 'cat_snack', 13000, 4500, 22, 7, 'porsi'),
    prod('SN-023', 'Onion Ring', 'cat_snack', 16000, 6000, 20, 6, 'porsi'),
    prod('SN-024', 'Sosis Bakar Bumbu', 'cat_snack', 15000, 5500, 20, 6, 'porsi'),
    prod('SN-025', 'Chicken Wings BBQ', 'cat_snack', 22000, 9500, 18, 6, 'porsi'),
    prod('SN-026', 'Roti Bakar Coklat Keju', 'cat_snack', 17000, 6500, 18, 6, 'porsi'),
    prod('SN-027', 'Kentang Goreng Balado', 'cat_snack', 17000, 6500, 20, 6, 'porsi'),
    prod('SN-028', 'Tempe Mendoan', 'cat_snack', 12000, 4000, 25, 8, 'porsi'),
    prod('SN-029', 'Ekado Udang', 'cat_snack', 18000, 7500, 18, 6, 'porsi'),
    prod('SN-030', 'Risoles Mayo', 'cat_snack', 14000, 5000, 20, 6, 'porsi'),
    prod('SN-031', 'Corndog Keju', 'cat_snack', 18000, 7500, 18, 6, 'porsi'),
    prod('SN-032', 'Kwetiau Goreng Mini', 'cat_snack', 19000, 8000, 15, 5, 'porsi'),
    prod('SN-033', 'Mozzarella Stick', 'cat_snack', 19000, 8000, 18, 6, 'porsi'),
    prod('SN-034', 'Sempol Ayam', 'cat_snack', 12000, 4000, 22, 7, 'porsi'),
    prod('SN-035', 'Pastel Isi Sayur', 'cat_snack', 13000, 4500, 20, 6, 'porsi'),
    prod('SN-036', 'Batagor Bandung', 'cat_snack', 17000, 6500, 18, 6, 'porsi'),
    prod('SN-037', 'Nugget Ayam Crispy', 'cat_snack', 16000, 6000, 20, 6, 'porsi'),
    prod('SN-038', 'Klapertart Cup', 'cat_snack', 18000, 7000, 15, 5, 'porsi'),
    prod('SN-039', 'Kentang Mustofa', 'cat_snack', 15000, 5500, 20, 6, 'porsi'),
    prod('SN-040', 'Cimol Bumbu Rujak', 'cat_snack', 11000, 4000, 25, 8, 'porsi'),

    // --- Tambahan menu Dessert ---
    prod('DS-004', 'Tiramisu Cup', 'cat_dessert', 24000, 10000, 15, 5, 'cup'),
    prod('DS-005', 'Waffle Coklat', 'cat_dessert', 22000, 9000, 15, 5, 'porsi'),
    prod('DS-006', 'Pancake Madu', 'cat_dessert', 20000, 8000, 15, 5, 'porsi'),
    prod('DS-007', 'Banana Split', 'cat_dessert', 23000, 9500, 12, 4, 'cup'),
    prod('DS-008', 'Brownies Lava', 'cat_dessert', 21000, 8500, 15, 5, 'porsi'),
    prod('DS-009', 'Es Campur', 'cat_dessert', 17000, 6500, 20, 6, 'cup'),
    prod('DS-010', 'Klepon Cup', 'cat_dessert', 13000, 4500, 20, 6, 'cup'),
    prod('DS-011', 'Martabak Mini Coklat Keju', 'cat_dessert', 19000, 7500, 18, 5, 'porsi'),
    prod('DS-012', 'Croffle Vanilla', 'cat_dessert', 21000, 8500, 15, 5, 'porsi'),
    prod('DS-013', 'Panna Cotta Mangga', 'cat_dessert', 20000, 8000, 15, 5, 'cup'),
    prod('DS-014', 'Cheese Tart', 'cat_dessert', 21000, 8500, 15, 5, 'porsi'),
    prod('DS-015', 'Mochi Ice Cream', 'cat_dessert', 18000, 7000, 20, 6, 'porsi'),
    prod('DS-016', 'Dorayaki Coklat', 'cat_dessert', 16000, 6000, 20, 6, 'porsi'),
    prod('DS-017', 'Puding Roti Karamel', 'cat_dessert', 17000, 6500, 18, 5, 'cup'),
    prod('DS-018', 'Sundae Coklat Kacang', 'cat_dessert', 19000, 7500, 15, 5, 'cup'),
    prod('DS-019', 'Kue Lumpur Pandan', 'cat_dessert', 14000, 5000, 20, 6, 'porsi'),
    prod('DS-020', 'Es Teler Buah', 'cat_dessert', 18000, 7000, 18, 6, 'cup'),
    prod('DS-021', 'Tiramisu Cup', 'cat_dessert', 23000, 9500, 15, 5, 'cup'),
    prod('DS-022', 'Cheesecake Slice', 'cat_dessert', 24000, 10000, 15, 5, 'porsi'),
    prod('DS-023', 'Es Krim Goreng', 'cat_dessert', 19000, 8000, 15, 5, 'porsi'),
    prod('DS-024', 'Puding Coklat Lumer', 'cat_dessert', 17000, 6500, 20, 6, 'cup'),
    prod('DS-025', 'Wafel Matcha', 'cat_dessert', 22000, 9000, 15, 5, 'porsi'),
    prod('DS-026', 'Sorbet Mangga', 'cat_dessert', 18000, 7000, 15, 5, 'cup'),
    prod('DS-027', 'Kue Cubit Coklat Keju', 'cat_dessert', 16000, 6000, 20, 6, 'porsi'),
    prod('DS-028', 'Rainbow Cake Slice', 'cat_dessert', 21000, 8500, 15, 5, 'porsi'),
    prod('DS-029', 'Es Krim Vanilla Cup', 'cat_dessert', 14000, 5000, 25, 8, 'cup'),
    prod('DS-030', 'Churros Coklat', 'cat_dessert', 19000, 7500, 18, 6, 'porsi'),
    prod('DS-031', 'Puding Karamel', 'cat_dessert', 15000, 5500, 20, 6, 'cup'),
    prod('DS-032', 'Cromboloni Coklat', 'cat_dessert', 22000, 9000, 15, 5, 'porsi'),
    prod('DS-033', 'Fruit Tart Mini', 'cat_dessert', 20000, 8000, 15, 5, 'porsi'),
    prod('DS-034', 'Es Krim Durian', 'cat_dessert', 21000, 8500, 15, 5, 'cup'),
    prod('DS-035', 'Roti Bakar Selai Susu', 'cat_dessert', 15000, 5500, 20, 6, 'porsi'),
    prod('DS-036', 'Choco Lava Cake', 'cat_dessert', 22000, 9000, 15, 5, 'porsi'),
    prod('DS-037', 'Bubur Sumsum Gula Merah', 'cat_dessert', 14000, 5000, 20, 6, 'cup'),
    prod('DS-038', 'Macarons (3 pcs)', 'cat_dessert', 24000, 10500, 15, 5, 'porsi'),
    prod('DS-039', 'Es Krim Coklat Kacang', 'cat_dessert', 20000, 8000, 18, 6, 'cup'),
    prod('DS-040', 'Kue Pukis Coklat Keju', 'cat_dessert', 15000, 5500, 20, 6, 'porsi'),
  ];
  // Buat sedikit stok menipis agar fitur low-stock terlihat
  products.find(p => p.sku === 'DS-002').stock = 3;
  products.find(p => p.sku === 'MK-004').stock = 4;

  const tables = [];
  for (let i = 1; i <= 12; i++) {
    tables.push({
      id: Util.uid('tbl'),
      table_number: 'M' + String(i).padStart(2, '0'),
      capacity: i % 3 === 0 ? 6 : (i % 2 === 0 ? 4 : 2),
      status: 'available'
    });
  }

  const customers = [
    { id: Util.uid('cust'), name: 'Dimas Prakoso', phone: '081234567801', email: 'dimas@mail.com', address: 'Jl. Kaliurang KM 5, Sleman', membership: 'gold', points: 320 },
    { id: Util.uid('cust'), name: 'Anisa Rahma', phone: '081234567802', email: 'anisa@mail.com', address: 'Jl. Malioboro, Yogyakarta', membership: 'silver', points: 140 },
    { id: Util.uid('cust'), name: 'Budi Santoso', phone: '081234567803', email: 'budi@mail.com', address: 'Jl. Gejayan, Yogyakarta', membership: 'regular', points: 20 },
    { id: Util.uid('cust'), name: 'Citra Lestari', phone: '081234567804', email: 'citra@mail.com', address: 'Jl. Parangtritis, Bantul', membership: 'gold', points: 410 },
  ];

  const employees = [
    { id: 'emp_admin', employee_code: 'EMP-001', name: 'Afifah', position: 'Administrator', phone: '081211110001', email: 'admin@simkroyal.id', address: 'Yogyakarta', join_date: '2024-01-10', status: 'active' },
    { id: 'emp_manager', employee_code: 'EMP-002', name: 'Zulfikar', position: 'Manager', phone: '081211110002', email: 'manager@simkroyal.id', address: 'Yogyakarta', join_date: '2024-02-15', status: 'active' },
    { id: 'emp_kasir1', employee_code: 'EMP-003', name: 'Dea', position: 'Kasir', phone: '081211110003', email: 'kasir@simkroyal.id', address: 'Yogyakarta', join_date: '2024-05-01', status: 'active' },
    { id: 'emp_staff1', employee_code: 'EMP-004', name: 'Ilhan', position: 'Staff', phone: '081211110004', email: 'staff@simkroyal.id', address: 'Yogyakarta', join_date: '2024-06-20', status: 'active' },
    { id: 'emp_kitchen', employee_code: 'EMP-006', name: 'Bianca', position: 'Kitchen', phone: '081211110006', email: 'bianca@simkroyal.id', address: 'Yogyakarta', join_date: '2024-08-01', status: 'active' },
  ];

  const users = [
    { id: 'usr_admin', username: 'admin', password: 'admin123', name: 'Administrator', email: 'admin@simkroyal.id', role: 'administrator', status: 'active', employee_id: 'emp_admin', created_at: '2024-01-10' },
  ];

  const shifts = [
    { id: Util.uid('shift'), name: 'Shift Pagi', start_time: '07:00', end_time: '15:00', employee_ids: ['emp_kasir1', 'emp_staff1'] },
    { id: Util.uid('shift'), name: 'Shift Sore', start_time: '15:00', end_time: '23:00', employee_ids: ['emp_manager'] },
  ];

  const suppliers = [
    { id: Util.uid('sup'), name: 'Toko Biji Kopi Nusantara', company: 'CV Nusantara Kopi', phone: '0274111222', email: 'sales@nusantarakopi.id', address: 'Jl. Solo KM 8, Sleman', status: 'active' },
    { id: Util.uid('sup'), name: 'Distributor Susu Segar', company: 'PT Dairy Jaya', phone: '0274333444', email: 'order@dairyjaya.id', address: 'Jl. Magelang, Sleman', status: 'active' },
    { id: Util.uid('sup'), name: 'Pasar Bahan Baku Segar', company: 'UD Sumber Rejeki', phone: '0274555666', email: 'sumberrejeki@mail.com', address: 'Pasar Beringharjo, Yogyakarta', status: 'active' },
  ];

  const promotions = [
    { id: Util.uid('promo'), name: 'Diskon Jam Santai', code: 'SIANG10', type: 'percent', value: 10, start_date: Util.todayISO(), end_date: '2026-12-31', minimum_transaction: 30000, status: 'active' },
    { id: Util.uid('promo'), name: 'Promo Member Gold', code: 'GOLD15', type: 'percent', value: 15, start_date: Util.todayISO(), end_date: '2026-12-31', minimum_transaction: 0, status: 'active' },
    { id: Util.uid('promo'), name: 'Potongan Ongkos Cetak Nota', code: 'HEMAT5K', type: 'nominal', value: 5000, start_date: Util.todayISO(), end_date: '2026-09-30', minimum_transaction: 50000, status: 'inactive' },
  ];

  const settings = {
    business_name: 'Royal Coffee & Eatery',
    address: 'Jl. Sudirman No. 88, Yogyakarta',
    phone: '0274-987654',
    tax_percent: 10,
    service_charge_percent: 5,
    currency: 'IDR',
    receipt_footer: 'Terima kasih atas kunjungan Anda. Sampai jumpa lagi!',
    low_stock_alert: true,
    qris_merchant_name: 'ROYAL COFFEE EATERY',
    cash_drawer_limit: 2000000,
    // Konfigurasi Payment Gateway Midtrans. Hanya Client Key (kunci publik)
    // yang boleh disimpan di sini (aman untuk browser) — Server Key tetap
    // HANYA di file .env backend (payment-server/), tidak pernah di frontend.
    midtrans: {
      enabled: false,
      is_production: false,
      client_key: '',
      backend_url: 'http://localhost:4000',
    },
  };

  const payment_methods = [
    { id: 'cash', name: 'Cash', enabled: true },
    { id: 'qris', name: 'QRIS (Simulasi)', enabled: true },
    { id: 'debit', name: 'Debit', enabled: true },
    { id: 'credit', name: 'Credit', enabled: true },
    { id: 'transfer', name: 'Transfer', enabled: true },
    { id: 'ewallet', name: 'E-Wallet', enabled: true },
    { id: 'midtrans', name: 'Midtrans (Semua Metode)', enabled: false },
  ];

  /* ----------------------- 10 modul CRUD tambahan ----------------------- */

  // 1) Reservasi Meja
  const reservations = [
    { id: Util.uid('rsv'), customer_name: 'Dimas Prakoso', phone: '081234567801', table_id: tables[2].id, party_size: 4, reservation_date: Util.todayISO(), reservation_time: '18:00', status: 'confirmed', note: 'Dekat jendela' },
    { id: Util.uid('rsv'), customer_name: 'Anisa Rahma', phone: '081234567802', table_id: tables[5].id, party_size: 2, reservation_date: Util.todayISO(), reservation_time: '19:30', status: 'pending', note: '' },
  ];

  // 2) Bahan Baku & Resep (BOM) — stok bahan baku terpisah dari stok produk jadi
  const rawMat = (name, unit, stock, min, cost) => ({ id: Util.uid('bb'), name, unit, stock, minimum_stock: min, cost, status: 'active' });
  const raw_materials = [
    rawMat('Biji Kopi Arabica', 'gram', 8000, 1500, 220),
    rawMat('Biji Kopi Robusta', 'gram', 6000, 1500, 160),
    rawMat('Susu UHT Full Cream', 'ml', 15000, 3000, 18),
    rawMat('Gula Aren Cair', 'ml', 5000, 1000, 45),
    rawMat('Sirup Vanilla', 'ml', 3000, 500, 60),
    rawMat('Beras Premium', 'gram', 25000, 5000, 12),
    rawMat('Ayam Fillet', 'gram', 12000, 2000, 38),
    rawMat('Kentang Beku', 'gram', 10000, 2000, 25),
    rawMat('Keju Cheddar', 'gram', 4000, 800, 90),
    rawMat('Coklat Couverture', 'gram', 3500, 700, 110),
  ];
  const findProd = (sku) => products.find(p => p.sku === sku);
  const recipes = [
    { id: Util.uid('rcp'), product_id: findProd('KP-001').id, items: [{ raw_material_id: raw_materials[0].id, qty: 18 }] },
    { id: Util.uid('rcp'), product_id: findProd('KP-003').id, items: [{ raw_material_id: raw_materials[0].id, qty: 18 }, { raw_material_id: raw_materials[2].id, qty: 120 }, { raw_material_id: raw_materials[3].id, qty: 20 }] },
    { id: Util.uid('rcp'), product_id: findProd('MK-001').id, items: [{ raw_material_id: raw_materials[5].id, qty: 200 }, { raw_material_id: raw_materials[6].id, qty: 80 }] },
    { id: Util.uid('rcp'), product_id: findProd('SN-001').id, items: [{ raw_material_id: raw_materials[7].id, qty: 150 }] },
  ];

  // 3) Voucher / Gift Card (bernilai saldo, berbeda dari kode promo persen/nominal)
  const vouchers = [
    { id: Util.uid('vch'), code: 'GIFT100K', type: 'giftcard', balance: 100000, initial_balance: 100000, owner_name: 'Citra Lestari', expiry_date: '2026-12-31', status: 'active' },
    { id: Util.uid('vch'), code: 'GIFT50K', type: 'giftcard', balance: 50000, initial_balance: 50000, owner_name: '', expiry_date: '2026-12-31', status: 'active' },
    { id: Util.uid('vch'), code: 'WELCOME25K', type: 'giftcard', balance: 0, initial_balance: 25000, owner_name: 'Budi Santoso', expiry_date: '2026-06-30', status: 'used' },
  ];

  // 4) Penggajian Karyawan (Payroll)
  const payroll = [
    { id: Util.uid('pay'), employee_id: 'emp_kasir1', period: Util.todayISO().slice(0, 7), base_salary: 2800000, allowance: 300000, overtime: 150000, deduction: 50000, net_salary: 3200000, status: 'paid', paid_at: new Date().toISOString() },
    { id: Util.uid('pay'), employee_id: 'emp_staff1', period: Util.todayISO().slice(0, 7), base_salary: 2500000, allowance: 200000, overtime: 0, deduction: 0, net_salary: 2700000, status: 'unpaid', paid_at: null },
  ];

  // 5) Ulasan & Rating Pelanggan
  const reviews = [
    { id: Util.uid('rev'), customer_name: 'Dimas Prakoso', product_id: findProd('KP-003').id, rating: 5, comment: 'Kopi susu gula arennya mantap, tidak terlalu manis.', reply: '', status: 'published', created_at: new Date().toISOString() },
    { id: Util.uid('rev'), customer_name: 'Anisa Rahma', product_id: findProd('MK-001').id, rating: 4, comment: 'Porsinya pas, tapi agak lama disajikan saat ramai.', reply: 'Terima kasih masukannya, kami perbaiki.', status: 'published', created_at: new Date().toISOString() },
  ];

  // 6) Cabang / Outlet (multi-outlet)
  const branches = [
    { id: Util.uid('brc'), name: 'Royal Coffee — Surakarta (Pusat)', address: 'Jl. Slamet Riyadi, Surakarta, Jawa Tengah', phone: '0271-700100', pic_name: 'Zulfikar', status: 'active' },
    { id: Util.uid('brc'), name: 'Royal Coffee — Jebres', address: 'Jl. Ir. Sutami, Jebres, Surakarta', phone: '0271-700200', pic_name: 'Bianca', status: 'active' },
  ];

  // 7) Aset & Maintenance Peralatan
  const assets = [
    { id: Util.uid('ast'), name: 'Mesin Espresso La Marzocco', category: 'Peralatan Dapur', purchase_date: '2024-01-20', purchase_cost: 85000000, condition: 'good', location: branches[0].id, status: 'active' },
    { id: Util.uid('ast'), name: 'Kulkas Showcase 4 Pintu', category: 'Peralatan Dapur', purchase_date: '2024-02-10', purchase_cost: 12000000, condition: 'good', location: branches[0].id, status: 'active' },
    { id: Util.uid('ast'), name: 'Mesin Kasir & Printer Struk', category: 'Elektronik', purchase_date: '2024-03-05', purchase_cost: 4500000, condition: 'needs_repair', location: branches[1].id, status: 'active' },
  ];
  const asset_maintenance = [
    { id: Util.uid('mtn'), asset_id: assets[2].id, date: Util.todayISO(), issue: 'Printer struk sering macet kertas', action: 'Menunggu teknisi', cost: 0, status: 'scheduled' },
  ];

  // 8) Anggaran / Budget Pengeluaran (per kategori per bulan, selaras dengan
  //    kategori yang dipakai di modul Pengeluaran)
  const budgets = [
    { id: Util.uid('bud'), category: 'Bahan Baku', period: Util.todayISO().slice(0, 7), planned_amount: 15000000 },
    { id: Util.uid('bud'), category: 'Gaji Karyawan', period: Util.todayISO().slice(0, 7), planned_amount: 20000000 },
    { id: Util.uid('bud'), category: 'Sewa Tempat', period: Util.todayISO().slice(0, 7), planned_amount: 8000000 },
    { id: Util.uid('bud'), category: 'Listrik & Air', period: Util.todayISO().slice(0, 7), planned_amount: 2500000 },
    { id: Util.uid('bud'), category: 'Marketing', period: Util.todayISO().slice(0, 7), planned_amount: 3000000 },
  ];

  // 9) Pengumuman Internal / Notifikasi Staff
  const announcements = [
    { id: Util.uid('ann'), title: 'Briefing SOP Kebersihan Dapur', content: 'Seluruh staff kitchen wajib mengikuti briefing SOP kebersihan setiap Senin pukul 08.00.', target_role: 'all', priority: 'normal', status: 'published', created_at: new Date().toISOString() },
    { id: Util.uid('ann'), title: 'Promo Akhir Bulan Segera Tayang', content: 'Kasir harap menginformasikan kode promo GOLD15 kepada pelanggan member gold.', target_role: 'kasir', priority: 'high', status: 'published', created_at: new Date().toISOString() },
  ];

  // 10) Komplain & Saran (Tiket Layanan)
  const tickets = [
    { id: Util.uid('tik'), type: 'complaint', subject: 'Pesanan tertukar', reporter_name: 'Budi Santoso', description: 'Pesanan Ayam Geprek tertukar dengan meja lain.', priority: 'high', status: 'open', response: '', created_at: new Date().toISOString() },
    { id: Util.uid('tik'), type: 'suggestion', subject: 'Tambah menu non-kafein', reporter_name: 'Citra Lestari', description: 'Mohon ditambahkan varian minuman tanpa kafein untuk malam hari.', priority: 'low', status: 'in_progress', response: 'Sedang dipertimbangkan tim produk.', created_at: new Date().toISOString() },
  ];

  /* ------------------- 10 modul CRUD tambahan (gelombang 2) ------------------- */

  // 11) Paket Bundling / Combo Menu
  const bundles = [
    { id: Util.uid('bdl'), name: 'Paket Ngopi Berdua', product_ids: [findProd('KP-003').id, findProd('KP-003').id], bundle_price: 35000, status: 'active', description: '2x Kopi Susu Gula Aren, hemat dibanding beli satuan.' },
    { id: Util.uid('bdl'), name: 'Paket Nongkrong Seru', product_ids: [findProd('MK-001').id, findProd('SN-001').id, findProd('NK-001').id], bundle_price: 45000, status: 'active', description: '1 Nasi Goreng + 1 Snack + 1 Minuman Non-Kopi.' },
    { id: Util.uid('bdl'), name: 'Paket Hemat Sarapan', product_ids: [findProd('MK-020').id, findProd('KP-001').id], bundle_price: 30000, status: 'active', description: '1 Menu Sarapan + 1 Kopi Hitam.' },
  ];

  // 12) Limbah & Kerugian Stok (Waste/Spoilage Log)
  const stock_waste = [
    { id: Util.uid('wst'), item_type: 'raw_material', item_id: raw_materials[2].id, qty: 500, reason: 'Kedaluwarsa', date: Util.todayISO(), reported_by: 'Staff Dapur', cost_loss: 500 * raw_materials[2].cost },
  ];

  // 13) Booking Acara / Sewa Tempat (Venue/Event Booking)
  const events = [
    { id: Util.uid('evt'), event_name: 'Ulang Tahun Anak', customer_name: 'Anisa Rahma', phone: '081234567802', event_date: Util.todayISO(), start_time: '16:00', end_time: '19:00', guest_count: 20, package: 'Paket Silver', total_price: 2500000, down_payment: 1000000, status: 'confirmed', notes: 'Butuh dekorasi balon & sound system kecil.' },
    { id: Util.uid('evt'), event_name: 'Meeting Komunitas', customer_name: 'Dimas Prakoso', phone: '081234567801', event_date: Util.todayISO(), start_time: '09:00', end_time: '12:00', guest_count: 15, package: 'Paket Meeting', total_price: 900000, down_payment: 300000, status: 'pending', notes: '' },
  ];

  // 14) Hadiah & Penukaran Poin (Loyalty Rewards Catalog + Redemption Log)
  const rewards = [
    { id: Util.uid('rwd'), name: 'Voucher Diskon 20rb', points_cost: 100, stock: 50, status: 'active' },
    { id: Util.uid('rwd'), name: 'Kopi Susu Gratis', points_cost: 150, stock: 30, status: 'active' },
    { id: Util.uid('rwd'), name: 'Merchandise Tumbler Royal', points_cost: 400, stock: 10, status: 'active' },
  ];
  const redemptions = [];

  // 15) Kontrak Supplier (Supplier Agreements)
  const supplier_contracts = [
    { id: Util.uid('ktr'), supplier_id: suppliers[0].id, contract_number: 'KTR/2026/001', start_date: '2026-01-01', end_date: '2026-12-31', payment_terms: 'Net 14 hari', value: 180000000, status: 'active' },
    { id: Util.uid('ktr'), supplier_id: suppliers[1] ? suppliers[1].id : suppliers[0].id, contract_number: 'KTR/2026/002', start_date: '2026-02-01', end_date: '2026-07-31', payment_terms: 'Net 30 hari', value: 60000000, status: 'active' },
  ];

  // 16) Checklist SOP & Kebersihan Harian
  const sop_checklist = [
    { id: Util.uid('sop'), task: 'Bersihkan mesin espresso', category: 'Kebersihan', shift: 'pagi', assigned_to: employees[0] ? employees[0].id : '', date: Util.todayISO(), status: 'done', completed_at: new Date().toISOString() },
    { id: Util.uid('sop'), task: 'Cek suhu kulkas & freezer', category: 'Keamanan Pangan', shift: 'pagi', assigned_to: employees[0] ? employees[0].id : '', date: Util.todayISO(), status: 'pending', completed_at: null },
    { id: Util.uid('sop'), task: 'Lap meja & kursi area luar', category: 'Kebersihan', shift: 'siang', assigned_to: '', date: Util.todayISO(), status: 'pending', completed_at: null },
  ];

  // 17) Insentif & Bonus Kinerja Karyawan
  const incentives = [
    { id: Util.uid('inc'), employee_id: employees[0] ? employees[0].id : '', period: Util.todayISO().slice(0, 7), target_description: 'Target penjualan Rp 50.000.000/bulan', achievement: 'Tercapai Rp 54.200.000', bonus_amount: 300000, status: 'pending' },
  ];

  // 18) Perizinan & Dokumen Legal
  const licenses = [
    { id: Util.uid('lic'), name: 'Nomor Induk Berusaha (NIB)', number: 'NIB-8120012345678', issued_by: 'OSS RI', issue_date: '2023-05-10', expiry_date: '2028-05-10', status: 'active' },
    { id: Util.uid('lic'), name: 'Sertifikat Laik Higiene Sanitasi', number: 'SLHS-2024-0091', issued_by: 'Dinas Kesehatan Surakarta', issue_date: '2024-03-01', expiry_date: '2026-03-01', status: 'active' },
    { id: Util.uid('lic'), name: 'Sertifikat Halal', number: 'ID00120026789', issued_by: 'BPJPH', issue_date: '2024-08-15', expiry_date: '2026-08-15', status: 'active' },
  ];

  // 19) Log Suhu Penyimpanan (Cold Storage Temperature Log)
  const temperature_logs = [
    { id: Util.uid('tmp'), equipment: 'Kulkas Showcase Utama', date: Util.todayISO(), time: '08:00', temperature_celsius: 4, status: 'normal', checked_by: employees[0] ? employees[0].id : '', note: '' },
    { id: Util.uid('tmp'), equipment: 'Freezer Bahan Baku', date: Util.todayISO(), time: '08:05', temperature_celsius: -16, status: 'normal', checked_by: employees[0] ? employees[0].id : '', note: '' },
  ];

  // 20) Program Referral Pelanggan
  const referrals = [
    { id: Util.uid('ref'), referrer_customer_id: customers[0].id, referred_name: 'Fajar Nugroho', referred_phone: '081234567899', status: 'pending', reward_points: 50, date: Util.todayISO() },
  ];

  return {
    version: 2,
    users, employees, shifts, attendance: [],
    categories, products,
    customers, tables,
    suppliers, purchases: [], purchase_items: [],
    promotions, expenses: [],
    transactions: [], transaction_items: [],
    cash_sessions: [], cash_movements: [], activity_logs: [], refunds: [], held_orders: [],
    settings, payment_methods,
    next_invoice_seq: 1,

    // --- 10 modul CRUD tambahan (gelombang 1) ---
    reservations,
    raw_materials, recipes,
    vouchers,
    payroll,
    reviews,
    branches,
    assets, asset_maintenance,
    budgets,
    announcements,
    tickets,

    // --- 10 modul CRUD tambahan (gelombang 2) ---
    bundles,
    stock_waste,
    events,
    rewards, redemptions,
    supplier_contracts,
    sop_checklist,
    incentives,
    licenses,
    temperature_logs,
    referrals,
  };
}

/* -------------------------------------------------------------------------
   Store: load/save + operasi generik
   ------------------------------------------------------------------------- */
const Store = {
  data: null,
  ready: false,
  _saveTimer: null,

  // Inisialisasi database (IndexedDB, fallback localStorage). Async karena
  // membuka database nyata butuh waktu, tapi hanya dipanggil sekali di awal
  // (index.html & app.html) sebelum UI dirender — seluruh operasi CRUD
  // sesudahnya (list/get/create/update/remove) tetap sinkron seperti semula.
  async init() {
    if (this.ready) return this.data;
    let loaded = null;
    try { loaded = await DBAdapter.load(DB_KEY); } catch (e) { console.error('[SIMK Royal] Gagal memuat database:', e); }
    this.data = loaded || seedDatabase();

    // Migrasi progresif: jika database lama (browser yang sudah pernah pakai
    // versi sebelumnya) belum punya koleksi/kolom baru, lengkapi otomatis
    // tanpa menghapus data yang sudah ada.
    const defaults = seedDatabase();
    Object.keys(defaults).forEach((key) => {
      if (this.data[key] === undefined) this.data[key] = defaults[key];
    });
    if (this.data.settings && this.data.settings.cash_drawer_limit === undefined) this.data.settings.cash_drawer_limit = 2000000;
    if (this.data.settings && this.data.settings.midtrans === undefined) {
      this.data.settings.midtrans = { enabled: false, is_production: false, client_key: '', backend_url: 'http://localhost:4000' };
    }
    if (Array.isArray(this.data.payment_methods) && !this.data.payment_methods.some(m => m.id === 'midtrans')) {
      this.data.payment_methods.push({ id: 'midtrans', name: 'Midtrans (Semua Metode)', enabled: false });
    }

    if (!loaded) this.save(true);
    this.ready = true;
    return this.data;
  },

  // Menyimpan this.data ke database nyata. Dipanggil ratusan kali secara
  // sinkron di seluruh modul CRUD; agar modul-modul tersebut tidak perlu
  // diubah menjadi async, penulisan ke disk dilakukan di latar belakang
  // (debounced ~150ms) sehingga UI tetap responsif walau data besar.
  save(immediate = false) {
    if (immediate) return DBAdapter.persist(DB_KEY, this.data);
    clearTimeout(this._saveTimer);
    return new Promise((resolve) => {
      this._saveTimer = setTimeout(async () => {
        await DBAdapter.persist(DB_KEY, this.data);
        resolve();
      }, 150);
    });
  },

  resetToSeed() {
    this.data = seedDatabase();
    this.save(true);
    return this.data;
  },

  list(coll) { return this.data[coll] || []; },
  get(coll, id) { return (this.data[coll] || []).find(x => x.id === id) || null; },

  create(coll, obj, prefix) {
    if (!obj.id) obj.id = Util.uid(prefix || coll.slice(0, 4));
    this.data[coll].push(obj);
    this.save();
    return obj;
  },

  update(coll, id, patch) {
    const item = this.get(coll, id);
    if (!item) return null;
    Object.assign(item, patch);
    this.save();
    return item;
  },

  remove(coll, id) {
    const arr = this.data[coll];
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    this.save();
    return true;
  },

  /* --------------------- Logika bisnis lintas-entitas --------------------- */

  nextInvoiceNumber() {
    const seq = this.data.next_invoice_seq || 1;
    this.data.next_invoice_seq = seq + 1;
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    this.save();
    return `INV-${ymd}-${String(seq).padStart(4, '0')}`;
  },

  lowStockProducts() {
    return this.list('products').filter(p => p.status === 'active' && p.stock <= p.minimum_stock);
  },

  /* --------------------- Bahan Baku & Resep (BOM) --------------------- */

  lowStockRawMaterials() {
    return this.list('raw_materials').filter(m => m.status === 'active' && m.stock <= m.minimum_stock);
  },

  recipeForProduct(productId) {
    return this.list('recipes').find(r => r.product_id === productId) || null;
  },

  // Dipanggil otomatis dari completeTransaction(): mengurangi stok bahan baku
  // sesuai resep produk yang terjual, supaya stok bahan baku selalu "hidup"
  // mengikuti transaksi POS tanpa perlu input manual berulang.
  deductRawMaterialsForSale(productId, qtySold) {
    const recipe = this.recipeForProduct(productId);
    if (!recipe) return;
    recipe.items.forEach(ing => {
      const mat = this.get('raw_materials', ing.raw_material_id);
      if (mat) mat.stock = Math.max(0, mat.stock - ing.qty * qtySold);
    });
  },

  /* --------------------- Voucher / Gift Card --------------------- */

  redeemVoucher(code, amount) {
    const v = this.list('vouchers').find(x => x.code.toUpperCase() === String(code).toUpperCase());
    if (!v) return { ok: false, message: 'Kode voucher tidak ditemukan.' };
    if (v.status !== 'active') return { ok: false, message: 'Voucher sudah tidak aktif / sudah dipakai.' };
    if (v.expiry_date && v.expiry_date < Util.todayISO()) return { ok: false, message: 'Voucher sudah kedaluwarsa.' };
    if (v.balance <= 0) return { ok: false, message: 'Saldo voucher sudah habis.' };
    const used = Math.min(v.balance, amount);
    v.balance -= used;
    if (v.balance <= 0) v.status = 'used';
    this.save();
    return { ok: true, used, voucher: v };
  },

  /* --------------------- Anggaran / Budget --------------------- */

  budgetRealization(category, period) {
    const spent = this.list('expenses')
      .filter(e => e.category === category && (e.date || '').slice(0, 7) === period)
      .reduce((s, e) => s + Number(e.amount), 0);
    return spent;
  },

  /* --------------------- Limbah & Kerugian Stok --------------------- */

  // Dipanggil saat mencatat limbah: langsung mengurangi stok bahan
  // baku/produk terkait supaya stok selalu mencerminkan kondisi nyata.
  applyStockWaste(itemType, itemId, qty) {
    const coll = itemType === 'raw_material' ? 'raw_materials' : 'products';
    const item = this.get(coll, itemId);
    if (item) item.stock = Math.max(0, item.stock - qty);
  },

  /* --------------------- Hadiah & Penukaran Poin --------------------- */

  redeemReward(customerId, rewardId) {
    const cust = this.get('customers', customerId);
    const reward = this.get('rewards', rewardId);
    if (!cust) return { ok: false, message: 'Pelanggan tidak ditemukan.' };
    if (!reward) return { ok: false, message: 'Hadiah tidak ditemukan.' };
    if (reward.status !== 'active' || reward.stock <= 0) return { ok: false, message: 'Hadiah sudah tidak tersedia.' };
    if ((cust.points || 0) < reward.points_cost) return { ok: false, message: 'Poin pelanggan tidak cukup.' };
    cust.points -= reward.points_cost;
    reward.stock -= 1;
    const redemption = this.create('redemptions', { customer_id: customerId, reward_id: rewardId, points_used: reward.points_cost, date: Util.todayISO() }, 'rdm');
    return { ok: true, redemption, customer: cust };
  },

  /* --------------------- Program Referral --------------------- */

  markReferralRewarded(referralId) {
    const ref = this.get('referrals', referralId);
    if (!ref) return { ok: false, message: 'Data referral tidak ditemukan.' };
    if (ref.status === 'rewarded') return { ok: false, message: 'Referral ini sudah diberi reward.' };
    const cust = this.get('customers', ref.referrer_customer_id);
    if (cust) cust.points = (cust.points || 0) + Number(ref.reward_points || 0);
    ref.status = 'rewarded';
    this.save();
    return { ok: true, customer: cust };
  },

  // Menyelesaikan transaksi POS: kurangi stok, catat item, tambah poin member
  completeTransaction({ cart, customer_id, table_id, cashier_id, discount, payment_method, payment_amount, promo_code, splits, midtrans_order_id, midtrans_status }) {
    const settings = this.data.settings;
    const subtotal = cart.reduce((s, i) => s + (i.price * i.qty - i.item_discount), 0);
    let promoDiscount = 0;
    const promo = promo_code ? this.list('promotions').find(p => p.code === promo_code && p.status === 'active') : null;
    if (promo && subtotal >= (promo.minimum_transaction || 0)) {
      promoDiscount = promo.type === 'percent' ? Math.round(subtotal * promo.value / 100) : promo.value;
    }
    const totalDiscount = (discount || 0) + promoDiscount;
    const taxable = Math.max(subtotal - totalDiscount, 0);
    const tax = Math.round(taxable * (settings.tax_percent || 0) / 100);
    const serviceCharge = Math.round(taxable * (settings.service_charge_percent || 0) / 100);
    const total = taxable + tax + serviceCharge;
    const change = splits ? 0 : Math.max((payment_amount || total) - total, 0);

    const trx = {
      id: Util.uid('trx'),
      invoice_number: this.nextInvoiceNumber(),
      cashier_id, customer_id: customer_id || null, table_id: table_id || null,
      subtotal, discount: totalDiscount, tax, service_charge: serviceCharge, total,
      payment_method, payment_amount: payment_amount || total, change,
      splits: splits || null,
      status: 'paid', promo_code: promo ? promo.code : null,
      midtrans_order_id: midtrans_order_id || null, midtrans_status: midtrans_status || null,
      created_at: new Date().toISOString(),
    };
    this.data.transactions.push(trx);

    cart.forEach(i => {
      this.data.transaction_items.push({
        id: Util.uid('ti'), transaction_id: trx.id, product_id: i.id,
        quantity: i.qty, price: i.price, discount: i.item_discount || 0,
        subtotal: i.price * i.qty - (i.item_discount || 0)
      });
      const prod = this.get('products', i.id);
      if (prod) prod.stock = Math.max(0, prod.stock - i.qty);
      this.deductRawMaterialsForSale(i.id, i.qty);
    });

    if (table_id) {
      const table = this.get('tables', table_id);
      if (table) table.status = 'available';
    }
    if (customer_id) {
      const cust = this.get('customers', customer_id);
      if (cust) {
        cust.points = (cust.points || 0) + Math.floor(total / 10000);
        if (cust.points >= 500) cust.membership = 'gold';
        else if (cust.points >= 150) cust.membership = 'silver';
      }
    }
    this.save();
    return trx;
  },

  transactionDetail(trxId) {
    const trx = this.get('transactions', trxId);
    if (!trx) return null;
    const items = this.list('transaction_items').filter(i => i.transaction_id === trxId).map(i => ({
      ...i, product: this.get('products', i.product_id)
    }));
    return {
      trx, items,
      cashier: this.list('employees').find(e => e.id === trx.cashier_id) || this.list('users').find(u => u.id === trx.cashier_id),
      customer: trx.customer_id ? this.get('customers', trx.customer_id) : null,
      table: trx.table_id ? this.get('tables', trx.table_id) : null,
    };
  },

  // Terima barang pembelian -> tambah stok
  receivePurchase(purchaseId) {
    const purchase = this.get('purchases', purchaseId);
    if (!purchase || purchase.status === 'received') return null;
    const items = this.list('purchase_items').filter(i => i.purchase_id === purchaseId);
    items.forEach(i => {
      const prod = this.get('products', i.product_id);
      if (prod) prod.stock += Number(i.quantity);
    });
    purchase.status = 'received';
    this.save();
    return purchase;
  },

  checkIn(employee_id) {
    const today = Util.todayISO();
    let att = this.list('attendance').find(a => a.employee_id === employee_id && a.date === today);
    const now = Util.nowTime();
    const lateMinutes = now > '08:00' ? (Number(now.split(':')[0]) * 60 + Number(now.split(':')[1])) - (8 * 60) : 0;
    if (att) { att.check_in = now; att.status = lateMinutes > 0 ? 'late' : 'present'; att.late_minutes = lateMinutes; }
    else {
      att = { id: Util.uid('att'), employee_id, date: today, check_in: now, check_out: null, status: lateMinutes > 0 ? 'late' : 'present', late_minutes: lateMinutes };
      this.data.attendance.push(att);
    }
    this.save();
    return att;
  },

  checkOut(employee_id) {
    const today = Util.todayISO();
    let att = this.list('attendance').find(a => a.employee_id === employee_id && a.date === today);
    if (!att) return null;
    att.check_out = Util.nowTime();
    this.save();
    return att;
  },

  dashboardStats(dateFrom, dateTo) {
    const inRange = (iso) => {
      const d = iso.slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    };
    const trx = this.list('transactions').filter(t => inRange(t.created_at) && t.status !== 'void');
    const revenue = trx.reduce((s, t) => s + t.total, 0);
    const itemsSold = this.list('transaction_items')
      .filter(i => trx.some(t => t.id === i.transaction_id))
      .reduce((s, i) => s + i.quantity, 0);
    const expenses = this.list('expenses').filter(e => inRange(e.date + 'T00:00:00')).reduce((s, e) => s + Number(e.amount), 0);
    return {
      revenue, transactionCount: trx.length, itemsSold, expenses,
      customerCount: this.list('customers').length,
      employeeCount: this.list('employees').filter(e => e.status === 'active').length,
      stockValue: this.list('products').reduce((s, p) => s + p.stock * p.cost, 0),
      lowStockCount: this.lowStockProducts().length,
      attendanceToday: this.list('attendance').filter(a => a.date === Util.todayISO()).length,
      netProfit: revenue - expenses,
    };
  },

  topProducts(limit = 5, dateFrom, dateTo) {
    const inRange = (iso) => {
      const d = iso.slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    };
    const trxIds = new Set(this.list('transactions').filter(t => inRange(t.created_at) && t.status !== 'void').map(t => t.id));
    const map = {};
    this.list('transaction_items').filter(i => trxIds.has(i.transaction_id)).forEach(i => {
      map[i.product_id] = (map[i.product_id] || 0) + i.quantity;
    });
    return Object.entries(map)
      .map(([product_id, qty]) => ({ product: this.get('products', product_id), qty }))
      .filter(x => x.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit);
  },

  salesByDay(days = 7) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = this.list('transactions')
        .filter(t => t.created_at.slice(0, 10) === iso && t.status !== 'void')
        .reduce((s, t) => s + t.total, 0);
      out.push({ date: iso, total });
    }
    return out;
  },

  /* --------------------- Manajemen Kas Kasir (Buka/Tutup Kasir) --------------------- */

  // Sesi kas yang sedang berjalan milik seorang kasir (jika ada)
  activeCashSession(cashierId) {
    return this.list('cash_sessions').find(s => s.cashier_id === cashierId && s.status === 'open') || null;
  },

  // Total penjualan tunai yang masuk sepanjang sebuah sesi kas berjalan
  // (termasuk porsi tunai dari transaksi split payment)
  cashSessionSalesTotal(session) {
    const end = session.closed_at || new Date().toISOString();
    const rows = this.list('transactions')
      .filter(t => t.cashier_id === session.cashier_id && t.status !== 'void'
        && t.created_at >= session.opened_at && t.created_at <= end);
    return rows.reduce((sum, t) => {
      if (t.payment_method === 'cash') return sum + t.total;
      if (t.payment_method === 'split' && Array.isArray(t.splits)) {
        const leg = t.splits.find(s => s.method === 'cash');
        if (leg) return sum + leg.amount;
      }
      return sum;
    }, 0);
  },

  // Total pendapatan per metode pembayaran dari sekumpulan transaksi (termasuk porsi split payment)
  revenueByMethod(methodId, rows) {
    return rows.reduce((sum, t) => {
      if (t.payment_method === methodId) return sum + t.total;
      if (t.payment_method === 'split' && Array.isArray(t.splits)) {
        const leg = t.splits.find(s => s.method === methodId);
        if (leg) return sum + leg.amount;
      }
      return sum;
    }, 0);
  },

  cashMovementsForSession(sessionId) {
    return this.list('cash_movements').filter(m => m.session_id === sessionId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  cashSessionInOutTotal(session) {
    const moves = this.cashMovementsForSession(session.id);
    const cashIn = moves.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
    const cashOut = moves.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
    return { cashIn, cashOut };
  },

  // Estimasi kas yang seharusnya ada di laci saat ini: modal awal + penjualan tunai + kas masuk - kas keluar
  cashSessionExpected(session) {
    const salesTotal = this.cashSessionSalesTotal(session);
    const { cashIn, cashOut } = this.cashSessionInOutTotal(session);
    return session.opening_cash + salesTotal + cashIn - cashOut;
  },

  // Buka kasir: kasir mencatat modal awal sebelum mulai melayani transaksi
  openCashSession({ cashier_id, cashier_name, opening_cash, note }) {
    const session = {
      id: Util.uid('cash'), cashier_id, cashier_name,
      opening_cash: Number(opening_cash) || 0, opening_note: note || '',
      opened_at: new Date().toISOString(),
      status: 'open',
      closing_cash: null, expected_cash: null, difference: null, closing_note: '', closed_at: null,
      denominations: null,
    };
    this.data.cash_sessions.push(session);
    this.save();
    this.logActivity({ type: 'open_session', actor_id: cashier_id, actor_name: cashier_name, ref_id: session.id, detail: `Membuka kasir dengan modal awal ${Util.formatCurrency(session.opening_cash)}` });
    return session;
  },

  // Tutup kasir: bandingkan uang tunai fisik (opsional dari rincian pecahan) dengan estimasi kas dari sistem
  closeCashSession(sessionId, actualCash, note, denominations) {
    const session = this.get('cash_sessions', sessionId);
    if (!session || session.status !== 'open') return null;
    session.closed_at = new Date().toISOString();
    const expected = this.cashSessionExpected(session);
    session.expected_cash = expected;
    session.closing_cash = Number(actualCash) || 0;
    session.difference = session.closing_cash - expected;
    session.closing_note = note || '';
    session.denominations = denominations || null;
    session.status = 'closed';
    this.save();
    this.logActivity({ type: 'close_session', actor_id: session.cashier_id, actor_name: session.cashier_name, ref_id: session.id, detail: `Menutup kasir. Selisih ${Util.formatCurrency(session.difference)}` });
    return session;
  },

  /* --------------------- Kas Masuk / Kas Keluar (selama sesi berjalan) --------------------- */

  addCashMovement({ session_id, cashier_id, cashier_name, type, amount, reason }) {
    const movement = {
      id: Util.uid('mov'), session_id, cashier_id, cashier_name,
      type, amount: Number(amount) || 0, reason: reason || '',
      created_at: new Date().toISOString(),
    };
    this.data.cash_movements.push(movement);
    this.save();
    this.logActivity({
      type: type === 'in' ? 'cash_in' : 'cash_out', actor_id: cashier_id, actor_name: cashier_name, ref_id: movement.id,
      detail: `${type === 'in' ? 'Kas masuk' : 'Kas keluar'} ${Util.formatCurrency(movement.amount)}${reason ? ' — ' + reason : ''}`,
    });
    return movement;
  },

  /* --------------------- Log Aktivitas Kasir (Audit Trail) --------------------- */

  logActivity({ type, actor_id, actor_name, detail, ref_id }) {
    const entry = { id: Util.uid('log'), type, actor_id, actor_name, detail, ref_id: ref_id || null, created_at: new Date().toISOString() };
    this.data.activity_logs.push(entry);
    this.save();
    return entry;
  },

  /* --------------------- Retur / Refund Sebagian Item --------------------- */

  createRefund({ transaction_id, items, reason, processed_by, processed_by_name }) {
    const trx = this.get('transactions', transaction_id);
    if (!trx) return null;
    const totalRefund = items.reduce((s, i) => s + i.price * i.qty, 0);
    const refund = {
      id: Util.uid('ref'), transaction_id, invoice_number: trx.invoice_number,
      items, total_refund: totalRefund, reason: reason || '',
      processed_by, processed_by_name, created_at: new Date().toISOString(),
    };
    this.data.refunds.push(refund);
    // Kembalikan stok produk yang diretur
    items.forEach(i => {
      const p = this.get('products', i.product_id);
      if (p) p.stock += i.qty;
    });
    // Catat sebagai kas keluar bila transaksi asal dibayar tunai dan kasir tsb masih punya sesi berjalan
    if (trx.payment_method === 'cash') {
      const session = this.activeCashSession(trx.cashier_id);
      if (session) {
        this.addCashMovement({
          session_id: session.id, cashier_id: trx.cashier_id, cashier_name: session.cashier_name,
          type: 'out', amount: totalRefund, reason: `Retur invoice ${trx.invoice_number}`,
        });
      }
    }
    this.save();
    this.logActivity({
      type: 'refund', actor_id: processed_by, actor_name: processed_by_name, ref_id: refund.id,
      detail: `Retur ${Util.formatCurrency(totalRefund)} untuk invoice ${trx.invoice_number}`,
    });
    return refund;
  },

  refundsForTransaction(transactionId) {
    return this.list('refunds').filter(r => r.transaction_id === transactionId);
  },

  /* --------------------- Tahan Pesanan (Park / Hold Order) --------------------- */

  holdOrder({ cashier_id, cashier_name, cart, table_id, customer_id, note }) {
    const order = {
      id: Util.uid('hold'), cashier_id, cashier_name, cart, table_id: table_id || null, customer_id: customer_id || null,
      note: note || '', created_at: new Date().toISOString(),
    };
    this.data.held_orders.push(order);
    this.save();
    this.logActivity({ type: 'hold_order', actor_id: cashier_id, actor_name: cashier_name, ref_id: order.id, detail: 'Menahan pesanan sementara' });
    return order;
  },

  heldOrdersFor(cashierId) {
    return this.list('held_orders').filter(o => o.cashier_id === cashierId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  removeHeldOrder(id) {
    this.data.held_orders = this.data.held_orders.filter(o => o.id !== id);
    this.save();
  },
};

/* -------------------------------------------------------------------------
   Session / Auth
   ------------------------------------------------------------------------- */
const Session = {
  get() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  },
  set(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      id: user.id, username: user.username, name: user.name, role: user.role, email: user.email
    }));
  },
  clear() { sessionStorage.removeItem(SESSION_KEY); },
  isLoggedIn() { return !!this.get(); },
};
