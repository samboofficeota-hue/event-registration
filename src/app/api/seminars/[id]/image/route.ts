import { NextRequest, NextResponse } from "next/server";
import {
  findMasterRowById,
  updateMasterRow,
  uploadImageToDrive,
  findRowById,
  updateRow
} from "@/lib/google/sheets";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await findMasterRowById(id);

    if (!result) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const formData = await request.formData();
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
    const imageUrl = await uploadImageToDrive(fileName, buffer, file.type);
    console.log("[Image Upload] Upload successful, URL:", imageUrl);

    const now = new Date().toISOString();
    const individualSpreadsheetId = result.values[11]; // L列: spreadsheet_id

    // 1. マスタースプレッドシートの P列（インデックス15）に画像URL を更新
    console.log("[Image Upload] Updating master spreadsheet...");
    console.log("[Image Upload] Original row values length:", result.values.length);

    const updatedMaster = [...result.values];
    while (updatedMaster.length < 18) updatedMaster.push("");
    updatedMaster[15] = imageUrl;  // P列
    updatedMaster[17] = now;        // R列

    console.log("[Image Upload] Master P列 (index 15):", updatedMaster[15]);
    console.log("[Image Upload] Master R列 (index 17):", updatedMaster[17]);

    await updateMasterRow(result.rowIndex, updatedMaster);
    console.log("[Image Upload] Master spreadsheet update successful");

    // 2. 個別イベントスプレッドシートの「イベント情報」シートも更新
    if (individualSpreadsheetId) {
      console.log("[Image Upload] Updating individual spreadsheet:", individualSpreadsheetId);

      const individualResult = await findRowById(individualSpreadsheetId, "イベント情報", id);
      if (individualResult) {
        const updatedIndividual = [...individualResult.values];
        while (updatedIndividual.length < 18) updatedIndividual.push("");
        updatedIndividual[15] = imageUrl;  // P列
        updatedIndividual[17] = now;        // R列

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
