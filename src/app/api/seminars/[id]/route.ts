import { NextRequest, NextResponse } from "next/server";
import { findMasterRowById, updateMasterRow } from "@/lib/google/sheets";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import { rowToSeminar } from "@/lib/seminars";

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
      current.image_url,
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
