"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Plus, Clock, History, AlertTriangle, Info, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Campaign {
  id: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent";
  recipient_tags: string[];
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function formatDatetime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface SendStats {
  today: { total: number; newsletter: number; seminar: number };
  month: { total: number; newsletter_sent: number; newsletter_failed: number; seminar_sent: number };
  limits: { daily: number | null; monthly: number; plan: string };
}

interface SendLog {
  id: number;
  email: string;
  name: string;
  status: "sent" | "failed";
  resend_id: string | null;
  error_message: string | null;
  sent_at: string;
}

interface LogModal {
  campaign: Campaign;
  page: number;
  total: number;
  logs: SendLog[];
  filterStatus: "" | "sent" | "failed";
  loading: boolean;
}

export default function NewsletterHistoryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SendStats | null>(null);
  const [logModal, setLogModal] = useState<LogModal | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/newsletter/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

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

  const openLogModal = useCallback(async (campaign: Campaign, filterStatus: "" | "sent" | "failed" = "") => {
    setLogModal({ campaign, page: 1, total: 0, logs: [], filterStatus, loading: true });
    try {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/newsletter/campaigns/${campaign.id}/logs?${params}`);
      const data = await res.json();
      setLogModal((prev) => prev ? { ...prev, total: data.total, logs: data.logs ?? [], loading: false } : null);
    } catch {
      toast.error("取得に失敗しました");
      setLogModal(null);
    }
  }, []);

  const loadLogPage = useCallback(async (page: number) => {
    if (!logModal) return;
    setLogModal((prev) => prev ? { ...prev, loading: true } : null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "100" });
      if (logModal.filterStatus) params.set("status", logModal.filterStatus);
      const res = await fetch(`/api/newsletter/campaigns/${logModal.campaign.id}/logs?${params}`);
      const data = await res.json();
      setLogModal((prev) => prev ? { ...prev, page, total: data.total, logs: data.logs ?? [], loading: false } : null);
    } catch {
      toast.error("取得に失敗しました");
    }
  }, [logModal]);

  const drafts     = campaigns.filter((c) => c.status === "draft");
  const scheduled  = campaigns.filter((c) => c.status === "scheduled");
  const sent       = campaigns.filter((c) => c.status === "sent");

  return (
    <>
    <div className="p-6 space-y-8 max-w-4xl">

      {/* ページヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">配信トップ</h1>
          <p className="admin-description mt-1">メルマガのキャンペーン一覧</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-xl leading-relaxed">
            配信は <strong>100件ずつ自動分割</strong> して順番に送信します（Resend API の仕様）。1,000件の場合は約10回のリクエストが順次実行されます。<br />
            <strong>予約配信</strong>は毎日 JST 10:00 に GitHub Actions が自動実行するため、ブラウザを開いておく必要はありません。<br />
            <strong className="text-amber-600">即時送信中はブラウザのタブを閉じたり、ページを移動したりしないでください。</strong>中断した場合、処理済みのバッチまでは送信済みとなり、残りの配信は行われません。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 shrink-0">
          <RefreshCw className="size-3.5" />更新
        </Button>
      </div>

      {/* ─── Resend 送信制限 ─── */}
      {stats && (() => {
        const hasDailyLimit = stats.limits.daily !== null;
        const dailyPct = hasDailyLimit ? Math.min(100, Math.round((stats.today.total / stats.limits.daily!) * 100)) : 0;
        const monthlyPct = Math.min(100, Math.round((stats.month.total / stats.limits.monthly) * 100));
        const dailyWarn = hasDailyLimit && dailyPct >= 80;
        const monthlyWarn = monthlyPct >= 80;
        const monthlyRemaining = Math.max(0, stats.limits.monthly - stats.month.total);
        return (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-muted-foreground shrink-0" />
              <p className="text-sm font-medium">Resend 送信制限 <span className="font-normal text-muted-foreground">（{stats.limits.plan} プラン）</span></p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>今日の送信数</span>
                  <span className={dailyWarn ? "text-amber-600 font-medium" : ""}>
                    {stats.today.total.toLocaleString()} {hasDailyLimit ? `/ ${stats.limits.daily!.toLocaleString()} 件` : "件（上限なし）"}
                    {dailyWarn && <AlertTriangle className="inline size-3 ml-1" />}
                  </span>
                </div>
                {hasDailyLimit ? (
                  <>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${dailyPct >= 100 ? "bg-red-500" : dailyWarn ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${dailyPct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">残り {Math.max(0, stats.limits.daily! - stats.today.total)} 件（メルマガ {stats.today.newsletter} + セミナー {stats.today.seminar}）</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">メルマガ {stats.today.newsletter} + セミナー {stats.today.seminar}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>今月の送信数</span>
                  <span className={monthlyWarn ? "text-amber-600 font-medium" : ""}>
                    {stats.month.total.toLocaleString()} / {stats.limits.monthly.toLocaleString()} 件
                    {monthlyWarn && <AlertTriangle className="inline size-3 ml-1" />}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${monthlyPct >= 100 ? "bg-red-500" : monthlyWarn ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${monthlyPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">残り {monthlyRemaining.toLocaleString()} 件（メルマガ {stats.month.newsletter_sent} + セミナー {stats.month.seminar_sent}）</p>
              </div>
            </div>
            {hasDailyLimit && dailyPct >= 100 && <p className="text-xs text-red-600 font-medium">⚠ 1日の上限に達しました。</p>}
            {monthlyPct >= 100 && <p className="text-xs text-red-600 font-medium">⚠ 今月の上限（50,000件）に達しました。Resend のプランアップグレードを検討してください。</p>}
          </div>
        );
      })()}

      {/* ─── 新規作成 ─── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plus className="size-4 text-primary" />新規作成
        </h2>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <Link href="/super-manage-console/newsletter-compose">
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />新規メルマガを作成
            </Button>
          </Link>

          {/* 下書き一覧 */}
          {!loading && drafts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">下書き（{drafts.length}件）</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-xs">件名</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs">送信対象</th>
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
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.recipient_tags.length === 0 ? "全員" : c.recipient_tags.map((t) => (
                            <Badge key={t} variant="secondary" className="mr-1 text-xs">{t}</Badge>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDatetime(c.updated_at)}</td>
                        <td className="px-4 py-3">
                          <Link href={`/super-manage-console/newsletter-compose?id=${c.id}`}>
                            <Button variant="outline" size="sm">編集・配信</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── 配信予約 ─── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="size-4 text-primary" />配信予約
        </h2>
        {!loading && scheduled.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
            <Clock className="size-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm">予約された配信はありません</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-xs">件名</th>
                  <th className="px-4 py-2.5 text-left font-medium text-xs">送信対象</th>
                  <th className="px-4 py-2.5 text-left font-medium text-xs">配信予定日時</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scheduled.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {c.subject || <span className="text-muted-foreground italic">（件名なし）</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.recipient_tags.length === 0 ? "全員" : c.recipient_tags.map((t) => (
                        <Badge key={t} variant="secondary" className="mr-1 text-xs">{t}</Badge>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.scheduled_at
                        ? new Date(c.scheduled_at).toLocaleString("ja-JP")
                        : "—"}
                    </td>
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

      {/* ─── 配信履歴 ─── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="size-4 text-primary" />配信履歴
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : sent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            <History className="size-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm">送信済みのキャンペーンはありません</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-xs">件名</th>
                  <th className="px-4 py-2.5 text-left font-medium text-xs">送信対象</th>
                  <th className="px-4 py-2.5 text-right font-medium text-xs">送信数</th>
                  <th className="px-4 py-2.5 text-right font-medium text-xs">失敗</th>
                  <th className="px-4 py-2.5 text-left font-medium text-xs">送信日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sent.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{c.subject}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.recipient_tags.length === 0 ? "全員" : c.recipient_tags.map((t) => (
                        <Badge key={t} variant="secondary" className="mr-1 text-xs">{t}</Badge>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openLogModal(c, "sent")}
                        className="font-medium text-emerald-600 hover:underline tabular-nums"
                        title="送信成功リストを表示"
                      >
                        {c.sent_count.toLocaleString()}
                      </button>
                      <span className="text-muted-foreground text-xs ml-1">/ {c.recipient_count.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.failed_count > 0 ? (
                        <button
                          onClick={() => openLogModal(c, "failed")}
                          className="text-red-500 font-medium hover:underline tabular-nums"
                          title="失敗リストを表示"
                        >
                          {c.failed_count}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDatetime(c.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>

    {/* ─── 送信ログ モーダル ─── */}
    {logModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) setLogModal(null); }}
      >
        <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-background shadow-2xl">

          {/* ヘッダー */}
          <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4 shrink-0">
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">{logModal.campaign.subject}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                送信日時: {formatDatetime(logModal.campaign.sent_at)} ／ 合計: {logModal.total.toLocaleString()} 件
              </p>
            </div>
            <button
              onClick={() => setLogModal(null)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* フィルタータブ */}
          <div className="flex gap-1 px-6 py-2 border-b border-border bg-muted/10 shrink-0">
            {(["", "sent", "failed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => openLogModal(logModal.campaign, s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  logModal.filterStatus === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "" ? "全件" : s === "sent" ? "✓ 成功" : "✗ 失敗"}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground self-center">
              {logModal.total.toLocaleString()} 件
            </span>
          </div>

          {/* テーブル */}
          <div className="flex-1 overflow-y-auto">
            {logModal.loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">読み込み中…</div>
            ) : logModal.logs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">該当するログがありません</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-xs text-muted-foreground">メールアドレス</th>
                    <th className="px-4 py-2.5 text-left font-medium text-xs text-muted-foreground">名前</th>
                    <th className="px-4 py-2.5 text-left font-medium text-xs text-muted-foreground">結果</th>
                    <th className="px-4 py-2.5 text-left font-medium text-xs text-muted-foreground">送信時刻</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logModal.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-mono text-xs">{log.email}</td>
                      <td className="px-4 py-2.5 text-xs">{log.name || "—"}</td>
                      <td className="px-4 py-2.5">
                        {log.status === "sent" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">✓ 成功</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700" title={log.error_message ?? ""}>
                            ✗ 失敗{log.error_message ? `：${log.error_message.slice(0, 30)}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {formatDatetime(log.sent_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ページネーション */}
          {logModal.total > 100 && (
            <div className="flex items-center justify-center gap-2 border-t border-border px-6 py-3 shrink-0">
              <Button
                size="sm"
                variant="outline"
                disabled={logModal.page <= 1 || logModal.loading}
                onClick={() => loadLogPage(logModal.page - 1)}
                className="gap-1"
              >
                <ChevronLeft className="size-3.5" />前
              </Button>
              <span className="text-xs text-muted-foreground">
                {logModal.page} / {Math.ceil(logModal.total / 100)} ページ
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={logModal.page >= Math.ceil(logModal.total / 100) || logModal.loading}
                onClick={() => loadLogPage(logModal.page + 1)}
                className="gap-1"
              >
                次<ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}

        </div>
      </div>
    )}
    </>
  );
}
