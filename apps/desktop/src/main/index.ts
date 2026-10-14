import { app } from 'electron';
import { AppLifecycle } from './lifecycle.js';

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
