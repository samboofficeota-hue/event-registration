import { getMasterData, findMasterRowById, getSheetData } from "@/lib/google/sheets";
import { getTenantConfig } from "@/lib/tenant-config";
import type { Seminar } from "@/lib/types";

// マスタースプレッドシート「セミナー一覧」シートの列順:
// 新レイアウト(20列): ... O:対象 P:招待コード Q:画像URL R:created_at S:updated_at T:参考URL

/**
 * シートの1行を Seminar オブジェクトに変換する。
 * row.length >= 20 のとき招待コード列(P)あり。それ未満は従来レイアウト。
 */
export function rowToSeminar(row: string[]): Seminar {
  const formatVal = row[13];
  const isNewLayout =
    formatVal === "venue" || formatVal === "online" || formatVal === "hybrid";
  const hasInvitationCode = isNewLayout && row.length >= 20;
  return {
    id: row[0] || "",
    title: row[1] || "",
    description: row[2] || "",
    date: row[3] || "",
    end_time: row[4] || "",
    capacity: parseInt(row[5] || "0", 10),
    current_bookings: parseInt(row[6] || "0", 10),
    speaker: row[7] || "",
    meet_url: row[8] || "",
    calendar_event_id: row[9] || "",
    status: (row[10] as Seminar["status"]) || "draft",
    spreadsheet_id: row[11] || "",
    speaker_title: isNewLayout ? row[12] || "" : "",
    speaker_reference_url: isNewLayout ? (hasInvitationCode ? row[19] || "" : row[18] || "") : "",
    format: (isNewLayout ? row[13] : "online") as Seminar["format"],
    target: (isNewLayout ? row[14] : "public") as Seminar["target"],
    invitation_code: hasInvitationCode ? row[15]?.trim() || "" : "",
    image_url: isNewLayout ? (hasInvitationCode ? row[16] || "" : row[15] || "") : "",
    created_at: isNewLayout ? (hasInvitationCode ? row[17] || "" : row[16] || "") : row[12] || "",
    updated_at: isNewLayout ? (hasInvitationCode ? row[18] || "" : row[17] || "") : row[13] || "",
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

/**
 * 指定テナントのマスターから公開中のセミナー一覧を取得する。
 * テナント未設定の場合は空配列を返す。
 * 各セミナーに tenant を付与し、予約APIで確実にテナントを渡せるようにする。
 */
export async function getPublishedSeminarsForTenant(
  tenant: string
): Promise<Seminar[]> {
  const config = getTenantConfig(tenant);
  if (!config) return [];
  try {
    const rows = await getSheetData(
      config.masterSpreadsheetId,
      "セミナー一覧"
    );
    const seminars = rows
      .slice(1)
      .filter((row) => row[0]?.trim())
      .map((row) => ({ ...rowToSeminar(row), tenant }))
      .filter((s) => s.status === "published");

    seminars.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return seminars;
  } catch {
    return [];
  }
}
