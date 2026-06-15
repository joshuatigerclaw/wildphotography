/**
 * scripts/d1-helper.js
 * 
 * Helper functions for D1 operations via Cloudflare REST API.
 * Used by migration scripts to execute SQL against D1.
 * 
 * Note: Requires CLOUDFLARE_API_TOKEN with D1 Admin permissions.
 */

const API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

async function d1Execute(databaseId, sql, params = []) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '3ec62f93675c404fe4a9a4949e38e5e5';
  
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN environment variable not set');
  }

  // Build the SQL query — wrap in a transaction
  const body = {
    sql: params.length > 0 
      ? { sql, params: params.map(p => String(p)) }
      : { sql }
  };

  const resp = await fetch(`${API_BASE}/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: sql,
      params: params.map(p => String(p)),
    }),
  });

  const data = await resp.json();
  if (!data.success) {
    const msg = data.errors?.[0]?.message || JSON.stringify(data.errors);
    throw new Error(`D1 query failed: ${msg}`);
  }
  return data.result;
}

module.exports = { d1Execute };
