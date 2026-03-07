import { relations } from "drizzle-orm/relations";
import { orders, orderItems, photos, galleries, galleryPhotos, ingestRuns, ingestJobs, fulfillments, photoKeywords, keywords } from "./schema";

export const orderItemsRelations = relations(orderItems, ({one, many}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	photo: one(photos, {
		fields: [orderItems.photoId],
		references: [photos.id]
	}),
	fulfillments: many(fulfillments),
}));

export const ordersRelations = relations(orders, ({many}) => ({
	orderItems: many(orderItems),
	fulfillments: many(fulfillments),
}));

export const photosRelations = relations(photos, ({many}) => ({
	orderItems: many(orderItems),
	galleryPhotos: many(galleryPhotos),
	galleries: many(galleries),
	ingestJobs: many(ingestJobs),
	photoKeywords: many(photoKeywords),
}));

export const galleryPhotosRelations = relations(galleryPhotos, ({one}) => ({
	gallery: one(galleries, {
		fields: [galleryPhotos.galleryId],
		references: [galleries.id]
	}),
	photo: one(photos, {
		fields: [galleryPhotos.photoId],
		references: [photos.id]
	}),
}));

export const galleriesRelations = relations(galleries, ({one, many}) => ({
	galleryPhotos: many(galleryPhotos),
	photo: one(photos, {
		fields: [galleries.coverPhotoId],
		references: [photos.id]
	}),
}));

export const ingestJobsRelations = relations(ingestJobs, ({one}) => ({
	ingestRun: one(ingestRuns, {
		fields: [ingestJobs.runId],
		references: [ingestRuns.id]
	}),
	photo: one(photos, {
		fields: [ingestJobs.photoId],
		references: [photos.id]
	}),
}));

export const ingestRunsRelations = relations(ingestRuns, ({many}) => ({
	ingestJobs: many(ingestJobs),
}));

export const fulfillmentsRelations = relations(fulfillments, ({one}) => ({
	order: one(orders, {
		fields: [fulfillments.orderId],
		references: [orders.id]
	}),
	orderItem: one(orderItems, {
		fields: [fulfillments.orderItemId],
		references: [orderItems.id]
	}),
}));

export const photoKeywordsRelations = relations(photoKeywords, ({one}) => ({
	photo: one(photos, {
		fields: [photoKeywords.photoId],
		references: [photos.id]
	}),
	keyword: one(keywords, {
		fields: [photoKeywords.keywordId],
		references: [keywords.id]
	}),
}));

export const keywordsRelations = relations(keywords, ({many}) => ({
	photoKeywords: many(photoKeywords),
}));