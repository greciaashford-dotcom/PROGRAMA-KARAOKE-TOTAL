import { app, protocol } from 'electron';
import { AppLifecycle } from './lifecycle.js';

// Registrar esquema privilegiado antes de que la aplicación esté lista (app.whenReady)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'karaoke-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.whenReady().then(async () => {
  const lifecycle = AppLifecycle.getInstance();
  await lifecycle.bootstrap();

  app.on('activate', () => {
    // En macOS se suele recrear la ventana al hacer click en el dock si no hay otras abiertas
  });
});

process.on('uncaughtException', (error) => {
  console.error('[Error no capturado en proceso principal]:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Promesa rechazada no controlada]:', reason);
});
