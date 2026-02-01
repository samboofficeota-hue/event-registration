import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getMasterData,
  appendMasterRow,
  createSeminarSpreadsheet,
  appendRow,
} from "@/lib/google/sheets";
import { createCalendarEvent } from "@/lib/google/calendar";
import { rowToSeminar } from "@/lib/seminars";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const rows = await getMasterData();
    let seminars = rows.slice(1).filter((row) => row[0]?.trim()).map(rowToSeminar);

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
    const {
      title,
      description,
      date,
      duration_minutes,
      capacity,
      speaker,
      speaker_title,
      format,
      target,
      status,
    } = body;

    if (!title || !date || !speaker) {
      return NextResponse.json(
        { error: "必須項目（タイトル・日時・登壇者）が不足しています" },
        { status: 400 }
      );
    }
    const duration = Number(duration_minutes) || 60;
    const cap = Number(capacity) || 100;

    // 1. Google Calendar イベント作成 + Meet URL 生成
    let meetUrl = "";
    let calendarEventId = "";
    try {
      const calEvent = await createCalendarEvent(title, date, duration, description);
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

    const formatVal = ["venue", "online", "hybrid"].includes(format) ? format : "online";
    const targetVal = ["members_only", "public"].includes(target) ? target : "public";

    // 3. セミナー専用スプレッドシートの「イベント情報」シートにも書き込む
    const now = new Date().toISOString();
    const id = uuidv4();
    try {
      await appendRow(spreadsheetId, "イベント情報", [
        id,
        title,
        description || "",
        date,
        String(duration),
        String(cap),
        "0",
        speaker || "",
        speaker_title || "",
        formatVal,
        targetVal,
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
      String(duration),
      String(cap),
      "0",
      speaker || "",
      meetUrl,
      calendarEventId,
      status || "draft",
      spreadsheetId,
      speaker_title || "",
      formatVal,
      targetVal,
      "",        // image_url（画像登録時に更新）
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
