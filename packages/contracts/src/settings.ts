import { z } from 'zod';

export const SettingsSchema = z.object({
  id: z.string().uuid(),
  language: z.enum(['es', 'en']).default('es'),
  theme: z.enum(['dark', 'light']).default('dark'),
  operatorDisplayId: z.string().nullable().default(null),
  publicDisplayId: z.string().nullable().default(null),
  masterVolume: z.number().int().min(0).max(100).default(80),
  karaokeVolume: z.number().int().min(0).max(100).default(100),
  ambientVolume: z.number().int().min(0).max(100).default(30),
  karaokeMuted: z.boolean().default(false),
  ambientMuted: z.boolean().default(false),
  masterMuted: z.boolean().default(false),
  crossfadeEnabled: z.boolean().default(true),
  crossfadeDurationSec: z.number().int().min(1).max(5).default(3),
  mixerExpanded: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SettingsDTO = z.infer<typeof SettingsSchema>;

export const UpdateSettingsSchema = SettingsSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateSettingsDTO = z.infer<typeof UpdateSettingsSchema>;
