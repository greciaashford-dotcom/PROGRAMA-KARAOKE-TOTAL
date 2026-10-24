import { z } from 'zod';

export const FolderCategorySchema = z.enum(['KARAOKE', 'AMBIENT', 'EFFECT']);
export type FolderCategory = z.infer<typeof FolderCategorySchema>;

export const ScanStatusSchema = z.enum(['IDLE', 'SCANNING', 'COMPLETED', 'CANCELLED', 'FAILED']);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

export const MediaStatusSchema = z.enum([
  'AVAILABLE',
  'MISSING',
  'MODIFIED',
  'INCOMPATIBLE',
  'CORRUPT',
  'PENDING_ANALYSIS',
]);
export type MediaStatus = z.infer<typeof MediaStatusSchema>;

export const MetadataSourceSchema = z.enum(['FILENAME', 'MANUAL']);
export type MetadataSource = z.infer<typeof MetadataSourceSchema>;

export const MediaFolderDTOSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  category: FolderCategorySchema,
  enabled: z.boolean(),
  lastScanStartedAt: z.string().nullable(),
  lastScanCompletedAt: z.string().nullable(),
  scanStatus: ScanStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MediaFolderDTO = z.infer<typeof MediaFolderDTOSchema>;

export const MediaAssetDTOSchema = z.object({
  id: z.string().uuid(),
  folderId: z.string().uuid(),
  filename: z.string(),
  extension: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  container: z.string().nullable(),
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  audioChannels: z.number().int().nullable(),
  status: MediaStatusSchema,
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MediaAssetDTO = z.infer<typeof MediaAssetDTOSchema>;

export const SongDTOSchema = z.object({
  id: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
  title: z.string(),
  artist: z.string(),
  language: z.string().nullable(),
  genre: z.string().nullable(),
  collection: z.string().nullable(),
  disc: z.string().nullable(),
  track: z.string().nullable(),
  metadataSource: MetadataSourceSchema,
  asset: MediaAssetDTOSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SongDTO = z.infer<typeof SongDTOSchema>;

export const CatalogQuerySchema = z.object({
  search: z.string().optional(),
  folderId: z.string().uuid().optional(),
  category: FolderCategorySchema.optional(),
  status: MediaStatusSchema.optional(),
  extension: z.string().optional(),
  language: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sortBy: z.enum(['title', 'artist', 'createdAt']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

export const ToggleFolderSchema = z.object({
  folderId: z.string().uuid(),
  enabled: z.boolean(),
});
export type ToggleFolderDTO = z.infer<typeof ToggleFolderSchema>;

export const UpdateSongSchema = z.object({
  songId: z.string().uuid(),
  title: z.string().min(1),
  artist: z.string().min(1),
  language: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  collection: z.string().nullable().optional(),
});
export type UpdateSongDTO = z.infer<typeof UpdateSongSchema>;
