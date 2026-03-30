/**
 * Photo Operations Admin — Database layer
 * Uses `pg` for full SQL support (transactions, RETURNING, bulk upserts).
 */

import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require";

export function getAdminClient(): Client {
  return new Client({ connectionString: DATABASE_URL, statement_timeout: 30000 });
}

// ── Photo Library ──────────────────────────────────────────────────────────────

export type PhotoListItem = {
  id: number;
  slug: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  location_name: string | null;
  region: string | null;
  country: string | null;
  gallery_id: number | null;
  gallery_slug: string | null;
  gallery_name: string | null;
  species_common_name: string | null;
  species_scientific_name: string | null;
  derivatives_complete: boolean;
  ready_for_public_render: boolean;
  search_ready: boolean;
  ai_description_status: string | null;
  ai_description: string | null;
  description_locked: boolean;
  preview_url: string | null;
  thumb_url: string | null;
  medium_url: string | null;
  date_taken: string | null;
  date_uploaded: string | null;
  source_path: string | null;
  original_r2_key: string | null;
  ai_description_generated_at: string | null;
};

export type PhotoDetail = PhotoListItem & {
  ai_description_source: string | null;
  ai_description_model: string | null;
  ai_description_word_count: number | null;
  ai_description_version: string | null;
  ai_description_review_notes: string | null;
  description_last_manual_edit_at: string | null;
  camera_model: string | null;
  lens_model: string | null;
  category_raw: string | null;
};

const PHOTO_LIST_SELECT = `
  p.id, p.slug, p.title, p.description, p.keywords,
  p.location_name, p.region, p.country,
  p.gallery_id, p.gallery_slug,
  g.name AS gallery_name,
  p.species_common_name, p.species_scientific_name,
  p.derivatives_complete, p.ready_for_public_render, p.search_ready,
  p.ai_description_status, p.ai_description,
  p.description_locked,
  p.preview_url, p.thumb_url, p.medium_url,
  p.date_taken::text, p.date_uploaded::text,
  p.source_path, p.original_r2_key,
  p.ai_description_generated_at::text
`;

export async function listPhotos(opts: {
  page?: number;
  perPage?: number;
  search?: string;
  filterReady?: boolean;
  filterSearchReady?: boolean;
  filterDerivatives?: boolean;
  filterAiStatus?: string; // null | generated | accepted | rejected | failed
  filterGallery?: string;
  filterCategory?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<{ photos: PhotoListItem[]; total: number }> {
  const {
    page = 1,
    perPage = 48,
    search = "",
    filterReady,
    filterSearchReady,
    filterDerivatives,
    filterAiStatus,
    filterGallery,
    sortBy = "p.id",
    sortDir = "desc",
  } = opts;
  const offset = (page - 1) * perPage;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(p.slug ILIKE $${paramIdx} OR p.title ILIKE $${paramIdx} OR p.keywords ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (filterReady !== undefined) {
    conditions.push(`p.ready_for_public_render = $${paramIdx}`);
    params.push(filterReady);
    paramIdx++;
  }
  if (filterSearchReady !== undefined) {
    conditions.push(`p.search_ready = $${paramIdx}`);
    params.push(filterSearchReady);
    paramIdx++;
  }
  if (filterDerivatives !== undefined) {
    conditions.push(`p.derivatives_complete = $${paramIdx}`);
    params.push(filterDerivatives);
    paramIdx++;
  }
  if (filterAiStatus) {
    if (filterAiStatus === "null") {
      conditions.push(`p.ai_description_status IS NULL`);
    } else {
      conditions.push(`p.ai_description_status = $${paramIdx}`);
      params.push(filterAiStatus);
      paramIdx++;
    }
  }
  if (filterGallery) {
    conditions.push(`p.gallery_slug = $${paramIdx}`);
    params.push(filterGallery);
    paramIdx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = `${sortBy} ${sortDir.toUpperCase()} NULLS LAST`;

  const client = getAdminClient();
  try {
    await client.connect();

    const countRes = await client.query(
      `SELECT COUNT(*) FROM photos p LEFT JOIN galleries g ON g.id = p.gallery_id ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const q = `SELECT ${PHOTO_LIST_SELECT} FROM photos p LEFT JOIN galleries g ON g.id = p.gallery_id ${where} ORDER BY ${order} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const allParams = [...params, perPage, offset];
    const res = await client.query(q, allParams);

    return { photos: res.rows as PhotoListItem[], total };
  } finally {
    await client.end();
  }
}

export async function getPhotoById(id: number): Promise<PhotoDetail | null> {
  const client = getAdminClient();
  try {
    await client.connect();
    const res = await client.query(
      `SELECT ${PHOTO_LIST_SELECT},
              p.ai_description_source, p.ai_description_model,
              p.ai_description_word_count, p.ai_description_version,
              p.ai_description_review_notes,
              p.description_last_manual_edit_at,
              p.camera_model, p.lens_model, p.category_raw
       FROM photos p
       LEFT JOIN galleries g ON g.id = p.gallery_id
       WHERE p.id = $1`,
      [id]
    );
    return res.rows[0] as PhotoDetail ?? null;
  } finally {
    await client.end();
  }
}

export async function updatePhoto(
  id: number,
  fields: {
    title?: string | null;
    description?: string | null;
    keywords?: string | null;
    location_name?: string | null;
    region?: string | null;
    country?: string | null;
    gallery_id?: number | null;
    gallery_slug?: string | null;
    species_common_name?: string | null;
    species_scientific_name?: string | null;
    search_ready?: boolean;
    ready_for_public_render?: boolean;
    description_locked?: boolean;
    ai_description_review_notes?: string | null;
    ai_description_status?: string | null;
    description_last_manual_edit_at?: string;
  }
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      sets.push(`${k} = $${i}`);
      vals.push(v);
      i++;
    }
  }
  if (!sets.length) return;

  vals.push(id);
  const client = getAdminClient();
  try {
    await client.connect();
    await client.query(`UPDATE photos SET ${sets.join(", ")} WHERE id = $${i}`, vals);
  } finally {
    await client.end();
  }
}

export async function bulkUpdatePhotos(
  ids: number[],
  fields: {
    keywords?: string | null;
    gallery_id?: number | null;
    gallery_slug?: string | null;
    search_ready?: boolean;
    ready_for_public_render?: boolean;
  }
): Promise<number> {
  if (!ids.length) return 0;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      sets.push(`${k} = $${i}`);
      vals.push(v);
      i++;
    }
  }
  if (!sets.length) return 0;

  vals.push(ids);
  const client = getAdminClient();
  try {
    await client.connect();
    const res = await client.query(
      `UPDATE photos SET ${sets.join(", ")} WHERE id = ANY($${i})`,
      vals
    );
    return res.rowCount ?? 0;
  } finally {
    await client.end();
  }
}

// ── Galleries ──────────────────────────────────────────────────────────────────

export type Gallery = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  photo_count?: number;
};

export async function listGalleries(): Promise<Gallery[]> {
  const client = getAdminClient();
  try {
    await client.connect();
    const res = await client.query(`
      SELECT g.id, g.name, g.slug, g.description,
             COUNT(p.id)::int AS photo_count
      FROM galleries g
      LEFT JOIN photos p ON p.gallery_id = g.id
      GROUP BY g.id, g.name, g.slug, g.description
      ORDER BY g.name
    `);
    return res.rows as Gallery[];
  } finally {
    await client.end();
  }
}

// ── Quality Review Queue ───────────────────────────────────────────────────────

export type QualityIssue = {
  id: number;
  slug: string;
  issue_type: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  gallery_slug: string | null;
  search_ready: boolean;
  ready_for_public_render: boolean;
  derivatives_complete: boolean;
  ai_description_status: string | null;
  thumb_url: string | null;
};

export async function getQualityQueue(): Promise<QualityIssue[]> {
  const client = getAdminClient();
  try {
    await client.connect();
    const res = await client.query(`
      SELECT p.id, p.slug, p.title, p.description, p.keywords, p.gallery_slug,
             p.search_ready, p.ready_for_public_render, p.derivatives_complete,
             p.ai_description_status, p.thumb_url,
             CASE
               WHEN p.search_ready = true AND p.ready_for_public_render = false
                 THEN 'search_ready_but_not_renderable'
               WHEN p.ready_for_public_render = true AND p.search_ready = false
                 THEN 'renderable_but_not_searchable'
               WHEN p.ai_description_status IS NULL
                 THEN 'missing_ai_description'
               WHEN p.ai_description_status = 'failed'
                 THEN 'ai_description_failed'
               WHEN p.keywords IS NULL OR length(trim(p.keywords)) < 3
                 THEN 'weak_keywords'
               WHEN p.description IS NULL OR length(trim(p.description)) < 40
                 THEN 'weak_description'
               WHEN p.derivatives_complete = false
                 THEN 'missing_derivatives'
               ELSE 'other'
             END AS issue_type
      FROM photos p
      WHERE
        (p.search_ready = true AND p.ready_for_public_render = false)
        OR (p.ready_for_public_render = true AND p.search_ready = false)
        OR (p.ai_description_status IS NULL AND p.ready_for_public_render = true)
        OR (p.ai_description_status = 'failed')
        OR (p.ready_for_public_render = true AND p.derivatives_complete = false)
      ORDER BY
        CASE issue_type
          WHEN 'missing_derivatives' THEN 1
          WHEN 'missing_ai_description' THEN 2
          WHEN 'weak_description' THEN 3
          WHEN 'ai_description_failed' THEN 4
          WHEN 'search_ready_but_not_renderable' THEN 5
          WHEN 'renderable_but_not_searchable' THEN 6
          ELSE 7
        END,
        p.id DESC
      LIMIT 200
    `);
    return res.rows as QualityIssue[];
  } finally {
    await client.end();
  }
}

// ── Stats / Dashboard ────────────────────────────────────────────────────────

export type AdminStats = {
  total_photos: number;
  ready_for_public_render: number;
  search_ready: number;
  derivatives_complete: number;
  ai_descriptions_generated: number;
  ai_descriptions_accepted: number;
  ai_descriptions_failed: number;
  quality_issues: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const client = getAdminClient();
  try {
    await client.connect();
    const [total, ready, search, derivs, aiStatusRows, qualityRows] = await Promise.all([
      client.query("SELECT count(*) FROM photos"),
      client.query("SELECT count(*) FROM photos WHERE ready_for_public_render = true"),
      client.query("SELECT count(*) FROM photos WHERE search_ready = true"),
      client.query("SELECT count(*) FROM photos WHERE derivatives_complete = true"),
      client.query(`SELECT ai_description_status, count(*)::int FROM photos WHERE ai_description_source = 'visionati' GROUP BY ai_description_status`),
      client.query(`SELECT count(*) FROM photos WHERE (search_ready = true AND ready_for_public_render = false) OR (ready_for_public_render = true AND search_ready = false) OR (ai_description_status IS NULL AND ready_for_public_render = true) OR (ai_description_status = 'failed') OR (ready_for_public_render = true AND derivatives_complete = false)`),
    ]);

    const aiMap: Record<string, number> = {};
    for (const r of aiStatusRows.rows) aiMap[r.ai_description_status] = parseInt(r.count, 10);

    return {
      total_photos: parseInt(total.rows[0].count, 10),
      ready_for_public_render: parseInt(ready.rows[0].count, 10),
      search_ready: parseInt(search.rows[0].count, 10),
      derivatives_complete: parseInt(derivs.rows[0].count, 10),
      ai_descriptions_generated: aiMap.generated ?? 0,
      ai_descriptions_accepted: aiMap.accepted ?? 0,
      ai_descriptions_failed: aiMap.failed ?? 0,
      quality_issues: parseInt(qualityRows.rows[0].count, 10),
    };
  } finally {
    await client.end();
  }
}

// ── Edit History ──────────────────────────────────────────────────────────────

export type EditHistoryEntry = {
  id: number;
  photo_id: number;
  edited_by: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  edited_at: string;
};

export async function getEditHistory(photoId: number): Promise<EditHistoryEntry[]> {
  const client = getAdminClient();
  try {
    await client.connect();
    const res = await client.query(
      `SELECT id, photo_id, edited_by, field_changed, old_value, new_value, edited_at::text
       FROM photo_edit_history WHERE photo_id = $1 ORDER BY edited_at DESC LIMIT 50`,
      [photoId]
    );
    return res.rows as EditHistoryEntry[];
  } finally {
    await client.end();
  }
}

export async function logEdit(
  photoId: number,
  editedBy: string,
  fieldChanged: string,
  oldValue: string | null,
  newValue: string | null
): Promise<void> {
  const client = getAdminClient();
  try {
    await client.connect();
    await client.query(
      `INSERT INTO photo_edit_history (photo_id, edited_by, field_changed, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [photoId, editedBy, fieldChanged, oldValue, newValue]
    );
  } finally {
    await client.end();
  }
}
