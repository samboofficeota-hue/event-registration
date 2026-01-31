import { NextRequest, NextResponse } from "next/server";
import { findMasterRowById, updateMasterRow, uploadImageToDrive } from "@/lib/google/sheets";

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
    const imageUrl = await uploadImageToDrive(fileName, buffer, file.type);

    // マスタースプレッドシートの P列（インデックス15）に画像URL を更新
    const now = new Date().toISOString();
    const updated = [...result.values];
    while (updated.length < 18) updated.push("");
    updated[15] = imageUrl;
    updated[17] = now;

    await updateMasterRow(result.rowIndex, updated);

    return NextResponse.json({ image_url: imageUrl });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json({ error: "画像のアップロードに失敗しました" }, { status: 500 });
  }
}
