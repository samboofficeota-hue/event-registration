import {
  getSeminarByIdFromD1,
  getSeminarsByTenantFromD1,
  type D1Seminar,
} from "@/lib/d1";
import type { Seminar } from "@/lib/types";

// ---------------------------------------------------------------------------
// D1Seminar → Seminar 変換
// ---------------------------------------------------------------------------
export function d1SeminarToSeminar(row: D1Seminar): Seminar {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    end_time: row.end_time,
    capacity: row.capacity,
    current_bookings: row.current_bookings,
    speaker: row.speaker,
    speaker_title: row.speaker_title,
    speaker_reference_url: row.speaker_reference_url,
    format: row.format as Seminar["format"],
    target: row.target as Seminar["target"],
    invitation_code: row.invitation_code,
    image_url: row.image_url,
    meet_url: row.meet_url,
    calendar_event_id: row.calendar_event_id,
    status: row.status as Seminar["status"],
    spreadsheet_id: row.spreadsheet_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Google Sheets 時代の rowToSeminar は後方互換のため保持
// （移行スクリプト内で使用）
// ---------------------------------------------------------------------------
export function rowToSeminar(row: string[]): Seminar {
  const r = [...row];
  while (r.length < 20) r.push("");
  return {
    id: r[0],
    title: r[1],
    description: r[2],
    date: r[3],
    end_time: r[4],
    capacity: parseInt(r[5] || "0", 10),
    current_bookings: parseInt(r[6] || "0", 10),
    speaker: r[7],
    meet_url: r[8],
    calendar_event_id: r[9],
    status: (r[10] as Seminar["status"]) || "draft",
    spreadsheet_id: r[11],
    speaker_title: r[12],
    format: (r[13] || "online") as Seminar["format"],
    target: (r[14] || "public") as Seminar["target"],
    invitation_code: r[15].trim(),
    image_url: r[16],
    created_at: r[17],
    updated_at: r[18],
    speaker_reference_url: r[19],
  };
}

// ---------------------------------------------------------------------------
// D1 ベースのデータ取得
// ---------------------------------------------------------------------------

/**
 * ID でセミナーを1件取得（D1）
 */
export async function getSeminarById(id: string): Promise<Seminar | null> {
  try {
    const row = await getSeminarByIdFromD1(id);
    if (!row) return null;
    return d1SeminarToSeminar(row);
  } catch (err) {
    console.error("[getSeminarById] failed for id:", id, err);
    return null;
  }
}

/**
 * デフォルトテナントの公開中セミナー一覧（D1）
 */
export async function getPublishedSeminars(): Promise<Seminar[]> {
  try {
    const rows = await getSeminarsByTenantFromD1("default", "published");
    const seminars = rows.map(d1SeminarToSeminar);
    seminars.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return seminars;
  } catch {
    return [];
  }
}

/**
 * テナント指定で公開中セミナー一覧（D1）
 */
export async function getPublishedSeminarsForTenant(
  tenant: string
): Promise<Seminar[]> {
  try {
    const rows = await getSeminarsByTenantFromD1(tenant, "published");
    const seminars = rows.map((r) => ({ ...d1SeminarToSeminar(r), tenant }));
    seminars.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return seminars;
  } catch {
    return [];
  }
}
