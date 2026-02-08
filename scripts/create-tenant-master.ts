/**
 * スクリプト: テナント用の予約管理マスターを新規作成
 *
 * 指定テナント用のマスタースプレッドシートを新規作成し、
 * シート「セミナー一覧」「会員企業ドメイン」「予約番号インデックス」とヘッダー行を設定する。
 * テナントの Drive フォルダIDが環境変数に設定されていれば、そのフォルダに配置する。
 *
 * 使い方:
 *   npx tsx scripts/create-tenant-master.ts whgc-seminars
 *   npx tsx scripts/create-tenant-master.ts kgri-pic-center
 *   npx tsx scripts/create-tenant-master.ts aff-events
 *   npx tsx scripts/create-tenant-master.ts pic-courses
 *
 * 前提: .env.local に Google API 認証情報を設定
 *       テナントの Drive フォルダIDは TENANT_*_DRIVE_FOLDER_ID（任意）
 *
 * 作成後: 表示されたスプレッドシートIDを環境変数 TENANT_*_MASTER_SPREADSHEET_ID に設定する。
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createTenantMasterSpreadsheet } from "../src/lib/google/sheets";
import { TENANT_KEYS, isTenantKey } from "../src/lib/tenant-config";

const envKeyForMaster: Record<string, string> = {
  "whgc-seminars": "TENANT_WHGC_SEMINARS_MASTER_SPREADSHEET_ID",
  "kgri-pic-center": "TENANT_KGRI_PIC_CENTER_MASTER_SPREADSHEET_ID",
  "aff-events": "TENANT_AFF_EVENTS_MASTER_SPREADSHEET_ID",
  "pic-courses": "TENANT_PIC_COURSES_MASTER_SPREADSHEET_ID",
};

const envKeyForFolder: Record<string, string> = {
  "whgc-seminars": "TENANT_WHGC_SEMINARS_DRIVE_FOLDER_ID",
  "kgri-pic-center": "TENANT_KGRI_PIC_CENTER_DRIVE_FOLDER_ID",
  "aff-events": "TENANT_AFF_EVENTS_DRIVE_FOLDER_ID",
  "pic-courses": "TENANT_PIC_COURSES_DRIVE_FOLDER_ID",
};

async function main() {
  const tenant = process.argv[2]?.trim();

  if (!tenant || !isTenantKey(tenant)) {
    console.error(
      "テナントを指定してください。\n" +
        `  有効な値: ${TENANT_KEYS.join(", ")}\n` +
        "  例: npx tsx scripts/create-tenant-master.ts whgc-seminars"
    );
    process.exit(1);
  }

  const driveFolderId = process.env[envKeyForFolder[tenant]]?.trim() || undefined;

  console.log(`📋 テナント「${tenant}」用の予約管理マスターを作成中...`);
  if (driveFolderId) {
    console.log(`   Drive フォルダに配置: ${driveFolderId}`);
  } else {
    console.log("   Drive フォルダ未設定のため、マイドライブ直下に作成します。");
  }

  const spreadsheetId = await createTenantMasterSpreadsheet(tenant, driveFolderId);

  console.log("\n✅ 作成が完了しました。\n");
  console.log("スプレッドシートID（環境変数に設定してください）:\n");
  const envKey = envKeyForMaster[tenant];
  console.log(`  ${envKey}=${spreadsheetId}`);
  console.log("\nURL: https://docs.google.com/spreadsheets/d/" + spreadsheetId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
