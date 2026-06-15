/**
 * Shared D1 helpers for Cloudflare REST API access.
 * Used by API auth, admin routes, and account routes.
 *
 * All functions return null/false on failure (no throw).
 * Token is read from process.env.CLOUDFLARE_API_TOKEN.
 */

const D1_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const D1_DB_ID = '57a98059-434d-46a3-a72b-8aa8a87b0fdc';

interface D1Result {
  results: Array<{ [col: string]: string | number | null }>;
  success: boolean;
}

function getToken(): string | undefined {
  return (process.env as Record<string, string | undefined>).CLOUDFLARE_API_TOKEN;
}

export async function d1Query<T = Record<string, string | number | null>>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DB_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: D1Result[]; success: boolean };
    const result = data.result?.[0];
    if (!result?.success || !result.results?.length) return null;
    return result.results[0] as T;
  } catch {
    return null;
  }
}

export async function d1QueryAll<T = Record<string, string | number | null>>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T[] | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DB_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: D1Result[]; success: boolean };
    const result = data.result?.[0];
    if (!result?.success) return null;
    return (result.results || []) as T[];
  } catch {
    return null;
  }
}

export async function d1Exec(
  sql: string,
  params: (string | number | null)[] = []
): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DB_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
