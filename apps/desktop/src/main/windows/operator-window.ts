import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { enforceWindowSecurity } from '../security.js';

export function createOperatorWindow(): BrowserWindow {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  const preloadPath = path.join(app.getAppPath(), 'dist', 'preload', 'operator.js');

  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1080,
    minHeight: 720,
    title: 'Karaoke Total — Consola del Operador',
    backgroundColor: '#09090b',
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: preloadPath,
    },
  });

  enforceWindowSecurity(win);

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
    win.loadFile(indexPath);
  }

  return win;
}
