/**
 * スクリプト: スプレッドシート更新のテスト
 *
 * 実際にP列に画像URLを書き込んでテストします
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { findMasterRowById, updateMasterRow } from "../src/lib/google/sheets";

async function testUpdateRow() {
  // セミナーID（スプレッドシートの2行目にあるID）
  const seminarId = "95658241-261d-4d20-b2b8-940c79474a42";

  console.log("📋 セミナーIDで行を検索:", seminarId);

  const result = await findMasterRowById(seminarId);
  if (!result) {
    console.error("❌ セミナーが見つかりません");
    return;
  }

  console.log("✅ セミナーが見つかりました");
  console.log("   行番号:", result.rowIndex);
  console.log("   元の列数:", result.values.length);
  console.log("   元のデータ:", JSON.stringify(result.values, null, 2));

  // テスト用の画像URL
  const testImageUrl = "https://drive.google.com/file/d/1aAyn2MyeJkyhLia3GqSq-XAUBevGDz8S/view";
  const now = new Date().toISOString();

  const updated = [...result.values];
  console.log("\n📝 更新前の配列長:", updated.length);

  while (updated.length < 18) {
    updated.push("");
  }

  updated[15] = testImageUrl;  // P列
  updated[17] = now;            // R列

  console.log("📝 更新後の配列長:", updated.length);
  console.log("   P列 (index 15):", updated[15]);
  console.log("   R列 (index 17):", updated[17]);

  console.log("\n🔄 スプレッドシートを更新中...");
  await updateMasterRow(result.rowIndex, updated);
  console.log("✅ 更新完了！");

  console.log("\n📌 スプレッドシートを開いて、P列に画像URLが入っているか確認してください");
}

testUpdateRow().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
