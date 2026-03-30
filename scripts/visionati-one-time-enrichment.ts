/**
 * Visionati one-time enrichment runner for WildPhotography photo descriptions.
 *
 * Usage:
 *   npx tsx scripts/visionati-one-time-enrichment.ts
 *
 * Env vars (see .env.example):
 *   DATABASE_URL
 *   VISIONATI_API_KEY
 *   VISIONATI_BASE_URL
 *   VISIONATI_DESCRIPTION_BACKENDS
 *   VISIONATI_FEATURES
 *   VISIONATI_ROLE
 *   VISIONATI_LANGUAGE
 *   VISIONATI_TIMEOUT_MS
 *   VISIONATI_DESCRIBE_ENDPOINT
 *   VISIONATI_RUN_LIMIT_PER_CATEGORY  (default 15)
 *   VISIONATI_MAX_RETRIES            (default 1)
 *   VISIONATI_DESCRIPTION_VERSION     (default visionati-wildphotography-v1)
 */

import "dotenv/config";
import { Client } from "pg";
import { buildUserPrompt } from "../src/lib/visionati-prompt";
import { describeImageWithVisionati } from "../src/lib/visionati-client";
import {
  isAcceptableGeneratedDescription,
  isStrongDescription,
  isWeakDescription,
} from "../src/lib/description-quality";

// ── Types ────────────────────────────────────────────────────────────────────

type CandidateRow = {
  id: number;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  category_key: string | null; // gallery_slug used as proxy for category
  gallery_name: string | null;
  location_name: string | null;
  region: string | null;
  country: string | null;
  common_name: string | null;
  scientific_name: string | null;
  camera_model: string | null;
  lens_model: string | null;
  capture_date: string | null;
  source_path: string | null;
  slug: string | null;
  preview_url: string | null;
};

type CategoryStats = {
  category: string;
  selected: number;
  generated: number;
  accepted: number;
  rejected: number;
  failed: number;
  changed_public_description: number;
};

type FailedItem = {
  id: number;
  category: string;
  source_path: string | null;
  reason: string;
};

// ── Config ─────────────────────────────────────────────────────────────────

const LIMIT_PER_CATEGORY =
  Number(process.env["VISIONATI_RUN_LIMIT_PER_CATEGORY"] ?? "150");
const MAX_RETRIES = Number(process.env["VISIONATI_MAX_RETRIES"] ?? "1");
const DESCRIPTION_VERSION =
  process.env["VISIONATI_DESCRIPTION_VERSION"] ??
  "visionati-wildphotography-v1";

// ── Env guard ───────────────────────────────────────────────────────────────

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// ── Candidate query ─────────────────────────────────────────────────────────

async function getCandidates(client: Client): Promise<CandidateRow[]> {
  // gallery_slug is used as the category proxy (no category column exists)
  const sql = `
    WITH candidates AS (
      SELECT
        p.id,
        p.title,
        p.description,
        p.keywords::text AS keywords,
        COALESCE(g.slug, 'uncategorized') AS category_key,
        g.name AS gallery_name,
        p.location_name,
        p.region,
        p.country,
        p.species_common_name AS common_name,
        p.species_scientific_name AS scientific_name,
        p.camera_model,
        p.lens_model,
        p.date_taken::text AS capture_date,
        p.source_path,
        p.slug,
        COALESCE(
          -- Accessible: /derivatives/ paths that are NOT the dead subdirectories
          CASE WHEN p.thumb_url ~ '/derivatives/' AND p.thumb_url !~ '/thumbs/' AND p.thumb_url !~ '/previews/' AND p.thumb_url !~ '/mediums/' AND p.thumb_url !~ '/smalls/' THEN p.thumb_url END,
          CASE WHEN p.medium_url ~ '/derivatives/' AND p.medium_url !~ '/thumbs/' AND p.medium_url !~ '/previews/' AND p.medium_url !~ '/mediums/' AND p.medium_url !~ '/smalls/' THEN p.medium_url END,
          CASE WHEN p.small_url ~ '/derivatives/' AND p.small_url !~ '/thumbs/' AND p.small_url !~ '/previews/' AND p.small_url !~ '/mediums/' AND p.small_url !~ '/smalls/' THEN p.small_url END,
          -- /web/ paths (known accessible)
          CASE WHEN p.thumb_url ~ '/web/' THEN p.thumb_url END,
          CASE WHEN p.medium_url ~ '/web/' THEN p.medium_url END,
          -- preview_url as last resort
          p.preview_url
        ) AS preview_url,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(g.slug, 'uncategorized')
          ORDER BY p.id ASC
        ) AS rn
      FROM photos p
      LEFT JOIN galleries g ON g.id = p.gallery_id
      WHERE p.derivatives_complete = true
        AND p.ready_for_public_render = true
        AND COALESCE(p.description_locked, false) = false
        AND (
          p.ai_description_status IS NULL
          OR p.ai_description_status NOT IN ('accepted', 'generated', 'manual_override')
        )
        AND (
          p.description IS NULL
          OR length(trim(p.description)) < 40
          OR lower(trim(p.description)) ~ '^(untitled|image|photo|bird|animal|landscape|nature)$'
          OR lower(trim(p.description)) ~ '^(img|dsc|photo|image)[_ -]?[0-9]+$'
        )
    )
    SELECT
      id, title, description, keywords, category_key, gallery_name, location_name,
      region, country, common_name, scientific_name, camera_model, lens_model,
      capture_date, source_path, slug, preview_url
    FROM candidates
    WHERE rn <= $1
    ORDER BY category_key, id;
  `;
  const result = await client.query(sql, [LIMIT_PER_CATEGORY]);
  return result.rows as unknown as CandidateRow[];
}

// ── DB save helpers ────────────────────────────────────────────────────────

async function saveGeneratedOnly(
  client: Client,
  row: CandidateRow,
  generatedText: string,
  wordCount: number,
  model?: string
): Promise<void> {
  await client.query(
    `UPDATE photos SET
       ai_description = $2,
       ai_description_source = 'visionati',
       ai_description_model = $3,
       ai_description_generated_at = NOW(),
       ai_description_status = 'generated',
       ai_description_word_count = $4,
       ai_description_version = $5,
       ai_description_review_notes = NULL
     WHERE id = $1`,
    [row.id, generatedText, model ?? null, wordCount, DESCRIPTION_VERSION]
  );
}

async function saveAcceptedAndPromote(
  client: Client,
  row: CandidateRow,
  generatedText: string,
  wordCount: number,
  model?: string
): Promise<boolean> {
  // Promote only if existing description is weak
  const shouldPromote =
    !isStrongDescription(row.description) &&
    isWeakDescription(row.description);

  await client.query(
    `UPDATE photos SET
       ai_description = $2,
       ai_description_source = 'visionati',
       ai_description_model = $3,
       ai_description_generated_at = NOW(),
       ai_description_status = 'accepted',
       ai_description_word_count = $4,
       ai_description_version = $5,
       ai_description_review_notes = NULL,
       description = CASE
         WHEN COALESCE(description_locked, false) = true THEN description
         WHEN $6 = true THEN $2
         ELSE description
       END
     WHERE id = $1`,
    [
      row.id,
      generatedText,
      model ?? null,
      wordCount,
      DESCRIPTION_VERSION,
      shouldPromote,
    ]
  );

  return shouldPromote;
}

async function saveRejected(
  client: Client,
  row: CandidateRow,
  reason: string,
  generatedText?: string,
  model?: string
): Promise<void> {
  await client.query(
    `UPDATE photos SET
       ai_description = COALESCE($2, ai_description),
       ai_description_source = 'visionati',
       ai_description_model = COALESCE($3, ai_description_model),
       ai_description_generated_at = NOW(),
       ai_description_status = 'rejected',
       ai_description_version = $4,
       ai_description_review_notes = $5
     WHERE id = $1`,
    [
      row.id,
      generatedText ?? null,
      model ?? null,
      DESCRIPTION_VERSION,
      reason,
    ]
  );
}

async function saveFailed(
  client: Client,
  row: CandidateRow,
  reason: string
): Promise<void> {
  await client.query(
    `UPDATE photos SET
       ai_description_status = 'failed',
       ai_description_source = 'visionati',
       ai_description_generated_at = NOW(),
       ai_description_version = $2,
       ai_description_review_notes = $3
     WHERE id = $1`,
    [row.id, DESCRIPTION_VERSION, reason]
  );
}

async function fetchReindexCandidates(client: Client): Promise<number[]> {
  const result = await client.query(`
    SELECT id FROM photos
    WHERE ai_description_source = 'visionati'
      AND ai_description_status = 'accepted'
      AND ai_description_generated_at > NOW() - INTERVAL '1 day'
      AND search_ready = true
  `);
  return result.rows.map((r) => Number((r as { id: unknown }).id));
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  requiredEnv("DATABASE_URL");
  const client = new Client({
    connectionString: process.env["DATABASE_URL"],
  });
  await client.connect();

  const statsByCategory = new Map<string, CategoryStats>();
  const failedItems: FailedItem[] = [];

  try {
    const candidates = await getCandidates(client);
    console.error(`\n=== Loaded ${candidates.length} candidates ===\n`);

    for (const row of candidates) {
      const category = row.category_key || "uncategorized";
      if (!statsByCategory.has(category)) {
        statsByCategory.set(category, {
          category,
          selected: 0,
          generated: 0,
          accepted: 0,
          rejected: 0,
          failed: 0,
          changed_public_description: 0,
        });
      }
      const stats = statsByCategory.get(category)!;
      stats.selected++;

      if (!row.preview_url) {
        await saveFailed(client, row, "missing_preview_url");
        stats.failed++;
        failedItems.push({
          id: row.id,
          category,
          source_path: row.source_path,
          reason: "missing_preview_url",
        });
        console.error(
          `  [${category}] SKIP id=${row.id} — no preview_url`
        );
        continue;
      }

      const prompt = buildUserPrompt({
        title: row.title,
        description: row.description,
        keywords: row.keywords,
        category: category,
        galleryName: row.gallery_name,
        locationName: row.location_name,
        region: row.region,
        country: row.country,
        commonName: row.common_name,
        scientificName: row.scientific_name,
        cameraModel: row.camera_model,
        lensModel: row.lens_model,
        captureDate: row.capture_date,
        sourcePath: row.source_path,
        photoSlug: row.slug,
      });

      let lastError = "";
      let accepted = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await describeImageWithVisionati({
            imageUrl: row.preview_url!,
            userPrompt: prompt,
          });

          stats.generated++;

          const validation = isAcceptableGeneratedDescription(
            result.text,
            row.description
          );

          if (!validation.ok) {
            lastError = validation.reason ?? "validation_failed";
            await saveRejected(
              client,
              row,
              lastError,
              result.text,
              result.model
            );
            if (attempt < MAX_RETRIES) continue;
            stats.rejected++;
            break;
          }

          await saveGeneratedOnly(
            client,
            row,
            result.text,
            validation.wordCount,
            result.model
          );

          const promoted = await saveAcceptedAndPromote(
            client,
            row,
            result.text,
            validation.wordCount,
            result.model
          );

          stats.accepted++;
          if (promoted) stats.changed_public_description++;

          console.error(
            `  [${category}] ACCEPT id=${row.id} slug=${row.slug} wc=${validation.wordCount} promoted=${promoted}`
          );
          accepted = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.error(
            `  [${category}] ERROR id=${row.id} attempt=${attempt}: ${lastError}`
          );
          if (attempt >= MAX_RETRIES) {
            await saveFailed(client, row, lastError);
            stats.failed++;
            failedItems.push({
              id: row.id,
              category,
              source_path: row.source_path,
              reason: lastError,
            });
          }
        }
      }

      if (!accepted && !lastError) {
        stats.rejected++;
      }
    }

    const reindexIds = await fetchReindexCandidates(client);

    // ── Report ─────────────────────────────────────────────────────────────

    const totals = {
      categories_processed: statsByCategory.size,
      photos_selected: 0,
      generated: 0,
      accepted: 0,
      rejected: 0,
      failed: 0,
      public_descriptions_changed: 0,
    };

    for (const stats of statsByCategory.values()) {
      totals.photos_selected += stats.selected;
      totals.generated += stats.generated;
      totals.accepted += stats.accepted;
      totals.rejected += stats.rejected;
      totals.failed += stats.failed;
      totals.public_descriptions_changed +=
        stats.changed_public_description;
    }

    // Print structured report
    const report = {
      totals,
      by_category: Object.fromEntries(statsByCategory),
      reindex_candidates: reindexIds,
      failed_items: failedItems,
    };

    console.log("\n=== VISIONATI ONE-TIME ENRICHMENT REPORT ===\n");
    console.log(JSON.stringify(report, null, 2));

    console.log("\n=== COUNTS BY CATEGORY ===");
    for (const [cat, s] of statsByCategory.entries()) {
      console.log(
        `  ${cat}: selected=${s.selected} generated=${s.generated} accepted=${s.accepted} rejected=${s.rejected} failed=${s.failed} changed=${s.changed_public_description}`
      );
    }

    console.log("\n=== TOTALS ===");
    console.log(
      `  categories: ${totals.categories_processed}`
    );
    console.log(`  photos selected: ${totals.photos_selected}`);
    console.log(`  generated: ${totals.generated}`);
    console.log(`  accepted: ${totals.accepted}`);
    console.log(`  rejected: ${totals.rejected}`);
    console.log(`  failed: ${totals.failed}`);
    console.log(
      `  public descriptions changed: ${totals.public_descriptions_changed}`
    );
    console.log(
      `  Typesense reindex candidates: ${reindexIds.length}`
    );

    if (failedItems.length > 0) {
      console.log("\n=== FAILED ITEMS ===");
      for (const f of failedItems) {
        console.log(
          `  id=${f.id} category=${f.category} path=${f.source_path} reason=${f.reason}`
        );
      }
    } else {
      console.log("\n=== FAILED ITEMS: none ===");
    }

    console.log("\n=== REINDEX IDs (JSON) ===");
    console.log(JSON.stringify(reindexIds));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
