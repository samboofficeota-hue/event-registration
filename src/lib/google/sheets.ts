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

  // 1. スプレッドシート作成（6シート構成：イベント・予約・事前/事後アンケート・事前/事後アンケート設問）
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
            range: "イベント情報!A1:R1",
            values: [[
              "ID", "タイトル", "説明", "開催日時", "所要時間(分)",
              "定員", "現在の予約数", "登壇者", "Meet URL", "Calendar Event ID",
              "ステータス", "spreadsheet_id", "肩書き", "開催形式", "対象",
              "画像URL", "作成日時", "更新日時",
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
  mimeType: string
): Promise<string> {
  const token = await getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_IMAGES_FOLDER_ID;

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
