/**
 * スクリプト: 既存の個別スプレッドシートに画像URLを同期
 *
 * 予約管理マスターのP列にある画像URLを、
 * 各個別イベントスプレッドシートの「イベント情報」シートにコピーします。
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { getMasterData, findRowById, updateRow } from "../src/lib/google/sheets";

async function syncImagesToIndividual() {
  console.log("📋 予約管理マスターからデータを取得中...");

  const rows = await getMasterData();
  const dataRows = rows.slice(1); // ヘッダー行を除く

  console.log(`   データ行数: ${dataRows.length}\n`);

  let syncedCount = 0;
  let skippedCount = 0;

  for (const row of dataRows) {
    const id = row[0];
    const title = row[1];
    const individualSpreadsheetId = row[11]; // L列: spreadsheet_id
    const imageUrl = row[15]; // P列: image_url

    if (!id || !individualSpreadsheetId) {
      console.log(`⏭️  スキップ: ${title || "不明"} (IDまたはspreadsheet_idなし)`);
      skippedCount++;
      continue;
    }

    if (!imageUrl) {
      console.log(`⏭️  スキップ: ${title} (画像URLなし)`);
      skippedCount++;
      continue;
    }

    try {
      console.log(`🔄 処理中: ${title}`);
      console.log(`   個別スプシID: ${individualSpreadsheetId}`);
      console.log(`   画像URL: ${imageUrl.substring(0, 60)}...`);

      // 個別スプレッドシートの「イベント情報」シートから該当行を検索
      const individualResult = await findRowById(individualSpreadsheetId, "イベント情報", id);

      if (!individualResult) {
        console.log(`   ⚠️  個別スプシに該当行が見つかりません`);
        skippedCount++;
        continue;
      }

      // P列（index 15）に画像URLを設定
      const updated = [...individualResult.values];
      while (updated.length < 18) updated.push("");
      updated[15] = imageUrl;
      updated[17] = new Date().toISOString(); // R列: updated_at

      await updateRow(individualSpreadsheetId, "イベント情報", individualResult.rowIndex, updated);
      console.log(`   ✅ 同期完了\n`);
      syncedCount++;
    } catch (err) {
      console.error(`   ❌ エラー: ${err}\n`);
      skippedCount++;
    }
  }

  console.log("\n📊 結果:");
  console.log(`   同期成功: ${syncedCount}件`);
  console.log(`   スキップ: ${skippedCount}件`);
  console.log("\n✅ 同期処理が完了しました！");
}

syncImagesToIndividual().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
