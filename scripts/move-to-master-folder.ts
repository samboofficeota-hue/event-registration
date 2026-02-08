/**
 * スクリプト: 「セミナー運営システム」内の全コンテンツを master_folder に移行
 *
 * 1. 指定フォルダ（既定: GOOGLE_DRIVE_FOLDER_ID = セミナー運営システム）の直下のアイテム一覧を取得
 * 2. その中に "master_folder" を作成
 * 3. 取得した一覧の各アイテムを master_folder に移動
 *
 * 使い方:
 *   npx tsx scripts/move-to-master-folder.ts
 *   # または、フォルダIDを直接指定:
 *   npx tsx scripts/move-to-master-folder.ts <親フォルダID>
 *
 * 前提: .env.local に GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PRIVATE_KEY_ID を設定
 *       親フォルダIDは GOOGLE_DRIVE_FOLDER_ID または引数で指定
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import {
  createFolder,
  listChildren,
  moveFileToFolder,
} from "../src/lib/google/drive";

const MASTER_FOLDER_NAME = "master_folder";

async function main() {
  const parentFolderId =
    process.argv[2]?.trim() || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!parentFolderId) {
    console.error(
      "親フォルダIDを指定してください。\n" +
        "  .env.local に GOOGLE_DRIVE_FOLDER_ID を設定するか、\n" +
        "  引数で指定: npx tsx scripts/move-to-master-folder.ts <親フォルダID>"
    );
    process.exit(1);
  }

  console.log("📁 親フォルダ直下のアイテムを取得中...");
  const children = await listChildren(parentFolderId);

  if (children.length === 0) {
    console.log("   → 直下にアイテムがありません。終了します。");
    return;
  }

  console.log(`   → ${children.length} 件のアイテムを検出\n`);

  // 既に master_folder が存在するか確認
  const existingMaster = children.find(
    (f) => f.name === MASTER_FOLDER_NAME && f.mimeType?.includes("folder")
  );
  let masterFolderId: string;

  if (existingMaster) {
    console.log(`📂 "${MASTER_FOLDER_NAME}" は既に存在します (ID: ${existingMaster.id})`);
    masterFolderId = existingMaster.id;
    // 移動対象は master_folder 以外
  } else {
    console.log(`📂 "${MASTER_FOLDER_NAME}" を作成中...`);
    masterFolderId = await createFolder(parentFolderId, MASTER_FOLDER_NAME);
    console.log(`   → 作成しました (ID: ${masterFolderId})\n`);
  }

  const toMove = children.filter((f) => f.id !== masterFolderId);
  if (toMove.length === 0) {
    console.log("   → 移動するアイテムがありません。");
    return;
  }

  console.log(`📦 ${toMove.length} 件を "${MASTER_FOLDER_NAME}" に移動します...\n`);

  for (const item of toMove) {
    const typeLabel = item.mimeType?.includes("folder") ? "フォルダ" : "ファイル";
    process.stdout.write(`   ${typeLabel}: ${item.name} ... `);
    try {
      await moveFileToFolder(item.id, masterFolderId, parentFolderId);
      console.log("OK");
    } catch (err) {
      console.log("失敗");
      console.error("     ", err instanceof Error ? err.message : err);
    }
  }

  console.log("\n✅ 処理が完了しました。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
