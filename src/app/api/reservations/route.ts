import { NextRequest, NextResponse } from "next/server";
import { getSheetData } from "@/lib/google/sheets";
import type { Reservation } from "@/lib/types";

// 予約情報シート列順: ... K:備考 L:予約番号 M:参加方法（13列目）

function rowToReservation(row: string[]): Reservation {
  const participation = row[12]?.trim();
  return {
    id: row[0] || "",
    name: row[1] || "",
    email: row[2] || "",
    company: row[3] || "",
    department: row[4] || "",
    phone: row[5] || "",
    status: (row[6] as Reservation["status"]) || "confirmed",
    pre_survey_completed: row[7] === "TRUE",
    post_survey_completed: row[8] === "TRUE",
    created_at: row[9] || "",
    note: row[10] || "",
    reservation_number: row[11] || undefined,
    participation_method: participation === "venue" || participation === "online" ? participation : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheet_id");

    if (!spreadsheetId) {
      return NextResponse.json({ error: "spreadsheet_id が必要です" }, { status: 400 });
    }

    const rows = await getSheetData(spreadsheetId, "予約情報");
    const reservations = rows.slice(1).map(rowToReservation);

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return NextResponse.json({ error: "予約一覧の取得に失敗しました" }, { status: 500 });
  }
}
