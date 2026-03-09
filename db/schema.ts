import { pgTable, serial, varchar, text, timestamp, integer, boolean, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const orderStatusEnum = pgEnum('order_status', ['pending', 'processing', 'completed', 'cancelled', 'refunded']);
export const fulfillmentStatusEnum = pgEnum('fulfillment_status', ['pending', 'processing', 'shipped', 'delivered', 'failed']);
export const ingestStatusEnum = pgEnum('ingest_status', ['queued', 'running', 'completed', 'failed']);

// Photos table - Updated with R2 storage
export const photos = pgTable('photos', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  
  // R2 Storage Keys (internal - never exposed)
  originalR2Key: varchar('original_r2_key', { length: 500 }),
  
  // Public Derivative URLs (exposed in API)
  thumbUrl: varchar('thumb_url', { length: 500 }),
  smallUrl: varchar('small_url', { length: 500 }),
  mediumUrl: varchar('medium_url', { length: 500 }),
  largeUrl: varchar('large_url', { length: 500 }),
  previewUrl: varchar('preview_url', { length: 500 }),
  
  // Legacy fields (for migration)
  filename: varchar('filename', { length: 255 }),
  originalFilename: varchar('original_filename', { length: 255 }),
  imageUrl: varchar('image_url', { length: 500 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  
  // Metadata
  width: integer('width'),
  height: integer('height'),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 50 }),
  orientation: varchar('orientation', { length: 20 }),
  
  // Attribution
  photographer: varchar('photographer', { length: 255 }),
  location: varchar('location', { length: 255 }),
  cameraModel: varchar('camera_model', { length: 255 }),
  lens: varchar('lens', { length: 255 }),
  
  // Dates
  dateTaken: timestamp('date_taken'),
  dateUploaded: timestamp('date_uploaded').defaultNow(),
  dateModified: timestamp('date_modified').defaultNow(),
  
  // Status
  isActive: boolean('is_active').default(true),
  popularity: integer('popularity').default(0),
  
  // Extra
  metadata: jsonb('metadata'),
});

// Keywords table
export const keywords = pgTable('keywords', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  category: varchar('category', { length: 100 }),
  usageCount: integer('usage_count').default(0),
  dateCreated: timestamp('date_created').defaultNow(),
});

// Photo_Keywords junction table
export const photoKeywords = pgTable('photo_keywords', {
  id: serial('id').primaryKey(),
  photoId: integer('photo_id').references(() => photos.id).notNull(),
  keywordId: integer('keyword_id').references(() => keywords.id).notNull(),
  confidence: decimal('confidence', { precision: 5, scale: 2 }),
  dateAssigned: timestamp('date_assigned').defaultNow(),
});

// Galleries table
export const galleries = pgTable('galleries', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  coverPhotoId: integer('cover_photo_id').references(() => photos.id),
  parentGalleryId: integer('parent_gallery_id'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  dateCreated: timestamp('date_created').defaultNow(),
  dateModified: timestamp('date_modified').defaultNow(),
});

// Gallery_Photos junction table
export const galleryPhotos = pgTable('gallery_photos', {
  id: serial('id').primaryKey(),
  galleryId: integer('gallery_id').references(() => galleries.id).notNull(),
  photoId: integer('photo_id').references(() => photos.id).notNull(),
  sortOrder: integer('sort_order').default(0),
  dateAdded: timestamp('date_added').defaultNow(),
});

// Orders table
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }),
  tax: decimal('tax', { precision: 10, scale: 2 }),
  shipping: decimal('shipping', { precision: 10, scale: 2 }),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').default('pending'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  dateCreated: timestamp('date_created').defaultNow(),
  dateModified: timestamp('date_modified').defaultNow(),
});

// Order_Items table
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  photoId: integer('photo_id').references(() => photos.id),
  productType: varchar('product_type', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  licenseType: varchar('license_type', { length: 50 }),
  downloadUrl: varchar('download_url', { length: 500 }),
  dateCreated: timestamp('date_created').defaultNow(),
});

// Fulfillments table
export const fulfillments = pgTable('fulfillments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  orderItemId: integer('order_item_id').references(() => orderItems.id),
  status: fulfillmentStatusEnum('status').default('pending'),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  trackingUrl: varchar('tracking_url', { length: 500 }),
  carrier: varchar('carrier', { length: 100 }),
  dateShipped: timestamp('date_shipped'),
  dateDelivered: timestamp('date_delivered'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  dateCreated: timestamp('date_created').defaultNow(),
  dateModified: timestamp('date_modified').defaultNow(),
});

// Ingest_Runs table
export const ingestRuns = pgTable('ingest_runs', {
  id: serial('id').primaryKey(),
  runNumber: integer('run_number'),
  source: varchar('source', { length: 100 }).notNull(),
  status: ingestStatusEnum('status').default('queued'),
  photosProcessed: integer('photos_processed').default(0),
  photosImported: integer('photos_imported').default(0),
  photosSkipped: integer('photos_skipped').default(0),
  photosFailed: integer('photos_failed').default(0),
  errors: jsonb('errors'),
  dateStarted: timestamp('date_started'),
  dateCompleted: timestamp('date_completed'),
  dateCreated: timestamp('date_created').defaultNow(),
});

// Ingest_Jobs table
export const ingestJobs = pgTable('ingest_jobs', {
  id: serial('id').primaryKey(),
  runId: integer('run_id').references(() => ingestRuns.id),
  sourceId: varchar('source_id', { length: 255 }),
  sourceUrl: varchar('source_url', { length: 500 }),
  status: ingestStatusEnum('status').default('queued'),
  photoId: integer('photo_id').references(() => photos.id),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  dateStarted: timestamp('date_started'),
  dateCompleted: timestamp('date_completed'),
  dateCreated: timestamp('date_created').defaultNow(),
});

// Type exports for queries
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
