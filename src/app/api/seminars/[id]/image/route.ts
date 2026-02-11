import { NextRequest, NextResponse } from "next/server";
import {
  findMasterRowById,
  findMasterRowByIdForTenant,
  updateMasterRow,
  updateMasterRowForTenant,
  uploadImageToDrive,
  findRowById,
  updateRow
} from "@/lib/google/sheets";
import { getTenantConfig, isTenantKey } from "@/lib/tenant-config";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const tenantParam = formData.get("tenant") as string | null;
    const tenantKey = tenantParam && isTenantKey(tenantParam) ? tenantParam : undefined;
    const tenantConfig = tenantKey ? getTenantConfig(tenantKey) : null;

    const result = tenantKey
      ? await findMasterRowByIdForTenant(tenantKey, id)
      : await findMasterRowById(id);

    if (!result) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "画像ファイルが見つかりません" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "許可されているファイル形式: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは5MB以内にしてください" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const fileName = `seminar_${id}_${Date.now()}.${file.name.split(".").pop()}`;

    console.log("[Image Upload] Uploading file:", fileName);
    const imageUrl = await uploadImageToDrive(
      fileName,
      buffer,
      file.type,
      tenantConfig?.driveImagesFolderId || undefined
    );
    console.log("[Image Upload] Upload successful, URL:", imageUrl);

    const now = new Date().toISOString();
    const individualSpreadsheetId = result.values[11]; // L列: spreadsheet_id

    // 1. マスタースプレッドシートの Q列（インデックス16）に画像URL を更新
    //    列順: ... P(15):招待コード Q(16):画像URL R(17):作成日時 S(18):更新日時 T(19):参考URL
    console.log("[Image Upload] Updating master spreadsheet...");

    const updatedMaster = [...result.values];
    while (updatedMaster.length < 20) updatedMaster.push("");
    updatedMaster[16] = imageUrl;  // Q列: 画像URL
    updatedMaster[18] = now;        // S列: 更新日時

    if (tenantKey) {
      await updateMasterRowForTenant(tenantKey, result.rowIndex, updatedMaster);
    } else {
      await updateMasterRow(result.rowIndex, updatedMaster);
    }
    console.log("[Image Upload] Master spreadsheet update successful");

    // 2. 個別イベントスプレッドシートの「イベント情報」シートも更新
    if (individualSpreadsheetId) {
      console.log("[Image Upload] Updating individual spreadsheet:", individualSpreadsheetId);

      const individualResult = await findRowById(individualSpreadsheetId, "イベント情報", id);
      if (individualResult) {
        const updatedIndividual = [...individualResult.values];
        while (updatedIndividual.length < 20) updatedIndividual.push("");
        updatedIndividual[16] = imageUrl;  // Q列: 画像URL
        updatedIndividual[18] = now;        // S列: 更新日時

        await updateRow(individualSpreadsheetId, "イベント情報", individualResult.rowIndex, updatedIndividual);
        console.log("[Image Upload] Individual spreadsheet update successful");
      } else {
        console.warn("[Image Upload] Individual spreadsheet row not found");
      }
    } else {
      console.warn("[Image Upload] No individual spreadsheet ID found");
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json({ error: "画像のアップロードに失敗しました" }, { status: 500 });
  }
}
