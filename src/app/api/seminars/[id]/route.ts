import { NextRequest, NextResponse } from "next/server";
import { findMasterRowById, updateMasterRow } from "@/lib/google/sheets";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import type { Seminar } from "@/lib/types";

// マスタースプレッドシート列順: A~R (id ~ updated_at、M:肩書き N:開催形式 O:対象 P:Googleカレンダー)

function rowToSeminar(row: string[]): Seminar {
  const isNewLayout = row.length >= 18;
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
    speaker_title: isNewLayout ? row[12] || "" : "",
    format: (isNewLayout ? row[13] : "online") as Seminar["format"],
    target: (isNewLayout ? row[14] : "public") as Seminar["target"],
    calendar_link: isNewLayout ? row[15] || "" : "",
    created_at: isNewLayout ? row[16] || "" : row[12] || "",
    updated_at: isNewLayout ? row[17] || "" : row[13] || "",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await findMasterRowById(id);

    if (!result) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    return NextResponse.json(rowToSeminar(result.values));
  } catch (error) {
    console.error("Error fetching seminar:", error);
    return NextResponse.json({ error: "セミナーの取得に失敗しました" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await findMasterRowById(id);

    if (!result) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const current = rowToSeminar(result.values);
    const now = new Date().toISOString();

    const updated: string[] = [
      id,
      body.title ?? current.title,
      body.description ?? current.description,
      body.date ?? current.date,
      String(body.duration_minutes ?? current.duration_minutes),
      String(body.capacity ?? current.capacity),
      String(current.current_bookings),
      body.speaker ?? current.speaker,
      body.meet_url ?? current.meet_url,
      current.calendar_event_id,
      body.status ?? current.status,
      current.spreadsheet_id,
      body.speaker_title ?? current.speaker_title,
      body.format ?? current.format,
      body.target ?? current.target,
      body.calendar_link ?? current.calendar_link,
      current.created_at,
      now,
    ];

    // Calendar イベント更新
    if (current.calendar_event_id && (body.date || body.title || body.duration_minutes)) {
      try {
        await updateCalendarEvent(
          current.calendar_event_id,
          body.title ?? current.title,
          body.date ?? current.date,
          body.duration_minutes ?? current.duration_minutes,
          body.description ?? current.description
        );
      } catch (calError) {
        console.error("Calendar update failed:", calError);
      }
    }

    await updateMasterRow(result.rowIndex, updated);

    return NextResponse.json(rowToSeminar(updated));
  } catch (error) {
    console.error("Error updating seminar:", error);
    return NextResponse.json({ error: "セミナーの更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await findMasterRowById(id);

    if (!result) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const current = rowToSeminar(result.values);
    const now = new Date().toISOString();

    // 論理削除: status を cancelled に変更
    const updated = [...result.values];
    while (updated.length < 18) updated.push("");
    updated[10] = "cancelled";
    updated[17] = now;

    await updateMasterRow(result.rowIndex, updated);

    if (current.calendar_event_id) {
      try {
        await deleteCalendarEvent(current.calendar_event_id);
      } catch (calError) {
        console.error("Calendar delete failed:", calError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting seminar:", error);
    return NextResponse.json({ error: "セミナーの削除に失敗しました" }, { status: 500 });
  }
}
