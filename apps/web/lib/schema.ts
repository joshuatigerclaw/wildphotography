import { pgTable, uuid, varchar, text, timestamp, integer, numeric, boolean, jsonb, pgEnum, primaryKey, index } from 'drizzle-orm/pg-core';

// Enums
export const statusEnum = pgEnum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'public', 'private']);
export const orientationEnum = pgEnum('orientation', ['landscape', 'portrait', 'square']);
export const jobTypeEnum = pgEnum('job_type', ['metadata', 'download', 'derivative', 'index']);

// Photos table
export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  smugmugImageKey: varchar('smugmug_image_key', { length: 255 }).unique(),
  title: varchar('title', { length: 500 }),
  slug: varchar('slug', { length: 500 }).unique(),
  captionShort: varchar('caption_short', { length: 500 }),
  descriptionLong: text('description_long'),
  takenAt: timestamp('taken_at'),
  uploadedAt: timestamp('uploaded_at'),
  cameraMake: varchar('camera_make', { length: 100 }),
  cameraModel: varchar('camera_model', { length: 100 }),
  lens: varchar('lens', { length: 255 }),
  focalLengthMm: numeric('focal_length_mm', { precision: 10, scale: 2 }),
  aperture: numeric('aperture', { precision: 5, scale: 2 }),
  shutterS: numeric('shutter_s', { precision: 10, scale: 2 }),
  iso: integer('iso'),
  width: integer('width'),
  height: integer('height'),
  orientation: orientationEnum('orientation'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lon: numeric('lon', { precision: 10, scale: 7 }),
  locationName: varchar('location_name', { length: 255 }),
  country: varchar('country', { length: 100 }),
  status: statusEnum('status').default('public').notNull(),
  copyrightNotice: text('copyright_notice'),
  thumbUrl: varchar('thumb_url', { length: 500 }),
  smallUrl: varchar('small_url', { length: 500 }),
  mediumUrl: varchar('medium_url', { length: 500 }),
  largeUrl: varchar('large_url', { length: 500 }),
  previewUrl: varchar('preview_url', { length: 500 }),
  priceDownload: numeric('price_download', { precision: 10, scale: 2 }),
  originalStored: boolean('original_stored').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('photos_slug_idx').on(table.slug),
  statusIdx: index('photos_status_idx').on(table.status),
}));

// Keywords table
export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyword: varchar('keyword', { length: 255 }).notNull().unique(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  keywordType: varchar('keyword_type', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Photo_Keywords junction table
export const photoKeywords = pgTable('photo_keywords', {
  photoId: uuid('photo_id').references(() => photos.id).notNull(),
  keywordId: uuid('keyword_id').references(() => keywords.id).notNull(),
}, (t) => ({
  pk: primaryKey(t.photoId, t.keywordId),
}));

// Galleries table
export const galleries = pgTable('galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  smugmugAlbumKey: varchar('smugmug_album_key', { length: 255 }).unique(),
  title: varchar('title', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 500 }).unique(),
  description: text('description'),
  coverPhotoId: uuid('cover_photo_id').references(() => photos.id),
  parentGalleryId: uuid('parent_gallery_id'),
  status: statusEnum('status').default('public').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('galleries_slug_idx').on(table.slug),
}));

// Gallery_Photos junction table
export const galleryPhotos = pgTable('gallery_photos', {
  galleryId: uuid('gallery_id').references(() => galleries.id).notNull(),
  photoId: uuid('photo_id').references(() => photos.id).notNull(),
  position: integer('position'),
}, (t) => ({
  pk: primaryKey(t.galleryId, t.photoId),
}));

// Orders table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  status: statusEnum('status').default('pending').notNull(),
  paypalOrderId: varchar('paypal_order_id', { length: 100 }).unique(),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Order_Items table
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  photoId: uuid('photo_id').references(() => photos.id),
  sku: varchar('sku', { length: 100 }).notNull(),
  unitAmountCents: integer('unit_amount_cents').notNull(),
});

// Fulfillments table
export const fulfillments = pgTable('fulfillments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  downloadToken: varchar('download_token', { length: 255 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  maxDownloads: integer('max_downloads').default(5).notNull(),
  downloadCount: integer('download_count').default(0).notNull(),
});

// Ingest_Runs table
export const ingestRuns = pgTable('ingest_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: varchar('source', { length: 50 }).notNull(),
  status: statusEnum('status').default('pending').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  statsJson: jsonb('stats_json'),
});

// Ingest_Jobs table
export const ingestJobs = pgTable('ingest_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingestRunId: uuid('ingest_run_id').references(() => ingestRuns.id),
  jobType: jobTypeEnum('job_type').notNull(),
  sourceKey: varchar('source_key', { length: 255 }),
  status: statusEnum('status').default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
export type Gallery = typeof galleries.$inferSelect;
export type NewGallery = typeof galleries.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Fulfillment = typeof fulfillments.$inferSelect;
export type NewFulfillment = typeof fulfillments.$inferInsert;
export type IngestRun = typeof ingestRuns.$inferSelect;
export type NewIngestRun = typeof ingestRuns.$inferInsert;
export type IngestJob = typeof ingestJobs.$inferSelect;
export type NewIngestJob = typeof ingestJobs.$inferInsert;
