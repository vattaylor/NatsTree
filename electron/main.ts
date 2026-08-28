import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, shell } from "electron";
import { startServer } from "../server/bridge";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let stopServer: (() => Promise<void>) | undefined;

async function resolveAppUrl() {
  if (isDev) return "http://127.0.0.1:5173";
  const running = await startServer({
    port: 0,
    distDir: path.join(__dirname, "../dist"),
  });
  stopServer = running.close;
  return `http://127.0.0.1:${running.port}`;
}

async function createWindow() {
  const url = await resolveAppUrl();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: "NatsTree",
    backgroundColor: "#f3f8fc",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    void shell.openExternal(target);
    return { action: "deny" };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setName("NatsTree");
    Menu.setApplicationMenu(null);
    await createWindow();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    void stopServer?.();
  });
}
