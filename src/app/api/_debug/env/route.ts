import { NextResponse } from "next/server";

/**
 * 一時用デバッグエンドポイント
 * 環境変数が読めているか確認するためのもの。
 * 確認後に削除してください。
 */
export async function GET() {
  return NextResponse.json({
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? "SET" : "UNDEFINED",
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET ? "SET" : "UNDEFINED",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "SET" : "UNDEFINED",
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? "SET" : "UNDEFINED",
    GOOGLE_PRIVATE_KEY_ID: process.env.GOOGLE_PRIVATE_KEY_ID ? "SET" : "UNDEFINED",
    GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID ? "SET" : "UNDEFINED",
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID ? "SET" : "UNDEFINED",
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID ? "SET" : "UNDEFINED",
    GOOGLE_IMPERSONATE_EMAIL: process.env.GOOGLE_IMPERSONATE_EMAIL ? "SET" : "UNDEFINED",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "UNDEFINED",
  });
}
