import { BrowserWindow, Display, screen } from 'electron';
import * as path from 'node:path';
import { enforceWindowSecurity } from '../security.js';

export function createPublicWindow(targetDisplay?: Display): BrowserWindow {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const preloadPath = path.resolve(__dirname, '../../preload/operator.js');

  // Si no se especifica pantalla, intentar ubicarla en un segundo monitor no primario
  let displayToUse = targetDisplay;
  if (!displayToUse) {
    const allDisplays = screen.getAllDisplays();
    const secondary = allDisplays.find((d) => d.id !== screen.getPrimaryDisplay().id);
    displayToUse = secondary || screen.getPrimaryDisplay();
  }

  const bounds = displayToUse.bounds;
  const isSecondary = displayToUse.id !== screen.getPrimaryDisplay().id;

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    title: 'Karaoke Total — Pantalla Pública',
    backgroundColor: '#000000',
    show: false,
    frame: !isSecondary, // Sin marco si está en pantalla externa, con marco si se prueba en la misma pantalla
    autoHideMenuBar: true,
    fullscreen: isSecondary,
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
    if (isSecondary) {
      win.setFullScreen(true);
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#public`);
  } else {
    const indexPath = path.resolve(__dirname, '../../renderer/index.html');
    win.loadFile(indexPath, { hash: 'public' });
  }

  return win;
}
