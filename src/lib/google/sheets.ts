import { getAccessToken } from "./auth";
import {
  preSurveyQuestions,
  postSurveyQuestions,
  type SurveyQuestion,
} from "@/lib/survey-config";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

/** 設問シートの列: A:設問ID B:ラベル C:タイプ D:必須 E:選択肢 F:min G:max H:プレースホルダ I:表示順 */
export const SURVEY_QUESTION_SHEET_HEADER = [
  "設問ID", "ラベル", "タイプ", "必須", "選択肢", "min", "max", "プレースホルダ", "表示順",
];

export function surveyQuestionToRow(q: SurveyQuestion, order: number): string[] {
  return [
    q.id,
    q.label,
    q.type,
    q.required ? "TRUE" : "FALSE",
    (q.options || []).join(","),
    q.min != null ? String(q.min) : "",
    q.max != null ? String(q.max) : "",
    q.placeholder || "",
    String(order),
  ];
}

// ---------------------------------------------------------------------------
// マスタースプレッドシートID（環境変数から取得）
// ---------------------------------------------------------------------------
function getMasterSpreadsheetId(): string {
  return process.env.GOOGLE_SPREADSHEET_ID!;
}

// ---------------------------------------------------------------------------
// 汎用シート操作（spreadsheetId を引数に取る）
// ---------------------------------------------------------------------------

export async function getSheetData(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const token = await getAccessToken();
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read sheet ${sheetName}: ${error}`);
  }
  const data = await response.json();
  return data.values || [];
}

export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: string[]
): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:Z:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to append row to ${sheetName}: ${error}`);
  }
}

/**
 * 指定シートの指定範囲を指定した値で上書きする。
 * 設問シート全体の書き込みに使用する。
 */
export async function setSheetValues(
  spreadsheetId: string,
  sheetName: string,
  values: string[][]
): Promise<void> {
  if (values.length === 0) return;
  const token = await getAccessToken();
  const lastRow = values.length;
  const lastCol = Math.max(...values.map((row) => row.length), 1);
  const colLetter =
    lastCol <= 26
      ? String.fromCharCode(64 + lastCol)
      : String.fromCharCode(64 + Math.floor(lastCol / 26)) +
        String.fromCharCode(64 + (lastCol % 26));
  const range = `${sheetName}!A1:${colLetter}${lastRow}`;
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set sheet ${sheetName}: ${error}`);
  }
}

/**
 * 指定シートの指定範囲の値をクリアする。
 * 初期化スクリプトでデータ行のみ消してヘッダーを残すために使用。
 */
export async function clearSheetRange(
  spreadsheetId: string,
  sheetName: string,
  rangeA1: string
): Promise<void> {
  const token = await getAccessToken();
  const range = rangeA1.includes("!") ? rangeA1 : `${sheetName}!${rangeA1}`;
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`シートのクリアに失敗しました (${sheetName}): ${error}`);
  }
}

/**
 * スプレッドシートのシート名一覧を取得する。
 */
export async function getSpreadsheetSheetTitles(
  spreadsheetId: string
): Promise<string[]> {
  const token = await getAccessToken();
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets(properties(title))`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get spreadsheet: ${error}`);
  }
  const data = await response.json();
  const sheets = data.sheets || [];
  return sheets.map(
    (s: { properties?: { title?: string } }) => s.properties?.title ?? ""
  );
}

/**
 * 既存スプレッドシートに新しいシートを追加する。
 */
export async function addSheet(
  spreadsheetId: string,
  title: string
): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add sheet ${title}: ${error}`);
  }
}

/**
 * 既存のセミナー用スプレッドシートに「事前アンケート設問」「事後アンケート設問」シートが
 * なければ追加し、デフォルトの設問行を書き込む。既に存在するシートは上書きしない。
 */
export async function ensureSurveyQuestionSheets(
  spreadsheetId: string
): Promise<{ addedPre: boolean; addedPost: boolean }> {
  const titles = await getSpreadsheetSheetTitles(spreadsheetId);
  const hasPre = titles.includes("事前アンケート設問");
  const hasPost = titles.includes("事後アンケート設問");

  if (!hasPre) {
    await addSheet(spreadsheetId, "事前アンケート設問");
    const rows = [
      SURVEY_QUESTION_SHEET_HEADER,
      ...preSurveyQuestions.map((q, i) => surveyQuestionToRow(q, i + 1)),
    ];
    await setSheetValues(spreadsheetId, "事前アンケート設問", rows);
  }
  if (!hasPost) {
    await addSheet(spreadsheetId, "事後アンケート設問");
    const rows = [
      SURVEY_QUESTION_SHEET_HEADER,
      ...postSurveyQuestions.map((q, i) => surveyQuestionToRow(q, i + 1)),
    ];
    await setSheetValues(spreadsheetId, "事後アンケート設問", rows);
  }

  return { addedPre: !hasPre, addedPost: !hasPost };
}

export async function updateRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  values: string[]
): Promise<void> {
  const token = await getAccessToken();
  const colLetter = String.fromCharCode(64 + values.length);
  const range = `${sheetName}!A${rowIndex}:${colLetter}${rowIndex}`;
  console.log("[updateRow] Updating range:", range);
  console.log("[updateRow] Values length:", values.length);
  console.log("[updateRow] Column letter:", colLetter);
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update row in ${sheetName}: ${error}`);
  }
}

export async function updateCell(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  colIndex: number,
  value: string
): Promise<void> {
  const token = await getAccessToken();
  const colLetter = String.fromCharCode(65 + colIndex);
  const range = `${sheetName}!${colLetter}${rowIndex}`;
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [[value]] }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update cell in ${sheetName}: ${error}`);
  }
}

export async function findRowById(
  spreadsheetId: string,
  sheetName: string,
  id: string
): Promise<{ rowIndex: number; values: string[] } | null> {
  const rows = await getSheetData(spreadsheetId, sheetName);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      return { rowIndex: i + 1, values: rows[i] };
    }
  }
  return null;
}

export async function findRowsByField(
  spreadsheetId: string,
  sheetName: string,
  fieldIndex: number,
  value: string
): Promise<{ rowIndex: number; values: string[] }[]> {
  const rows = await getSheetData(spreadsheetId, sheetName);
  const results: { rowIndex: number; values: string[] }[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][fieldIndex] === value) {
      results.push({ rowIndex: i + 1, values: rows[i] });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// マスタースプレッドシート操作
// ---------------------------------------------------------------------------

export async function getMasterData(): Promise<string[][]> {
  return getSheetData(getMasterSpreadsheetId(), "セミナー一覧");
}

/** テナント指定時用: そのテナントのマスター「セミナー一覧」の行を返す。未設定なら null。 */
export async function getMasterDataForTenant(
  tenant: string
): Promise<string[][] | null> {
  const { getTenantConfig } = await import("@/lib/tenant-config");
  const config = getTenantConfig(tenant);
  if (!config) return null;
  const rows = await getSheetData(config.masterSpreadsheetId, "セミナー一覧");
  return rows;
}

/** テナントのマスターで ID に一致する行を返す。未設定・未検出なら null。 */
export async function findMasterRowByIdForTenant(
  tenant: string,
  id: string
): Promise<{ rowIndex: number; values: string[] } | null> {
  const config = (await import("@/lib/tenant-config")).getTenantConfig(tenant);
  if (!config) return null;
  return findRowById(config.masterSpreadsheetId, "セミナー一覧", id);
}

/** テナントのマスターの指定行を更新する。 */
export async function updateMasterRowForTenant(
  tenant: string,
  rowIndex: number,
  values: string[]
): Promise<void> {
  const config = (await import("@/lib/tenant-config")).getTenantConfig(tenant);
  if (!config) throw new Error("テナント未設定");
  return updateRow(config.masterSpreadsheetId, "セミナー一覧", rowIndex, values);
}

/** テナントのマスターに行を追加する。 */
export async function appendMasterRowForTenant(
  tenant: string,
  values: string[]
): Promise<void> {
  const config = (await import("@/lib/tenant-config")).getTenantConfig(tenant);
  if (!config) throw new Error("テナント未設定");
  return appendRow(config.masterSpreadsheetId, "セミナー一覧", values);
}

export async function appendMasterRow(values: string[]): Promise<void> {
  return appendRow(getMasterSpreadsheetId(), "セミナー一覧", values);
}

export async function updateMasterRow(rowIndex: number, values: string[]): Promise<void> {
  return updateRow(getMasterSpreadsheetId(), "セミナー一覧", rowIndex, values);
}

export async function findMasterRowById(
  id: string
): Promise<{ rowIndex: number; values: string[] } | null> {
  return findRowById(getMasterSpreadsheetId(), "セミナー一覧", id);
}

// ---------------------------------------------------------------------------
// 会員企業ドメイン（マスタースプレッドシート内シート「会員企業ドメイン」）
// ---------------------------------------------------------------------------

export const MEMBER_DOMAINS_SHEET_NAME = "会員企業ドメイン";
const MEMBER_DOMAINS_HEADER = ["ドメイン", "作成日時"];

/**
 * 会員企業ドメイン用シートがなければ作成し、ヘッダー行を書き込む。
 */
export async function ensureMemberDomainsSheet(): Promise<void> {
  const spreadsheetId = getMasterSpreadsheetId();
  const titles = await getSpreadsheetSheetTitles(spreadsheetId);
  if (titles.includes(MEMBER_DOMAINS_SHEET_NAME)) return;
  await addSheet(spreadsheetId, MEMBER_DOMAINS_SHEET_NAME);
  await setSheetValues(spreadsheetId, MEMBER_DOMAINS_SHEET_NAME, [
    MEMBER_DOMAINS_HEADER,
  ]);
}

/**
 * 会員企業ドメイン一覧を取得する（@ より後ろの文字列のリスト）。
 */
export async function getMemberDomains(): Promise<string[]> {
  await ensureMemberDomainsSheet();
  const rows = await getSheetData(
    getMasterSpreadsheetId(),
    MEMBER_DOMAINS_SHEET_NAME
  );
  const domains: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i][0]?.trim();
    if (d) domains.push(d);
  }
  return domains;
}

/**
 * 会員企業ドメインを1件追加する。
 */
export async function addMemberDomain(domain: string): Promise<void> {
  await ensureMemberDomainsSheet();
  const d = domain.trim().toLowerCase();
  if (!d) throw new Error("ドメインを入力してください");
  await appendRow(getMasterSpreadsheetId(), MEMBER_DOMAINS_SHEET_NAME, [
    d,
    new Date().toISOString(),
  ]);
}

/**
 * 会員企業ドメインを1件削除する（大文字小文字は区別しない）。
 */
export async function removeMemberDomain(domain: string): Promise<void> {
  await ensureMemberDomainsSheet();
  const spreadsheetId = getMasterSpreadsheetId();
  const rows = await getSheetData(spreadsheetId, MEMBER_DOMAINS_SHEET_NAME);
  const target = domain.trim().toLowerCase();
  const newRows = [
    MEMBER_DOMAINS_HEADER,
    ...rows.slice(1).filter((row) => row[0]?.trim().toLowerCase() !== target),
  ];
  await setSheetValues(spreadsheetId, MEMBER_DOMAINS_SHEET_NAME, newRows);
}

// ---------------------------------------------------------------------------
// テナント対応: 会員企業ドメイン
// ---------------------------------------------------------------------------

async function ensureMemberDomainsSheetForTenant(spreadsheetId: string): Promise<void> {
  const titles = await getSpreadsheetSheetTitles(spreadsheetId);
  if (titles.includes(MEMBER_DOMAINS_SHEET_NAME)) return;
  await addSheet(spreadsheetId, MEMBER_DOMAINS_SHEET_NAME);
  await setSheetValues(spreadsheetId, MEMBER_DOMAINS_SHEET_NAME, [
    MEMBER_DOMAINS_HEADER,
  ]);
}

export async function getMemberDomainsForTenant(tenant: string): Promise<string[]> {
  const config = (await import("@/lib/tenant-config")).getTenantConfig(tenant);
  if (!config) return [];
  await ensureMemberDomainsSheetForTenant(config.masterSpreadsheetId);
  const rows = await getSheetData(config.masterSpreadsheetId, MEMBER_DOMAINS_SHEET_NAME);
  const domains: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i][0]?.trim();
    if (d) domains.push(d);
  }
  return domains;
}

export async function addMemberDomainForTenant(tenant: string, domain: string): Promise<void> {
  const config = (await import("@/lib/tenant-config")).getTenantConfig(tenant);
  if (!config) throw new Error("テナント未設定");
  await ensureMemberDomainsSheetForTenant(config.masterSpreadsheetId);
  const d = domain.trim().toLowerCase();
  if (!d) throw new Error("ドメインを入力してください");
  await appendRow(config.masterSpreadsheetId, MEMBER_DOMAINS_SHEET_NAME, [
    d,
    new Date().toISOString(),
  ]);
}

export async function removeMemberDomainForTenant(tenant: string, domain: string): Promise<void> {
  const config = (await import("@/lib/tenant-config")).getTenantConfig(tenant);
  if (!config) throw new Error("テナント未設定");
  await ensureMemberDomainsSheetForTenant(config.masterSpreadsheetId);
  const rows = await getSheetData(config.masterSpreadsheetId, MEMBER_DOMAINS_SHEET_NAME);
  const target = domain.trim().toLowerCase();
  const newRows = [
    MEMBER_DOMAINS_HEADER,
    ...rows.slice(1).filter((row) => row[0]?.trim().toLowerCase() !== target),
  ];
  await setSheetValues(config.masterSpreadsheetId, MEMBER_DOMAINS_SHEET_NAME, newRows);
}

// ---------------------------------------------------------------------------
// 予約番号インデックス（マスター内シート「予約番号インデックス」）
// 予約番号 → spreadsheet_id, reservation_id の検索用
// ---------------------------------------------------------------------------

export const RESERVATION_INDEX_SHEET_NAME = "予約番号インデックス";
const RESERVATION_INDEX_HEADER = ["予約番号", "spreadsheet_id", "reservation_id"];

export async function ensureReservationIndexSheet(): Promise<void> {
  const spreadsheetId = getMasterSpreadsheetId();
  const titles = await getSpreadsheetSheetTitles(spreadsheetId);
  if (titles.includes(RESERVATION_INDEX_SHEET_NAME)) return;
  await addSheet(spreadsheetId, RESERVATION_INDEX_SHEET_NAME);
  await setSheetValues(spreadsheetId, RESERVATION_INDEX_SHEET_NAME, [
    RESERVATION_INDEX_HEADER,
  ]);
}

export async function appendReservationIndex(
  reservationNumber: string,
  spreadsheetId: string,
  reservationId: string
): Promise<void> {
  await ensureReservationIndexSheet();
  await appendRow(getMasterSpreadsheetId(), RESERVATION_INDEX_SHEET_NAME, [
    reservationNumber.trim().toLowerCase(),
    spreadsheetId,
    reservationId,
  ]);
}

/** 指定したマスタースプレッドシートに「予約番号インデックス」シートがなければ作成する（テナント用）。 */
export async function ensureReservationIndexSheetFor(
  masterSpreadsheetId: string
): Promise<void> {
  const titles = await getSpreadsheetSheetTitles(masterSpreadsheetId);
  if (titles.includes(RESERVATION_INDEX_SHEET_NAME)) return;
  await addSheet(masterSpreadsheetId, RESERVATION_INDEX_SHEET_NAME);
  await setSheetValues(masterSpreadsheetId, RESERVATION_INDEX_SHEET_NAME, [
    RESERVATION_INDEX_HEADER,
  ]);
}

/** 指定したマスタースプレッドシートの予約番号インデックスに1件追加（テナント用）。 */
export async function appendReservationIndexToMaster(
  masterSpreadsheetId: string,
  reservationNumber: string,
  seminarSpreadsheetId: string,
  reservationId: string
): Promise<void> {
  await ensureReservationIndexSheetFor(masterSpreadsheetId);
  await appendRow(masterSpreadsheetId, RESERVATION_INDEX_SHEET_NAME, [
    reservationNumber.trim().toLowerCase(),
    seminarSpreadsheetId,
    reservationId,
  ]);
}

export async function findReservationByNumber(
  reservationNumber: string
): Promise<{ spreadsheet_id: string; reservation_id: string } | null> {
  await ensureReservationIndexSheet();
  const rows = await getSheetData(
    getMasterSpreadsheetId(),
    RESERVATION_INDEX_SHEET_NAME
  );
  const key = reservationNumber.trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]?.trim().toLowerCase() === key) {
      return {
        spreadsheet_id: rows[i][1] || "",
        reservation_id: rows[i][2] || "",
      };
    }
  }
  return null;
}

/** テナント用: 指定したマスタースプレッドシートの予約番号インデックスから検索する。 */
export async function findReservationByNumberForTenant(
  masterSpreadsheetId: string,
  reservationNumber: string
): Promise<{ spreadsheet_id: string; reservation_id: string } | null> {
  await ensureReservationIndexSheetFor(masterSpreadsheetId);
  const rows = await getSheetData(
    masterSpreadsheetId,
    RESERVATION_INDEX_SHEET_NAME
  );
  const key = reservationNumber.trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]?.trim().toLowerCase() === key) {
      return {
        spreadsheet_id: rows[i][1] || "",
        reservation_id: rows[i][2] || "",
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// セミナー専用スプレッドシートの自動作成
// ---------------------------------------------------------------------------

/**
 * 新しいスプレッドシートを作成し、必要なシート（タブ）とヘッダー行を設定する。
 * Google Drive API でフォルダに配置する場合は GOOGLE_DRIVE_FOLDER_ID 環境変数を設定。
 * テナント用フォルダに配置したい場合は overrideFolderId を渡す。
 */
export async function createSeminarSpreadsheet(
  seminarTitle: string,
  overrideFolderId?: string
): Promise<string> {
  const token = await getAccessToken();

  // 1. Sheets API でスプレッドシートを作成（6シート構成）
  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: `【セミナー】${seminarTitle}`,
      },
      sheets: [
        { properties: { title: "イベント情報", index: 0 } },
        { properties: { title: "予約情報", index: 1 } },
        { properties: { title: "事前アンケート", index: 2 } },
        { properties: { title: "事後アンケート", index: 3 } },
        { properties: { title: "事前アンケート設問", index: 4 } },
        { properties: { title: "事後アンケート設問", index: 5 } },
      ],
    }),
  });

  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Failed to create seminar spreadsheet: ${error}`);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId: string = spreadsheet.spreadsheetId;

  // 2. 各シートにヘッダー行を設定（バッチ更新）
  const batchRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: "イベント情報!A1:T1",
            values: [[
              "ID", "タイトル", "説明", "開催日時", "終了時刻",
              "定員", "現在の予約数", "登壇者", "Meet URL", "Calendar Event ID",
              "ステータス", "spreadsheet_id", "肩書き", "開催形式", "対象",
              "招待コード", "画像URL", "作成日時", "更新日時", "参考URL",
            ]],
          },
          {
            range: "予約情報!A1:L1",
            values: [[
              "ID", "氏名", "メールアドレス", "会社名", "部署",
              "電話番号", "ステータス", "事前アンケート回答済",
              "事後アンケート回答済", "予約日時", "備考", "予約番号",
            ]],
          },
          {
            range: "事前アンケート!A1:H1",
            values: [[
              "ID", "予約ID", "関心度(1-5)", "期待すること",
              "関連経験", "事前質問", "回答日時", "備考",
            ]],
          },
          {
            range: "事後アンケート!A1:J1",
            values: [[
              "ID", "予約ID", "満足度(1-5)", "内容の質(1-5)",
              "登壇者評価(1-5)", "学んだこと", "改善点",
              "推薦度(0-10)", "回答日時", "備考",
            ]],
          },
          {
            range: "事前アンケート設問!A1:I1",
            values: [SURVEY_QUESTION_SHEET_HEADER],
          },
          {
            range: "事前アンケート設問!A2:I5",
            values: preSurveyQuestions.map((q, i) => surveyQuestionToRow(q, i + 1)),
          },
          {
            range: "事後アンケート設問!A1:I1",
            values: [SURVEY_QUESTION_SHEET_HEADER],
          },
          {
            range: "事後アンケート設問!A2:I7",
            values: postSurveyQuestions.map((q, i) => surveyQuestionToRow(q, i + 1)),
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    const error = await batchRes.text();
    throw new Error(`Failed to set headers: ${error}`);
  }

  // 3. Google Drive フォルダに移動（設定されている場合）
  const targetFolderId = overrideFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (targetFolderId) {
    try {
      // 現在の親を取得
      const fileRes = await fetch(
        `${DRIVE_API}/${spreadsheetId}?fields=parents`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!fileRes.ok) {
        console.error("[createSeminarSpreadsheet] Failed to get parents:", fileRes.status, await fileRes.text());
      } else {
        const fileData = await fileRes.json();
        const previousParents = (fileData.parents || []).join(",");

        // 新しいフォルダに移動
        const moveRes = await fetch(
          `${DRIVE_API}/${spreadsheetId}?addParents=${targetFolderId}&removeParents=${previousParents}&fields=id,parents`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (!moveRes.ok) {
          console.error("[createSeminarSpreadsheet] Drive move failed:", moveRes.status, await moveRes.text());
        } else {
          const moveData = await moveRes.json();
          console.log("[createSeminarSpreadsheet] Moved to folder", targetFolderId, "parents:", moveData.parents);
        }
      }
    } catch (err) {
      console.error("[createSeminarSpreadsheet] Failed to move to folder:", err);
    }
  }

  return spreadsheetId;
}

// ---------------------------------------------------------------------------
// テナント用マスタースプレッドシートの新規作成
// ---------------------------------------------------------------------------

/** マスター「セミナー一覧」シートのヘッダー（20列。rowToSeminar と一致） */
const MASTER_SEMINAR_LIST_HEADER = [
  "ID",
  "タイトル",
  "説明",
  "開催日時",
  "終了時刻",
  "定員",
  "現在の予約数",
  "登壇者",
  "Meet URL",
  "Calendar Event ID",
  "ステータス",
  "スプレッドシートID",
  "肩書き",
  "開催形式",
  "対象",
  "招待コード",
  "画像URL",
  "作成日時",
  "更新日時",
  "参考URL",
];

/**
 * マスタースプレッドシートの「セミナー一覧」ヘッダー行を最新の20列形式に自動修正する。
 * - 列数が20未満の場合（古い形式）→ 正しいヘッダーで上書き
 * - 「所要時間(分)」→「終了時刻」のリネーム
 * 既にデータがある行には影響しない（ヘッダー行のみ更新）。
 */
export async function ensureMasterHeaders(spreadsheetId: string): Promise<void> {
  try {
    const rows = await getSheetData(spreadsheetId, "セミナー一覧");
    if (rows.length === 0) return; // シートが空なら何もしない

    const currentHeader = rows[0];
    const expectedHeader = MASTER_SEMINAR_LIST_HEADER;

    // ヘッダーが一致していれば何もしない
    const needsUpdate =
      currentHeader.length !== expectedHeader.length ||
      currentHeader.some((val, i) => val !== expectedHeader[i]);

    if (!needsUpdate) return;

    console.log(
      "[ensureMasterHeaders] Updating header for",
      spreadsheetId,
      "from",
      currentHeader.length,
      "cols to",
      expectedHeader.length,
      "cols"
    );

    const token = await getAccessToken();
    await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent("セミナー一覧!A1:T1")}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [expectedHeader] }),
      }
    );
  } catch (err) {
    console.error("[ensureMasterHeaders] Failed:", err);
  }
}

/**
 * セミナー個別スプレッドシートの「イベント情報」ヘッダー行を最新の20列形式に自動修正する。
 */
export async function ensureSeminarSpreadsheetHeaders(spreadsheetId: string): Promise<void> {
  const SEMINAR_EVENT_HEADER = [
    "ID", "タイトル", "説明", "開催日時", "終了時刻",
    "定員", "現在の予約数", "登壇者", "Meet URL", "Calendar Event ID",
    "ステータス", "spreadsheet_id", "肩書き", "開催形式", "対象",
    "招待コード", "画像URL", "作成日時", "更新日時", "参考URL",
  ];
  try {
    const rows = await getSheetData(spreadsheetId, "イベント情報");
    if (rows.length === 0) return;

    const currentHeader = rows[0];
    const needsUpdate =
      currentHeader.length !== SEMINAR_EVENT_HEADER.length ||
      currentHeader.some((val, i) => val !== SEMINAR_EVENT_HEADER[i]);

    if (!needsUpdate) return;

    console.log("[ensureSeminarSpreadsheetHeaders] Updating header for", spreadsheetId);

    const token = await getAccessToken();
    await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent("イベント情報!A1:T1")}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [SEMINAR_EVENT_HEADER] }),
      }
    );
  } catch (err) {
    console.error("[ensureSeminarSpreadsheetHeaders] Failed:", err);
  }
}

/**
 * テナント用の予約管理マスターを新規作成する。
 * シート: セミナー一覧・会員企業ドメイン・予約番号インデックス。各ヘッダー行のみ書き込む。
 * @param tenantKey テナントキー（例: whgc-seminars）。ファイル名に使用
 * @param driveFolderId 配置先の Drive フォルダID。未指定ならルートに作成
 * @returns 作成したスプレッドシートのID
 */
export async function createTenantMasterSpreadsheet(
  tenantKey: string,
  driveFolderId?: string
): Promise<string> {
  const token = await getAccessToken();
  const title = `予約管理マスター（${tenantKey}）`;

  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: "セミナー一覧", index: 0 } },
        { properties: { title: MEMBER_DOMAINS_SHEET_NAME, index: 1 } },
        { properties: { title: RESERVATION_INDEX_SHEET_NAME, index: 2 } },
      ],
    }),
  });

  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`テナント用マスターの作成に失敗しました: ${error}`);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId: string = spreadsheet.spreadsheetId;

  const batchRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: "セミナー一覧!A1:T1",
            values: [MASTER_SEMINAR_LIST_HEADER],
          },
          {
            range: `${MEMBER_DOMAINS_SHEET_NAME}!A1:B1`,
            values: [MEMBER_DOMAINS_HEADER],
          },
          {
            range: `${RESERVATION_INDEX_SHEET_NAME}!A1:C1`,
            values: [RESERVATION_INDEX_HEADER],
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    const error = await batchRes.text();
    throw new Error(`ヘッダーの書き込みに失敗しました: ${error}`);
  }

  if (driveFolderId) {
    try {
      const fileRes = await fetch(
        `${DRIVE_API}/${spreadsheetId}?fields=parents`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const fileData = await fileRes.json();
      const previousParents = (fileData.parents || []).join(",");
      await fetch(
        `${DRIVE_API}/${spreadsheetId}?addParents=${driveFolderId}&removeParents=${previousParents}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (err) {
      console.error("Failed to move spreadsheet to folder:", err);
    }
  }

  return spreadsheetId;
}

// ---------------------------------------------------------------------------
// Google Drive: セミナー画像アップロード
// ---------------------------------------------------------------------------

/**
 * ファイルを Google Drive にアップロードし、公開URLを返す。
 * GOOGLE_DRIVE_IMAGES_FOLDER_ID が設定されている場合はそのフォルダに配置する。
 */
export async function uploadImageToDrive(
  fileName: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  tenantImagesFolderId?: string
): Promise<string> {
  const token = await getAccessToken();
  const folderId = tenantImagesFolderId || process.env.GOOGLE_DRIVE_IMAGES_FOLDER_ID;

  // multipart/related でメタデータとファイル本体を同時に送信
  const boundary = `boundary_${Date.now()}`;
  const metadata = JSON.stringify({
    name: fileName,
    mimeType,
    ...(folderId ? { parents: [folderId] } : {}),
  });

  const metadataPart = [
    `--${boundary}`,
    `Content-Type: application/json; charset=UTF-8`,
    ``,
    metadata,
  ].join("\r\n");

  const filePart = [
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    ``,
  ].join("\r\n");

  const ending = `\r\n--${boundary}--`;

  // バイト列を結合して送信本体を構築
  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metadataPart + "\r\n");
  const filePartBytes = encoder.encode(filePart + "\r\n");
  const fileBytes = new Uint8Array(fileBuffer);
  const endBytes = encoder.encode(ending);

  const totalLength = metaBytes.length + filePartBytes.length + fileBytes.length + endBytes.length;
  const body = new Uint8Array(totalLength);
  let offset = 0;
  body.set(metaBytes, offset); offset += metaBytes.length;
  body.set(filePartBytes, offset); offset += filePartBytes.length;
  body.set(fileBytes, offset); offset += fileBytes.length;
  body.set(endBytes, offset);

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload image: ${error}`);
  }

  const data = await response.json();
  const fileId: string = data.id;

  // ファイルを公開して閲覧URLを返す
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  return `https://drive.google.com/file/d/${fileId}/view`;
}
