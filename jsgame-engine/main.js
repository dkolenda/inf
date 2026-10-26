// JSGame Engine — aplikacja desktopowa (Electron). Otwiera edytor z src/index.html w jednym oknie.
// Okna „Graj w nowym oknie” to podglądy gry (adresy blob:), linki do stron otwierają się w przeglądarce.
// Klasy TypeScript (pliki .ts edytowane w VS Code) obsługuje ts-host.js, a folder projektu z zasobami — project-host.js;
// edytor sięga do nich przez preload.js.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const { setupTsHost, DEBUG_PORT } = require('./ts-host');
const { setupProjectHost } = require('./project-host');

const ICON = path.join(__dirname, 'build', 'icon.png');
let mainWindow = null;

// Debuger VS Code (launch.json w Scripts/ projektu) podłącza się do edytora przez ten port — tylko z tego komputera.
app.commandLine.appendSwitch('remote-debugging-port', String(DEBUG_PORT));
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'JSGame Engine',
    icon: ICON,
    backgroundColor: '#0d0d0d',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 1024, height: 720, icon: ICON, autoHideMenuBar: true, backgroundColor: '#000000' }
      };
    }
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

// Jedna kopia programu naraz — dwa okna nadpisywałyby sobie zapis projektu.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    // Na Windows i Linuksie edytor ma własne menu, a skróty schowka działają bez menu okna.
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    setupTsHost();
    setupProjectHost();
    createWindow();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
