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

      // <media:thumbnail url="..." />
      const thumbMatch = block.match(/<media:thumbnail[^>]+url="([^"]+)"/);
      const image = thumbMatch?.[1] || "";

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
