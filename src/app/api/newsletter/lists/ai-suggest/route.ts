import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

// POST /api/newsletter/lists/ai-suggest
// body: { query: string, field: "department" | "company" }
// Claude が購読者データベースの実際の値を参考に、クエリに合うキーワード候補を返す
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { query, field = "department" } = body;

  if (!query) return NextResponse.json({ error: "クエリが必要です" }, { status: 400 });

  const validField = ["department", "company"].includes(field) ? field : "department";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が未設定です" }, { status: 500 });

  try {
    const db = await getD1();

    // 実際のデータベースから distinct 値を取得（最大200件）
    const rows = await db.prepare(
      `SELECT DISTINCT ${validField} AS val FROM newsletter_subscribers
       WHERE status = 'active' AND ${validField} != ''
       ORDER BY ${validField} LIMIT 200`
    ).all() as any;
    const distinctValues: string[] = (rows.results ?? []).map((r: any) => r.val);

    const client = new Anthropic({ apiKey });

    const fieldLabel = validField === "department" ? "部署名" : "会社名";
    const prompt = `あなたはメール配信リストのフィルタリングアシスタントです。

ユーザーが「${query}」という条件で${fieldLabel}を絞り込みたいと言っています。

以下はデータベースに実際に存在する${fieldLabel}の一覧です：
${distinctValues.length > 0 ? distinctValues.map((v) => `- ${v}`).join("\n") : "（データなし）"}

この一覧から、「${query}」に関連する・一致すると思われる値を選んでください。
部分一致・類義語・略称・英語表記なども考慮してください。

返答は以下のJSON形式のみ（マークダウン不要）：
{"keywords": ["キーワード1", "キーワード2", ...]}

マッチしない場合は {"keywords": []} を返してください。
最大10個まで。`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ keywords: [] });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [] });

  } catch (error) {
    console.error("[newsletter/lists/ai-suggest] error:", error);
    return NextResponse.json({ error: "AI 提案に失敗しました" }, { status: 500 });
  }
}
