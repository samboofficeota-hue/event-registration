import { NextRequest, NextResponse } from "next/server";

type JwtPayload = { tenant?: string; exp?: number };

const TENANT_KEYS = [
  "whgc-seminars",
  "kgri-pic-center",
  "aff-events",
  "pic-courses",
] as const;

async function verifyAndDecodeToken(
  token: string,
  secret: string
): Promise<{ valid: boolean; payload?: JwtPayload }> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64)
      return { valid: false };

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = Uint8Array.from(
      atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(`${headerB64}.${payloadB64}`)
    );

    if (!valid) return { valid: false };

    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    ) as JwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // workers.dev ドメインからカスタムドメインへリダイレクト
  const hostname = request.headers.get("host") || "";
  if (hostname.includes(".workers.dev")) {
    const customDomain = "events.allianceforum.org";
    const url = new URL(request.url);
    url.hostname = customDomain;
    url.protocol = "https:";
    return NextResponse.redirect(url, 301); // 恒久的リダイレクト
  }

  // テナント管理画面: /{tenant}/admin/*
  for (const tenant of TENANT_KEYS) {
    const adminPrefix = `/${tenant}/admin`;
    if (pathname.startsWith(adminPrefix)) {
      // ログインページはスルー
      if (pathname === `${adminPrefix}/login`) {
        return NextResponse.next();
      }
      const token = request.cookies.get("admin_token")?.value;
      const secret = process.env.ADMIN_JWT_SECRET;
      if (!token || !secret) {
        return NextResponse.redirect(new URL(`${adminPrefix}/login`, request.url));
      }
      const { valid, payload } = await verifyAndDecodeToken(token, secret);
      if (!valid || payload?.tenant !== tenant) {
        return NextResponse.redirect(new URL(`${adminPrefix}/login`, request.url));
      }
      return NextResponse.next();
    }
  }

  // 共通管理画面: /admin/*
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("admin_token")?.value;
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!token || !secret) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const { valid } = await verifyAndDecodeToken(token, secret);
    if (!valid) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // すべてのリクエストに対して middleware を実行（workers.dev リダイレクトのため）
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
