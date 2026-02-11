import { NextRequest, NextResponse } from "next/server";
import {
  findMasterRowById,
  findMasterRowByIdForTenant,
  updateMasterRow,
  updateMasterRowForTenant,
  findRowById,
  updateRow,
  ensureSeminarSpreadsheetHeaders,
} from "@/lib/google/sheets";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import { rowToSeminar } from "@/lib/seminars";
import { isTenantKey } from "@/lib/tenant-config";

async function resolveMasterRow(
  id: string,
  tenant?: string | null
): Promise<{ rowIndex: number; values: string[] } | null> {
  if (tenant && isTenantKey(tenant)) {
    return findMasterRowByIdForTenant(tenant, id);
  }
  return findMasterRowById(id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = new URL(request.url).searchParams.get("tenant");
    const result = await resolveMasterRow(id, tenant);

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
    const tenant = body.tenant && isTenantKey(body.tenant) ? body.tenant : null;
    const result = await resolveMasterRow(id, tenant);

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
      body.end_time ?? current.end_time,
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
      (body.invitation_code ?? current.invitation_code ?? "").trim(),
      current.image_url,
      current.created_at,
      now,
      body.speaker_reference_url ?? current.speaker_reference_url ?? "",
    ];

    // Calendar イベント更新
    if (current.calendar_event_id && (body.date || body.title || body.end_time)) {
      try {
        await updateCalendarEvent(
          current.calendar_event_id,
          body.title ?? current.title,
          body.date ?? current.date,
          body.end_time ?? current.end_time,
          body.description ?? current.description
        );
      } catch (calError) {
        console.error("Calendar update failed:", calError);
      }
    }

    if (tenant) {
      await updateMasterRowForTenant(tenant, result.rowIndex, updated);
    } else {
      await updateMasterRow(result.rowIndex, updated);
    }

    // 個別イベントスプレッドシートの「イベント情報」シートも更新
    if (current.spreadsheet_id) {
      try {
        // ヘッダーを最新形式に自動修正
        await ensureSeminarSpreadsheetHeaders(current.spreadsheet_id);
        const individualResult = await findRowById(current.spreadsheet_id, "イベント情報", id);
        if (individualResult) {
          await updateRow(current.spreadsheet_id, "イベント情報", individualResult.rowIndex, updated);
          console.log("[Seminar Update] Individual spreadsheet synced");
        }
      } catch (err) {
        console.error("[Seminar Update] Failed to sync individual spreadsheet:", err);
      }
    }

    return NextResponse.json(rowToSeminar(updated));
  } catch (error) {
    console.error("Error updating seminar:", error);
    return NextResponse.json({ error: "セミナーの更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    let tenant: string | null = url.searchParams.get("tenant");
    if (!tenant || !isTenantKey(tenant)) {
      try {
        const body = await request.json();
        tenant = body.tenant && isTenantKey(body.tenant) ? body.tenant : null;
      } catch {
        tenant = null;
      }
    }
    const result = await resolveMasterRow(id, tenant);

    if (!result) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const current = rowToSeminar(result.values);
    const now = new Date().toISOString();

    // 論理削除: status を cancelled に変更
    const updated = [...result.values];
    while (updated.length < 20) updated.push("");
    updated[10] = "cancelled";
    updated[18] = now;

    if (tenant) {
      await updateMasterRowForTenant(tenant, result.rowIndex, updated);
    } else {
      await updateMasterRow(result.rowIndex, updated);
    }

    // 個別イベントスプレッドシートの「イベント情報」シートも更新
    if (current.spreadsheet_id) {
      try {
        const individualResult = await findRowById(current.spreadsheet_id, "イベント情報", id);
        if (individualResult) {
          const updatedIndividual = [...individualResult.values];
          while (updatedIndividual.length < 20) updatedIndividual.push("");
          updatedIndividual[10] = "cancelled";
          updatedIndividual[18] = now;
          await updateRow(current.spreadsheet_id, "イベント情報", individualResult.rowIndex, updatedIndividual);
          console.log("[Seminar Delete] Individual spreadsheet synced");
        }
      } catch (err) {
        console.error("[Seminar Delete] Failed to sync individual spreadsheet:", err);
      }
    }

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
