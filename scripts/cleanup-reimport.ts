/**
 * WildPhotography Photo Cleanup & Reimport Workflow
 * 
 * With duplicate-aware gallery/category repair
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function queryNeon<T>(sql: string): Promise<T[]> {
  const result = await pool.query(sql);
  return result.rows as T[];
}
import { R2 } from '../src/lib/r2';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const BACKUP_ROOT = '/Volumes/ADATA SC740/Smugmug Backup';
const COSTA_RICA_ROOT = `${BACKUP_ROOT}/Galleries/Costa-Rica-Gallery`;

// Types
type ExistingPhotoRow = {
  id: number;
  slug?: string | null;
  content_hash?: string | null;
  gallery_id?: number | null;
  gallery_slug?: string | null;
  category?: string | null;
  category_slug?: string | null;
  original_source_path?: string | null;
  country?: string | null;
  region?: string | null;
  location_name?: string | null;
  title?: string | null;
  description?: string | null;
};

type GalleryRow = {
  id: number;
  name: string;
  slug: string;
};

type BackupFileContext = {
  backupFilePath: string;
  folderName: string;
  categoryName: string;
  categorySlug: string;
  galleryName: string;
  gallerySlug: string;
  country?: string | null;
  region?: string | null;
  locationName?: string | null;
};

type DuplicateDecision =
  | "reused_only"
  | "updated_gallery_reference"
  | "updated_category_only"
  | "updated_source_path_only"
  | "no_change";

// Generic library names to avoid downgrading to
const GENERIC_LIBRARY_NAMES = new Set([
  "uncategorized",
  "favorites",
  "wildlife",
  "landscapes",
  "beaches",
  "birds",
  "nature",
  "photos",
  "gallery",
]);

function normalizeText(v?: string | null): string {
  return (v || "").trim().toLowerCase();
}

function slugify(value: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "uncategorized";
}

function titleizeFolderName(folder: string): string {
  return folder
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isMoreSpecific(newValue?: string | null, oldValue?: string | null): boolean {
  const n = normalizeText(newValue);
  const o = normalizeText(oldValue);

  if (!n) return false;
  if (!o) return true;
  if (n === o) return false;

  const oldGeneric = GENERIC_LIBRARY_NAMES.has(o);
  const newGeneric = GENERIC_LIBRARY_NAMES.has(n);

  if (oldGeneric && !newGeneric) return true;
  if (!oldGeneric && newGeneric) return false;

  if (n.includes(o) && n.length > o.length + 2) return true;
  if (!oldGeneric && !newGeneric && n.length > o.length + 4) return true;

  return false;
}

function shouldImproveGallery(existing: ExistingPhotoRow, derived: BackupFileContext): boolean {
  const current = normalizeText(existing.gallery_slug);
  const incoming = normalizeText(derived.gallerySlug);

  if (!incoming) return false;
  if (!current) return true;
  if (current === incoming) return false;
  if (current === "uncategorized") return true;

  return isMoreSpecific(incoming, current);
}

function shouldImproveCategory(existing: ExistingPhotoRow, derived: BackupFileContext): boolean {
  const current = normalizeText(existing.category);
  const incoming = normalizeText(derived.categoryName);

  if (!incoming) return false;
  if (!current) return true;
  if (current === incoming) return false;
  if (current === "uncategorized") return true;

  return isMoreSpecific(incoming, current);
}

function shouldImproveLocationField(existingValue?: string | null, incomingValue?: string | null): boolean {
  const cur = normalizeText(existingValue);
  const inc = normalizeText(incomingValue);
  if (!inc) return false;
  if (!cur) return true;
  return isMoreSpecific(inc, cur);
}

function deriveFolderContextFromBackupPath(backupFilePath: string): BackupFileContext {
  const normalized = backupFilePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const folderName = parts.length >= 2 ? parts[parts.length - 2] : "uncategorized";

  const categoryName = titleizeFolderName(folderName);
  const categorySlug = slugify(folderName);

  return {
    backupFilePath,
    folderName,
    categoryName,
    categorySlug,
    galleryName: categoryName,
    gallerySlug: categorySlug,
  };
}

async function getOrCreateGallery(slug: string, name: string): Promise<GalleryRow> {
  // Check if gallery exists
  const existing = await queryNeon<any>(`
    SELECT id, name, slug FROM galleries WHERE slug = '${slug.replace(/'/g, "''")}' LIMIT 1
  `);

  if (existing.length > 0) {
    return {
      id: existing[0].id,
      name: existing[0].name,
      slug: existing[0].slug,
    };
  }

  // Create new gallery
  const insert = await queryNeon<any>(`
    INSERT INTO galleries (name, slug, is_active)
    VALUES ('${name.replace(/'/g, "''")}', '${slug.replace(/'/g, "''")}', true)
    RETURNING id, name, slug
  `);

  return {
    id: insert[0].id,
    name: insert[0].name,
    slug: insert[0].slug,
  };
}

// Report tracking
const duplicateReport = {
  duplicate_hashes_found: 0,
  duplicates_reused_only: 0,
  duplicates_improved_gallery_linkage: 0,
  duplicates_improved_category: 0,
  duplicates_updated_source_path_only: 0,
  duplicates_no_change: 0,
  duplicate_samples: [] as any[],
  new_photos_found: 0,
  new_photos_imported: 0,
  source_paths_backfilled: 0,
  galleries_created: 0,
};

async function handleDuplicate(existing: ExistingPhotoRow, backupPath: string): Promise<void> {
  duplicateReport.duplicate_hashes_found++;

  const derived = deriveFolderContextFromBackupPath(backupPath);
  const derivedGallery = await getOrCreateGallery(derived.gallerySlug, derived.galleryName);

  const updates: Record<string, any> = {};
  let action: DuplicateDecision = "reused_only";
  const reasons: string[] = [];

  const improveGallery = shouldImproveGallery(existing, derived);
  const improveCategory = shouldImproveCategory(existing, derived);

  if (improveGallery) {
    updates.gallery_id = derivedGallery.id;
    updates.gallery_slug = derivedGallery.slug;
    action = "updated_gallery_reference";
    reasons.push("folder-derived gallery more specific");
  }

  if (improveCategory) {
    updates.category = derived.categoryName;
    updates.category_slug = derived.categorySlug;
    if (action === "reused_only") action = "updated_category_only";
    reasons.push("folder-derived category more specific");
  }

  if (!existing.original_source_path) {
    updates.original_source_path = backupPath;
    if (action === "reused_only") action = "updated_source_path_only";
    reasons.push("backfilled original_source_path");
    duplicateReport.source_paths_backfilled++;
  }

  if (Object.keys(updates).length === 0) {
    action = "no_change";
  }

  // Apply updates
  if (Object.keys(updates).length > 0) {
    const setClauses = Object.entries(updates)
      .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
      .join(", ");
    await queryNeon(`UPDATE photos SET ${setClauses} WHERE id = ${existing.id}`);
  }

  // Track action
  if (action === "reused_only") duplicateReport.duplicates_reused_only++;
  if (action === "updated_gallery_reference") duplicateReport.duplicates_improved_gallery_linkage++;
  if (action === "updated_category_only") duplicateReport.duplicates_improved_category++;
  if (action === "updated_source_path_only") duplicateReport.duplicates_updated_source_path_only++;
  if (action === "no_change") duplicateReport.duplicates_no_change++;

  // Sample
  if (duplicateReport.duplicate_samples.length < 10) {
    duplicateReport.duplicate_samples.push({
      photo_id: existing.id,
      existing_gallery: existing.gallery_slug,
      new_gallery: derived.gallerySlug,
      action,
      reasons: reasons.join("; "),
    });
  }
}

// Main scan function
async function scanAndProcessBackup() {
  console.log("=== BACKUP SCAN & PROCESS ===\n");

  const supported = ['.jpg', '.jpeg', '.png', '.webp'];

  // Scan folders
  const folders = fs.readdirSync(COSTA_RICA_ROOT).filter(f => {
    const stat = fs.statSync(path.join(COSTA_RICA_ROOT, f));
    return stat.isDirectory();
  });

  console.log(`Found ${folders.length} folders`);

  let processed = 0;
  const newGalleries = new Set<string>();

  for (const folder of folders) {
    const folderPath = path.join(COSTA_RICA_ROOT, folder);
    const files = fs.readdirSync(folderPath).filter(f => 
      supported.includes(path.extname(f).toLowerCase())
    );

    if (files.length === 0) continue;

    // Ensure gallery exists
    const gallerySlug = slugify(folder);
    const galleryName = titleizeFolderName(folder);

    try {
      const gallery = await getOrCreateGallery(gallerySlug, galleryName);
      if (gallery.id > 0) {
        // Check if this was a new gallery
        const checkExisting = await queryNeon<any>(`
          SELECT id FROM galleries WHERE slug = '${gallerySlug}' AND created_at > NOW() - INTERVAL '1 minute'
        `);
        if (checkExisting.length > 0) {
          newGalleries.add(gallerySlug);
          duplicateReport.galleries_created++;
        }
      }
    } catch(e) {
      console.log(`Gallery error for ${folder}:`, e.message);
    }

    // Process files
    for (const file of files.slice(0, 50)) { // Limit per folder for testing
      const filePath = path.join(folderPath, file);
      
      try {
        // Compute hash
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const contentHash = hashSum.digest('hex');

        // Check for existing
        const existing = await queryNeon<ExistingPhotoRow>(`
          SELECT id, slug, content_hash, gallery_slug, category, original_source_path
          FROM photos 
          WHERE content_hash = '${contentHash}' 
          AND is_active = true
          LIMIT 1
        `);

        if (existing.length > 0) {
          // Duplicate found
          await handleDuplicate(existing[0], filePath);
        } else {
          // New photo
          duplicateReport.new_photos_found++;
        }

        processed++;
        if (processed % 500 === 0) {
          console.log(`Processed ${processed} files...`);
        }
      } catch(e) {
        // Skip file errors
      }
    }
  }

  console.log("\n=== FINAL REPORT ===");
  console.log("Total files processed:", processed);
  console.log("Duplicate hashes found:", duplicateReport.duplicate_hashes_found);
  console.log("Duplicates reused only:", duplicateReport.duplicates_reused_only);
  console.log("Improved gallery linkage:", duplicateReport.duplicates_improved_gallery_linkage);
  console.log("Improved category:", duplicateReport.duplicates_improved_category);
  console.log("Updated source path only:", duplicateReport.duplicates_updated_source_path_only);
  console.log("No change:", duplicateReport.duplicates_no_change);
  console.log("New photos found:", duplicateReport.new_photos_found);
  console.log("Galleries created:", duplicateReport.galleries_created);
  console.log("Source paths backfilled:", duplicateReport.source_paths_backfilled);

  console.log("\nSample duplicate decisions:");
  duplicateReport.duplicate_samples.forEach(s => {
    console.log(`  ${s.existing_gallery} -> ${s.new_gallery}: ${s.action}`);
  });

  return duplicateReport;
}

// Run
scanAndProcessBackup()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
