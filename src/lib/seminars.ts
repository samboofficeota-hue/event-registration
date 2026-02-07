import { getMasterData, findMasterRowById } from "@/lib/google/sheets";
import type { Seminar } from "@/lib/types";

// マスタースプレッドシート「セミナー一覧」シートの列順:
// A:id B:title C:description D:date E:duration_minutes F:capacity
// G:current_bookings H:speaker I:meet_url J:calendar_event_id
// K:status L:spreadsheet_id M:肩書き N:開催形式 O:対象 P:画像URL Q:created_at R:updated_at

/**
 * シートの1行を Seminar オブジェクトに変換する。
 * Google Sheets APIは末尾の空セルを省略するため、row.length で新旧レイアウトを判定するのは不正確。
 * N列(インデックス13)が開催形式の正規値になっているか確認する。
 */
export function rowToSeminar(row: string[]): Seminar {
  const formatVal = row[13];
  const isNewLayout =
    formatVal === "venue" || formatVal === "online" || formatVal === "hybrid";
  return {
    id: row[0] || "",
    title: row[1] || "",
    description: row[2] || "",
    date: row[3] || "",
    duration_minutes: parseInt(row[4] || "0", 10),
    capacity: parseInt(row[5] || "0", 10),
    current_bookings: parseInt(row[6] || "0", 10),
    speaker: row[7] || "",
    meet_url: row[8] || "",
    calendar_event_id: row[9] || "",
    status: (row[10] as Seminar["status"]) || "draft",
    spreadsheet_id: row[11] || "",
    speaker_title: isNewLayout ? row[12] || "" : "",
    format: (isNewLayout ? row[13] : "online") as Seminar["format"],
    target: (isNewLayout ? row[14] : "public") as Seminar["target"],
    image_url: isNewLayout ? row[15] || "" : "",
    created_at: isNewLayout ? row[16] || "" : row[12] || "",
    updated_at: isNewLayout ? row[17] || "" : row[13] || "",
  };
}

/**
 * マスタースプレッドシートから1つのセミナーを ID で取得する。
 * Server Component から直接呼べる（APIルートへのself-fetchを経由しない）。
 */
export async function getSeminarById(id: string): Promise<Seminar | null> {
  try {
    const result = await findMasterRowById(id);
    if (!result) return null;
    return rowToSeminar(result.values);
  } catch (err) {
    console.error("[getSeminarById] failed for id:", id, err);
    return null;
  }
}

/**
 * マスタースプレッドシートから公開中のセミナー一覧を取得する。
 * Server Component から直接呼べる（APIルートへのself-fetchを経由しない）。
 */
export async function getPublishedSeminars(): Promise<Seminar[]> {
  try {
    const rows = await getMasterData();
    const seminars = rows
      .slice(1)
      .filter((row) => row[0]?.trim())
      .map(rowToSeminar)
      .filter((s) => s.status === "published");

    // 日付の近い順（昇順＝直近の日付が先）
    seminars.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return seminars;
  } catch {
    return [];
  }
}
