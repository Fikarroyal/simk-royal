/* =========================================================================
   main.js — Proses utama Electron untuk SIMK Royal (desktop: Mac/Win/Linux)
   Membuka aplikasi web (folder app/) dalam sebuah jendela desktop mandiri,
   lengkap dengan menu bar sederhana dan dukungan penuh IndexedDB (database
   tetap aktif, tersimpan permanen di profil pengguna komputer).
   ========================================================================= */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#F5F6F4',
    title: 'SIMK Royal',
    icon: path.join(__dirname, 'app', 'assets', 'icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // IndexedDB & localStorage aktif penuh secara default di BrowserWindow —
      // tidak perlu konfigurasi tambahan, data tersimpan permanen per-profil.
    },
  });

  mainWindow.setMenuBarVisibility(true);
  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Buka tautan eksternal (jika ada) di browser sistem, bukan di jendela app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

const menuTemplate = [
  {
    label: 'SIMK Royal',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Segarkan Halaman', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
      { type: 'separator' },
      { role: 'quit', label: 'Keluar' },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo', label: 'Urungkan' },
      { role: 'redo', label: 'Ulangi' },
      { type: 'separator' },
      { role: 'cut', label: 'Potong' },
      { role: 'copy', label: 'Salin' },
      { role: 'paste', label: 'Tempel' },
      { role: 'selectAll', label: 'Pilih Semua' },
    ],
  },
  {
    label: 'Tampilan',
    submenu: [
      { role: 'reload', label: 'Muat Ulang' },
      { role: 'toggleDevTools', label: 'Alat Pengembang' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Reset Zoom' },
      { role: 'zoomIn', label: 'Perbesar' },
      { role: 'zoomOut', label: 'Perkecil' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Layar Penuh' },
    ],
  },
  {
    label: 'Jendela',
    submenu: [
      { role: 'minimize', label: 'Minimalkan' },
      { role: 'close', label: 'Tutup' },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
