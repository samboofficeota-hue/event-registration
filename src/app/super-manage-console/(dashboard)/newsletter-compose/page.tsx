"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Save, ChevronRight, RefreshCw, X, FlaskConical, Plus, History, FileEdit } from "lucide-react";
import { TENANT_KEYS, TENANT_LABELS } from "@/lib/tenant-config";
import type { TenantKey } from "@/lib/tenant-config";
import Link from "next/link";

interface Seminar {
  id: string;
  title: string;
  date: string;
  format: string;
  speaker: string;
  description: string;
  status: string;
}

interface Campaign {
  id: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent";
  updated_at: string;
  sent_at: string | null;
  recipient_count: number;
  sent_count: number;
}

const FORMAT_LABEL: Record<string, string> = {
  online: "オンライン",
  venue: "会場",
  hybrid: "ハイブリッド",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatShort(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function buildSeminarBlock(seminar: Seminar, tenant: TenantKey): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://events.allianceforum.org";
  const tenantPath = tenant === "whgc-seminars" ? "whgc-seminars" : tenant;
  const lines = [
    `■ ${seminar.title}`,
    seminar.date ? `　日時：${formatDate(seminar.date)}` : "",
    seminar.format ? `　形式：${FORMAT_LABEL[seminar.format] ?? seminar.format}` : "",
    seminar.speaker ? `　登壇：${seminar.speaker}` : "",
    seminar.description ? `\n${seminar.description}` : "",
    `\n　詳細・お申し込み：${appUrl}/${tenantPath}/seminars/${seminar.id}`,
  ].filter(Boolean);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════
// ハブページ（?id なし）
// ═══════════════════════════════════════════════════════════
function ComposeHub() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter/campaigns");
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      toast.error("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const drafts = campaigns.filter((c) => c.status === "draft");
  const sentList = campaigns.filter((c) => c.status === "sent");

  async function createNew() {
    const res = await fetch("/api/newsletter/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "", body: "", recipient_tags: [] }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/super-manage-console/newsletter-compose?id=${data.id}`);
    } else {
      toast.error("作成に失敗しました");
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">メール作成・編集</h1>
          <p className="admin-description mt-1">メルマガの新規作成・下書き編集・過去メール参照</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 shrink-0">
          <RefreshCw className="size-3.5" />更新
        </Button>
      </div>

      {/* 新規作成 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plus className="size-4 text-primary" />新規作成
        </h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <Button onClick={createNew} className="gap-1.5">
            <Plus className="size-3.5" />新規メールを作成
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            件名・本文を入力し、下書き保存してからリスト設定・配信で送信します。
          </p>
        </div>
      </section>

      {/* 下書きリスト */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileEdit className="size-4 text-primary" />下書きリスト
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : drafts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
            <FileEdit className="size-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm">下書きはありません</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-xs">件名</th>
                  <th className="px-4 py-2.5 text-left font-medium text-xs">最終更新</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {drafts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {c.subject || <span className="text-muted-foreground italic">（件名なし）</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatShort(c.updated_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/super-manage-console/newsletter-compose?id=${c.id}`}>
                        <Button variant="outline" size="sm">編集</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 過去のメール一覧 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="size-4 text-primary" />過去のメール一覧
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : sentList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
            <History className="size-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm">送信済みメールはありません</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-xs">件名</th>
                  <th className="px-4 py-2.5 text-right font-medium text-xs">送信数</th>
                  <th className="px-4 py-2.5 text-left font-medium text-xs">送信日時</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sentList.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{c.subject || "（件名なし）"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-emerald-600">{c.sent_count.toLocaleString()}</span>
                      <span className="text-muted-foreground text-xs ml-1">/ {c.recipient_count.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.sent_at ? formatShort(c.sent_at) : "—"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/super-manage-console/newsletter-compose?id=${c.id}`}>
                        <Button variant="outline" size="sm">参照・コピー</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// メールエディタ（?id あり）
// ═══════════════════════════════════════════════════════════
function NewsletterComposeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");

  if (!campaignId) {
    return <ComposeHub />;
  }

  return <ComposeEditor campaignId={campaignId} router={router} />;
}

// ─── エディタ本体 ──────────────────────────────────────────
function ComposeEditor({ campaignId, router }: { campaignId: string; router: ReturnType<typeof useRouter> }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientTags, setRecipientTags] = useState<string[]>([]);

  const [selectedTenant, setSelectedTenant] = useState<TenantKey>("whgc-seminars");
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loadingSeminars, setLoadingSeminars] = useState(false);

  const [scheduledAt, setScheduledAt] = useState("");

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);

  interface SendProgress {
    total: number;
    sent: number;
    failed: number;
    processed: number;
    done: boolean;
    error?: string;
  }
  const [progress, setProgress] = useState<SendProgress | null>(null);

  // 既存キャンペーン読み込み
  useEffect(() => {
    fetch(`/api/newsletter/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((d) => {
        setSubject(d.subject ?? "");
        setBody(d.body ?? "");
        setRecipientTags(d.recipient_tags ?? []);
        if (d.scheduled_at) {
          const dt = new Date(d.scheduled_at);
          const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16);
          setScheduledAt(local);
        }
      })
      .catch(() => toast.error("キャンペーンの読み込みに失敗しました"));
  }, [campaignId]);

  // セミナー取得
  const loadSeminars = useCallback(async (tenant: TenantKey) => {
    setLoadingSeminars(true);
    try {
      const res = await fetch(`/api/seminars?tenant=${tenant}&status=published`);
      const data = await res.json();
      setSeminars(Array.isArray(data) ? data : []);
    } catch {
      toast.error("セミナー一覧の取得に失敗しました");
    } finally {
      setLoadingSeminars(false);
    }
  }, []);

  useEffect(() => {
    loadSeminars(selectedTenant);
  }, [selectedTenant, loadSeminars]);

  function insertSeminar(seminar: Seminar) {
    const block = "\n\n" + buildSeminarBlock(seminar, selectedTenant) + "\n";
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newBody = body.substring(0, start) + block + body.substring(end);
      setBody(newBody);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + block.length;
        el.focus();
      }, 0);
    } else {
      setBody((prev) => prev + block);
    }
    toast.success(`「${seminar.title}」を挿入しました`);
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await fetch(`/api/newsletter/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipient_tags: recipientTags }),
      });
      toast.success("保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function saveScheduled() {
    if (!scheduledAt) { toast.error("配信日時を選択してください"); return; }
    if (!subject) { toast.error("件名を入力してください"); return; }
    setSaving(true);
    try {
      const scheduledIso = new Date(scheduledAt).toISOString();
      await fetch(`/api/newsletter/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipient_tags: recipientTags, scheduled_at: scheduledIso, status: "scheduled" }),
      });
      toast.success("配信予約を登録しました");
    } catch {
      toast.error("予約登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testEmail) { toast.error("テスト送信先メールアドレスを入力してください"); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/newsletter/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_email: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`テストメールを ${testEmail} に送信しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  async function sendCampaign() {
    setSending(true);
    setProgress(null);
    try {
      await fetch(`/api/newsletter/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipient_tags: recipientTags }),
      });

      let offset = 0;
      let totalSent = 0;
      let totalFailed = 0;
      let totalCount = 0;

      while (true) {
        const res = await fetch(`/api/newsletter/campaigns/${campaignId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, batch_size: 100 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        totalSent += data.sent;
        totalFailed += data.failed;
        totalCount = data.total;
        offset = data.next_offset;

        setProgress({ total: totalCount, sent: totalSent, failed: totalFailed, processed: offset, done: !data.has_more });
        if (!data.has_more) break;
      }

      toast.success(`配信完了: ${totalSent}件送信 / ${totalFailed}件失敗`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "送信に失敗しました";
      setProgress((prev) => prev ? { ...prev, error: msg, done: true } : null);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* ヘッダー */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/super-manage-console/newsletter-compose")}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                メール作成・編集
              </button>
              <span className="text-muted-foreground text-sm">/</span>
              <h1 className="text-sm font-semibold">編集中</h1>
            </div>
            <p className="admin-description mt-0.5 text-xs">ID: {campaignId.slice(0, 8)}…</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving} className="gap-1.5">
              <Save className="size-3.5" />{saving ? "保存中…" : "下書き保存"}
            </Button>
            <Button size="sm" onClick={() => setShowSendModal(true)} className="gap-1.5">
              <Send className="size-3.5" />今すぐ配信
            </Button>
          </div>
        </div>
      </div>

      {/* メインレイアウト */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
          {/* 件名 */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">件名</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="メールの件名を入力してください"
              className="text-base"
            />
          </div>

          {/* 送信対象 */}
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              送信対象の設定は{" "}
              <Link href="/super-manage-console/newsletter-list" className="text-primary underline hover:no-underline">
                リスト設定・配信
              </Link>{" "}
              ページで行います。
            </p>
          </div>

          {/* 配信予約 */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">配信予約</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 flex-1 min-w-48">
                <Label htmlFor="scheduled-at" className="text-xs text-muted-foreground">配信日時（空欄 = 予約なし）</Label>
                <input
                  id="scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !scheduledAt}
                onClick={saveScheduled}
                className="gap-1.5 shrink-0"
              >
                <Save className="size-3.5" />予約登録
              </Button>
            </div>
            {scheduledAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(scheduledAt).toLocaleString("ja-JP")} に自動配信されます（GitHub Actions が毎日 10:00 JST に処理）
              </p>
            )}
          </div>

          {/* 本文 */}
          <div className="flex flex-1 flex-col space-y-1.5">
            <Label htmlFor="body">本文</Label>
            <Textarea
              id="body"
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`メール本文を入力してください。\n\n右パネルからイベント情報を挿入できます。\n\n{{name}} で宛名（購読者名）に置換されます。`}
              className="flex-1 min-h-[400px] font-mono text-sm leading-relaxed resize-none"
            />
          </div>

          {/* テスト送信 */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
            <p className="text-sm font-medium">テスト送信</p>
            <div className="flex gap-2">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="テスト送信先メールアドレス"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={sendTest} disabled={sending || !testEmail} className="gap-1.5 shrink-0">
                <FlaskConical className="size-3.5" />テスト送信
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">件名に [テスト] が付いて送信されます。</p>
          </div>
        </div>

        {/* 右: セミナー挿入パネル */}
        <aside className="w-80 shrink-0 border-l border-border bg-muted/10 flex flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">イベント情報を挿入</p>
            <p className="text-xs text-muted-foreground mt-0.5">選択したイベントの情報をカーソル位置に挿入</p>
          </div>
          <div className="border-b border-border px-4 py-2 flex gap-1 flex-wrap">
            {TENANT_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedTenant(key)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  selectedTenant === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border hover:bg-muted"
                }`}
              >
                {TENANT_LABELS[key].replace("セミナー", "").replace("イベント", "").replace("コース", "").trim()}
              </button>
            ))}
            <button
              onClick={() => loadSeminars(selectedTenant)}
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
              title="更新"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingSeminars ? (
              <div className="p-4 text-center text-sm text-muted-foreground">読み込み中…</div>
            ) : seminars.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">公開中のセミナーがありません</div>
            ) : (
              <ul className="divide-y divide-border">
                {seminars.map((seminar) => (
                  <li key={seminar.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <p className="text-sm font-medium leading-snug line-clamp-2">{seminar.title}</p>
                    {seminar.date && (
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(seminar.date)}</p>
                    )}
                    {seminar.format && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {FORMAT_LABEL[seminar.format] ?? seminar.format}
                      </Badge>
                    )}
                    <button
                      onClick={() => insertSeminar(seminar)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-colors"
                    >
                      挿入 <ChevronRight className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* 送信確認・進捗モーダル */}
      {showSendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (!sending && progress?.done !== false && e.target === e.currentTarget) {
              setShowSendModal(false);
              setProgress(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold">
                {progress?.done ? "配信完了" : sending ? "配信中…" : "配信の確認"}
              </h2>
              {!sending && (
                <button
                  onClick={() => { setShowSendModal(false); setProgress(null); }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="p-6 space-y-4">
              {!sending && !progress && (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-800">送信前に確認してください</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-700 list-disc list-inside">
                      <li>件名: {subject || "（未入力）"}</li>
                      <li>送信対象: {recipientTags.length === 0 ? "全購読者" : `タグ: ${recipientTags.join("・")}`}</li>
                    </ul>
                    <p className="mt-2 text-xs text-amber-600">※ 送信後は取り消しできません。</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">バッチ送信について</p>
                    <p>メールは <strong>100件ずつのバッチ</strong> に分けて順番に送信されます。</p>
                    <p className="text-amber-700 font-medium">⚠ 送信完了まで、このブラウザタブを閉じないでください。</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSendModal(false)}>キャンセル</Button>
                    <Button size="sm" onClick={sendCampaign} className="gap-1.5">
                      <Send className="size-3.5" />配信実行
                    </Button>
                  </div>
                </>
              )}

              {(sending || (progress && !progress.done)) && progress && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">送信中…</span>
                      <span className="font-medium">
                        {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} 件
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>成功: {progress.sent.toLocaleString()} 件</span>
                      {progress.failed > 0 && <span className="text-red-500">失敗: {progress.failed.toLocaleString()} 件</span>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">送信中はこのウィンドウを閉じないでください</p>
                </div>
              )}

              {progress?.done && (
                <div className="space-y-4">
                  {progress.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1">
                      <p className="font-medium text-red-700">エラーが発生しました</p>
                      <p className="text-sm text-red-600">{progress.error}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-1">
                      <p className="font-medium text-emerald-700">配信完了 ✓</p>
                      <p className="text-sm text-emerald-600">送信成功: <strong>{progress.sent.toLocaleString()}</strong> 件</p>
                      {progress.failed > 0 && (
                        <p className="text-sm text-red-500">失敗: <strong>{progress.failed.toLocaleString()}</strong> 件</p>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowSendModal(false); setProgress(null); }}>閉じる</Button>
                    <Button size="sm" onClick={() => { setShowSendModal(false); setProgress(null); router.push("/super-manage-console/newsletter-history"); }}>
                      配信履歴を確認
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewsletterComposePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">読み込み中…</div>}>
      <NewsletterComposeInner />
    </Suspense>
  );
}
