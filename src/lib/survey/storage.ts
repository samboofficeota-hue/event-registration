import { getSheetData } from "@/lib/google/sheets";
import type { SurveyQuestion } from "@/lib/survey-config";

const QUESTION_TYPES = ["rating", "text", "select", "nps"] as const;

/**
 * 設問シートの1行を SurveyQuestion に変換する。
 * 列: A:設問ID B:ラベル C:タイプ D:必須 E:選択肢 F:min G:max H:プレースホルダ I:表示順
 */
function rowToSurveyQuestion(row: string[]): SurveyQuestion | null {
  const id = row[0]?.trim();
  const label = row[1]?.trim();
  const typeRaw = (row[2]?.trim() || "").toLowerCase();
  const type = QUESTION_TYPES.includes(typeRaw as (typeof QUESTION_TYPES)[number])
    ? (typeRaw as SurveyQuestion["type"])
    : "text";
  if (!id || !label) return null;

  const required = (row[3]?.trim() || "").toUpperCase() === "TRUE";
  const optionsStr = row[4]?.trim() || "";
  const options =
    optionsStr.length > 0
      ? optionsStr.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
  const minRaw = row[5]?.trim();
  const min = minRaw !== "" && minRaw != null ? parseInt(minRaw, 10) : undefined;
  const maxRaw = row[6]?.trim();
  const max = maxRaw !== "" && maxRaw != null ? parseInt(maxRaw, 10) : undefined;
  const placeholder = row[7]?.trim() || undefined;

  return {
    id,
    label,
    type,
    required,
    options,
    min: min !== undefined && !Number.isNaN(min) ? min : undefined,
    max: max !== undefined && !Number.isNaN(max) ? max : undefined,
    placeholder,
  };
}

/**
 * セミナー用スプレッドシートの「事前アンケート設問」または「事後アンケート設問」シートから
 * 設問一覧を取得する。シートが存在しない・空の場合は null を返す（呼び出し元でフォールバック用）。
 */
export async function getSurveyQuestions(
  spreadsheetId: string,
  type: "pre" | "post"
): Promise<SurveyQuestion[] | null> {
  const sheetName =
    type === "pre" ? "事前アンケート設問" : "事後アンケート設問";

  try {
    const rows = await getSheetData(spreadsheetId, sheetName);
    if (!rows || rows.length < 2) return null;

    const withOrder: { q: SurveyQuestion; order: number }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const q = rowToSurveyQuestion(row);
      if (!q) continue;
      const orderStr = (row[8] ?? "").trim();
      const order =
        orderStr === ""
          ? 999 + i
          : (() => {
              const n = parseInt(orderStr, 10);
              return Number.isNaN(n) ? 999 + i : n;
            })();
      withOrder.push({ q, order });
    }

    withOrder.sort((a, b) => a.order - b.order);
    const questions = withOrder.map((x) => x.q);

    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}
