"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Seminar } from "@/lib/types";
import type { EmailSchedule, EmailSendLog } from "@/lib/d1";
import { Megaphone, Users, RefreshCw } from "lucide-react";

const TENANT = "whgc-seminars";
const ADMIN_BASE = "/whgc-seminars/manage-console";

// ─── ラベル定義 ────────────────────────────────────────────
const ANNOUNCE_TEMPLATE_IDS = ["announce_30", "announce_14", "announce_7"];
const REGISTRANT_TEMPLATE_IDS = ["reminder_30", "reminder_7", "reminder_1", "followup_1"];

const TEMPLATE_LABELS: Record<string, string> = {
  // 【告知集客用】
  announce_30: "30日前告知",
  announce_14: "2週間前告知",
  announce_7:  "1週間前告知",
  // 【予約者向け】
  reminder_30: "2週間前リマインド",
  reminder_7:  "7日前リマインド",
  reminder_1:  "前日リマインド",
  followup_1:  "御礼・アンケート",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: "未送信", variant: "outline" },
  sent:      { label: "送信済", variant: "default" },
  failed:    { label: "失敗", variant: "destructive" },
  cancelled: { label: "キャンセル", variant: "secondary" },
};

interface NewsletterList { id: string; name: string; preview_count: number; }

// ─── スケジュール行 ────────────────────────────────────────
function ScheduleRow({
  schedule,
  onToggle,
  onSend,
  onSaveEdit,
  sendingId,
}: {
  schedule: EmailSchedule;
  onToggle: (s: EmailSchedule) => void;
  onSend: (s: EmailSchedule) => void;
  onSaveEdit: (scheduleId: number, values: { scheduled_date: string; send_time: string }) => void;
  sendingId: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    scheduled_date: schedule.scheduled_date,
    send_time: schedule.send_time,
  });

  const status = STATUS_BADGE[schedule.status] ?? STATUS_BADGE.pending;
  const isSent = schedule.status === "sent";

  return (
    <div className={`rounded-lg border border-border bg-muted/20 p-4 space-y-3 ${!schedule.enabled && !isSent ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {TEMPLATE_LABELS[schedule.template_id] ?? schedule.template_id}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {!isSent && (
            <button
              onClick={() => onToggle(schedule)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${schedule.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
              title={schedule.enabled ? "無効にする" : "有効にする"}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${schedule.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">送信日</Label>
            <Input type="date" value={editValues.scheduled_date}
              onChange={(e) => setEditValues((v) => ({ ...v, scheduled_date: e.target.value }))}
              className="h-8 text-sm w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">送信時刻</Label>
            <Input type="time" value={editValues.send_time}
              onChange={(e) => setEditValues((v) => ({ ...v, send_time: e.target.value }))}
              className="h-8 text-sm w-28" />
          </div>
          <Button size="sm" onClick={() => { onSaveEdit(schedule.id, editValues); setEditing(false); }}>保存</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            送信予定：
            <span className="font-medium text-foreground ml-1">
              {schedule.scheduled_date} {schedule.send_time}
            </span>
            {schedule.sent_at && (
              <span className="ml-2 text-xs">（送信済：{new Date(schedule.sent_at).toLocaleString("ja-JP")}）</span>
            )}
          </p>
          {!isSent && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>日時変更</Button>
              <Button size="sm" disabled={!schedule.enabled || sendingId === schedule.id} onClick={() => onSend(schedule)}>
                {sendingId === schedule.id ? "送信中..." : "今すぐ送信"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────
export default function WhgcSeminarEmailSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [schedules, setSchedules] = useState<EmailSchedule[]>([]);
  const [logs, setLogs] = useState<EmailSendLog[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  // ニュースレターリスト（告知集客用）
  const [lists, setLists] = useState<NewsletterList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [savingList, setSavingList] = useState(false);

  const loadSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/seminars/${id}/email-schedules`);
      if (res.ok) {
        const data: EmailSchedule[] = await res.json();
        setSchedules(data);
        // 既存の list_id を復元
        const withList = data.find(s => ANNOUNCE_TEMPLATE_IDS.includes(s.template_id) && s.list_id);
        if (withList?.list_id) setSelectedListId(withList.list_id);
      }
    } catch { /* 未生成 */ }
  }, [id]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/seminars/${id}/email-send-logs`);
      if (res.ok) setLogs(await res.json());
    } catch { /* ログなし */ }
  }, [id]);

  useEffect(() => {
    fetch(`/api/seminars/${id}?tenant=${TENANT}`).then(r => r.json()).then(setSeminar);
    loadSchedules();
    loadLogs();
    fetch("/api/newsletter/lists").then(r => r.json()).then(d => setLists(Array.isArray(d) ? d : []));
  }, [id, loadSchedules, loadLogs]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/seminars/${id}/email-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: TENANT }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await loadSchedules();
      toast.success("スケジュールを生成しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleEnabled(schedule: EmailSchedule) {
    try {
      const res = await fetch(`/api/seminars/${id}/email-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: EmailSchedule = await res.json();
      setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  async function handleSaveEdit(scheduleId: number, values: { scheduled_date: string; send_time: string }) {
    try {
      const res = await fetch(`/api/seminars/${id}/email-schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: EmailSchedule = await res.json();
      setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success("送信日時を更新しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  async function handleSend(schedule: EmailSchedule) {
    if (!confirm(`「${TEMPLATE_LABELS[schedule.template_id]}」を今すぐ送信しますか？`)) return;
    setSendingId(schedule.id);
    try {
      const res = await fetch(`/api/email-schedules/${schedule.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: TENANT }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`送信完了：${data.sent}件 成功 / ${data.failed}件 失敗`);
      await loadSchedules();
      await loadLogs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSendingId(null);
    }
  }

  // 告知集客用スケジュール全件に list_id を保存
  async function handleSaveListId() {
    if (!selectedListId) { toast.error("リストを選択してください"); return; }
    const announceSchedules = schedules.filter(s => ANNOUNCE_TEMPLATE_IDS.includes(s.template_id));
    if (announceSchedules.length === 0) { toast.error("告知集客用スケジュールを先に生成してください"); return; }
    setSavingList(true);
    try {
      await Promise.all(announceSchedules.map(s =>
        fetch(`/api/seminars/${id}/email-schedules/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ list_id: selectedListId }),
        })
      ));
      await loadSchedules();
      toast.success("送付リストを保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSavingList(false);
    }
  }

  const announceSchedules = schedules.filter(s => ANNOUNCE_TEMPLATE_IDS.includes(s.template_id));
  const registrantSchedules = schedules.filter(s => REGISTRANT_TEMPLATE_IDS.includes(s.template_id));
  const hasSchedules = schedules.length > 0;
  const savedListName = lists.find(l => {
    const s = schedules.find(sc => ANNOUNCE_TEMPLATE_IDS.includes(sc.template_id) && sc.list_id);
    return s && l.id === s.list_id;
  })?.name;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">メール配信設定</h1>
          {seminar && <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{seminar.title}</p>}
        </div>
        <Button variant="outline" onClick={() => router.push(`${ADMIN_BASE}/seminars/${id}/edit`)}>
          セミナー編集へ
        </Button>
      </div>

      {/* スケジュール未生成 */}
      {!hasSchedules && (
        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                スケジュールがまだ生成されていません。<br />
                セミナーの開催日から自動計算して生成します。
              </p>
              <Button onClick={handleGenerate} disabled={generating || !seminar?.date}>
                {generating ? "生成中..." : "スケジュールを生成する"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasSchedules && (
        <>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="gap-1.5">
              <RefreshCw className={`size-3.5 ${generating ? "animate-spin" : ""}`} />
              {generating ? "更新中..." : "日付を再計算"}
            </Button>
          </div>

          {/* ─── 【告知集客用】 ─── */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Megaphone className="size-4 text-orange-500" />
                【告知集客用】
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 送付リスト選択 */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <label className="text-xs font-medium text-muted-foreground">送付リスト</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">-- リストを選択 --</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}（{l.preview_count.toLocaleString()}件）
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleSaveListId} disabled={savingList || !selectedListId}>
                    {savingList ? "保存中..." : "保存"}
                  </Button>
                </div>
                {savedListName && (
                  <p className="text-xs text-muted-foreground">
                    現在の設定：<span className="font-medium text-foreground">{savedListName}</span>
                  </p>
                )}
              </div>

              {/* 告知スケジュール */}
              <div className="space-y-2">
                {announceSchedules.map((schedule) => (
                  <ScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    onToggle={handleToggleEnabled}
                    onSend={handleSend}
                    onSaveEdit={handleSaveEdit}
                    sendingId={sendingId}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── 【予約者向け】 ─── */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Users className="size-4 text-blue-500" />
                【予約者向け】
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {registrantSchedules.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  onToggle={handleToggleEnabled}
                  onSend={handleSend}
                  onSaveEdit={handleSaveEdit}
                  sendingId={sendingId}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── 送信ログ ─── */}
      {logs.length > 0 && (
        <Card className="border border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">送信ログ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">送信日時</th>
                    <th className="pb-2 pr-4 font-medium">テンプレート</th>
                    <th className="pb-2 pr-4 font-medium">宛先</th>
                    <th className="pb-2 font-medium">結果</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const schedule = schedules.find(s => s.id === log.schedule_id);
                    return (
                      <tr key={log.id}>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(log.sent_at).toLocaleString("ja-JP")}
                        </td>
                        <td className="py-2 pr-4">
                          {schedule ? TEMPLATE_LABELS[schedule.template_id] : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {log.recipient_name}
                          <span className="ml-1 text-muted-foreground">&lt;{log.recipient_email}&gt;</span>
                        </td>
                        <td className="py-2">
                          <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                            {log.status === "sent" ? "成功" : "失敗"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
