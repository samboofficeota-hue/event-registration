"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { EmailSchedule } from "@/lib/d1";

const TENANT = "whgc-seminars";
const ADMIN_BASE = "/whgc-seminars/manage-console";

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

interface SeminarInfo {
  id: string;
  title: string;
  date: string;
  status: string;
}

interface SeminarGroup {
  seminar: SeminarInfo;
  schedules: EmailSchedule[];
}

interface TemplateModal {
  templateId: string | null;
  seminarId: string;
  subject: string;
  body: string;
  seminarVars: Record<string, string> | null;
  activeTab: "edit" | "preview";
  loading: boolean;
  saving: boolean;
}

function buildClientVars(seminar: Record<string, string>): Record<string, string> {
  const date = seminar.date ? new Date(seminar.date) : null;
  const dateStr = date
    ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${
        ["日", "月", "火", "水", "木", "金", "土"][date.getDay()]
      }) ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : "";
  const formatMap: Record<string, string> = {
    online: "オンライン",
    venue: "会場",
    hybrid: "ハイブリッド",
  };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    name: "（参加者名）",
    seminar_title: seminar.title ?? "",
    date: dateStr,
    format: formatMap[seminar.format ?? "online"] ?? "オンライン",
    speaker: seminar.speaker ?? "",
    description: seminar.description ?? "",
    meet_url_line: seminar.meet_url ? `Meet URL：${seminar.meet_url}` : "",
    registration_url: `${appUrl}/seminars/${seminar.id}`,
    survey_url: `${appUrl}/seminars/${seminar.id}/survey`,
    from_email: "",
  };
}

function renderPreview(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

const EMPTY_MODAL: TemplateModal = {
  templateId: null,
  seminarId: "",
  subject: "",
  body: "",
  seminarVars: null,
  activeTab: "edit",
  loading: false,
  saving: false,
};

export default function WhgcEmailSchedulesPage() {
  const [groups, setGroups] = useState<SeminarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("pending");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ scheduled_date: string; send_time: string }>({
    scheduled_date: "",
    send_time: "",
  });
  const [testSendId, setTestSendId] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [templateModal, setTemplateModal] = useState<TemplateModal>(EMPTY_MODAL);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const seminarsRes = await fetch(`/api/seminars?tenant=${TENANT}`);
      const seminars: SeminarInfo[] = await seminarsRes.json();

      const result: SeminarGroup[] = [];
      await Promise.all(
        seminars
          .filter((s) => s.status !== "cancelled")
          .map(async (seminar) => {
            try {
              const res = await fetch(`/api/seminars/${seminar.id}/email-schedules`);
              if (!res.ok) return;
              const schedules: EmailSchedule[] = await res.json();
              if (schedules.length > 0) result.push({ seminar, schedules });
            } catch {
              // スケジュール未設定はスキップ
            }
          })
      );

      result.sort((a, b) => new Date(b.seminar.date).getTime() - new Date(a.seminar.date).getTime());
      setGroups(result);
    } catch {
      toast.error("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function startEdit(schedule: EmailSchedule) {
    setEditingId(schedule.id);
    setTestSendId(null);
    setEditValues({ scheduled_date: schedule.scheduled_date, send_time: schedule.send_time });
  }

  function startTestSend(schedule: EmailSchedule) {
    setTestSendId(schedule.id);
    setEditingId(null);
    setTestEmail("");
  }

  async function openTemplateModal(templateId: string, seminarId: string) {
    setTemplateModal({ ...EMPTY_MODAL, templateId, seminarId, loading: true });
    try {
      const [templateRes, seminarRes] = await Promise.all([
        fetch(`/api/email-templates/${templateId}`),
        fetch(`/api/seminars/${seminarId}?tenant=${TENANT}`),
      ]);
      if (!templateRes.ok) throw new Error("テンプレートを取得できませんでした");
      const [templateData, seminarData] = await Promise.all([
        templateRes.json(),
        seminarRes.ok ? seminarRes.json() : null,
      ]);
      setTemplateModal((prev) => ({
        ...prev,
        subject: templateData.subject ?? "",
        body: templateData.body ?? "",
        seminarVars: seminarData ? buildClientVars(seminarData) : null,
        loading: false,
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "読み込みに失敗しました");
      setTemplateModal(EMPTY_MODAL);
    }
  }

  async function handleSaveTemplate() {
    if (!templateModal.templateId) return;
    setTemplateModal((prev) => ({ ...prev, saving: true }));
    try {
      const res = await fetch(`/api/email-templates/${templateModal.templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: templateModal.subject, body: templateModal.body }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("テンプレートを保存しました");
      setTemplateModal(EMPTY_MODAL);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
      setTemplateModal((prev) => ({ ...prev, saving: false }));
    }
  }

  async function handleSaveEdit(seminarId: string, scheduleId: number) {
    try {
      const res = await fetch(`/api/seminars/${seminarId}/email-schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: EmailSchedule = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.seminar.id === seminarId
            ? { ...g, schedules: g.schedules.map((s) => (s.id === updated.id ? updated : s)) }
            : g
        )
      );
      setEditingId(null);
      toast.success("送信日時を更新しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  async function handleToggleEnabled(seminarId: string, schedule: EmailSchedule) {
    try {
      const res = await fetch(`/api/seminars/${seminarId}/email-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: EmailSchedule = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.seminar.id === seminarId
            ? { ...g, schedules: g.schedules.map((s) => (s.id === updated.id ? updated : s)) }
            : g
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  async function handleTestSend(scheduleId: number) {
    if (!testEmail) {
      toast.error("送信先メールアドレスを入力してください");
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch(`/api/email-schedules/${scheduleId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, tenant: TENANT }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`テスト送信しました → ${data.to}`);
      setTestSendId(null);
      setTestEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "テスト送信に失敗しました");
    } finally {
      setTestSending(false);
    }
  }

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      schedules: g.schedules.filter((s) => {
        if (filter === "pending") return s.status === "pending";
        if (filter === "sent") return s.status === "sent";
        return true;
      }),
    }))
    .filter((g) => g.schedules.length > 0);

  const previewSubject =
    templateModal.seminarVars
      ? renderPreview(templateModal.subject, templateModal.seminarVars)
      : templateModal.subject;
  const previewBody =
    templateModal.seminarVars
      ? renderPreview(templateModal.body, templateModal.seminarVars)
      : templateModal.body;

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">配信スケジュール管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              全セミナーのメール配信スケジュールを一括管理できます
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            {loading ? "読込中..." : "更新"}
          </Button>
        </div>

        <div className="flex gap-2">
          {(["pending", "sent", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {{ pending: "未送信", sent: "送信済", all: "すべて" }[f]}
            </Button>
          ))}
        </div>

        {loading && <p className="text-sm text-muted-foreground">読み込み中...</p>}

        {!loading && filteredGroups.length === 0 && (
          <Card className="border border-border bg-card">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {filter === "pending" ? "未送信のスケジュールはありません" : "スケジュールがありません"}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {filteredGroups.map(({ seminar, schedules }) => (
            <Card key={seminar.id} className="border border-border bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold text-foreground line-clamp-1">
                      {seminar.title}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      開催日: {seminar.date ? new Date(seminar.date).toLocaleDateString("ja-JP") : "未設定"}
                    </p>
                  </div>
                  <Link href={`${ADMIN_BASE}/seminars/${seminar.id}/email-schedule`}>
                    <Button size="sm" variant="outline">詳細</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {schedules.map((schedule) => {
                  const statusInfo = STATUS_BADGE[schedule.status] ?? STATUS_BADGE.pending;
                  const isSent = schedule.status === "sent";
                  const isEditing = editingId === schedule.id;
                  const isTestSending = testSendId === schedule.id;

                  return (
                    <div
                      key={schedule.id}
                      className="rounded-md border border-border bg-muted/10 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-foreground shrink-0">
                            {TEMPLATE_LABELS[schedule.template_id] ?? schedule.template_id}
                          </span>
                          <Badge variant={statusInfo.variant} className="text-[10px] h-4 px-1">
                            {statusInfo.label}
                          </Badge>
                          {!isSent && (
                            <button
                              onClick={() => handleToggleEnabled(seminar.id, schedule)}
                              className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                                schedule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                              }`}
                              title={schedule.enabled ? "無効にする" : "有効にする"}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                                  schedule.enabled ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          )}
                        </div>

                        {!isEditing && !isTestSending && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {schedule.scheduled_date} {schedule.send_time}
                            </span>
                            {!isSent && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => startEdit(schedule)}
                                >
                                  日時変更
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => openTemplateModal(schedule.template_id, seminar.id)}
                                >
                                  文面確認・編集
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => startTestSend(schedule)}
                                >
                                  テスト送信
                                </Button>
                              </>
                            )}
                            {isSent && schedule.sent_at && (
                              <span className="text-xs text-muted-foreground">
                                送信済: {new Date(schedule.sent_at).toLocaleDateString("ja-JP")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-2 flex items-end gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">送信日</Label>
                            <Input
                              type="date"
                              value={editValues.scheduled_date}
                              onChange={(e) =>
                                setEditValues((v) => ({ ...v, scheduled_date: e.target.value }))
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">送信時刻</Label>
                            <Input
                              type="time"
                              value={editValues.send_time}
                              onChange={(e) =>
                                setEditValues((v) => ({ ...v, send_time: e.target.value }))
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSaveEdit(seminar.id, schedule.id)}
                          >
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setEditingId(null)}
                          >
                            キャンセル
                          </Button>
                        </div>
                      )}

                      {isTestSending && (
                        <div className="mt-2 flex items-end gap-2">
                          <div className="space-y-1 flex-1">
                            <Label className="text-[10px]">テスト送信先メールアドレス</Label>
                            <Input
                              type="email"
                              placeholder="example@example.com"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={testSending}
                            onClick={() => handleTestSend(schedule.id)}
                          >
                            {testSending ? "送信中..." : "送信"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setTestSendId(null)}
                          >
                            キャンセル
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 文面確認・編集モーダル */}
      {templateModal.templateId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setTemplateModal(EMPTY_MODAL); }}
        >
          <div className="w-full max-w-2xl rounded-lg border border-border bg-background shadow-xl flex flex-col max-h-[90vh]">
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-foreground">メール文面確認・編集</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {TEMPLATE_LABELS[templateModal.templateId] ?? templateModal.templateId}
                </p>
              </div>
              <button
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
                onClick={() => setTemplateModal(EMPTY_MODAL)}
              >
                ✕
              </button>
            </div>

            {/* タブ */}
            <div className="flex border-b border-border shrink-0">
              {(["edit", "preview"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTemplateModal((prev) => ({ ...prev, activeTab: tab }))}
                  className={`px-5 py-2 text-xs font-medium border-b-2 transition-colors ${
                    templateModal.activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "edit" ? "編集" : "プレビュー（変数展開）"}
                </button>
              ))}
            </div>

            {templateModal.loading ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">読み込み中...</div>
            ) : (
              <div className="overflow-y-auto flex-1 px-5 py-4">
                {templateModal.activeTab === "edit" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">件名</Label>
                      <Input
                        value={templateModal.subject}
                        onChange={(e) =>
                          setTemplateModal((prev) => ({ ...prev, subject: e.target.value }))
                        }
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">本文</Label>
                      <Textarea
                        value={templateModal.body}
                        onChange={(e) =>
                          setTemplateModal((prev) => ({ ...prev, body: e.target.value }))
                        }
                        rows={18}
                        className="text-sm font-mono resize-none"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      使用可能な変数: <code>{"{{name}}"}</code> <code>{"{{seminar_title}}"}</code> <code>{"{{date}}"}</code> <code>{"{{format}}"}</code> <code>{"{{speaker}}"}</code> <code>{"{{meet_url_line}}"}</code> <code>{"{{registration_url}}"}</code> <code>{"{{survey_url}}"}</code>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">件名（プレビュー）</Label>
                      <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                        {previewSubject || <span className="text-muted-foreground italic">（空）</span>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">本文（プレビュー）</Label>
                      <div className="rounded-md border border-border bg-muted/20 px-3 py-3 text-sm whitespace-pre-wrap font-mono leading-relaxed min-h-[300px]">
                        {previewBody || <span className="text-muted-foreground italic">（空）</span>}
                      </div>
                    </div>
                    {!templateModal.seminarVars && (
                      <p className="text-xs text-amber-600">セミナー情報を取得できなかったため、変数は展開されていません</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* フッター */}
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setTemplateModal(EMPTY_MODAL)}>
                閉じる
              </Button>
              <Button
                size="sm"
                disabled={templateModal.loading || templateModal.saving}
                onClick={handleSaveTemplate}
              >
                {templateModal.saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
