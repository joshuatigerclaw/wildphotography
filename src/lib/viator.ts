// src/lib/viator.ts

export type ViatorContext = {
 pageType?: "gallery" | "photo" | "species" | "location" | "article";
 galleryTitle?: string;
 gallerySlug?: string;
 photoTitle?: string;
 photoDescription?: string;
 locationName?: string;
 region?: string;
 country?: string;
 destinationHub?: string;
 speciesCommonName?: string;
 animalGroup?: string;
};

export type ViatorResult = {
 provider: "viator";
 title: string;
 productCode?: string;
 productUrl: string;
 rating?: number;
 reviewCount?: number;
 price?: string;
 duration?: string;
 destinationUsed: string;
 searchQueryUsed: string;
 relevanceScore: number;
 whySelected: string;
};

type ViatorApiProduct = {
 productCode?: string;
 title?: string;
 productUrl?: string;
 reviewAvgRating?: number;
 reviewCount?: number;
 duration?: {
 fixedDurationInMinutes?: number;
 };
 pricing?: {
 summary?: {
 fromPrice?: number;
 fromPriceFormatted?: string;
 };
 };
 fromPrice?: number;
 fromPriceFormatted?: string;
};

type ViatorFreeTextResponse = {
 data?: ViatorApiProduct[];
};

const VIATOR_API_KEY = process.env.VIATOR_API_KEY || "7c0d5089-fa48-48c7-9f70-010b0470f030";
const VIATOR_API_BASE =
 process.env.VIATOR_API_BASE || "https://api.viator.com/partner";
const VIATOR_LOCALE = process.env.VIATOR_LOCALE || "en";
const VIATOR_CURRENCY = process.env.VIATOR_CURRENCY || "USD";
const NODE_ENV = process.env.NODE_ENV || "development";

const DESTINATION_HINTS: Record<string, string[]> = {
 monteverde: ["birdwatching", "cloud forest", "night walk", "wildlife"],
 carara: ["birdwatching", "wildlife", "nature walk", "scarlet macaw"],
 arenal: ["volcano", "nature walk", "wildlife", "hanging bridges"],
 corcovado: ["wildlife", "guided hike", "rainforest", "birdwatching"],
 osa: ["wildlife", "guided hike", "rainforest", "birdwatching"],
 tortuguero: ["canal", "wildlife", "boat tour", "birdwatching"],
 "manuel-antonio": ["wildlife", "nature walk", "park tour", "sloths"],
};

function norm(value?: string | null): string {
 return (value || "").trim().toLowerCase();
}

function escapeHtml(value?: string | null): string {
 return (value || "")
 .replaceAll("&", "&amp;")
 .replaceAll("<", "&lt;")
 .replaceAll(">", "&gt;")
 .replaceAll('"', "&quot;")
 .replaceAll("'", "&#39;");
}

function looksValidLiveViatorUrl(url?: string): boolean {
 if (!url) return false;
 try {
 const parsed = new URL(url);
 return (
 (parsed.hostname === "www.viator.com" || parsed.hostname === "viator.com") &&
 parsed.pathname.startsWith("/tours/")
 );
 } catch {
 return false;
 }
}

function stripEmpty<T extends Record<string, unknown>>(obj: T): T {
 const out = { ...obj };
 Object.keys(out).forEach((k) => {
 const v = out[k];
 if (
 v === undefined ||
 v === null ||
 v === "" ||
 (Array.isArray(v) && v.length === 0)
 ) {
 delete out[k];
 }
 });
 return out;
}

function buildCampaignValue(ctx: ViatorContext): string {
 const base =
 ctx.pageType === "gallery" && ctx.gallerySlug
 ? `wildphoto-gallery-${ctx.gallerySlug}`
 : ctx.pageType === "photo"
 ? "wildphoto-photo"
 : ctx.pageType === "species" && ctx.speciesCommonName
 ? `wildphoto-species-${ctx.speciesCommonName.replace(/[^a-zA-Z0-9-]+/g, "-")}`
 : ctx.pageType === "location" && (ctx.destinationHub || ctx.locationName)
 ? `wildphoto-location-${(ctx.destinationHub || ctx.locationName || "")
 .replace(/[^a-zA-Z0-9-]+/g, "-")
 .toLowerCase()}`
 : "wildphoto";
 return base.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function inferDestination(ctx: ViatorContext): string {
 return (
 ctx.locationName ||
 ctx.destinationHub ||
 ctx.region ||
 ctx.country ||
 "Costa Rica"
 );
}

function inferHub(ctx: ViatorContext): string {
 const joined = [
 ctx.destinationHub,
 ctx.gallerySlug,
 ctx.galleryTitle,
 ctx.locationName,
 ctx.region,
 ctx.photoTitle,
 ctx.photoDescription,
 ]
 .filter(Boolean)
 .join(" ")
 .toLowerCase();

 if (joined.includes("arenal")) return "arenal";
 if (joined.includes("monteverde")) return "monteverde";
 if (joined.includes("carara")) return "carara";
 if (joined.includes("corcovado")) return "corcovado";
 if (joined.includes("osa")) return "osa";
 if (joined.includes("tortuguero")) return "tortuguero";
 if (joined.includes("manuel antonio") || joined.includes("manuel-antonio")) {
 return "manuel-antonio";
 }
 return norm(ctx.destinationHub);
}

function buildQueries(ctx: ViatorContext): string[] {
 const destination = inferDestination(ctx);
 const hub = inferHub(ctx);

 const textBlob = [
 ctx.galleryTitle,
 ctx.gallerySlug,
 ctx.photoTitle,
 ctx.photoDescription,
 ctx.speciesCommonName,
 ctx.animalGroup,
 ]
 .filter(Boolean)
 .join(" ")
 .toLowerCase();

 const activityTerms = new Set<string>();

 if (ctx.speciesCommonName) activityTerms.add(ctx.speciesCommonName);
 if (ctx.animalGroup) activityTerms.add(ctx.animalGroup);

 for (const term of DESTINATION_HINTS[hub] || []) activityTerms.add(term);

 const keywordMap: Record<string, string> = {
 bird: "birdwatching",
 toucan: "birdwatching",
 macaw: "birdwatching",
 sloth: "wildlife",
 monkey: "wildlife",
 volcano: "nature tour",
 rainforest: "wildlife",
 jungle: "wildlife",
 night: "night walk",
 whale: "boat tour",
 dolphin: "boat tour",
 };

 for (const [needle, mapped] of Object.entries(keywordMap)) {
 if (textBlob.includes(needle)) activityTerms.add(mapped);
 }

 const queries: string[] = [];
 for (const term of Array.from(activityTerms).slice(0, 5)) {
 queries.push(`${destination} ${term}`);
 }

 queries.push(`${destination} wildlife tour`);
 queries.push(`${destination} nature tour`);

 return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean))).slice(
 0,
 6
 );
}

function calcDestinationScore(productText: string, destination: string, hub: string): number {
 let score = 0;
 const d = norm(destination);
 const h = norm(hub);
 if (d && productText.includes(d)) score += 0.35;
 if (h && productText.includes(h.replaceAll("-", " "))) score += 0.2;
 return Math.min(score, 0.35);
}

function calcWildlifeScore(productText: string, ctx: ViatorContext): number {
 let score = 0;
 const wildlifeTerms = [
 norm(ctx.speciesCommonName),
 norm(ctx.animalGroup),
 "wildlife",
 "nature",
 "bird",
 "birdwatching",
 "rainforest",
 "volcano",
 "park",
 "forest",
 "sloth",
 "monkey",
 "macaw",
 ].filter(Boolean);

 const hits = wildlifeTerms.filter((term) => productText.includes(term)).length;
 score += Math.min(0.3, hits * 0.06);
 return score;
}

function calcTextRelevance(productText: string, ctx: ViatorContext): number {
 const tokens = new Set(
 [
 ctx.galleryTitle,
 ctx.gallerySlug,
 ctx.photoTitle,
 ctx.photoDescription,
 ctx.locationName,
 ctx.region,
 ctx.destinationHub,
 ]
 .filter(Boolean)
 .join(" ")
 .toLowerCase()
 .match(/[a-z]{4,}/g) || []
 );

 let hits = 0;
 for (const token of tokens) {
 if (productText.includes(token)) hits += 1;
 }
 return Math.min(0.2, hits * 0.02);
}

function calcReviewScore(product: ViatorApiProduct): number {
 let score = 0;
 if (typeof product.reviewAvgRating === "number") {
 score += Math.min(0.06, product.reviewAvgRating / 100);
 }
 if (typeof product.reviewCount === "number") {
 score += Math.min(0.04, product.reviewCount / 5000);
 }
 return score;
}

function scoreProduct(product: ViatorApiProduct, ctx: ViatorContext, query: string): number {
 const destination = inferDestination(ctx);
 const hub = inferHub(ctx);

 const productText = [
 product.title,
 query,
 destination,
 hub.replaceAll("-", " "),
 ]
 .filter(Boolean)
 .join(" ")
 .toLowerCase();

 const total =
 calcDestinationScore(productText, destination, hub) +
 calcWildlifeScore(productText, ctx) +
 calcTextRelevance(productText, ctx) +
 calcReviewScore(product) +
 (/(nature|wildlife|bird|forest|park|volcano|rainforest)/.test(productText)
 ? 0.05
 : 0);

 return Number(total.toFixed(4));
}

function durationLabel(product: ViatorApiProduct): string | undefined {
 const mins = product.duration?.fixedDurationInMinutes;
 if (!mins || mins <= 0) return undefined;
 if (mins % 60 === 0) return `${mins / 60} hours`;
 if (mins > 60) {
 const h = Math.floor(mins / 60);
 const m = mins % 60;
 return `${h}h ${m}m`;
 }
 return `${mins} mins`;
}

function priceLabel(product: ViatorApiProduct): string | undefined {
 return (
 product.pricing?.summary?.fromPriceFormatted ||
 (typeof product.pricing?.summary?.fromPrice === "number"
 ? `$${product.pricing.summary.fromPrice}`
 : undefined) ||
 product.fromPriceFormatted ||
 (typeof product.fromPrice === "number" ? `$${product.fromPrice}` : undefined)
 );
}

async function searchViatorLive(query: string, campaignValue: string): Promise<ViatorApiProduct[]> {
 if (!VIATOR_API_KEY) return [];

 const payload = {
 searchTerm: query,
 searchTypes: ["PRODUCTS"],
 pagination: {
 start: 1,
 count: 12,
 },
 currency: VIATOR_CURRENCY,
 "campaign-value": campaignValue,
 };

 const res = await fetch(`${VIATOR_API_BASE}/search/freetext`, {
 method: "POST",
 headers: {
 "exp-api-key": VIATOR_API_KEY,
 "Accept-Language": VIATOR_LOCALE,
 Accept: "application/json;version=2.0",
 "Content-Type": "application/json",
 },
 body: JSON.stringify(payload),
 cache: "no-store",
 });

 if (!res.ok) {
 const text = await res.text().catch(() => "");
 console.error("[VIATOR] live search failed", {
 status: res.status,
 query,
 payload,
 body: text,
 });
 return [];
 }

 const json = (await res.json()) as ViatorFreeTextResponse;
 return json.data || [];
}

export async function getViatorRecommendations(
 context: ViatorContext
): Promise<ViatorResult[]> {
 const isProduction = NODE_ENV === "production";
 const campaignValue = buildCampaignValue(context);

 // Live-only in production. If API key is missing, return no results.
 if (isProduction && !VIATOR_API_KEY) {
 console.warn("[VIATOR] production mode with no API key, omitting block");
 return [];
 }

 const queries = buildQueries(context);
 const destination = inferDestination(context);
 const results: ViatorResult[] = [];

 for (const query of queries) {
 const products = await searchViatorLive(query, campaignValue);

 for (const product of products) {
 if (!looksValidLiveViatorUrl(product.productUrl)) continue;

 const relevanceScore = scoreProduct(product, context, query);

 results.push(
 stripEmpty({
 provider: "viator" as const,
 title: product.title || "Viator Tour",
 productCode: product.productCode,
 productUrl: product.productUrl!, // exact API-returned URL only
 rating: product.reviewAvgRating,
 reviewCount: product.reviewCount,
 price: priceLabel(product),
 duration: durationLabel(product),
 destinationUsed: destination,
 searchQueryUsed: query,
 relevanceScore,
 whySelected: "Matched by destination + activity + review strength",
 })
 );
 }
 }

 const deduped: ViatorResult[] = [];
 const seen = new Set<string>();

 for (const item of results.sort((a, b) => b.relevanceScore - a.relevanceScore)) {
 const key = item.productCode || item.productUrl;
 if (seen.has(key)) continue;
 seen.add(key);
 deduped.push(item);
 }

 // Strong matches only.
 return deduped.filter((r) => r.relevanceScore >= 0.2).slice(0, 3);
}

export function renderViatorBlock(results: ViatorResult[]): string {
 if (!results || results.length === 0) return "";

 const cards = results
 .map((r) => {
 return `
 <div class="viator-card">
 <h4>${escapeHtml(r.title)}</h4>
 ${
 r.rating || r.reviewCount
 ? `<div class="viator-meta">⭐ ${escapeHtml(
 String(r.rating ?? "")
 )}${r.reviewCount ? ` (${escapeHtml(String(r.reviewCount))})` : ""}</div>`
 : ""
 }
 ${r.price ? `<div class="viator-price">${escapeHtml(r.price)}</div>` : ""}
 ${r.duration ? `<div class="viator-meta">${escapeHtml(r.duration)}</div>` : ""}
 <a
 class="viator-btn"
 href="${escapeHtml(r.productUrl)}"
 target="_blank"
 rel="sponsored noopener noreferrer"
 >
 View Tour
 </a>
 </div>
 `;
 })
 .join("");

 return `
 <section class="viator-section">
 <h3>More Tours Nearby</h3>
 <div class="viator-cards">
 ${cards}
 </div>
 </section>
 `;
}

export const viatorCss = `
.viator-section { margin: 2rem auto; padding: 1.5rem; max-width: 1100px; }
.viator-section h3 { font-size: 1.3rem; margin-bottom: 1rem; text-align: center; }
.viator-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.viator-card { background: white; padding: 1rem; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.viator-card h4 { font-size: 0.95rem; margin-bottom: 0.5rem; color: #333; }
.viator-meta { color: #f39c12; font-size: 0.85rem; margin-bottom: 0.5rem; }
.viator-price { font-weight: bold; color: #27ae60; margin-bottom: 0.5rem; }
.viator-btn { display: inline-block; background: #8e44ad; color: white; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-size: 0.85rem; }
.viator-btn:hover { background: #7d3c98; }
`;
