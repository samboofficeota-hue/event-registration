import { getAccessToken } from "./auth";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

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

export async function updateRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  values: string[]
): Promise<void> {
  const token = await getAccessToken();
  const colLetter = String.fromCharCode(64 + values.length);
  const range = `${sheetName}!A${rowIndex}:${colLetter}${rowIndex}`;
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
// セミナー専用スプレッドシートの自動作成
// ---------------------------------------------------------------------------

/**
 * 新しいスプレッドシートを作成し、必要なシート（タブ）とヘッダー行を設定する。
 * Google Drive API でフォルダに配置する場合は GOOGLE_DRIVE_FOLDER_ID 環境変数を設定。
 */
export async function createSeminarSpreadsheet(
  seminarTitle: string
): Promise<string> {
  const token = await getAccessToken();

  // 1. スプレッドシート作成（4シート構成）
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
            range: "イベント情報!A1:P1",
            values: [[
              "ID", "タイトル", "説明", "開催日時", "所要時間(分)",
              "定員", "現在の予約数", "登壇者", "肩書き", "開催形式", "対象", "Googleカレンダー",
              "Meet URL", "Calendar Event ID", "ステータス", "作成日時",
            ]],
          },
          {
            range: "予約情報!A1:K1",
            values: [[
              "ID", "氏名", "メールアドレス", "会社名", "部署",
              "電話番号", "ステータス", "事前アンケート回答済",
              "事後アンケート回答済", "予約日時", "備考",
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
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    const error = await batchRes.text();
    throw new Error(`Failed to set headers: ${error}`);
  }

  // 3. Google Drive フォルダに移動（設定されている場合）
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (folderId) {
    try {
      // 現在の親を取得
      const fileRes = await fetch(
        `${DRIVE_API}/${spreadsheetId}?fields=parents`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const fileData = await fileRes.json();
      const previousParents = (fileData.parents || []).join(",");

      // 新しいフォルダに移動
      await fetch(
        `${DRIVE_API}/${spreadsheetId}?addParents=${folderId}&removeParents=${previousParents}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (err) {
      console.error("Failed to move spreadsheet to folder:", err);
      // フォルダ移動の失敗は致命的でないので続行
    }
  }

  return spreadsheetId;
}
