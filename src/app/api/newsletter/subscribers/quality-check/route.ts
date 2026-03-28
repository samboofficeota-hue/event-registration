import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export interface DuplicateName {
  name: string;
  count: number;
  subscribers: {
    id: string;
    email: string;
    company: string;
    department: string;
    created_at: string;
    status: string;
  }[];
}

export interface ReversedName {
  id: string;
  email: string;
  current_name: string;
  suggested_name: string;
  reason: string;
}

// POST /api/newsletter/subscribers/quality-check
// 購読者データの品質問題を検出する
// Body: { checks: ("duplicates" | "reversed_names")[] }
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const checks: string[] = body.checks ?? ["duplicates", "reversed_names"];

  const db = await getD1();
  const result: {
    duplicate_names: DuplicateName[];
    reversed_names: ReversedName[];
  } = { duplicate_names: [], reversed_names: [] };

  // ── 1. 重複チェック（同名・複数メール） ─────────────────────
  if (checks.includes("duplicates")) {
    // 同じ名前で複数の購読者を検出
    // 半角・全角スペースを除去して正規化（「太田義史」「太田 義史」「太田　義史」を同一視）
    const dupRows = await db.prepare(
      `SELECT REPLACE(REPLACE(REPLACE(TRIM(name), ' ', ''), '　', ''), '\t', '') AS norm_name,
              COUNT(*) AS cnt
       FROM newsletter_subscribers
       WHERE name != '' AND status != 'bounced'
       GROUP BY REPLACE(REPLACE(REPLACE(TRIM(name), ' ', ''), '　', ''), '\t', '')
       HAVING cnt > 1
       ORDER BY cnt DESC, norm_name
       LIMIT 50`
    ).all() as any;

    for (const row of (dupRows.results ?? [])) {
      // norm_name に一致する全レコードを取得（スペース正規化で比較）
      const members = await db.prepare(
        `SELECT id, email, name, company, department, created_at, status
         FROM newsletter_subscribers
         WHERE REPLACE(REPLACE(REPLACE(TRIM(name), ' ', ''), '　', ''), '\t', '') = ?
           AND status != 'bounced'
         ORDER BY created_at ASC`
      ).bind(row.norm_name).all() as any;

      result.duplicate_names.push({
        name: row.norm_name,  // スペース除去後の正規化名
        count: row.cnt,
        subscribers: members.results ?? [],
      });
    }
  }

  // ── 2. 姓名逆転チェック（Claude AI） ──────────────────────
  if (checks.includes("reversed_names")) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      // アクティブな購読者の名前を取得（最大300件）
      const nameRows = await db.prepare(
        `SELECT id, email, name
         FROM newsletter_subscribers
         WHERE name != '' AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 300`
      ).all() as any;

      const subscribers = (nameRows.results ?? []) as { id: string; email: string; name: string }[];

      if (subscribers.length > 0) {
        const client = new Anthropic({ apiKey });

        const nameList = subscribers
          .map((s, i) => `${i + 1}. [${s.id.slice(0, 8)}] ${s.name}`)
          .join("\n");

        const prompt = `以下は日本のビジネスメーリングリストの購読者名一覧です。

${nameList}

この中から、**姓と名の順番が逆になっている可能性が高い**名前を特定してください。

判定基準：
- 日本語名: 通常は「姓 名」の順（例: 山田 太郎）。「名 姓」の順（例: 太郎 山田）は逆
- 英語名: 通常は「名 姓」の順（例: Taro Yamada）。「姓 名」の順（例: Yamada Taro）で入力されているケースも逆
- スペースなし: 「太郎山田」のように姓名が逆順に結合されているケース
- 明らかに正しい名前は含めないこと（確信度が低い場合も除外）

返答は以下のJSON形式のみ（マークダウン不要）：
{
  "issues": [
    {
      "index": 1,
      "id": "（IDの最初の8文字）",
      "current": "現在の名前",
      "suggested": "修正後の名前",
      "reason": "判定理由（日本語で簡潔に）"
    }
  ]
}

問題なければ {"issues": []} を返してください。`;

        try {
          const message = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            messages: [{ role: "user", content: prompt }],
          });

          const text = message.content[0].type === "text" ? message.content[0].text : "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const issues: { index: number; id: string; current: string; suggested: string; reason: string }[] =
              parsed.issues ?? [];

            // ID の最初の8文字から完全なIDを復元
            for (const issue of issues) {
              const matched = subscribers.find((s) => s.id.startsWith(issue.id));
              if (matched) {
                result.reversed_names.push({
                  id: matched.id,
                  email: matched.email,
                  current_name: issue.current,
                  suggested_name: issue.suggested,
                  reason: issue.reason,
                });
              }
            }
          }
        } catch (e) {
          console.error("[quality-check] Claude API error:", e);
          // AI エラーは無視して他のチェック結果を返す
        }
      }
    }
  }

  return NextResponse.json(result);
}
