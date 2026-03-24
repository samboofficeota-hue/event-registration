"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Seminar } from "@/lib/types";
import type { EmailSchedule, EmailSendLog } from "@/lib/d1";

const TEMPLATE_LABELS: Record<string, string> = {
  reminder_30: "30日前案内",
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

export default function SeminarEmailSchedulePage({
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ scheduled_date: string; send_time: string }>({
    scheduled_date: "",
    send_time: "",
  });

  useEffect(() => {
    fetch(`/api/seminars/${id}`)
      .then((r) => r.json())
      .then(setSeminar);
    loadSchedules();
    loadLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadSchedules() {
    try {
      const res = await fetch(`/api/seminars/${id}/email-schedules`);
      if (res.ok) setSchedules(await res.json());
    } catch {
      // 未生成の場合は空配列のまま
    }
  }

  async function loadLogs() {
    try {
      const res = await fetch(`/api/seminars/${id}/email-send-logs`);
      if (res.ok) setLogs(await res.json());
    } catch {
      // ログなし
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/seminars/${id}/email-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSchedules(await res.json());
      toast.success("スケジュールを生成しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleEnabled(schedule: EmailSchedule) {
    try {
      const res = await fetch(
        `/api/seminars/${id}/email-schedules/${schedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !schedule.enabled }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: EmailSchedule = await res.json();
      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  function startEdit(schedule: EmailSchedule) {
    setEditingId(schedule.id);
    setEditValues({
      scheduled_date: schedule.scheduled_date,
      send_time: schedule.send_time,
    });
  }

  async function handleSaveEdit(scheduleId: number) {
    try {
      const res = await fetch(
        `/api/seminars/${id}/email-schedules/${scheduleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editValues),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: EmailSchedule = await res.json();
      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingId(null);
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
        body: JSON.stringify({}),
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">メール配信設定</h1>
          {seminar && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{seminar.title}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => router.push(`/manage-console/seminars/${id}/edit`)}>
          セミナー編集へ
        </Button>
      </div>

      {/* スケジュール生成 */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">配信スケジュール</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                スケジュールがまだ生成されていません。<br />
                セミナーの開催日から自動計算して生成します。
              </p>
              <Button onClick={handleGenerate} disabled={generating || !seminar?.date}>
                {generating ? "生成中..." : "スケジュールを生成する"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
                  {generating ? "更新中..." : "日付を再計算"}
                </Button>
              </div>
              {schedules.map((schedule) => {
                const status = STATUS_BADGE[schedule.status] ?? STATUS_BADGE.pending;
                const isSent = schedule.status === "sent";
                const isEditing = editingId === schedule.id;

                return (
                  <div key={schedule.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-foreground">
                          {TEMPLATE_LABELS[schedule.template_id] ?? schedule.template_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {!isSent && (
                          <button
                            onClick={() => handleToggleEnabled(schedule)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              schedule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                            }`}
                            title={schedule.enabled ? "無効にする" : "有効にする"}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                schedule.enabled ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="flex items-end gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">送信日</Label>
                          <Input
                            type="date"
                            value={editValues.scheduled_date}
                            onChange={(e) => setEditValues((v) => ({ ...v, scheduled_date: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">送信時刻</Label>
                          <Input
                            type="time"
                            value={editValues.send_time}
                            onChange={(e) => setEditValues((v) => ({ ...v, send_time: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button size="sm" onClick={() => handleSaveEdit(schedule.id)}>保存</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>キャンセル</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          送信予定：
                          <span className="font-medium text-foreground ml-1">
                            {schedule.scheduled_date} {schedule.send_time}
                          </span>
                          {schedule.sent_at && (
                            <span className="ml-2 text-xs">
                              （送信済：{new Date(schedule.sent_at).toLocaleString("ja-JP")}）
                            </span>
                          )}
                        </p>
                        {!isSent && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(schedule)}
                            >
                              日時変更
                            </Button>
                            <Button
                              size="sm"
                              disabled={!schedule.enabled || sendingId === schedule.id}
                              onClick={() => handleSend(schedule)}
                            >
                              {sendingId === schedule.id ? "送信中..." : "今すぐ送信"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 送信ログ */}
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
                    const schedule = schedules.find((s) => s.id === log.schedule_id);
                    return (
                      <tr key={log.id} className="text-foreground">
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(log.sent_at).toLocaleString("ja-JP")}
                        </td>
                        <td className="py-2 pr-4">
                          {schedule ? TEMPLATE_LABELS[schedule.template_id] : "-"}
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
