import { session, BrowserWindow } from 'electron';

export function setupSecurity(): void {
  // Configurar Content Security Policy (CSP) restrictiva en la sesión por defecto
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'none'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "media-src 'self' karaoke-media: data:; " +
            "img-src 'self' data:; " +
            "connect-src 'self' http://localhost:5173 ws://localhost:5173; " +
            "font-src 'self';",
        ],
      },
    });
  });
}

export function enforceWindowSecurity(win: BrowserWindow): void {
  // Bloquear navegación arbitraria y redirecciones
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    // Permitir solo navegación a la propia app local (vite dev o archivo local)
    const parsed = new URL(navigationUrl);
    if (parsed.protocol !== 'file:' && parsed.origin !== 'http://localhost:5173') {
      event.preventDefault();
      console.warn(`[Seguridad] Navegación bloqueada hacia: ${navigationUrl}`);
    }
  });

  // Bloquear apertura de nuevas ventanas no controladas
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[Seguridad] Apertura de ventana bloqueada hacia: ${url}`);
    return { action: 'deny' };
  });
}
