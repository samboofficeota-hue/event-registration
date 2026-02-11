import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface NoteArticle {
  title: string;
  url: string;
  image: string;
  pubDate: string;
  creator: string;
}

/**
 * note.com の RSS フィードから最新記事を取得して JSON で返す。
 * GET /api/note-articles?user=whgc_official&limit=3
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get("user") || "whgc_official";
  const limit = Math.min(Number(searchParams.get("limit") || "3"), 10);

  try {
    const rssUrl = `https://note.com/${user}/rss`;
    const res = await fetch(rssUrl, {
      next: { revalidate: 3600 }, // 1時間キャッシュ
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "RSS の取得に失敗しました" },
        { status: 502 }
      );
    }

    const xml = await res.text();

    // 簡易 XML パーサー（依存ライブラリ不要）
    const items: NoteArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];

      const title = extractTag(block, "title");
      const url = extractTag(block, "link");
      const pubDate = extractTag(block, "pubDate");
      const creator = extractTag(block, "note:creatorName");

      // 画像URL: media:thumbnail（複数パターン）→ description/content 内の img src（HTMLエンティティ解釈）
      let image = extractNoteImageUrl(block);

      if (title && url) {
        items.push({ title, url, image, pubDate, creator });
      }
    }

    return NextResponse.json(items, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (err) {
    console.error("note RSS fetch error:", err);
    return NextResponse.json(
      { error: "RSS の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** XML タグから中身を取り出す（CDATA にも対応） */
function extractTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${escaped}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

/** HTML エンティティをデコード（img src 抽出用） */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/**
 * note.com RSS の item ブロックから画像 URL を取得する。
 * 形式例: https://assets.st-note.com/production/uploads/images/242248581/rectangle_large_type_2_xxx.png?width=600
 */
function extractNoteImageUrl(block: string): string {
  const decoded = decodeHtmlEntities(block);

  // 1) media:thumbnail の url 属性（属性順: url 先でも content 先でも可）
  const thumbMatch = decoded.match(
    /<media:thumbnail[^>]*(?:url=["']([^"']+)["']|content=["']([^"']+)["'])/i
  );
  const thumbUrl = thumbMatch?.[1] || thumbMatch?.[2];
  if (thumbUrl?.startsWith("http")) return thumbUrl;

  // 2) その他 thumbnail 系タグ
  const anyThumb = decoded.match(/<[^>]*thumbnail[^>]*(?:url=["']([^"']+)["']|content=["']([^"']+)["'])/i);
  const anyUrl = anyThumb?.[1] || anyThumb?.[2];
  if (anyUrl?.startsWith("http")) return anyUrl;

  // 3) item ブロック全体から note のサムネイル URL を直接検索（RSS 構造に依存しないフォールバック）
  const stNoteMatch = decoded.match(
    /https?:\/\/assets\.st-note\.com\/production\/uploads\/images\/[^\s"'<>]+/i
  );
  if (stNoteMatch?.[0]) {
    const url = stNoteMatch[0].replace(/&amp;/g, "&");
    return url.startsWith("http") ? url : `https:${url}`;
  }

  const rawDesc =
    extractTag(block, "description") || extractTag(block, "content:encoded") || "";
  const desc = decodeHtmlEntities(rawDesc);

  // 4) og:image（note の description に meta が含まれる場合）
  const ogMatch = desc.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || desc.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]?.startsWith("http")) return ogMatch[1];

  // 5) description 内の最初の img src
  const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]?.startsWith("http")) return imgMatch[1];

  return "";
}
