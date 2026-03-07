-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."fulfillment_status" AS ENUM('pending', 'processing', 'shipped', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingest_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'processing', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"photo_id" integer,
	"product_type" varchar(100) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"license_type" varchar(50),
	"download_url" varchar(500),
	"date_created" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gallery_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"gallery_id" integer NOT NULL,
	"photo_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0,
	"date_added" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"category" varchar(100),
	"usage_count" integer DEFAULT 0,
	"date_created" timestamp DEFAULT now(),
	CONSTRAINT "keywords_name_unique" UNIQUE("name"),
	CONSTRAINT "keywords_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_photo_id" integer,
	"parent_gallery_id" integer,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"date_created" timestamp DEFAULT now(),
	"date_modified" timestamp DEFAULT now(),
	CONSTRAINT "galleries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_number" integer,
	"source" varchar(100) NOT NULL,
	"status" "ingest_status" DEFAULT 'queued',
	"photos_processed" integer DEFAULT 0,
	"photos_imported" integer DEFAULT 0,
	"photos_skipped" integer DEFAULT 0,
	"photos_failed" integer DEFAULT 0,
	"errors" jsonb,
	"date_started" timestamp,
	"date_completed" timestamp,
	"date_created" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_name" varchar(255),
	"customer_phone" varchar(50),
	"subtotal" numeric(10, 2),
	"tax" numeric(10, 2),
	"shipping" numeric(10, 2),
	"total" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending',
	"notes" text,
	"metadata" jsonb,
	"date_created" timestamp DEFAULT now(),
	"date_modified" timestamp DEFAULT now(),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "ingest_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"source_id" varchar(255),
	"source_url" varchar(500),
	"status" "ingest_status" DEFAULT 'queued',
	"photo_id" integer,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"date_started" timestamp,
	"date_completed" timestamp,
	"date_created" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fulfillments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_item_id" integer,
	"status" "fulfillment_status" DEFAULT 'pending',
	"tracking_number" varchar(100),
	"tracking_url" varchar(500),
	"carrier" varchar(100),
	"date_shipped" timestamp,
	"date_delivered" timestamp,
	"notes" text,
	"metadata" jsonb,
	"date_created" timestamp DEFAULT now(),
	"date_modified" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"description" text,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255),
	"image_url" varchar(500),
	"thumbnail_url" varchar(500),
	"width" integer,
	"height" integer,
	"file_size" integer,
	"mime_type" varchar(50),
	"photographer" varchar(255),
	"location" varchar(255),
	"date_taken" timestamp,
	"date_uploaded" timestamp DEFAULT now(),
	"date_modified" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "photo_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"photo_id" integer NOT NULL,
	"keyword_id" integer NOT NULL,
	"confidence" numeric(5, 2),
	"date_assigned" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_jobs" ADD CONSTRAINT "ingest_jobs_run_id_ingest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingest_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_jobs" ADD CONSTRAINT "ingest_jobs_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_keywords" ADD CONSTRAINT "photo_keywords_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_keywords" ADD CONSTRAINT "photo_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE no action ON UPDATE no action;
*/