/**
 * スクリプト: 4テナント用フォルダを Google Drive 上に作成
 *
 * 指定した親フォルダ（例: セミナー運営システム）の直下に、
 * whgc-seminars, kgri-pic-center, aff-events, pic-courses の4フォルダを作成します。
 *
 * 使い方:
 *   npx tsx scripts/create-tenant-folders.ts
 *   # または、親フォルダIDを直接指定:
 *   npx tsx scripts/create-tenant-folders.ts <親フォルダID>
 *
 * 前提: .env.local に Google API 認証情報を設定
 *       親フォルダIDは GOOGLE_DRIVE_FOLDER_ID または引数で指定
 *
 * 作成後: 各フォルダのIDを環境変数 TENANT_*_DRIVE_FOLDER_ID に設定してください。
 *         Drive のフォルダを開き、URL の .../folders/<ID> からIDを確認できます。
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createFolder, listChildren } from "../src/lib/google/drive";

const TENANT_FOLDER_NAMES = [
  "whgc-seminars",
  "kgri-pic-center",
  "aff-events",
  "pic-courses",
] as const;

async function main() {
  const parentFolderId =
    process.argv[2]?.trim() || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!parentFolderId) {
    console.error(
      "親フォルダIDを指定してください。\n" +
        "  .env.local に GOOGLE_DRIVE_FOLDER_ID を設定するか、\n" +
        "  引数で指定: npx tsx scripts/create-tenant-folders.ts <親フォルダID>"
    );
    process.exit(1);
  }

  console.log("📁 親フォルダ直下の既存フォルダを確認中...");
  const existing = await listChildren(parentFolderId);
  const existingNames = new Set(existing.map((f) => f.name));

  const created: { name: string; id: string }[] = [];
  const skipped: string[] = [];

  for (const name of TENANT_FOLDER_NAMES) {
    if (existingNames.has(name)) {
      const folder = existing.find((f) => f.name === name);
      skipped.push(`${name} (既存 ID: ${folder?.id ?? "?"})`);
      continue;
    }
    console.log(`📂 "${name}" を作成中...`);
    const id = await createFolder(parentFolderId, name);
    created.push({ name, id });
    console.log(`   → ID: ${id}`);
  }

  console.log("\n--- 結果 ---");
  if (created.length > 0) {
    console.log("作成したフォルダ（環境変数に設定してください）:\n");
    const envKeyMap: Record<string, string> = {
      "whgc-seminars": "TENANT_WHGC_SEMINARS_DRIVE_FOLDER_ID",
      "kgri-pic-center": "TENANT_KGRI_PIC_CENTER_DRIVE_FOLDER_ID",
      "aff-events": "TENANT_AFF_EVENTS_DRIVE_FOLDER_ID",
      "pic-courses": "TENANT_PIC_COURSES_DRIVE_FOLDER_ID",
    };
    for (const { name, id } of created) {
      const envKey = envKeyMap[name] ?? `TENANT_${name.toUpperCase().replace(/-/g, "_")}_DRIVE_FOLDER_ID`;
      console.log(`  ${envKey}=${id}`);
    }
  }
  if (skipped.length > 0) {
    console.log("\n既に存在したためスキップ:", skipped.join(", "));
  }
  console.log("\n✅ 処理が完了しました。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
