import { NextRequest, NextResponse } from "next/server";

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createToken(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        role: "admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      })
    )
  );

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`));
  const signatureEncoded = base64UrlEncode(new Uint8Array(signature));

  return `${header}.${payload}.${signatureEncoded}`;
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.ADMIN_JWT_SECRET;

    if (!adminPassword || !jwtSecret) {
      return NextResponse.json({ error: "サーバー設定エラー" }, { status: 500 });
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }

    const token = await createToken(jwtSecret);

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "認証処理に失敗しました" }, { status: 500 });
  }
}
