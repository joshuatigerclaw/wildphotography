/**
 * Google Sheets v4 — pure fetch + Web Crypto (no google-auth-library).
 * Works in Cloudflare Workers (V8 isolates).
 */
import { PhotoOrder } from "@/types/orders";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1_l6ul1ze4O6JQCke3TH14r8TqxgzuArN09o4wjxS4Z4";
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || "Orders";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const HEADERS = [
  "order_ref","created_at","buyer_name","buyer_email","buyer_notes",
  "photo_id","photo_slug","photo_title","gallery_slug","gallery_title",
  "license_type","price_usd","currency","source_page_type","source_url",
  "referrer_url","utm_source","utm_medium","utm_campaign",
  "paypal_business_email","paypal_profile_link","paypal_item_name",
  "paypal_custom","paypal_txn_id","paypal_payment_status","paypal_payer_email",
  "paypal_returned","fulfillment_status","admin_notified_at","delivered_at","delivery_notes"
];

function orderToRow(order: PhotoOrder): (string | number)[] {
  const row: (string | number)[] = [];
  for (const h of HEADERS) {
    const v = (order as unknown as Record<string, unknown>)[h];
    if (typeof v === "boolean") row.push(v ? "true" : "false");
    else if (v === null || v === undefined) row.push("");
    else row.push(String(v));
  }
  return row;
}

// ─── Manual JWT + RSA signing using Web Crypto ─────────────────────────────────

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const sa: ServiceAccount = JSON.parse(raw);

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = base64urlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64urlEncode(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri || TOKEN_URL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    iat: now,
    exp: expiry,
  }));

  const signingInput = `${header}.${payload}`;
  const signature = await signWithRsaSha256(signingInput, sa.private_key);
  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`Token request failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const bin = Array.from(bytes).map(b => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signWithRsaSha256(data: string, privateKeyPem: string): Promise<string> {
  // Decode the PEM private key and import as raw RSA key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryStr = atob(pemBody);
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  const sigBin = Array.from(new Uint8Array(sig)).map(b => String.fromCharCode(b)).join("");
  return btoa(sigBin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ─── Sheets API helpers ────────────────────────────────────────────────────────

async function sheetsFetch(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  token?: string
): Promise<Record<string, unknown>> {
  const t = token || await getAccessToken();
  const url = path.startsWith("http") ? path : `${SHEETS_BASE}/${path}`;
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error(`Sheets API ${method} ${url} → status=${res.status}, parse error, body=${text.substring(0, 500)}`);
    throw e;
  }
  if (!res.ok) throw new Error(`Sheets API error: ${text}`);
  return data as Record<string, unknown>;
}

function colLetter(idx: number): string {
  let letter = "";
  idx++;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    idx = Math.floor((idx - 1) / 26);
  }
  return letter;
}

export async function appendOrderRow(order: PhotoOrder): Promise<{ spreadsheetId: string; tableRange: string }> {
  const token = await getAccessToken();
  const row = orderToRow(order);
  const data = await sheetsFetch(
    "POST",
    `${SHEET_ID}/values/${SHEET_TAB}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: [row] },
    token
  ) as { spreadsheetId?: string; tableRange?: string; updates?: { updatedRange?: string } };

  return { spreadsheetId: data?.spreadsheetId ?? SHEET_ID, tableRange: data?.tableRange ?? `${SHEET_TAB}!A1:AE1` };
}

export async function updateOrderRowByRef(
  orderRef: string,
  patch: Partial<PhotoOrder>
): Promise<void> {
  const token = await getAccessToken();

  // Use batchGet instead of direct /values/{range} — batchGet handles sheet names with spaces correctly
  const data = await sheetsFetch(
    "GET",
    `${SHEET_ID}/values:batchGet?ranges=${encodeURIComponent(SHEET_TAB + '!A1:AE1000')}&valueRenderOption=FORMATTED_VALUE`,
    undefined,
    token
  ) as { valueRanges?: { values?: (string | number)[][] }[] };

  const rows = data.valueRanges?.[0]?.values ?? [];
  if (rows.length < 1) throw new Error("Sheet has no data");

  const headerRow = rows[0];
  const orderRefColIdx = headerRow.indexOf("order_ref");
  if (orderRefColIdx < 0) throw new Error("order_ref column not found");

  let targetRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderRefColIdx]) === String(orderRef)) {
      targetRowIdx = i + 1;
      break;
    }
  }
  if (targetRowIdx < 0) throw new Error(`Order ${orderRef} not found`);

  for (const [key, value] of Object.entries(patch)) {
    const colIdx = headerRow.indexOf(key);
    if (colIdx < 0) continue;
    const cellRef = `${SHEET_TAB}!${colLetter(colIdx)}${targetRowIdx}`;
    const cellValue = typeof value === "boolean" ? (value ? "true" : "false") : String(value ?? "");
    await sheetsFetch(
      "PUT",
      `${SHEET_ID}/values/${cellRef}?valueInputOption=RAW`,
      { values: [[cellValue]] },
      token
    );
  }
}

export async function getOrderByRef(orderRef: string): Promise<PhotoOrder | null> {
  const token = await getAccessToken();
  // Use batchGet — it handles sheet names with spaces correctly and bypasses Google cache
  const data = await sheetsFetch(
    "GET",
    `${SHEET_ID}/values:batchGet?ranges=${encodeURIComponent(SHEET_TAB + '!A1:AE1000')}&valueRenderOption=FORMATTED_VALUE`,
    undefined,
    token
  ) as { valueRanges?: { values?: (string | number)[][] }[] };

  const rows = data.valueRanges?.[0]?.values ?? [];
  if (rows.length < 2) {
    console.error(`Sheets returned ${rows.length} rows (expected >= 2). data=${JSON.stringify(data).substring(0, 300)}`);
    return null;
  }

  console.log(`Sheets data: ${rows.length} rows, header=${JSON.stringify(rows[0]?.slice(0,3))}`);

  const headerRow = rows[0];
  const orderRefColIdx = headerRow.indexOf("order_ref");
  if (orderRefColIdx < 0) {
    console.error(`order_ref column not found in header: ${JSON.stringify(headerRow)}`);
    return null;
  }
  console.log(`order_ref col index: ${orderRefColIdx}`);

  for (let i = 1; i < rows.length; i++) {
    const candidate = String(rows[i][orderRefColIdx]);
    if (candidate === String(orderRef)) {
      console.log(`Found order at row ${i+1}: ${JSON.stringify(rows[i].slice(0,4))}`);
      const row = rows[i];
      const order: Record<string, string> = {};
      headerRow.forEach((h, idx) => {
        order[h] = row[idx] != null ? String(row[idx]) : "";
      });
      return order as unknown as PhotoOrder;
    }
  }
  console.error(`Order ${orderRef} not found in ${rows.length-1} data rows`);
  return null;
}
