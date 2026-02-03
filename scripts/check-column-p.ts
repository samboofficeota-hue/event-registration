/**
 * スクリプト: P列の値を直接確認
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { getAccessToken } from "../src/lib/google/auth";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function checkColumnP() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not set");
  }

  const token = await getAccessToken();

  // P列だけを取得
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/セミナー一覧!P:P`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read P column: ${error}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  console.log("📋 P列（画像URL）の内容:");
  console.log(`   総行数: ${rows.length}\n`);

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    const value = row[0] || "(空)";
    console.log(`行 ${rowNum}: ${value}`);
  });
}

checkColumnP().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
