import { pgTable, foreignKey, serial, integer, varchar, numeric, timestamp, unique, text, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const fulfillmentStatus = pgEnum("fulfillment_status", ['pending', 'processing', 'shipped', 'delivered', 'failed'])
export const ingestStatus = pgEnum("ingest_status", ['queued', 'running', 'completed', 'failed'])
export const orderStatus = pgEnum("order_status", ['pending', 'processing', 'completed', 'cancelled', 'refunded'])


export const orderItems = pgTable("order_items", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	photoId: integer("photo_id"),
	productType: varchar("product_type", { length: 100 }).notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	quantity: integer().default(1),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	totalPrice: numeric("total_price", { precision: 10, scale:  2 }).notNull(),
	licenseType: varchar("license_type", { length: 50 }),
	downloadUrl: varchar("download_url", { length: 500 }),
	dateCreated: timestamp("date_created", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.photoId],
			foreignColumns: [photos.id],
			name: "order_items_photo_id_photos_id_fk"
		}),
]);

export const galleryPhotos = pgTable("gallery_photos", {
	id: serial().primaryKey().notNull(),
	galleryId: integer("gallery_id").notNull(),
	photoId: integer("photo_id").notNull(),
	sortOrder: integer("sort_order").default(0),
	dateAdded: timestamp("date_added", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.galleryId],
			foreignColumns: [galleries.id],
			name: "gallery_photos_gallery_id_galleries_id_fk"
		}),
	foreignKey({
			columns: [table.photoId],
			foreignColumns: [photos.id],
			name: "gallery_photos_photo_id_photos_id_fk"
		}),
]);

export const keywords = pgTable("keywords", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }),
	usageCount: integer("usage_count").default(0),
	dateCreated: timestamp("date_created", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("keywords_name_unique").on(table.name),
	unique("keywords_slug_unique").on(table.slug),
]);

export const galleries = pgTable("galleries", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	description: text(),
	coverPhotoId: integer("cover_photo_id"),
	parentGalleryId: integer("parent_gallery_id"),
	sortOrder: integer("sort_order").default(0),
	isActive: boolean("is_active").default(true),
	dateCreated: timestamp("date_created", { mode: 'string' }).defaultNow(),
	dateModified: timestamp("date_modified", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.coverPhotoId],
			foreignColumns: [photos.id],
			name: "galleries_cover_photo_id_photos_id_fk"
		}),
	unique("galleries_slug_unique").on(table.slug),
]);

export const ingestRuns = pgTable("ingest_runs", {
	id: serial().primaryKey().notNull(),
	runNumber: integer("run_number"),
	source: varchar({ length: 100 }).notNull(),
	status: ingestStatus().default('queued'),
	photosProcessed: integer("photos_processed").default(0),
	photosImported: integer("photos_imported").default(0),
	photosSkipped: integer("photos_skipped").default(0),
	photosFailed: integer("photos_failed").default(0),
	errors: jsonb(),
	dateStarted: timestamp("date_started", { mode: 'string' }),
	dateCompleted: timestamp("date_completed", { mode: 'string' }),
	dateCreated: timestamp("date_created", { mode: 'string' }).defaultNow(),
});

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	orderNumber: varchar("order_number", { length: 50 }).notNull(),
	customerEmail: varchar("customer_email", { length: 255 }).notNull(),
	customerName: varchar("customer_name", { length: 255 }),
	customerPhone: varchar("customer_phone", { length: 50 }),
	subtotal: numeric({ precision: 10, scale:  2 }),
	tax: numeric({ precision: 10, scale:  2 }),
	shipping: numeric({ precision: 10, scale:  2 }),
	total: numeric({ precision: 10, scale:  2 }).notNull(),
	status: orderStatus().default('pending'),
	notes: text(),
	metadata: jsonb(),
	dateCreated: timestamp("date_created", { mode: 'string' }).defaultNow(),
	dateModified: timestamp("date_modified", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("orders_order_number_unique").on(table.orderNumber),
]);

export const ingestJobs = pgTable("ingest_jobs", {
	id: serial().primaryKey().notNull(),
	runId: integer("run_id"),
	sourceId: varchar("source_id", { length: 255 }),
	sourceUrl: varchar("source_url", { length: 500 }),
	status: ingestStatus().default('queued'),
	photoId: integer("photo_id"),
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0),
	dateStarted: timestamp("date_started", { mode: 'string' }),
	dateCompleted: timestamp("date_completed", { mode: 'string' }),
	dateCreated: timestamp("date_created", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.runId],
			foreignColumns: [ingestRuns.id],
			name: "ingest_jobs_run_id_ingest_runs_id_fk"
		}),
	foreignKey({
			columns: [table.photoId],
			foreignColumns: [photos.id],
			name: "ingest_jobs_photo_id_photos_id_fk"
		}),
]);

export const fulfillments = pgTable("fulfillments", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	orderItemId: integer("order_item_id"),
	status: fulfillmentStatus().default('pending'),
	trackingNumber: varchar("tracking_number", { length: 100 }),
	trackingUrl: varchar("tracking_url", { length: 500 }),
	carrier: varchar({ length: 100 }),
	dateShipped: timestamp("date_shipped", { mode: 'string' }),
	dateDelivered: timestamp("date_delivered", { mode: 'string' }),
	notes: text(),
	metadata: jsonb(),
	dateCreated: timestamp("date_created", { mode: 'string' }).defaultNow(),
	dateModified: timestamp("date_modified", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "fulfillments_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.orderItemId],
			foreignColumns: [orderItems.id],
			name: "fulfillments_order_item_id_order_items_id_fk"
		}),
]);

export const photos = pgTable("photos", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }),
	description: text(),
	filename: varchar({ length: 255 }).notNull(),
	originalFilename: varchar("original_filename", { length: 255 }),
	imageUrl: varchar("image_url", { length: 500 }),
	thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
	width: integer(),
	height: integer(),
	fileSize: integer("file_size"),
	mimeType: varchar("mime_type", { length: 50 }),
	photographer: varchar({ length: 255 }),
	location: varchar({ length: 255 }),
	dateTaken: timestamp("date_taken", { mode: 'string' }),
	dateUploaded: timestamp("date_uploaded", { mode: 'string' }).defaultNow(),
	dateModified: timestamp("date_modified", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true),
	metadata: jsonb(),
});

export const photoKeywords = pgTable("photo_keywords", {
	id: serial().primaryKey().notNull(),
	photoId: integer("photo_id").notNull(),
	keywordId: integer("keyword_id").notNull(),
	confidence: numeric({ precision: 5, scale:  2 }),
	dateAssigned: timestamp("date_assigned", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.photoId],
			foreignColumns: [photos.id],
			name: "photo_keywords_photo_id_photos_id_fk"
		}),
	foreignKey({
			columns: [table.keywordId],
			foreignColumns: [keywords.id],
			name: "photo_keywords_keyword_id_keywords_id_fk"
		}),
]);
