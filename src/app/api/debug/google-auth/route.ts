import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google/auth";

export async function GET() {
  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    const info: Record<string, unknown> = {
      email_set: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key_set: !!privateKey,
      keyId_set: !!process.env.GOOGLE_PRIVATE_KEY_ID,
      key_length: privateKey?.length,
      key_starts_with: privateKey?.substring(0, 40),
      key_ends_with: privateKey?.substring((privateKey?.length || 0) - 30),
      key_has_literal_backslash_n: privateKey?.includes("\\n"),
      key_has_real_newline: privateKey?.includes("\n"),
    };

    const token = await getAccessToken();
    info.token_obtained = true;
    info.token_prefix = token.substring(0, 20) + "...";

    return NextResponse.json(info);
  } catch (error) {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        key_length: privateKey?.length,
        key_starts_with: privateKey?.substring(0, 50),
        key_ends_with: privateKey?.substring((privateKey?.length || 0) - 40),
        key_has_literal_backslash_n: privateKey?.includes("\\n"),
        key_has_real_newline: privateKey?.includes("\n"),
        key_line_count: privateKey?.split("\n").length,
      },
      { status: 500 }
    );
  }
}
