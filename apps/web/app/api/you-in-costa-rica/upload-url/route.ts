import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const PRESIGNED_EXPIRY = 15 * 60;

export async function POST(req: NextRequest) {
  try {
    const { mime, size, sessionId } = await req.json() as {
      mime?: string; size?: number; sessionId?: string;
    };

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!mime || !allowed.includes(mime)) {
      return NextResponse.json({ error: "Invalid type. Use jpg, png, or webp." }, { status: 400 });
    }
    if (!size || size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    const key = sessionId || req.headers.get("x-forwarded-for") || "anon";
    if (sessionId && !checkRateLimit(key, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json({ error: "Rate limit: 5 uploads/hour." }, { status: 429 });
    }

    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    const r2Key = `uploads/you-in-costa-rica/${randomUUID()}.${ext}`;

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || "wildphoto-storage",
        Key: r2Key,
        ContentType: mime,
      }),
      { expiresIn: PRESIGNED_EXPIRY }
    );

    return NextResponse.json({
      uploadUrl,
      r2Key,
      expiresAt: new Date(Date.now() + PRESIGNED_EXPIRY * 1000).toISOString(),
    });
  } catch (err) {
    console.error("[upload-url]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}