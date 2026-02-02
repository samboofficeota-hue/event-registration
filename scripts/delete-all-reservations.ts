/**
 * スクリプト: 既存の予約データをすべて削除
 *
 * 予約管理マスターのセミナー一覧から、ヘッダー行以外のすべてのデータを削除します。
 *
 * 使用方法:
 *   npx tsx scripts/delete-all-reservations.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local explicitly
config({ path: resolve(process.cwd(), ".env.local") });

import { getAccessToken } from "../src/lib/google/auth";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function deleteAllReservations() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not set");
  }

  console.log("📋 対象スプレッドシート ID:", spreadsheetId);

  const token = await getAccessToken();

  // 1. 現在のデータを取得して行数を確認
  console.log("📊 現在のデータ行数を確認中...");
  const getResponse = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/セミナー一覧`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!getResponse.ok) {
    const error = await getResponse.text();
    throw new Error(`Failed to read sheet: ${error}`);
  }

  const data = await getResponse.json();
  const rows = data.values || [];
  const dataRowCount = rows.length - 1; // ヘッダー行を除く

  if (dataRowCount <= 0) {
    console.log("✅ データ行が存在しません。削除の必要はありません。");
    return;
  }

  console.log(`⚠️  ${dataRowCount} 件のデータ行が見つかりました。`);
  console.log("");
  console.log("🗑️  2行目以降のすべてのデータを削除します...");

  // 2. 2行目以降をすべてクリア（ヘッダー行は残す）
  const clearResponse = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/セミナー一覧!A2:R${rows.length}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!clearResponse.ok) {
    const error = await clearResponse.text();
    throw new Error(`Failed to clear data: ${error}`);
  }

  console.log("✅ すべての予約データを削除しました！");
  console.log("");
  console.log("📌 次のステップ:");
  console.log("   1. Google スプレッドシートを開いて、データが削除されていることを確認");
  console.log("   2. 管理画面から新しい構造に沿ってセミナーを再登録");
}

deleteAllReservations().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
