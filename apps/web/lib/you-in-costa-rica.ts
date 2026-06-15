/**
 * Helper library for the "You in Costa Rica" AI photo personalization tool.
 */

import { sql } from "./db";

// ============================================================
// Types
// ============================================================

export interface YouInCRJob {
  id: string;
  userEmail: string | null;
  sessionId: string | null;
  sourcePhotoId: string | null;
  sourcePhotoSlug: string | null;
  sourceGallerySlug: string | null;
  sourceR2Key: string | null;
  sourceCdnUrl: string | null;
  uploadedUserR2Key: string | null;
  uploadedUserMime: string | null;
  uploadedUserSize: number | null;
  prompt: string | null;
  status: string;
  freeOutputR2Key: string | null;
  premiumOutputR2Key: string | null;
  watermarkApplied: boolean | null;
  stripeSessionId: string | null;
  stripePaymentStatus: string | null;
  stripeAmountCents: number | null;
  errorMessage: string | null;
  bundleJobIds: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  userEmail?: string;
  sessionId?: string;
  sourcePhotoId: string;
  sourcePhotoSlug?: string;
  sourceGallerySlug?: string;
  sourceR2Key: string;
  sourceCdnUrl?: string;
  uploadedUserR2Key: string;
  uploadedUserMime?: string;
  uploadedUserSize?: number;
  prompt?: string;
}

export interface BackgroundCandidate {
  id: string;
  slug: string;
  title: string;
  keywords: string | null;
  sceneType: string | null;
  gallerySlug: string | null;
  galleryName: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  thumbUrl: string | null;
  category: string;
}

export interface BackgroundCandidatesByCategory {
  category: string;
  photos: BackgroundCandidate[];
}

// ============================================================
// Core DB helpers
// ============================================================

/** Fetch a single job by UUID */
export async function getJobById(id: string): Promise<YouInCRJob | null> {
  const result = await sql`SELECT * FROM you_in_costa_rica_jobs WHERE id = ${id} LIMIT 1`;
  if (result.length === 0) return null;
  return mapJob(result[0]);
}

/** Create a new job record */
export async function createJob(data: CreateJobInput): Promise<YouInCRJob> {
  const result = await sql`
    INSERT INTO you_in_costa_rica_jobs (
      user_email, session_id,
      source_photo_id, source_photo_slug, source_gallery_slug,
      source_r2_key, source_cdn_url,
      uploaded_user_r2_key, uploaded_user_mime, uploaded_user_size,
      prompt, status
    ) VALUES (
      ${data.userEmail ?? null},
      ${data.sessionId ?? null},
      ${data.sourcePhotoId},
      ${data.sourcePhotoSlug ?? null},
      ${data.sourceGallerySlug ?? null},
      ${data.sourceR2Key},
      ${data.sourceCdnUrl ?? null},
      ${data.uploadedUserR2Key},
      ${data.uploadedUserMime ?? null},
      ${data.uploadedUserSize ?? null},
      ${data.prompt ?? "You in Costa Rica composite"},
      'uploaded'
    )
    RETURNING *
  `;
  return mapJob(result[0]);
}

/** Update job status and optionally set extra fields */
export async function updateJobStatus(
  id: string,
  status: string,
  extras?: { freeOutputR2Key?: string; premiumOutputR2Key?: string; stripeSessionId?: string; stripePaymentStatus?: string; errorMessage?: string; watermarkApplied?: boolean }
): Promise<void> {
  const sets = ["status = $1"];
  const vals: any[] = [status];

  if (extras?.freeOutputR2Key !== undefined)     { vals.push(extras.freeOutputR2Key);     sets.push(`free_output_r2_key = $${vals.length}`); }
  if (extras?.premiumOutputR2Key !== undefined)  { vals.push(extras.premiumOutputR2Key);  sets.push(`premium_output_r2_key = $${vals.length}`); }
  if (extras?.stripeSessionId !== undefined)     { vals.push(extras.stripeSessionId);     sets.push(`stripe_session_id = $${vals.length}`); }
  if (extras?.stripePaymentStatus !== undefined) { vals.push(extras.stripePaymentStatus); sets.push(`stripe_payment_status = $${vals.length}`); }
  if (extras?.errorMessage !== undefined)        { vals.push(extras.errorMessage);        sets.push(`error_message = $${vals.length}`); }
  if (extras?.watermarkApplied !== undefined)    { vals.push(extras.watermarkApplied);    sets.push(`watermark_applied = $${vals.length}`); }

  vals.push(id);
  await sql(`UPDATE you_in_costa_rica_jobs SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
}

/** Paginated job list for admin */
export async function getJobsForAdmin(
  page: number,
  filters: { status?: string; userEmail?: string; sessionId?: string } = {}
): Promise<{ jobs: YouInCRJob[]; total: number; totalPages: number }> {
  const PAGE_SIZE = 20;
  const offset = (page - 1) * PAGE_SIZE;

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(filters.status);
  }
  if (filters.userEmail) {
    conditions.push(`user_email ILIKE $${params.length + 1}`);
    params.push(`%${filters.userEmail}%`);
  }
  if (filters.sessionId) {
    conditions.push(`session_id = $${params.length + 1}`);
    params.push(filters.sessionId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await sql(
    `SELECT COUNT(*)::int as count FROM you_in_costa_rica_jobs ${whereClause}`,
    params.length > 0 ? params : undefined
  );
  const total = Number(countRows[0]?.count ?? 0);

  const rows = await sql(
    `SELECT * FROM you_in_costa_rica_jobs ${whereClause} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    params.length > 0 ? params : undefined
  );

  return {
    jobs: (rows as any[]).map(mapJob),
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

// ============================================================
// Background candidates
// ============================================================

/**
 * Fetch top ~30 candidate background photos grouped by category.
 * Each category gets up to 5 of the highest-popularity photos.
 */
export async function getBackgroundCandidates(): Promise<BackgroundCandidatesByCategory[]> {
  const result = await sql`
    SELECT
      p.id,
      p.slug,
      p.title,
      p.keywords,
      p.scene_type,
      p.gallery_slug,
      g.name AS gallery_name,
      p.medium_url,
      p.large_url,
      p.thumb_url,
      CASE
        WHEN p.keywords ILIKE '%beach%'    OR p.keywords ILIKE '%coast%'     OR p.gallery_slug ILIKE '%beach%'  THEN 'beach'
        WHEN p.keywords ILIKE '%volcan%'   OR p.gallery_slug ILIKE '%volcan%' THEN 'volcano'
        WHEN p.keywords ILIKE '%waterfall%' OR p.gallery_slug ILIKE '%waterfall%' THEN 'waterfall'
        WHEN p.keywords ILIKE '%rain%'     OR p.keywords ILIKE '%jungle%'
                                             OR p.gallery_slug ILIKE '%rain%'   THEN 'rainforest'
        WHEN p.keywords ILIKE '%wild%'     OR p.keywords ILIKE '%bird%'
                                             OR p.gallery_slug ILIKE '%wildlife%' THEN 'wildlife'
        WHEN p.keywords ILIKE '%aerial%'   OR p.keywords ILIKE '%drone%'      THEN 'aerial'
        WHEN p.keywords ILIKE '%sunset%'   OR p.keywords ILIKE '%sunrise%'     THEN 'sunset'
        ELSE 'other'
      END AS category
    FROM photos p
    LEFT JOIN galleries g ON p.gallery_slug = g.slug
    WHERE p.is_active = true
      AND p.ready_for_public_render = true
      AND p.medium_url IS NOT NULL
      AND p.large_url IS NOT NULL
    ORDER BY p.popularity DESC NULLS LAST
    LIMIT 100
  `;

  type Raw = {
    id: any;
    slug: any;
    title: any;
    keywords: any;
    scene_type: any;
    gallery_slug: any;
    gallery_name: any;
    medium_url: any;
    large_url: any;
    thumb_url: any;
    category: any;
  };

  const R2_PUBLIC = "https://images.wildphotography.com";
  const PER_CAT = 5;

  const grouped = new Map<string, BackgroundCandidate[]>();
  for (const row of result as Raw[]) {
    const cat = row.category as string;
    if (!grouped.has(cat)) grouped.set(cat, []);
    const photos = grouped.get(cat)!;
    if (photos.length < PER_CAT) {
      photos.push({
        id: String(row.id),
        slug: row.slug as string,
        title: row.title as string,
        keywords: row.keywords as string | null,
        sceneType: row.scene_type as string | null,
        gallerySlug: row.gallery_slug as string | null,
        galleryName: row.gallery_name as string | null,
        mediumUrl: row.medium_url ? `${R2_PUBLIC}/${row.medium_url}` : null,
        largeUrl: row.large_url ? `${R2_PUBLIC}/${row.large_url}` : null,
        thumbUrl: row.thumb_url ? `${R2_PUBLIC}/${row.thumb_url}` : null,
        category: cat,
      });
    }
  }

  return Array.from(grouped.entries()).map(([category, photos]) => ({
    category,
    photos,
  }));
}

// ============================================================
// Internal helpers
// ============================================================

function snake(camel: string): string {
  return camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function mapJob(row: any): YouInCRJob {
  return {
    id: String(row.id),
    userEmail: row.user_email ?? null,
    sessionId: row.session_id ?? null,
    sourcePhotoId: row.source_photo_id ?? null,
    sourcePhotoSlug: row.source_photo_slug ?? null,
    sourceGallerySlug: row.source_gallery_slug ?? null,
    sourceR2Key: row.source_r2_key ?? null,
    sourceCdnUrl: row.source_cdn_url ?? null,
    uploadedUserR2Key: row.uploaded_user_r2_key ?? null,
    uploadedUserMime: row.uploaded_user_mime ?? null,
    uploadedUserSize: row.uploaded_user_size ?? null,
    prompt: row.prompt ?? null,
    status: row.status ?? "",
    freeOutputR2Key: row.free_output_r2_key ?? null,
    premiumOutputR2Key: row.premium_output_r2_key ?? null,
    watermarkApplied: row.watermark_applied ?? null,
    stripeSessionId: row.stripe_session_id ?? null,
    stripePaymentStatus: row.stripe_payment_status ?? null,
    stripeAmountCents: row.stripe_amount_cents ?? null,
    errorMessage: row.error_message ?? null,
    bundleJobIds: row.bundle_job_ids ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}
