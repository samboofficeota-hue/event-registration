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
import {
  Save, ChevronRight, RefreshCw, X, FlaskConical, Plus, History, FileEdit, Eye, AlignLeft,
} from "lucide-react";
import { TENANT_KEYS, TENANT_LABELS } from "@/lib/tenant-config";
import type { TenantKey } from "@/lib/tenant-config";
import Link from "next/link";
import { EMAIL_THEMES } from "@/lib/email/themes";
import { buildPreviewHtml } from "@/lib/email/client-preview";
import { BRAND_CONFIGS, detectBrand } from "@/lib/email/brand";
import type { BrandKey } from "@/lib/email/brand";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

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

function buildSeminarBlock(seminar: Seminar, _tenant: TenantKey): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://events.allianceforum.org";
  // UUIDの先頭8文字を短縮IDとして使用 (/s/{shortId} でリダイレクト)
  const shortId = seminar.id.replace(/-/g, "").slice(0, 8);
  const lines = [
    `■ ${seminar.title}`,
    seminar.date ? `　日時：${formatDate(seminar.date)}` : "",
    seminar.format ? `　形式：${FORMAT_LABEL[seminar.format] ?? seminar.format}` : "",
    seminar.speaker ? `　登壇：${seminar.speaker} さん` : "",
    seminar.description ? `\n${seminar.description}` : "",
    `\n　詳細・お申し込み：${appUrl}/s/${shortId}`,
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

  async function createNew(brand: BrandKey) {
    const brandConfig = BRAND_CONFIGS[brand];
    const res = await fetch("/api/newsletter/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "",
        body: "",
        recipient_tags: [],
        footer_text: brandConfig.footerSenderText,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/super-manage-console/newsletter-compose?id=${data.id}`);
    } else {
      toast.error("作成に失敗しました");
    }
  }

  const TEMPLATE_OPTIONS: { brand: BrandKey; label: string; sub: string }[] = [
    {
      brand: "aff",
      label: "① アライアンス・フォーラム財団",
      sub:   "ヘッダー：アライアンス・フォーラム財団 / 問い合わせ：contact@allianceforum.org",
    },
    {
      brand: "whgc",
      label: "② WHGC ゲームチェンジャーズ・フォーラム",
      sub:   "ヘッダー：WHGC ゲームチェンジャーズ・フォーラム / 問い合わせ：info@whgcforum.org",
    },
  ];

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
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-xs text-muted-foreground">テンプレートを選択して作成します。</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.brand}
                onClick={() => createNew(opt.brand)}
                className="flex flex-col items-start gap-1 rounded-lg border border-border bg-background px-4 py-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Plus className="size-3.5 text-primary shrink-0" />
                  {opt.label}
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">{opt.sub}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
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
  const [headerColor, setHeaderColor] = useState("dark");
  const [footerText, setFooterText] = useState("");
  const [showFooterEdit, setShowFooterEdit] = useState(false);

  const currentBrand = BRAND_CONFIGS[detectBrand(footerText)];

  const [selectedTenant, setSelectedTenant] = useState<TenantKey>("whgc-seminars");
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loadingSeminars, setLoadingSeminars] = useState(false);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // 既存キャンペーン読み込み
  useEffect(() => {
    fetch(`/api/newsletter/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((d) => {
        setSubject(d.subject ?? "");
        setBody(d.body ?? "");
        setRecipientTags(d.recipient_tags ?? []);
        setHeaderColor(d.header_color ?? "dark");
        setFooterText(d.footer_text ?? "");
      })
      .catch(() => toast.error("キャンペーンの読み込みに失敗しました"));
  }, [campaignId]);

  // プレビューHTMLをデバウンス更新
  useEffect(() => {
    if (!showPreview) return;
    const timer = setTimeout(() => {
      setPreviewHtml(buildPreviewHtml(body, headerColor, footerText || null));
    }, 250);
    return () => clearTimeout(timer);
  }, [body, headerColor, footerText, showPreview]);

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

  // テキスト挿入ヘルパー（カーソル位置に挿入）
  function insertText(text: string) {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newBody = body.substring(0, start) + text + body.substring(end);
      setBody(newBody);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
      }, 0);
    } else {
      setBody((prev) => prev + text);
    }
  }

  function insertSeminar(seminar: Seminar) {
    const block = "\n\n" + buildSeminarBlock(seminar, selectedTenant) + "\n";
    insertText(block);
    toast.success(`「${seminar.title}」を挿入しました`);
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await fetch(`/api/newsletter/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipient_tags: recipientTags, header_color: headerColor, footer_text: footerText || null }),
      });
      toast.success("保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testEmail) { toast.error("テスト送信先メールアドレスを入力してください"); return; }
    // まず保存してからテスト送信
    await saveDraft();
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

  function openPreview() {
    setPreviewHtml(buildPreviewHtml(body, headerColor, footerText || null));
    setShowPreview(true);
  }

  // 挿入可能な変数バッジの定義
  const INSERT_VARS = [
    { label: "{{name}}",       text: "{{name}}",       desc: "受信者名に自動置換" },
    { label: "{{company}}",    text: "{{company}}",    desc: "会社名に自動置換" },
    { label: "{{department}}", text: "{{department}}", desc: "部署・肩書きに自動置換" },
  ];

  return (
    <>
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
            <Button variant="outline" size="sm" onClick={openPreview} className="gap-1.5">
              <Eye className="size-3.5" />プレビュー
            </Button>
            <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving} className="gap-1.5">
              <Save className="size-3.5" />{saving ? "保存中…" : "下書き保存"}
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

          {/* ヘッダーカラー選択 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">ヘッダーカラー</Label>
            <div className="flex flex-wrap gap-2">
              {EMAIL_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setHeaderColor(theme.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                    headerColor === theme.id
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border bg-background hover:border-muted-foreground"
                  }`}
                >
                  <span
                    className="size-3.5 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: theme.header }}
                  />
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* 送信対象バナー */}
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              送信対象の設定・配信予約は{" "}
              <Link href="/super-manage-console/newsletter-list" className="text-primary underline hover:no-underline">
                リスト設定・配信
              </Link>{" "}
              ページで行います。
            </p>
          </div>

          {/* 本文 */}
          <div className="flex flex-1 flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">本文</Label>
              <button
                onClick={openPreview}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Eye className="size-3" />HTMLプレビュー
              </button>
            </div>

            {/* 挿入バッジ */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground self-center">挿入:</span>
              {INSERT_VARS.map((v) => (
                <button
                  key={v.text}
                  onClick={() => insertText(v.text)}
                  title={v.desc}
                  className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-mono text-primary hover:bg-primary/15 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>

            <Textarea
              id="body"
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`メール本文を入力してください。\n\n右パネルからイベント情報を挿入できます。\n\n{{name}} で宛名（購読者名）に置換されます。`}
              className="flex-1 min-h-[400px] font-mono text-sm leading-relaxed resize-none"
            />
          </div>

          {/* フッター編集 */}
          <div className="rounded-lg border border-border bg-muted/20">
            <button
              onClick={() => setShowFooterEdit((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
            >
              <span className="flex items-center gap-2">
                <AlignLeft className="size-3.5 text-muted-foreground" />
                フッター編集
              </span>
              <span className="text-xs text-muted-foreground">{showFooterEdit ? "▲ 閉じる" : "▼ 開く"}</span>
            </button>
            {showFooterEdit && (
              <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">現在のテンプレート：</span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {currentBrand.headerTitle}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  フッターの送信者名テキストを変更できます。空白の場合はテンプレートのデフォルトが使われます。
                </p>
                <Textarea
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder={currentBrand.footerSenderText}
                  className="text-sm min-h-[60px] resize-none"
                />
                <div className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                  <p>（自動付与）配信停止をご希望の方は「こちら」より停止手続きをお願いいたします。</p>
                  <p>（固定）ご不明な点は {currentBrand.contactEmail} までお問い合わせください。</p>
                </div>
              </div>
            )}
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
            <p className="text-xs text-muted-foreground">件名に [テスト] が付いて送信されます。保存してから送信します。</p>
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

    </div>

    {/* ─── HTMLプレビューモーダル（フルスクリーン、左:編集 / 右:プレビュー） ─── */}
    {showPreview && (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-border bg-background px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Eye className="size-4 text-primary" />
            <span className="text-sm font-semibold">HTMLプレビュー</span>
            <span className="text-xs text-muted-foreground">左で編集すると右のプレビューがリアルタイムで更新されます</span>
          </div>
          <button
            onClick={() => setShowPreview(false)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 分割ビュー */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左: 編集エリア */}
          <div className="w-1/2 flex flex-col border-r border-border bg-background">
            <div className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-muted-foreground">テキスト編集</span>
              {/* テーマ選択もプレビュー内で変更可能 */}
              <div className="flex gap-1">
                {EMAIL_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setHeaderColor(theme.id)}
                    title={theme.label}
                    className={`size-5 rounded-full border-2 transition-all ${
                      headerColor === theme.id ? "border-primary scale-110" : "border-transparent hover:border-muted-foreground"
                    }`}
                    style={{ backgroundColor: theme.header }}
                  />
                ))}
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 font-mono text-sm leading-relaxed resize-none border-none rounded-none focus-visible:ring-0"
              placeholder="本文を入力してください"
            />
            <div className="border-t border-border px-4 py-2 flex items-center gap-2 shrink-0 bg-muted/20">
              <span className="text-xs text-muted-foreground">挿入:</span>
              {INSERT_VARS.map((v) => (
                <button
                  key={v.text}
                  onClick={() => setBody((prev) => prev + v.text)}
                  title={v.desc}
                  className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-mono text-primary hover:bg-primary/15 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* 右: HTMLプレビュー */}
          <div className="w-1/2 flex flex-col overflow-hidden bg-gray-100">
            <div className="border-b border-border px-4 py-2 bg-white shrink-0">
              <span className="text-xs font-medium text-muted-foreground">メールプレビュー（サンプル表示）</span>
            </div>
            <iframe
              srcDoc={previewHtml}
              title="メールHTMLプレビュー"
              className="flex-1 w-full border-none"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="border-t border-border bg-background px-6 py-3 flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground">
            ※ プレビューでは {"{{name}}"} → 「〇〇様」に置換されています
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
              <X className="size-3.5 mr-1" />閉じる
            </Button>
            <Button size="sm" onClick={async () => { setShowPreview(false); await saveDraft(); }} className="gap-1.5">
              <Save className="size-3.5" />保存して閉じる
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default function NewsletterComposePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">読み込み中…</div>}>
      <NewsletterComposeInner />
    </Suspense>
  );
}
