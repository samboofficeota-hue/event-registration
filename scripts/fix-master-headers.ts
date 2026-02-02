/**
 * スクリプト: 予約管理マスターのヘッダー行を修正
 *
 * K列以降のヘッダーが欠けている問題を修正します。
 *
 * 使用方法:
 *   npx tsx scripts/fix-master-headers.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local explicitly
config({ path: resolve(process.cwd(), ".env.local") });

import { getAccessToken } from "../src/lib/google/auth";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function fixMasterHeaders() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not set");
  }

  console.log("📋 修正対象スプレッドシート ID:", spreadsheetId);

  const token = await getAccessToken();

  // マスタースプレッドシート「セミナー一覧」シートの正しいヘッダー (A-R)
  const correctHeaders = [
    "ID",               // A
    "タイトル",          // B
    "説明",             // C
    "開催日時",          // D
    "所要時間(分)",      // E
    "定員",             // F
    "現在の予約数",       // G
    "登壇者",           // H
    "Meet URL",         // I
    "Calendar Event ID", // J
    "ステータス",        // K
    "spreadsheet_id",   // L
    "肩書き",           // M
    "開催形式",          // N
    "対象",             // O
    "画像URL",          // P
    "作成日時",          // Q
    "更新日時",          // R
  ];

  console.log("✍️  正しいヘッダーをセット中...");
  console.log("   列数:", correctHeaders.length, "(A-R)");

  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/セミナー一覧!A1:R1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [correctHeaders],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update headers: ${error}`);
  }

  console.log("✅ ヘッダー行の修正が完了しました！");
  console.log("");
  console.log("📌 次のステップ:");
  console.log("   1. Google スプレッドシートを開いて、K-R列のヘッダーが正しく表示されているか確認");
  console.log("   2. 既存の予約データを削除（ユーザー指示通り）");
  console.log("   3. 新しい構造に沿ってデータを再登録");
}

fixMasterHeaders().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
