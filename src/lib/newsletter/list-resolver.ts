/**
 * newsletter_lists の conditions JSON を解釈して、
 * 一致する newsletter_subscribers を返す共通ロジック。
 *
 * 条件は AND 結合（全条件を満たす購読者のみ）。
 * 各条件内の複数値は OR 結合。
 */

export type ListCondition =
  | { type: "domain"; domains: string[] }
  | { type: "event"; seminar_id: string; seminar_title?: string; attendance_type: "registered" | "attended" }
  | { type: "keyword"; field: "department" | "company" | "name"; keywords: string[] };

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all(): Promise<{ results: unknown[] }>;
  first(): Promise<unknown>;
  run(): Promise<unknown>;
}

export async function resolveListConditions(
  db: D1Database,
  conditions: ListCondition[],
  sampleLimit = 5
): Promise<{ count: number; samples: { email: string; name: string; company: string }[] }> {
  // 条件なし → 全 active 購読者
  if (!conditions || conditions.length === 0) {
    const countRow = await db.prepare(
      `SELECT COUNT(*) AS cnt FROM newsletter_subscribers WHERE status = 'active'`
    ).first() as any;
    const samples = await db.prepare(
      `SELECT email, name, company FROM newsletter_subscribers
       WHERE status = 'active' ORDER BY created_at ASC LIMIT ?`
    ).bind(sampleLimit).all() as any;
    return { count: countRow?.cnt ?? 0, samples: samples.results ?? [] };
  }

  // 条件ごとに対象 subscriber_id SET を取得し、AND 結合
  let candidateIds: Set<string> | null = null as Set<string> | null;

  for (const cond of conditions) {
    let ids: string[] = [];

    if (cond.type === "domain") {
      if (!cond.domains || cond.domains.length === 0) continue;
      const likeExprs = cond.domains.map(() => `email LIKE ?`).join(" OR ");
      const binds = cond.domains.map((d) => `%@${d}`);
      const rows = await db.prepare(
        `SELECT id FROM newsletter_subscribers WHERE status = 'active' AND (${likeExprs})`
      ).bind(...binds).all() as any;
      ids = (rows.results ?? []).map((r: any) => r.id);

    } else if (cond.type === "event") {
      if (!cond.seminar_id) continue;
      // registered = 参加登録済み (status = 'confirmed')
      // attended = post_survey_completed = 1 を出席の代替指標とする
      const attendanceClause = cond.attendance_type === "attended"
        ? `AND r.post_survey_completed = 1`
        : "";
      const rows = await db.prepare(
        `SELECT DISTINCT s.id
         FROM newsletter_subscribers s
         JOIN registrations r ON r.email = s.email
         WHERE s.status = 'active'
           AND r.seminar_id = ?
           AND r.status = 'confirmed'
           ${attendanceClause}`
      ).bind(cond.seminar_id).all() as any;
      ids = (rows.results ?? []).map((r: any) => r.id);

    } else if (cond.type === "keyword") {
      if (!cond.keywords || cond.keywords.length === 0) continue;
      const field = ["department", "company", "name"].includes(cond.field) ? cond.field : "department";
      const likeExprs = cond.keywords.map(() => `${field} LIKE ?`).join(" OR ");
      const binds = cond.keywords.map((k) => `%${k}%`);
      const rows = await db.prepare(
        `SELECT id FROM newsletter_subscribers WHERE status = 'active' AND (${likeExprs})`
      ).bind(...binds).all() as any;
      ids = (rows.results ?? []).map((r: any) => r.id);
    }

    const idSet = new Set(ids);
    if (candidateIds === null) {
      candidateIds = idSet;
    } else {
      // AND: 積集合
      const existing = candidateIds;
      candidateIds = new Set([...existing].filter((id) => idSet.has(id)));
    }
  }

  if (candidateIds === null || candidateIds.size === 0) {
    return { count: 0, samples: [] };
  }

  // candidate IDs からカウントとサンプルを取得
  const idList = [...candidateIds];
  const placeholders = idList.map(() => "?").join(", ");

  const count = idList.length;
  const sampleRows = await db.prepare(
    `SELECT email, name, company FROM newsletter_subscribers
     WHERE id IN (${placeholders}) ORDER BY created_at ASC LIMIT ?`
  ).bind(...idList, sampleLimit).all() as any;

  return { count, samples: sampleRows.results ?? [] };
}
