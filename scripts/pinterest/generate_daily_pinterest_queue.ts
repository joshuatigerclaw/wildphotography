/**
 * WildPhotography Daily Pinterest Queue Generator
 * Generates keyword-driven vertical pins (1000x1500) from real photo inventory,
 * with text overlays, watermark, topical board assignment, and CSV export.
 *
 * DRY RUN: Set dryRun=false in config/pinterest.config.json to enable actual posting.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const CONFIG_PATH = path.join(process.cwd(), "config/pinterest.config.json");
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

const NEON_CONNECTION =
  "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&connect_timeout=30";
const sql = neon(NEON_CONNECTION);

type PhotoRow = {
  id: number;
  photo_slug: string | null;
  title: string | null;
  description: string | null;
  keywords: string[] | string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  gallery_slug: string | null;
  small_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  gallery_title: string | null;
};

// ── helpers ─────────────────────────────────────────────────────────────────

function normalizeKeywords(input: string[] | string | null): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((k) => String(k).trim()).filter(Boolean);
  return String(input)
    .split(/[,|;]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function pickNumber(): number {
  const options = [7, 8, 10, 12, 14, 15, 18, 21];
  return options[Math.floor(Math.random() * options.length)];
}

function pickAdjective(): string {
  const options = [
    "Beautiful",
    "Stunning",
    "Colorful",
    "Wild",
    "Iconic",
    "Tropical",
    "Breathtaking",
    "Amazing",
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function detectSpecies(keywords: string[], title?: string | null): string {
  const text = `${title || ""} ${keywords.join(" ")}`.toLowerCase();

  const speciesMap = [
    ["toucan", "Toucans"],
    ["macaw", "Scarlet Macaws"],
    ["hummingbird", "Hummingbirds"],
    ["sloth", "Sloths"],
    ["monkey", "Monkeys"],
    ["frog", "Frogs"],
    ["butterfly", "Butterflies"],
    ["crocodile", "Crocodiles"],
    ["heron", "Herons"],
    ["hawk", "Raptors"],
    ["eagle", "Raptors"],
    ["bird", "Birds"],
  ];

  for (const [needle, label] of speciesMap) {
    if (text.includes(needle)) return label;
  }
  return "Wildlife";
}

function detectTopic(photo: PhotoRow, keywords: string[]): string {
  const text = `${photo.title || ""} ${photo.description || ""} ${keywords.join(" ")} ${
    photo.gallery_title || ""
  }`.toLowerCase();

  if (text.includes("waterfall")) return "Waterfalls";
  if (text.includes("beach")) return "Beaches";
  if (
    text.includes("bird") ||
    text.includes("toucan") ||
    text.includes("macaw") ||
    text.includes("hummingbird")
  )
    return "Birds";
  if (text.includes("sloth") || text.includes("monkey")) return "Wildlife";
  if (text.includes("national park")) return "National Parks";
  if (text.includes("drone") || text.includes("aerial")) return "Aerial Views";
  if (text.includes("sunset")) return "Sunsets";
  return "Costa Rica Photography";
}

function detectBoard(photo: PhotoRow, keywords: string[]): string {
  const text = `${photo.title || ""} ${photo.description || ""} ${keywords.join(" ")} ${
    photo.gallery_title || ""
  } ${photo.location_name || ""}`.toLowerCase();

  if (text.includes("manuel antonio")) return "Manuel Antonio Costa Rica";
  if (text.includes("monteverde")) return "Monteverde Costa Rica";
  if (text.includes("arenal")) return "Arenal Costa Rica";
  if (text.includes("tamarindo")) return "Tamarindo Costa Rica";
  if (text.includes("osa")) return "Osa Peninsula Costa Rica";
  if (text.includes("waterfall")) return "Costa Rica Waterfalls";
  if (text.includes("beach")) return "Costa Rica Beaches";
  if (
    text.includes("toucan") ||
    text.includes("macaw") ||
    text.includes("hummingbird") ||
    text.includes("bird")
  )
    return "Costa Rica Birds";
  if (text.includes("sloth") || text.includes("monkey") || text.includes("wildlife"))
    return "Costa Rica Wildlife";
  return "Costa Rica Photography";
}

function buildTitle(photo: PhotoRow, keywords: string[]): string {
  const species = detectSpecies(keywords, photo.title);
  const topic = detectTopic(photo, keywords);
  const location = photo.location_name || photo.gallery_title || "Costa Rica";

  const templates = [
    `${pickNumber()} ${pickAdjective()} ${topic} in Costa Rica`,
    `Best ${topic} in Costa Rica`,
    `Where to See ${species} in Costa Rica`,
    `Costa Rica ${location} Photo Guide`,
    `${species} Photography from Costa Rica`,
    `Tropical Wall Art from Costa Rica`,
    `Beautiful ${topic} from Costa Rica`,
  ];

  return templates[Math.floor(Math.random() * templates.length)].replace(/\s+/g, " ").trim();
}

function buildDescription(photo: PhotoRow, keywords: string[]): string {
  const species = detectSpecies(keywords, photo.title);
  const topic = detectTopic(photo, keywords);
  const location = photo.location_name || photo.gallery_title || "Costa Rica";

  return `Explore real Costa Rica photography from WildPhotography.com. Discover ${topic.toLowerCase()}, ${species.toLowerCase()}, ${location}, wildlife, beaches, waterfalls, and travel inspiration through a searchable Costa Rica photo archive.`;
}

function buildDestinationUrl(photo: PhotoRow): string {
  if (photo.photo_slug) {
    return `${config.siteUrl}/photo/${photo.photo_slug}`;
  }
  if (photo.gallery_slug) {
    return `${config.siteUrl}/gallery/${photo.gallery_slug}`;
  }
  return `${config.siteUrl}/map/costa-rica`;
}

function sourceImage(photo: PhotoRow): string {
  return photo.large_url || photo.medium_url || photo.small_url || "";
}

function safeFileName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

// ── image fetching ────────────────────────────────────────────────────────────

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── SVG overlay ──────────────────────────────────────────────────────────────

function wrapSvgText(
  text: string,
  maxChars: number,
  x: number,
  y: number,
  lineHeight: number
): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = `${line} ${word}`.trim();
    if (test.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  return lines
    .slice(0, 3)
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${l}</tspan>`)
    .join("");
}

function svgOverlay(title: string): Buffer {
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return Buffer.from(`
<svg width="${config.pinWidth}" height="${config.pinHeight}">
<rect x="0" y="0" width="${config.pinWidth}" height="${config.pinHeight}" fill="rgba(0,0,0,0.18)" />
<rect x="60" y="980" width="880" height="330" rx="28" fill="rgba(0,0,0,0.58)" />
<text x="100" y="1070" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff">
${wrapSvgText(safeTitle, 24, 100, 1070, 78)}
</text>
<text x="100" y="1370" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="#ffffff">
${config.watermarkText}
</text>
</svg>
`);
}

// ── pin image creation ────────────────────────────────────────────────────────

async function createPinImage(
  photo: PhotoRow,
  title: string,
  imageUrl: string
): Promise<string> {
  const inputBuffer = await fetchImageBuffer(imageUrl);

  const hash = crypto
    .createHash("md5")
    .update(`${photo.id}-${title}-${Date.now()}`)
    .digest("hex")
    .slice(0, 10);

  const fileName = `${photo.id}-${safeFileName(title)}-${hash}.jpg`;
  const outputDir = path.join(process.cwd(), config.pinImageDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, fileName);

  await sharp(inputBuffer)
    .resize(config.pinWidth, config.pinHeight, {
      fit: "cover",
      position: "center",
    })
    .composite([
      {
        input: svgOverlay(title),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({
      quality: 88,
      progressive: true,
    })
    .toFile(outputPath);

  return `${config.pinImageDir}/${fileName}`;
}

// ── photo selection ──────────────────────────────────────────────────────────

async function selectPhotos(limit: number): Promise<PhotoRow[]> {
  const result = await sql`
    SELECT
      p.id,
      p.slug AS photo_slug,
      p.title,
      p.description,
      p.keywords,
      p.location_name,
      p.latitude,
      p.longitude,
      p.gallery_slug,
      p.small_url,
      p.medium_url,
      p.large_url,
      g.name AS gallery_title
    FROM photos p
    LEFT JOIN galleries g ON g.slug = p.gallery_slug
    WHERE p.ready_for_public_render = true
      AND p.derivatives_complete = true
      AND COALESCE(p.medium_url, p.large_url, p.small_url) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM pinterest_pins pp
        WHERE pp.photo_id = p.id
          AND pp.created_at > now() - interval '45 days'
      )
    ORDER BY
      CASE
        WHEN p.keywords::text ILIKE '%toucan%' THEN 1
        WHEN p.keywords::text ILIKE '%macaw%' THEN 2
        WHEN p.keywords::text ILIKE '%hummingbird%' THEN 3
        WHEN p.keywords::text ILIKE '%sloth%' THEN 4
        WHEN p.keywords::text ILIKE '%monkey%' THEN 5
        WHEN p.keywords::text ILIKE '%waterfall%' THEN 6
        WHEN p.keywords::text ILIKE '%beach%' THEN 7
        ELSE 20
      END,
      p.updated_at DESC
    LIMIT ${limit}
  `;

  return result as PhotoRow[];
}

// ── DB insert ────────────────────────────────────────────────────────────────

async function insertPinterestPin(row: {
  photo_id: number;
  gallery_slug: string | null;
  photo_slug: string | null;
  source_image_url: string;
  pin_image_path: string;
  title: string;
  description: string;
  board: string;
  destination_url: string;
  keywords: string[];
}) {
  await sql`
    INSERT INTO pinterest_pins (
      photo_id, gallery_slug, photo_slug, source_image_url, pin_image_path,
      title, description, board, destination_url, keywords,
      status, dry_run, scheduled_for
    )
    VALUES (
      ${row.photo_id}, ${row.gallery_slug}, ${row.photo_slug}, ${row.source_image_url}, ${row.pin_image_path},
      ${row.title}, ${row.description}, ${row.board}, ${row.destination_url}, ${row.keywords},
      ${config.defaultStatus}, ${config.dryRun}, current_date
    )
  `;
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(path.join(process.cwd(), config.outputDir), { recursive: true });

  const photos = await selectPhotos(config.dailyPinTarget);
  const csvRows: string[] = [];

  csvRows.push(
    [
      "photo_id",
      "image_url",
      "pin_image_file",
      "title",
      "description",
      "board",
      "destination_url",
      "keywords",
      "status",
    ].join(",")
  );

  let success = 0;
  let failed = 0;
  const failedRecords: string[] = [];

  for (const photo of photos) {
    try {
      const keywords = normalizeKeywords(photo.keywords);
      const imageUrl = sourceImage(photo);

      if (!imageUrl) {
        throw new Error(`No usable image URL for photo ${photo.id}`);
      }

      const title = buildTitle(photo, keywords);
      const description = buildDescription(photo, keywords);
      const board = detectBoard(photo, keywords);
      const destinationUrl = buildDestinationUrl(photo);
      const pinImagePath = await createPinImage(photo, title, imageUrl);

      await insertPinterestPin({
        photo_id: photo.id,
        gallery_slug: photo.gallery_slug,
        photo_slug: photo.photo_slug,
        source_image_url: imageUrl,
        pin_image_path: pinImagePath,
        title,
        description,
        board,
        destination_url: destinationUrl,
        keywords,
      });

      csvRows.push(
        [
          csvEscape(photo.id),
          csvEscape(imageUrl),
          csvEscape(pinImagePath),
          csvEscape(title),
          csvEscape(description),
          csvEscape(board),
          csvEscape(destinationUrl),
          csvEscape(keywords.join("|")),
          csvEscape(config.defaultStatus),
        ].join(",")
      );

      success++;
    } catch (error: any) {
      failed++;
      failedRecords.push(`photo ${photo.id}: ${error.message}`);
      console.error(`[pinterest] Failed for photo ${photo.id}:`, error.message);
    }
  }

  const csvPath = path.join(process.cwd(), config.csvFile);
  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");

  console.log("─────────────────────────────────────────────");
  console.log("Pinterest queue generation complete");
  console.log(`Photos selected  : ${photos.length}`);
  console.log(`Pins generated  : ${success}`);
  console.log(`Failed           : ${failed}`);
  console.log(`CSV             : ${csvPath}`);
  console.log(`DRY_RUN         : ${config.dryRun}`);
  console.log(`Pin images dir  : ${config.pinImageDir}`);
  if (failedRecords.length > 0) {
    console.log("Failed records:");
    failedRecords.forEach((r) => console.log("  " + r));
  }
  console.log("─────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});