import { NextRequest } from "next/server";

/**
 * admin_token クッキーまたは Authorization: Bearer <CRON_SECRET> ヘッダーを検証し、
 * 管理者として有効かどうかを返す。
 * API ルートで管理者専用操作の前に呼ぶ。
 */
export async function verifyAdminRequest(request: NextRequest): Promise<boolean> {
  // Authorization: Bearer <CRON_SECRET> ヘッダーによる認証 (GitHub Actions など)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && bearerToken === cronSecret) return true;
  }

  // admin_token クッキーによる認証 (ブラウザ管理画面)
  const token = request.cookies.get("admin_token")?.value;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) return false;
  return verifyToken(token, secret);
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureData = Uint8Array.from(
      atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureData,
      encoder.encode(`${headerB64}.${payloadB64}`)
    );

    if (!valid) return false;

    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
