import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // note.com およびその CDN のみ許可
    return (
      host === "note.com" ||
      host.endsWith(".note.com") ||
      host.endsWith(".cloudfront.net") ||
      host.includes("st-note.com")
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/note-articles/image?url=...
 * note.com 等の画像をプロキシして返す（Referer 制限・混在コンテンツ対策）
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !decodeURIComponent(url).startsWith("http")) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const decoded = decodeURIComponent(url);
  if (!isAllowedImageUrl(decoded)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const res = await fetch(decoded, {
      headers: {
        Accept: "image/*",
        "User-Agent": "EventRegistration/1.0 (RSS reader)",
      },
      cache: "force-cache",
      next: { revalidate: 86400 }, // 24h
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Image fetch failed" },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("note image proxy error:", err);
    return NextResponse.json(
      { error: "Image proxy failed" },
      { status: 502 }
    );
  }
}
