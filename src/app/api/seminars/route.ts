import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getMasterData,
  appendMasterRow,
  createSeminarSpreadsheet,
  appendRow,
} from "@/lib/google/sheets";
import { createCalendarEvent } from "@/lib/google/calendar";
import type { Seminar } from "@/lib/types";

// マスタースプレッドシート「セミナー一覧」シートの列順:
// A:id B:title C:description D:date E:duration_minutes F:capacity
// G:current_bookings H:speaker I:meet_url J:calendar_event_id
// K:status L:spreadsheet_id M:created_at N:updated_at

function rowToSeminar(row: string[]): Seminar {
  return {
    id: row[0] || "",
    title: row[1] || "",
    description: row[2] || "",
    date: row[3] || "",
    duration_minutes: parseInt(row[4] || "0", 10),
    capacity: parseInt(row[5] || "0", 10),
    current_bookings: parseInt(row[6] || "0", 10),
    speaker: row[7] || "",
    meet_url: row[8] || "",
    calendar_event_id: row[9] || "",
    status: (row[10] as Seminar["status"]) || "draft",
    spreadsheet_id: row[11] || "",
    created_at: row[12] || "",
    updated_at: row[13] || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const rows = await getMasterData();
    let seminars = rows.slice(1).map(rowToSeminar);

    if (statusFilter) {
      seminars = seminars.filter((s) => s.status === statusFilter);
    }

    seminars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(seminars);
  } catch (error) {
    console.error("Error fetching seminars:", error);
    return NextResponse.json({ error: "セミナー一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, date, duration_minutes, capacity, speaker, status } = body;

    if (!title || !date || !duration_minutes || !capacity) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // 1. Google Calendar イベント作成 + Meet URL 生成
    let meetUrl = "";
    let calendarEventId = "";
    try {
      const calEvent = await createCalendarEvent(title, date, duration_minutes, description);
      meetUrl = calEvent.meetUrl;
      calendarEventId = calEvent.eventId;
    } catch (calError) {
      console.error("Calendar event creation failed:", calError);
    }

    // 2. セミナー専用スプレッドシートを自動作成
    let spreadsheetId = "";
    try {
      spreadsheetId = await createSeminarSpreadsheet(title);
    } catch (ssError) {
      console.error("Spreadsheet creation failed:", ssError);
      return NextResponse.json(
        { error: "セミナー用スプレッドシートの作成に失敗しました" },
        { status: 500 }
      );
    }

    // 3. セミナー専用スプレッドシートの「イベント情報」シートにも書き込む
    const now = new Date().toISOString();
    const id = uuidv4();
    try {
      await appendRow(spreadsheetId, "イベント情報", [
        id,
        title,
        description || "",
        date,
        String(duration_minutes),
        String(capacity),
        "0",
        speaker || "",
        meetUrl,
        calendarEventId,
        status || "draft",
        now,
      ]);
    } catch (err) {
      console.error("Failed to write event info:", err);
    }

    // 4. マスタースプレッドシートに登録
    const masterRow = [
      id,
      title,
      description || "",
      date,
      String(duration_minutes),
      String(capacity),
      "0",
      speaker || "",
      meetUrl,
      calendarEventId,
      status || "draft",
      spreadsheetId,
      now,
      now,
    ];

    await appendMasterRow(masterRow);

    return NextResponse.json(rowToSeminar(masterRow), { status: 201 });
  } catch (error) {
    console.error("Error creating seminar:", error);
    return NextResponse.json({ error: "セミナーの作成に失敗しました" }, { status: 500 });
  }
}
