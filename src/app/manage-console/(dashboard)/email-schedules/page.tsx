"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { EmailSchedule } from "@/lib/d1";
import { RefreshCw, CalendarDays, ExternalLink } from "lucide-react";

const ADMIN_BASE = "/manage-console";

const TEMPLATE_LABELS: Record<string, string> = {
  reminder_30: "30日前案内",
  reminder_7:  "7日前リマインド",
  reminder_1:  "前日リマインド",
  followup_1:  "御礼・アンケート",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: "未送信", variant: "outline" },
  sent:      { label: "送信済", variant: "default" },
  failed:    { label: "失敗",   variant: "destructive" },
  cancelled: { label: "キャンセル", variant: "secondary" },
};

interface SeminarInfo { id: string; title: string; date: string; status: string; }
interface SeminarGroup { seminar: SeminarInfo; schedules: EmailSchedule[]; }
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
        ["日","月","火","水","木","金","土"][date.getDay()]
      }) ${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`
    : "";
  const formatMap: Record<string, string> = { online: "オンライン", venue: "会場", hybrid: "ハイブリッド" };
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
  templateId: null, seminarId: "", subject: "", body: "",
  seminarVars: null, activeTab: "edit", loading: false, saving: false,
};

export default function EmailSchedulesPage() {
  const [groups, setGroups] = useState<SeminarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("pending");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ scheduled_date: string; send_time: string }>({ scheduled_date: "", send_time: "" });
  const [testSendId, setTestSendId] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [templateModal, setTemplateModal] = useState<TemplateModal>(EMPTY_MODAL);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const seminarsRes = await fetch(`/api/seminars`);
      const seminars: SeminarInfo[] = await seminarsRes.json();
      const result: SeminarGroup[] = [];
      await Promise.all(
        seminars.filter((s) => s.status !== "cancelled").map(async (seminar) => {
          try {
            const res = await fetch(`/api/seminars/${seminar.id}/email-schedules`);
            if (!res.ok) return;
            const schedules: EmailSchedule[] = await res.json();
            if (schedules.length > 0) result.push({ seminar, schedules });
          } catch { /* skip */ }
        })
      );
      result.sort((a, b) => new Date(a.seminar.date).getTime() - new Date(b.seminar.date).getTime());
      setGroups(result);
    } catch {
      toast.error("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

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
        fetch(`/api/seminars/${seminarId}`),
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
    if (!testEmail) { toast.error("送信先メールアドレスを入力してください"); return; }
    setTestSending(true);
    try {
      const res = await fetch(`/api/email-schedules/${scheduleId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
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

  const previewSubject = templateModal.seminarVars
    ? renderPreview(templateModal.subject, templateModal.seminarVars)
    : templateModal.subject;
  const previewBody = templateModal.seminarVars
    ? renderPreview(templateModal.body, templateModal.seminarVars)
    : templateModal.body;

  return (
    <>
      <div className="space-y-6">

        {/* ページヘッダー */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">配信スケジュール管理</h1>
            <p className="admin-description mt-1">全セミナーのメール配信スケジュールを一括管理できます</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="shrink-0 gap-1.5">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            更新
          </Button>
        </div>

        {/* フィルタータブ */}
        <div className="flex gap-2 border-b border-border pb-0">
          {(["pending", "sent", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                filter === f
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {{ pending: "未送信", sent: "送信済", all: "すべて" }[f]}
            </button>
          ))}
        </div>

        {/* ローディング */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" />
            読み込み中...
          </div>
        )}

        {/* 空状態 */}
        {!loading && filteredGroups.length === 0 && (
          <div className="admin-card rounded-lg px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filter === "pending" ? "未送信のスケジュールはありません" : "スケジュールがありません"}
            </p>
          </div>
        )}

        {/* セミナーグループ一覧 */}
        <div className="space-y-4">
          {filteredGroups.map(({ seminar, schedules }) => (
            <div key={seminar.id} className="admin-card rounded-xl overflow-hidden">

              {/* セミナーヘッダー */}
              <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/20 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-1 text-sm font-semibold text-foreground">
                    {seminar.title}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5 shrink-0" />
                    開催日: {seminar.date ? new Date(seminar.date).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }) : "未設定"}
                  </p>
                </div>
                <Link href={`${ADMIN_BASE}/seminars/${seminar.id}/email-schedule`}>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
                    <ExternalLink className="size-3.5" />
                    詳細
                  </Button>
                </Link>
              </div>

              {/* スケジュール行 */}
              <div className="divide-y divide-border">
                {schedules.map((schedule) => {
                  const statusInfo = STATUS_BADGE[schedule.status] ?? STATUS_BADGE.pending;
                  const isSent = schedule.status === "sent";
                  const isEditing = editingId === schedule.id;
                  const isTestSendOpen = testSendId === schedule.id;

                  return (
                    <div key={schedule.id} className={`px-5 py-3.5 ${!schedule.enabled && !isSent ? "opacity-60" : ""}`}>

                      {/* メイン行 */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

                        {/* 左：種別 + ステータス + トグル */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-sm font-medium text-foreground shrink-0 w-28">
                            {TEMPLATE_LABELS[schedule.template_id] ?? schedule.template_id}
                          </span>
                          <Badge variant={statusInfo.variant} className="text-xs shrink-0">
                            {statusInfo.label}
                          </Badge>
                          {!isSent && (
                            <button
                              onClick={() => handleToggleEnabled(seminar.id, schedule)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                schedule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                              }`}
                              title={schedule.enabled ? "無効にする" : "有効にする"}
                              aria-label={schedule.enabled ? "無効にする" : "有効にする"}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                                  schedule.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          )}
                        </div>

                        {/* 右：送信日時 + アクション */}
                        {!isEditing && !isTestSendOpen && (
                          <div className="ml-auto flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {schedule.scheduled_date} {schedule.send_time}
                            </span>
                            {!isSent && (
                              <>
                                <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => startEdit(schedule)}>
                                  日時変更
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => openTemplateModal(schedule.template_id, seminar.id)}>
                                  文面確認・編集
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => startTestSend(schedule)}>
                                  テスト送信
                                </Button>
                              </>
                            )}
                            {isSent && schedule.sent_at && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(schedule.sent_at).toLocaleDateString("ja-JP")} 送信済
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 日時変更フォーム */}
                      {isEditing && (
                        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">送信日</Label>
                            <Input
                              type="date"
                              value={editValues.scheduled_date}
                              onChange={(e) => setEditValues((v) => ({ ...v, scheduled_date: e.target.value }))}
                              className="h-8 text-sm w-40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">送信時刻</Label>
                            <Input
                              type="time"
                              value={editValues.send_time}
                              onChange={(e) => setEditValues((v) => ({ ...v, send_time: e.target.value }))}
                              className="h-8 text-sm w-28"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8" onClick={() => handleSaveEdit(seminar.id, schedule.id)}>
                              保存
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(null)}>
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* テスト送信フォーム */}
                      {isTestSendOpen && (
                        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                          <div className="flex-1 space-y-1 min-w-48">
                            <Label className="text-xs font-medium">テスト送信先メールアドレス</Label>
                            <Input
                              type="email"
                              placeholder="example@example.com"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8" disabled={testSending} onClick={() => handleTestSend(schedule.id)}>
                              {testSending ? "送信中..." : "送信"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setTestSendId(null)}>
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 文面確認・編集モーダル */}
      {templateModal.templateId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setTemplateModal(EMPTY_MODAL); }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-background shadow-xl">

            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">メール文面確認・編集</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {TEMPLATE_LABELS[templateModal.templateId] ?? templateModal.templateId}
                </p>
              </div>
              <button
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={() => setTemplateModal(EMPTY_MODAL)}
                aria-label="閉じる"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* タブ */}
            <div className="flex border-b border-border shrink-0">
              {(["edit", "preview"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTemplateModal((prev) => ({ ...prev, activeTab: tab }))}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    templateModal.activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "edit" ? "編集" : "プレビュー（変数展開）"}
                </button>
              ))}
            </div>

            {/* モーダル本文 */}
            {templateModal.loading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin" />
                読み込み中...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {templateModal.activeTab === "edit" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">件名</Label>
                      <Input
                        value={templateModal.subject}
                        onChange={(e) => setTemplateModal((prev) => ({ ...prev, subject: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">本文</Label>
                      <Textarea
                        value={templateModal.body}
                        onChange={(e) => setTemplateModal((prev) => ({ ...prev, body: e.target.value }))}
                        rows={18}
                        className="font-mono text-sm resize-none"
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">使用可能な変数</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["{{name}}", "{{seminar_title}}", "{{date}}", "{{format}}", "{{speaker}}", "{{meet_url_line}}", "{{registration_url}}", "{{survey_url}}"].map((v) => (
                          <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{v}</code>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-muted-foreground">件名（プレビュー）</Label>
                      <div className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm">
                        {previewSubject || <span className="italic text-muted-foreground">（空）</span>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-muted-foreground">本文（プレビュー）</Label>
                      <div className="min-h-64 rounded-lg border border-border bg-muted/20 px-4 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                        {previewBody || <span className="italic text-muted-foreground">（空）</span>}
                      </div>
                    </div>
                    {!templateModal.seminarVars && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        セミナー情報を取得できなかったため、変数は展開されていません
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* モーダルフッター */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4 shrink-0">
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
