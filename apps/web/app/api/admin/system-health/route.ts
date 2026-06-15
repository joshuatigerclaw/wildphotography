/**
 * GET /api/admin/system-health
 * Cost optimization monitoring summary:
 * - Neon API auth health
 * - Visit tracking / queue status
 * - Typesense bandwidth safeguards
 * - Warnings
 *
 * Uses `neon()` serverless (HTTP) to avoid pooler connection limits.
 */
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const token = process.env.ADMIN_SECRET || "admin";

function checkAuth(req: NextRequest): boolean {
  return req.cookies.get("admin_token")?.value === token;
}

// ── Neon helpers (HTTP-based, pooler-safe) ──────────────────────────────────

const NEON_CONN = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require";

async function queryNeon(sql: string): Promise<{ rows: any[]; latencyMs: number; error?: string }> {
  const client = neon(NEON_CONN);
  const t0 = Date.now();
  try {
    // Dynamic query via tagged template — neon supports raw SQL strings
    const rows = await client`${sql}` as any[];
    return { rows, latencyMs: Date.now() - t0 };
  } catch (e: any) {
    return { rows: [], latencyMs: Date.now() - t0, error: String(e.message || e).slice(0, 200) };
  }
}

async function queryNeonSafe(query: string): Promise<{ rows: any[]; latencyMs: number; error?: string }> {
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(NEON_CONN);
    const t0 = Date.now();
    // Use raw unsafe query for dynamic SQL — caller is trusted admin
    const rows = await sql unsafe.raw(query) as any[];
    return { rows, latencyMs: Date.now() - t0 };
  } catch (e: any) {
    return { rows: [], latencyMs: Date.now() - t0, error: String(e.message || e).slice(0, 200) };
  }
}

// ── Typesense reconcile log helpers ──────────────────────────────────────────

function getLatestReconcileLog(pattern: string): { data: Record<string, any>; path: string } | null {
  const LOG_DIR = join(process.cwd(), "..", "..", "..", "wildphotography", "logs");
  if (!existsSync(LOG_DIR)) return null;
  const files = readdirSync(LOG_DIR)
    .filter(f => f.includes(pattern) && f.endsWith(".json"))
    .sort()
    .reverse();
  for (const f of files) {
    try {
      const raw = readFileSync(join(LOG_DIR, f), "utf8");
      return { data: JSON.parse(raw), path: f };
    } catch {}
  }
  return null;
}

// ── Bandwidth guard status ────────────────────────────────────────────────────

function getGuardStatus(): { python: boolean; js: boolean } {
  const base = join(process.cwd(), "..", "..", "..", "wildphotography", "scripts");
  const checks = [
    join(base, "wild_reindex_after_derivative_rebuild.py"),
    join(base, "wild_reindex_after_derivative_rebuild_v23.js"),
  ];
  let py = false, js = false;
  for (const p of checks) {
    if (!existsSync(p)) continue;
    try {
      const src = readFileSync(p, "utf8");
      if (p.endsWith(".py")) py = src.includes("FULL_TYPESENSE_EXPORT_BLOCKED") || src.includes("ALLOW_FULL_TYPESENSE_EXPORT");
      if (p.endsWith(".js")) js = src.includes("FULL_TYPESENSE_EXPORT_BLOCKED") || src.includes("ALLOW_FULL_TYPESENSE_EXPORT");
    } catch {}
  }
  return { python: py, js };
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const warnings: string[] = [];

  // ── 1. Neon API auth health ─────────────────────────────────────────────
  let authLatency = 0, authError: string | null = null;
  let activeKeys: number | null = null, activeCustomers: number | null = null, activePlans: number | null = null;
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(NEON_CONN);
    const t0 = Date.now();
    const [keys, customers, plans] = await Promise.all([
      sql`SELECT count(*)::int as cnt FROM api_keys WHERE status = 'active' AND revoked_at IS NULL LIMIT 1`,
      sql`SELECT count(*)::int as cnt FROM api_customers WHERE status = 'active' LIMIT 1`,
      sql`SELECT count(*)::int as cnt FROM api_plans WHERE active = true LIMIT 1`,
    ]);
    authLatency = Date.now() - t0;
    activeKeys = Number(keys[0]?.cnt ?? 0);
    activeCustomers = Number(customers[0]?.cnt ?? 0);
    activePlans = Number(plans[0]?.cnt ?? 0);
  } catch (e: any) {
    authError = String(e.message || e).slice(0, 120);
  }

  const authHealthy = !authError && authLatency < 5000;
  if (authError) warnings.push(`Neon auth error: ${authError}`);
  else if (authLatency > 3000) warnings.push(`Neon auth latency high: ${authLatency}ms`);

  // ── 2. Visit tracking ──────────────────────────────────────────────────
  let visitToday: number | null = null, visit7d: number | null = null, lastRollup: string | null = null;
  let visitError: string | null = null;
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(NEON_CONN);
    const [today, sevenDay, lastSeen] = await Promise.all([
      sql`SELECT count(*)::int as cnt FROM photo_visit_daily WHERE day = CURRENT_DATE LIMIT 1`,
      sql`SELECT count(*)::int as cnt FROM photo_visit_daily WHERE day >= CURRENT_DATE - INTERVAL '7 days' LIMIT 1`,
      sql`SELECT max(last_seen_at::text) as ts FROM photo_visit_daily WHERE source = 'web' LIMIT 1`,
    ]);
    visitToday = Number(today[0]?.cnt ?? 0);
    visit7d = Number(sevenDay[0]?.cnt ?? 0);
    lastRollup = lastSeen[0]?.ts ?? null;
  } catch (e: any) {
    visitError = String(e.message || e).slice(0, 120);
  }
  if (visitError) warnings.push(`Visit tracking error: ${visitError}`);

  // ── 3. Typesense bandwidth safeguards ──────────────────────────────────
  const guardStatus = getGuardStatus();

  const latestLog = getLatestReconcileLog("typesense_reconcile_v2_2026");
  const tsDrift = latestLog?.data?.final_drift ?? null;
  const tsRuntime = latestLog?.data?.duration_seconds ?? null;
  const tsLastRun = latestLog?.data?.run_at ?? null;

  if (tsDrift !== null && tsDrift > 1000) {
    warnings.push(`Typesense drift elevated: ${tsDrift} stale docs (>1000 threshold)`);
  }

  // Check recent reconcile logs for full export attempts
  const LOG_DIR = join(process.cwd(), "..", "..", "..", "wildphotography", "logs");
  let fullExportAttempts = 0;
  if (existsSync(LOG_DIR)) {
    const logFiles = readdirSync(LOG_DIR)
      .filter(f => f.startsWith("typesense_reconcile_v2_2026") && f.endsWith(".log"))
      .sort().reverse().slice(0, 5);
    for (const f of logFiles.slice(0, 3)) {
      try {
        const content = readFileSync(join(LOG_DIR, f), "utf8");
        // flag: export call without include_fields
        if (content.includes("/documents/export") && !content.includes("include_fields")) {
          fullExportAttempts++;
        }
      } catch {}
    }
  }
  if (fullExportAttempts > 0) {
    warnings.push(`Full Typesense export detected in ${fullExportAttempts} recent reconcile log(s)`);
  }

  // ── Assemble response ──────────────────────────────────────────────────

  return NextResponse.json({
    generated_at: new Date().toISOString(),

    neon_api_auth: {
      source: "neon",
      healthy: authHealthy,
      latency_ms: authLatency,
      active_keys: activeKeys,
      active_customers: activeCustomers,
      active_plans: activePlans,
      error: authError,
    },

    visit_tracking: {
      mode: visitError ? "unavailable" : "queue",
      visits_today: visitToday,
      visits_7d: visit7d,
      last_rollup: lastRollup,
      error: visitError,
    },

    typesense_safeguards: {
      full_export_guard_active: guardStatus.python && guardStatus.js,
      guard_python: guardStatus.python,
      guard_js: guardStatus.js,
      active_reconcile_cron: "wild-typesense-reconcile-v2 (hourly)",
      old_reconcile_cron_disabled: true,
      last_drift_count: tsDrift,
      last_reconcile_runtime_seconds: tsRuntime,
      last_reconcile_run: tsLastRun,
      latest_log_file: latestLog?.path ?? null,
    },

    warnings,
  });
}
