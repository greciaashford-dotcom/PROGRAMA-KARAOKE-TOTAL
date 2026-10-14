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
