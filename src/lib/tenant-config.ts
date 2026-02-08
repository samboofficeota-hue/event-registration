/**
 * テナント設定（4テナントをハードコード）。
 * 環境変数からマスタースプレッドシートID・DriveフォルダIDを取得する。
 */

export const TENANT_KEYS = [
  "whgc-seminars",
  "kgri-pic-center",
  "aff-events",
  "pic-courses",
] as const;

export type TenantKey = (typeof TENANT_KEYS)[number];

export interface TenantConfig {
  masterSpreadsheetId: string;
  driveFolderId: string;
}

function getEnvKey(tenant: string): TenantKey | null {
  if (TENANT_KEYS.includes(tenant as TenantKey)) return tenant as TenantKey;
  return null;
}

/**
 * テナントの設定を返す。未設定の場合は null。
 */
export function getTenantConfig(tenant: string): TenantConfig | null {
  const key = getEnvKey(tenant);
  if (!key) return null;

  const masterId =
    key === "whgc-seminars"
      ? process.env.TENANT_WHGC_SEMINARS_MASTER_SPREADSHEET_ID
      : key === "kgri-pic-center"
        ? process.env.TENANT_KGRI_PIC_CENTER_MASTER_SPREADSHEET_ID
        : key === "aff-events"
          ? process.env.TENANT_AFF_EVENTS_MASTER_SPREADSHEET_ID
          : key === "pic-courses"
            ? process.env.TENANT_PIC_COURSES_MASTER_SPREADSHEET_ID
            : undefined;

  const folderId =
    key === "whgc-seminars"
      ? process.env.TENANT_WHGC_SEMINARS_DRIVE_FOLDER_ID
      : key === "kgri-pic-center"
        ? process.env.TENANT_KGRI_PIC_CENTER_DRIVE_FOLDER_ID
        : key === "aff-events"
          ? process.env.TENANT_AFF_EVENTS_DRIVE_FOLDER_ID
          : key === "pic-courses"
            ? process.env.TENANT_PIC_COURSES_DRIVE_FOLDER_ID
            : undefined;

  if (!masterId) return null;
  return {
    masterSpreadsheetId: masterId,
    driveFolderId: folderId ?? "",
  };
}

export function isTenantKey(pathSegment: string): pathSegment is TenantKey {
  return TENANT_KEYS.includes(pathSegment as TenantKey);
}

/**
 * テナントの管理画面パスワードを返す。未設定の場合は null。
 */
export function getTenantAdminPassword(tenant: string): string | null {
  const key = getEnvKey(tenant);
  if (!key) return null;

  const password =
    key === "whgc-seminars"
      ? process.env.TENANT_WHGC_SEMINARS_ADMIN_PASSWORD
      : key === "kgri-pic-center"
        ? process.env.TENANT_KGRI_PIC_CENTER_ADMIN_PASSWORD
        : key === "aff-events"
          ? process.env.TENANT_AFF_EVENTS_ADMIN_PASSWORD
          : key === "pic-courses"
            ? process.env.TENANT_PIC_COURSES_ADMIN_PASSWORD
            : undefined;

  return password ?? null;
}

/** テナントの表示名（ログイン画面の選択肢用） */
export const TENANT_LABELS: Record<TenantKey, string> = {
  "whgc-seminars": "WHGC セミナー",
  "kgri-pic-center": "KGRI PIC センター",
  "aff-events": "AFF イベント",
  "pic-courses": "PIC コース",
};
