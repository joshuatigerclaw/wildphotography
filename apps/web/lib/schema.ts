import { pgTable, uuid, varchar, text, timestamp, integer, numeric, boolean, pgEnum, primaryKey } from 'drizzle-orm/pg-core';

export const galleries = pgTable('galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 500 }).unique().notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('public'),
  dateCreated: timestamp('date_created').defaultNow().notNull(),
  dateModified: timestamp('date_modified').defaultNow().notNull(),
});

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 500 }).unique().notNull(),
  title: varchar('title', { length: 500 }),
  captionShort: varchar('caption_short', { length: 500 }),
  descriptionLong: text('description_long'),
  locationName: varchar('location_name', { length: 255 }),
  country: varchar('country', { length: 100 }),
  cameraMake: varchar('camera_make', { length: 100 }),
  cameraModel: varchar('camera_model', { length: 100 }),
  lens: varchar('lens', { length: 255 }),
  width: integer('width'),
  height: integer('height'),
  orientation: varchar('orientation', { length: 20 }),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lon: numeric('lon', { precision: 10, scale: 7 }),
  thumbUrl: varchar('thumb_url', { length: 500 }),
  smallUrl: varchar('small_url', { length: 500 }),
  mediumUrl: varchar('medium_url', { length: 500 }),
  largeUrl: varchar('large_url', { length: 500 }),
  priceDownload: numeric('price_download', { precision: 10, scale: 2 }),
  status: varchar('status', { length: 20 }).default('public'),
  dateCreated: timestamp('date_created').defaultNow().notNull(),
  dateModified: timestamp('date_modified').defaultNow().notNull(),
});

export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyword: varchar('keyword', { length: 255 }).notNull().unique(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  keywordType: varchar('keyword_type', { length: 50 }),
  dateCreated: timestamp('date_created').defaultNow().notNull(),
});

export const galleryPhotos = pgTable('gallery_photos', {
  galleryId: uuid('gallery_id').notNull(),
  photoId: uuid('photo_id').notNull(),
  position: integer('position'),
}, (t) => ({ pk: primaryKey(t.galleryId, t.photoId) }));

export const photoKeywords = pgTable('photo_keywords', {
  photoId: uuid('photo_id').notNull(),
  keywordId: uuid('keyword_id').notNull(),
}, (t) => ({ pk: primaryKey(t.photoId, t.keywordId) }));

export type Gallery = typeof galleries.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
