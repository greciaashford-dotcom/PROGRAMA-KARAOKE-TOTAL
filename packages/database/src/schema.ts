import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const settingsTable = sqliteTable('settings', {
  id: text('id').primaryKey(),
  language: text('language').notNull().default('es'),
  theme: text('theme').notNull().default('dark'),
  operatorDisplayId: text('operator_display_id'),
  publicDisplayId: text('public_display_id'),
  masterVolume: integer('master_volume').notNull().default(80),
  karaokeVolume: integer('karaoke_volume').notNull().default(100),
  ambientVolume: integer('ambient_volume').notNull().default(30),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const mediaFoldersTable = sqliteTable('media_folders', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  absolutePath: text('absolute_path_encrypted_or_local_only').notNull(),
  category: text('category').notNull().default('KARAOKE'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastScanStartedAt: text('last_scan_started_at'),
  lastScanCompletedAt: text('last_scan_completed_at'),
  scanStatus: text('scan_status').notNull().default('IDLE'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const mediaAssetsTable = sqliteTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    folderId: text('folder_id')
      .notNull()
      .references(() => mediaFoldersTable.id, { onDelete: 'cascade' }),
    relativePath: text('relative_path').notNull(),
    filename: text('filename').notNull(),
    extension: text('extension').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    modifiedAt: text('modified_at').notNull(),
    fingerprint: text('fingerprint').notNull(),
    durationMs: integer('duration_ms'),
    container: text('container'),
    videoCodec: text('video_codec'),
    audioCodec: text('audio_codec'),
    width: integer('width'),
    height: integer('height'),
    audioChannels: integer('audio_channels'),
    status: text('status').notNull().default('PENDING_ANALYSIS'),
    lastSeenAt: text('last_seen_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_media_assets_folder_relative').on(table.folderId, table.relativePath),
    index('idx_media_assets_fingerprint').on(table.fingerprint),
    index('idx_media_assets_status').on(table.status),
  ],
);

export const songsTable = sqliteTable(
  'songs',
  {
    id: text('id').primaryKey(),
    mediaAssetId: text('media_asset_id')
      .notNull()
      .references(() => mediaAssetsTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    language: text('language'),
    genre: text('genre'),
    collection: text('collection'),
    disc: text('disc'),
    track: text('track'),
    searchTextNormalized: text('search_text_normalized').notNull(),
    metadataSource: text('metadata_source').notNull().default('FILENAME'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_songs_search').on(table.searchTextNormalized),
    index('idx_songs_asset').on(table.mediaAssetId),
  ],
);

export const karaokeSessionsTable = sqliteTable('karaoke_sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('OPEN'),
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const singersTable = sqliteTable(
  'singers',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => karaokeSessionsTable.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    tableOrLocation: text('table_or_location'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_singers_session').on(table.sessionId)],
);

export const queueItemsTable = sqliteTable(
  'queue_items',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => karaokeSessionsTable.id, { onDelete: 'cascade' }),
    songId: text('song_id')
      .notNull()
      .references(() => songsTable.id, { onDelete: 'restrict' }),
    singerId: text('singer_id')
      .notNull()
      .references(() => singersTable.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    keyShift: integer('key_shift').notNull().default(0),
    tempoPercent: integer('tempo_percent').notNull().default(100),
    status: text('status').notNull().default('QUEUED'),
    failureReason: text('failure_reason'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_queue_items_session_pos').on(table.sessionId, table.position),
    index('idx_queue_items_status').on(table.status),
  ],
);

export const queueEventsTable = sqliteTable(
  'queue_events',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => karaokeSessionsTable.id, { onDelete: 'cascade' }),
    queueItemId: text('queue_item_id')
      .notNull()
      .references(() => queueItemsTable.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    previousState: text('previous_state'),
    nextState: text('next_state').notNull(),
    payloadJson: text('payload_json'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_queue_events_item').on(table.queueItemId),
    index('idx_queue_events_session').on(table.sessionId),
  ],
);

export const playbackStateTable = sqliteTable('playback_state', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => karaokeSessionsTable.id, { onDelete: 'set null' }),
  queueItemId: text('queue_item_id').references(() => queueItemsTable.id, { onDelete: 'set null' }),
  mediaAssetId: text('media_asset_id').references(() => mediaAssetsTable.id, { onDelete: 'set null' }),
  state: text('state').notNull().default('IDLE'),
  positionMs: integer('position_ms').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  volume: integer('volume').notNull().default(100),
  lastErrorCode: text('last_error_code'),
  updatedAt: text('updated_at').notNull(),
});

// Relations
export const mediaFoldersRelations = relations(mediaFoldersTable, ({ many }) => ({
  assets: many(mediaAssetsTable),
}));

export const mediaAssetsRelations = relations(mediaAssetsTable, ({ one }) => ({
  folder: one(mediaFoldersTable, {
    fields: [mediaAssetsTable.folderId],
    references: [mediaFoldersTable.id],
  }),
  song: one(songsTable, {
    fields: [mediaAssetsTable.id],
    references: [songsTable.mediaAssetId],
  }),
}));

export const songsRelations = relations(songsTable, ({ one, many }) => ({
  mediaAsset: one(mediaAssetsTable, {
    fields: [songsTable.mediaAssetId],
    references: [mediaAssetsTable.id],
  }),
  queueItems: many(queueItemsTable),
}));

export const karaokeSessionsRelations = relations(karaokeSessionsTable, ({ many }) => ({
  singers: many(singersTable),
  queueItems: many(queueItemsTable),
  events: many(queueEventsTable),
}));

export const singersRelations = relations(singersTable, ({ one, many }) => ({
  session: one(karaokeSessionsTable, {
    fields: [singersTable.sessionId],
    references: [karaokeSessionsTable.id],
  }),
  queueItems: many(queueItemsTable),
}));

export const queueItemsRelations = relations(queueItemsTable, ({ one, many }) => ({
  session: one(karaokeSessionsTable, {
    fields: [queueItemsTable.sessionId],
    references: [karaokeSessionsTable.id],
  }),
  song: one(songsTable, {
    fields: [queueItemsTable.songId],
    references: [songsTable.id],
  }),
  singer: one(singersTable, {
    fields: [queueItemsTable.singerId],
    references: [singersTable.id],
  }),
  events: many(queueEventsTable),
}));
