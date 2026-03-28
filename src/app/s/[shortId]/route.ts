import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";

// GET /s/[shortId]
// UUIDの先頭8文字（16進数）でセミナーを検索してリダイレクト
// 例: /s/2fb87141 → /whgc-seminars/seminars/2fb87141-612d-4536-a55b-cc82824d2dc7
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;

  if (!/^[0-9a-f]{8}$/i.test(shortId)) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "https://events.allianceforum.org"));
  }

  const db = await getD1();
  const row = await db.prepare(
    `SELECT id, tenant FROM seminars WHERE id LIKE ? LIMIT 1`
  ).bind(`${shortId}%`).first() as { id: string; tenant: string } | null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://events.allianceforum.org";

  if (!row) {
    return NextResponse.redirect(new URL("/", appUrl));
  }

  const tenantPath = row.tenant === "whgc-seminars" ? "whgc-seminars" : row.tenant;
  return NextResponse.redirect(
    new URL(`/${tenantPath}/seminars/${row.id}`, appUrl),
    { status: 301 }
  );
}
