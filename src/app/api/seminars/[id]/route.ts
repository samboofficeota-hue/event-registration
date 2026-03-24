import { NextRequest, NextResponse } from "next/server";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import { d1SeminarToSeminar } from "@/lib/seminars";
import { isTenantKey } from "@/lib/tenant-config";
import { verifyAdminRequest } from "@/lib/auth";
import { generateEmailSchedules } from "@/lib/email/generate-schedules";
import {
  getSeminarByIdFromD1,
  updateSeminarInD1,
  type D1Seminar,
} from "@/lib/d1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await getSeminarByIdFromD1(id);

    if (!row) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const seminar = d1SeminarToSeminar(row);
    const isAdmin = await verifyAdminRequest(request);
    if (!isAdmin) {
      seminar.invitation_code = "";
    }
    return NextResponse.json(seminar);
  } catch (error) {
    console.error("Error fetching seminar:", error);
    return NextResponse.json({ error: "セミナーの取得に失敗しました" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();

    const current = await getSeminarByIdFromD1(id);
    if (!current) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates: Partial<D1Seminar> = {
      title: body.title ?? current.title,
      description: body.description ?? current.description,
      date: body.date ?? current.date,
      end_time: body.end_time ?? current.end_time,
      capacity: body.capacity != null ? Number(body.capacity) : current.capacity,
      speaker: body.speaker ?? current.speaker,
      speaker_title: body.speaker_title ?? current.speaker_title,
      speaker_reference_url: body.speaker_reference_url ?? current.speaker_reference_url,
      format: body.format ?? current.format,
      target: body.target ?? current.target,
      invitation_code: body.invitation_code != null
        ? body.invitation_code.trim()
        : current.invitation_code,
      status: body.status ?? current.status,
      meet_url: body.meet_url ?? current.meet_url,
      updated_at: now,
    };

    // Calendar イベント更新
    if (current.calendar_event_id && (body.date || body.title || body.end_time)) {
      try {
        await updateCalendarEvent(
          current.calendar_event_id,
          updates.title!,
          updates.date!,
          updates.end_time!,
          updates.description!
        );
      } catch (calError) {
        console.error("Calendar update failed:", calError);
      }
    }

    await updateSeminarInD1(id, updates);

    // メール配信スケジュールの日付を自動再計算
    const newDate = body.date ?? current.date;
    if (newDate) {
      generateEmailSchedules(id, newDate).catch(() => {});
    }

    const updated = { ...current, ...updates };
    return NextResponse.json(d1SeminarToSeminar(updated as D1Seminar));
  } catch (error) {
    console.error("Error updating seminar:", error);
    return NextResponse.json({ error: "セミナーの更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const current = await getSeminarByIdFromD1(id);

    if (!current) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // 論理削除: status を cancelled に変更
    await updateSeminarInD1(id, { status: "cancelled", updated_at: now });

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
