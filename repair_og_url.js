#!/usr/bin/env node
/**
 * WildPhotography OG URL Repair - 2026-04-26
 * 
 * Fixes 33 broken search card photos found in audit.
 * 
 * Categories:
 * A) og_image_url = corrupted text (1669, 2199, 2267) → clear og_image_url, demote flags
 * B) og_image_url 404, derivatives/{id}/ has medium.jpg (36207,30700,18776,36206,14892,35639) → fix og_image_url
 * C) og_image_url 404, derivatives/{id}/ is EMPTY → demote flags (no repair possible without originals)
 * D) Both thumb_url AND og_image_url broken (31041, 35644, 4975) → demote all flags
 * 
 * For group C photos: likely need original file re-upload to repair.
 */

const { Client } = require('pg');

const DB_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';

// Group A: og_image_url contains description text (data corruption)
const GROUP_A = [1669, 2199, 2267];

// Group B: og_image_url 404 but derivatives/{id}/medium.jpg exists → fix in place
const GROUP_B = [36207, 30700, 18776, 36206, 14892, 35639];

// Group C: og_image_url 404, no derivatives in R2 → demote flags
const GROUP_C = [27209, 27046, 35072, 35080, 35239, 27142, 27263, 35370, 27476, 26909, 27421, 12119, 25436, 35237, 31525, 27052, 27262, 37111, 33141, 27469];

// Group D: both thumb and og broken → demote flags
const GROUP_D = [31041, 35644, 4975];

async function main() {
  const client = new Client({ connectionString: DB_CONN });
  await client.connect();
  const results = { group_a: [], group_b: [], group_c: [], group_d: [], errors: [] };

  // Group A: clear corrupted og_image_url
  for (const id of GROUP_A) {
    try {
      await client.query(
        `UPDATE photos SET og_image_url = NULL, search_ready = false, ready_for_public_render = false
         WHERE id = $1`,
        [id]
      );
      results.group_a.push(id);
    } catch (e) {
      results.errors.push({ id, action: 'group_a', error: e.message });
    }
  }

  // Group B: fix og_image_url to point to existing medium.jpg in R2
  for (const id of GROUP_B) {
    try {
      const newOgUrl = `https://images.wildphotography.com/derivatives/${id}/${id}_medium.jpg`;
      await client.query(
        `UPDATE photos SET og_image_url = $2 WHERE id = $1`,
        [id, newOgUrl]
      );
      results.group_b.push({ id, new_url: newOgUrl });
    } catch (e) {
      results.errors.push({ id, action: 'group_b', error: e.message });
    }
  }

  // Group C: demote flags (no R2 derivatives to fix from)
  for (const id of GROUP_C) {
    try {
      await client.query(
        `UPDATE photos SET search_ready = false, ready_for_public_render = false
         WHERE id = $1`,
        [id]
      );
      results.group_c.push(id);
    } catch (e) {
      results.errors.push({ id, action: 'group_c', error: e.message });
    }
  }

  // Group D: demote all flags (both thumb and og broken)
  for (const id of GROUP_D) {
    try {
      await client.query(
        `UPDATE photos SET thumb_url = NULL, og_image_url = NULL, 
         search_ready = false, ready_for_public_render = false, derivatives_complete = false
         WHERE id = $1`,
        [id]
      );
      results.group_d.push(id);
    } catch (e) {
      results.errors.push({ id, action: 'group_d', error: e.message });
    }
  }

  await client.end();

  // Write results
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = `/Users/joshuatenbrink/.openclaw/workspace/wildphotography/logs/og_url_repair_${timestamp}.json`;
  fs.writeFileSync(outPath, JSON.stringify({ run_at: new Date().toISOString(), results }, null, 2));

  console.log(JSON.stringify(results, null, 2));
  console.log(`\nLog: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });