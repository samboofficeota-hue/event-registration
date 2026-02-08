/**
 * Google Drive API: フォルダ作成・一覧・ファイル移動
 */

import { getAccessToken } from "./auth";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

/**
 * 指定フォルダ内に新しいフォルダを作成する。
 * @param parentFolderId 親フォルダのID
 * @param folderName 作成するフォルダ名
 * @returns 作成されたフォルダのID
 */
export async function createFolder(
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(DRIVE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`フォルダの作成に失敗しました: ${error}`);
  }

  const data = await response.json();
  return data.id as string;
}

/**
 * 指定フォルダ直下のファイル・フォルダ一覧を取得する。
 * @param folderId フォルダID
 * @returns 直下のアイテム一覧（名前・ID・mimeType 等）
 */
export async function listChildren(folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken();
  const q = `'${folderId}' in parents`;
  const params = new URLSearchParams({
    q,
    fields: "files(id, name, mimeType, parents)",
    pageSize: "1000",
  });

  const response = await fetch(`${DRIVE_API}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`一覧の取得に失敗しました: ${error}`);
  }

  const data = await response.json();
  return (data.files || []) as DriveFile[];
}

/**
 * ファイルまたはフォルダを別のフォルダに移動する（元の親からは削除）。
 * @param fileId 移動するファイル/フォルダのID
 * @param newParentFolderId 移動先フォルダのID
 * @param previousParentId 現在の親フォルダID（removeParents に使用）
 */
export async function moveFileToFolder(
  fileId: string,
  newParentFolderId: string,
  previousParentId: string
): Promise<void> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    addParents: newParentFolderId,
    removeParents: previousParentId,
  });

  const response = await fetch(`${DRIVE_API}/${fileId}?${params.toString()}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`移動に失敗しました (${fileId}): ${error}`);
  }
}
