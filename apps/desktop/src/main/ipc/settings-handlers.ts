import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  UpdateSettingsSchema,
  ok,
  err,
  ErrorCode,
} from '@karaoke/contracts';
import { SettingsRepository } from '@karaoke/database';

export function registerSettingsHandlers(settingsRepo: SettingsRepository): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    try {
      const settings = settingsRepo.getOrCreateSettings();
      return ok(settings);
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      return err(
        ErrorCode.DATABASE_ERROR,
        'No se pudo recuperar la configuración de la aplicación.',
      );
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = UpdateSettingsSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Parámetros de configuración inválidos.',
          parseResult.error.format(),
        );
      }

      const updated = settingsRepo.updateSettings(parseResult.data);
      return ok(updated);
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      return err(
        ErrorCode.DATABASE_ERROR,
        'No se pudo guardar la configuración.',
      );
    }
  });
}
