import { NextRequest, NextResponse } from "next/server";
import {
  getMemberDomains,
  addMemberDomain,
  removeMemberDomain,
} from "@/lib/google/sheets";
import { verifyAdminRequest } from "@/lib/auth";

/**
 * GET: 会員企業ドメイン一覧を返す（管理画面・判定用）。
 */
export async function GET() {
  try {
    const domains = await getMemberDomains();
    return NextResponse.json(domains);
  } catch (error) {
    console.error("[member-domains GET]", error);
    return NextResponse.json(
      { error: "会員企業ドメインの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * POST: 会員企業ドメインを1件追加する（管理者のみ）。
 * Body: { domain: string }
 */
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const domain = typeof body.domain === "string" ? body.domain.trim() : "";
    if (!domain) {
      return NextResponse.json(
        { error: "ドメインを入力してください" },
        { status: 400 }
      );
    }
    await addMemberDomain(domain);
    const domains = await getMemberDomains();
    return NextResponse.json(domains);
  } catch (error) {
    console.error("[member-domains POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "追加に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 会員企業ドメインを1件削除する（管理者のみ）。
 * Body: { domain: string } または Query: ?domain=xxx
 */
export async function DELETE(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    let domain =
      url.searchParams.get("domain")?.trim() ?? "";
    if (!domain) {
      const body = await request.json().catch(() => ({}));
      domain = typeof body.domain === "string" ? body.domain.trim() : "";
    }
    if (!domain) {
      return NextResponse.json(
        { error: "ドメインを指定してください" },
        { status: 400 }
      );
    }
    await removeMemberDomain(domain);
    const domains = await getMemberDomains();
    return NextResponse.json(domains);
  } catch (error) {
    console.error("[member-domains DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除に失敗しました" },
      { status: 500 }
    );
  }
}
