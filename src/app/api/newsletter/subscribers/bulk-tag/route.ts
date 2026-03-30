import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { getMemberDomainsForTenant } from "@/lib/google/sheets";
import { isTenantKey } from "@/lib/tenant-config";

// POST /api/newsletter/subscribers/bulk-tag
// Body: { rule: "member_domain", tenant: string, tagName?: string, preview?: boolean }
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { rule, tenant, tagName, preview = false } = body as {
      rule: string;
      tenant: string;
      tagName?: string;
      preview?: boolean;
    };

    if (!rule) return NextResponse.json({ error: "ルールを指定してください" }, { status: 400 });
    if (!tenant || !isTenantKey(tenant))
      return NextResponse.json({ error: "テナントを指定してください" }, { status: 400 });
    if (!preview && !tagName?.trim())
      return NextResponse.json({ error: "タグ名を入力してください" }, { status: 400 });

    let subscriberIds: string[] = [];

    if (rule === "member_domain") {
      // テナントの会員企業ドメイン一覧を取得
      const domains = await getMemberDomainsForTenant(tenant);
      if (domains.length === 0) {
        return NextResponse.json({ count: 0, tagged: 0 });
      }

      const db = await getD1();

      // メールアドレスの末尾がドメインと一致する購読者を抽出
      const domainConditions = domains.map(() => "LOWER(email) LIKE ?").join(" OR ");
      const domainBinds = domains.map((d) => `%@${d.toLowerCase()}`);

      const rows = await db
        .prepare(
          `SELECT id, email, name, company, department
           FROM newsletter_subscribers WHERE (${domainConditions})
           ORDER BY company, email`
        )
        .bind(...domainBinds)
        .all();

      type Row = { id: string; email: string; name: string; company: string; department: string };
      const allRows = rows.results as Row[];
      subscriberIds = allRows.map((r) => r.id);

      if (preview) {
        return NextResponse.json({
          count: allRows.length,
          subscribers: allRows.map(({ id, email, name, company, department }) => ({
            id, email, name, company, department,
          })),
        });
      }

      // タグを付与（重複は無視）
      const db2 = await getD1();
      const now = new Date().toISOString();
      const tag = tagName!.trim();
      for (const id of subscriberIds) {
        await db2
          .prepare(
            `INSERT OR IGNORE INTO newsletter_tags (subscriber_id, tag, created_at) VALUES (?, ?, ?)`
          )
          .bind(id, tag, now)
          .run();
      }

      return NextResponse.json({ tagged: subscriberIds.length });
    }

    return NextResponse.json({ error: "未対応のルールです" }, { status: 400 });
  } catch (error) {
    console.error("[Newsletter/BulkTag] POST error:", error);
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
