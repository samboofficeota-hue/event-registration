"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, Upload, RefreshCw, Trash2, Pencil, X, Check, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle, Sparkles, ArrowLeftRight, ArrowDownToLine, Tag } from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  name: string;
  company: string;
  department: string;
  phone: string;
  note: string;
  status: "active" | "unsubscribed" | "bounced";
  source: string;
  tags: string[];
  created_at: string;
}

interface TagCount { tag: string; count: number; }

interface DuplicateName {
  name: string;
  count: number;
  subscribers: { id: string; email: string; company: string; department: string; created_at: string; status: string }[];
}
interface ReversedName {
  id: string;
  email: string;
  current_name: string;
  suggested_name: string;
  reason: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:       { label: "有効",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  unsubscribed: { label: "配信停止", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  bounced:      { label: "バウンス", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const EMPTY_FORM = { email: "", name: "", company: "", department: "", phone: "", note: "", tags: "" };

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagCount[]>([]);

  // フィルター
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // 追加フォーム
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  // 編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // CSV インポート
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTags, setImportTags] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 品質チェック
  const [showQuality, setShowQuality] = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityResult, setQualityResult] = useState<{ duplicate_names: DuplicateName[]; reversed_names: ReversedName[] } | null>(null);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  // セミナー同期
  const [syncing, setSyncing] = useState(false);

  // スマートタグ
  const [showSmartTag, setShowSmartTag] = useState(false);
  const [smartTagRule, setSmartTagRule] = useState("member_domain");
  const [smartTagTenant, setSmartTagTenant] = useState("whgc-seminars");
  const [smartTagName, setSmartTagName] = useState("");
  const [smartTagPreviewCount, setSmartTagPreviewCount] = useState<number | null>(null);
  const [smartTagPreviewList, setSmartTagPreviewList] = useState<{ id: string; email: string; name: string; company: string; department: string }[]>([]);
  const [showSmartTagList, setShowSmartTagList] = useState(false);
  const [smartTagPreviewing, setSmartTagPreviewing] = useState(false);
  const [smartTagApplying, setSmartTagApplying] = useState(false);


  const LIMIT = 50;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (q) params.set("q", q);
      if (filterStatus) params.set("status", filterStatus);
      if (filterTag) params.set("tag", filterTag);
      const res = await fetch(`/api/newsletter/subscribers?${params}`);
      const data = await res.json();
      setSubscribers(data.subscribers ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
    } catch { toast.error("読み込みに失敗しました"); }
    finally { setLoading(false); }
  }, [q, filterStatus, filterTag]);

  const loadTags = useCallback(async () => {
    const res = await fetch("/api/newsletter/tags");
    if (res.ok) setTags(await res.json());
  }, []);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => { loadTags(); }, [loadTags]);

  // 追加
  async function handleAdd() {
    if (!addForm.email) { toast.error("メールアドレスは必須です"); return; }
    setAdding(true);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          tags: addForm.tags.split(/[,、]/).map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("追加しました");
      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
      load(1); loadTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "追加に失敗しました"); }
    finally { setAdding(false); }
  }

  // 編集保存
  function startEdit(s: Subscriber) {
    setEditingId(s.id);
    setEditForm({ email: s.email, name: s.name, company: s.company, department: s.department, phone: s.phone, note: s.note, tags: s.tags.join(", ") });
  }
  async function handleSaveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/newsletter/subscribers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name, company: editForm.company, department: editForm.department,
          phone: editForm.phone, note: editForm.note,
          tags: editForm.tags.split(/[,、]/).map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("更新しました");
      setEditingId(null);
      load(page); loadTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "更新に失敗しました"); }
    finally { setSaving(false); }
  }

  // 削除
  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/newsletter/subscribers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("削除しました");
      setDeleteTarget(null);
      load(page); loadTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "削除に失敗しました"); }
    finally { setDeleting(false); }
  }

  // CSVインポート
  async function handleImport() {
    if (!importFile) { toast.error("ファイルを選択してください"); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const text = await importFile.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("データがありません（ヘッダー行 + データ行が必要です）");

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
        return row;
      });

      const res = await fetch("/api/newsletter/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          filename: importFile.name,
          source: "csv_import",
          tags: importTags.split(/[,、]/).map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportResult(data);
      toast.success(`インポート完了: ${data.imported}件追加 / ${data.skipped}件スキップ`);
      load(1); loadTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "インポートに失敗しました"); }
    finally { setImporting(false); }
  }

  // 品質チェック実行
  async function runQualityCheck() {
    setQualityLoading(true);
    setQualityResult(null);
    try {
      const res = await fetch("/api/newsletter/subscribers/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checks: ["duplicates", "reversed_names"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQualityResult(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "品質チェックに失敗しました");
    } finally {
      setQualityLoading(false);
    }
  }

  // 名前の修正を適用
  async function applyNameFix(id: string, newName: string) {
    setApplyingFix(id);
    try {
      const res = await fetch(`/api/newsletter/subscribers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("名前を修正しました");
      // 結果から該当を除去
      setQualityResult((prev) => prev ? {
        ...prev,
        reversed_names: prev.reversed_names.filter((r) => r.id !== id),
      } : null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "修正に失敗しました");
    } finally {
      setApplyingFix(null);
    }
  }

  // スマートタグ プレビュー
  async function previewSmartTag() {
    setSmartTagPreviewing(true);
    setSmartTagPreviewCount(null);
    setSmartTagPreviewList([]);
    setShowSmartTagList(false);
    try {
      const res = await fetch("/api/newsletter/subscribers/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: smartTagRule, tenant: smartTagTenant, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSmartTagPreviewCount(data.count);
      setSmartTagPreviewList(data.subscribers ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "プレビューに失敗しました"); }
    finally { setSmartTagPreviewing(false); }
  }

  // スマートタグ 付与
  async function applySmartTag() {
    if (!smartTagName.trim()) { toast.error("タグ名を入力してください"); return; }
    setSmartTagApplying(true);
    try {
      const res = await fetch("/api/newsletter/subscribers/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: smartTagRule, tenant: smartTagTenant, tagName: smartTagName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.tagged} 件にタグ「${smartTagName}」を付与しました`);
      setSmartTagName("");
      setSmartTagPreviewCount(null);
      load(1); loadTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "タグ付与に失敗しました"); }
    finally { setSmartTagApplying(false); }
  }

  // セミナー参加者→マスター同期
  async function syncFromRegistrations() {
    setSyncing(true);
    try {
      const res = await fetch("/api/newsletter/sync-from-registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      load(1);
    } catch (e) { toast.error(e instanceof Error ? e.message : "同期に失敗しました"); }
    finally { setSyncing(false); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="space-y-6">
        {/* ページヘッダー */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">メルマガ購読者管理</h1>
            <p className="admin-description mt-1">全テナント共通のメルマガデータベース</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => load(page)} className="gap-1.5">
              <RefreshCw className="size-3.5" />更新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowQuality((v) => !v); if (!showQuality && !qualityResult) runQualityCheck(); }}
              className="gap-1.5"
            >
              <ShieldCheck className="size-3.5" />品質チェック
              {showQuality ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowSmartTag((v) => !v); setSmartTagPreviewCount(null); }}
              className="gap-1.5"
            >
              <Tag className="size-3.5" />スマートタグ
              {showSmartTag ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
            <Button variant="outline" size="sm" onClick={syncFromRegistrations} disabled={syncing} className="gap-1.5">
              <ArrowDownToLine className="size-3.5" />{syncing ? "同期中…" : "セミナー同期"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
              <Upload className="size-3.5" />CSVインポート
            </Button>
            <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-1.5">
              <Plus className="size-3.5" />追加
            </Button>
          </div>
        </div>

        {/* ─── 品質チェックパネル ─── */}
        {showQuality && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span className="text-sm font-semibold">データ品質チェック</span>
                <span className="text-xs text-muted-foreground">AI によるデータ問題の検出</span>
              </div>
              <Button variant="outline" size="sm" onClick={runQualityCheck} disabled={qualityLoading} className="gap-1.5">
                <Sparkles className="size-3.5" />{qualityLoading ? "AI 分析中…" : "再チェック"}
              </Button>
            </div>

            {qualityLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin inline mr-2" />AI が購読者データを分析中…（しばらくお待ちください）
              </div>
            )}

            {qualityResult && !qualityLoading && (
              <div className="divide-y divide-border">

                {/* ─ 重複名チェック ─ */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                    <p className="text-sm font-medium">
                      同名・複数メール
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        （同じ名前で複数のメールアドレスが登録されているケース）
                      </span>
                    </p>
                    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                      qualityResult.duplicate_names.length > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {qualityResult.duplicate_names.length > 0
                        ? `${qualityResult.duplicate_names.length} 件の重複名`
                        : "問題なし"}
                    </span>
                  </div>

                  {qualityResult.duplicate_names.length > 0 && (
                    <div className="space-y-2">
                      {qualityResult.duplicate_names.map((dup) => (
                        <div key={dup.name} className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
                          <div className="px-3 py-2 bg-amber-100/50 flex items-center gap-2">
                            <span className="text-xs font-medium text-amber-800">{dup.name}</span>
                            <span className="text-xs text-amber-600">{dup.count} 件</span>
                          </div>
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-amber-100">
                              {dup.subscribers.map((s) => (
                                <tr key={s.id} className="hover:bg-amber-50">
                                  <td className="px-3 py-2 font-mono">{s.email}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{s.company}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{s.department}</td>
                                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                                    {new Date(s.created_at).toLocaleDateString("ja-JP")}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => { startEdit({ id: s.id, email: s.email, name: dup.name, company: s.company, department: s.department, phone: "", note: "", status: s.status as Subscriber["status"], source: "", tags: [], created_at: s.created_at }); setShowQuality(false); }}
                                      className="text-primary hover:underline"
                                    >
                                      編集
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─ 姓名逆転チェック ─ */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="size-3.5 text-blue-500 shrink-0" />
                    <p className="text-sm font-medium">
                      姓名逆転の可能性
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        （AI が姓と名の順番が逆と判定した名前）
                      </span>
                    </p>
                    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                      qualityResult.reversed_names.length > 0
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {qualityResult.reversed_names.length > 0
                        ? `${qualityResult.reversed_names.length} 件の要確認`
                        : "問題なし"}
                    </span>
                  </div>

                  {qualityResult.reversed_names.length > 0 && (
                    <div className="rounded-lg border border-blue-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-blue-100 bg-blue-50/50">
                            <th className="px-3 py-2 text-left font-medium text-blue-700">メール</th>
                            <th className="px-3 py-2 text-left font-medium text-blue-700">現在の名前</th>
                            <th className="px-3 py-2 text-left font-medium text-blue-700">修正候補</th>
                            <th className="px-3 py-2 text-left font-medium text-blue-700">理由</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100">
                          {qualityResult.reversed_names.map((r) => (
                            <tr key={r.id} className="hover:bg-blue-50/30">
                              <td className="px-3 py-2 font-mono text-muted-foreground">{r.email}</td>
                              <td className="px-3 py-2 text-red-600 line-through">{r.current_name}</td>
                              <td className="px-3 py-2 font-medium text-emerald-700">{r.suggested_name}</td>
                              <td className="px-3 py-2 text-muted-foreground">{r.reason}</td>
                              <td className="px-3 py-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={applyingFix === r.id}
                                  onClick={() => applyNameFix(r.id, r.suggested_name)}
                                  className="h-6 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                >
                                  <Check className="size-3" />
                                  {applyingFix === r.id ? "修正中…" : "修正を適用"}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {qualityResult.reversed_names.length === 0 && !qualityLoading && (
                    <p className="text-xs text-emerald-600">姓名の逆転は検出されませんでした。</p>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ─── スマートタグパネル ─── */}
        {showSmartTag && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
              <Tag className="size-4 text-primary" />
              <span className="text-sm font-semibold">スマートタグ</span>
              <span className="text-xs text-muted-foreground">条件に合う購読者に一括でタグを付与</span>
            </div>
            <div className="p-4 space-y-4">
              {/* ルール・テナント選択 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">抽出ルール</label>
                  <select
                    value={smartTagRule}
                    onChange={(e) => { setSmartTagRule(e.target.value); setSmartTagPreviewCount(null); }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="member_domain">会員企業ドメインと一致するメールアドレス</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">テナント（ドメイン参照元）</label>
                  <select
                    value={smartTagTenant}
                    onChange={(e) => { setSmartTagTenant(e.target.value); setSmartTagPreviewCount(null); }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="whgc-seminars">WHGC セミナー</option>
                    <option value="kgri-pic-center">KGRI PIC センター</option>
                    <option value="aff-events">AFF イベント</option>
                    <option value="pic-courses">PIC コース</option>
                  </select>
                </div>
              </div>

              {/* プレビュー */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button variant="outline" size="sm" onClick={previewSmartTag} disabled={smartTagPreviewing} className="gap-1.5">
                    <Search className="size-3.5" />{smartTagPreviewing ? "検索中…" : "対象者を確認"}
                  </Button>
                  {smartTagPreviewCount !== null && (
                    <button
                      type="button"
                      onClick={() => setShowSmartTagList((v) => !v)}
                      className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        smartTagPreviewCount > 0
                          ? "text-primary hover:text-primary/80"
                          : "text-muted-foreground cursor-default"
                      }`}
                    >
                      {smartTagPreviewCount > 0
                        ? `${smartTagPreviewCount.toLocaleString()} 件が対象です`
                        : "対象者が見つかりませんでした"}
                      {smartTagPreviewCount > 0 && (
                        showSmartTagList
                          ? <ChevronUp className="size-3.5" />
                          : <ChevronDown className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* 対象者リスト */}
                {showSmartTagList && smartTagPreviewList.length > 0 && (
                  <div className="rounded-lg border border-primary/20 overflow-hidden">
                    <div className="px-3 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
                      <Tag className="size-3 text-primary" />
                      <span className="text-xs font-medium text-primary">対象者一覧</span>
                    </div>
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/20 text-left">
                            <th className="px-3 py-2 font-medium text-muted-foreground">メールアドレス</th>
                            <th className="px-3 py-2 font-medium text-muted-foreground">氏名</th>
                            <th className="px-3 py-2 font-medium text-muted-foreground">会社・部署</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {smartTagPreviewList.map((s) => (
                            <tr key={s.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-mono">{s.email}</td>
                              <td className="px-3 py-2">{s.name || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {s.company}
                                {s.department && <span className="ml-1 opacity-70">/ {s.department}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* タグ名・付与 */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 flex-1 min-w-48">
                  <label className="text-xs font-medium text-muted-foreground">付与するタグ名</label>
                  <Input
                    value={smartTagName}
                    onChange={(e) => setSmartTagName(e.target.value)}
                    placeholder="例: WHGC会員企業"
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={applySmartTag}
                  disabled={smartTagApplying || !smartTagName.trim()}
                  className="gap-1.5 h-9"
                >
                  <Tag className="size-3.5" />{smartTagApplying ? "付与中…" : "タグを付与"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                既にタグが付いている場合は重複せず、新規分のみ追加されます。
              </p>
            </div>
          </div>
        )}

        {/* フィルターバー */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="メール・名前・会社で検索..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">全ステータス</option>
            <option value="active">有効</option>
            <option value="unsubscribed">配信停止</option>
            <option value="bounced">バウンス</option>
          </select>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">全タグ</option>
            {tags.map((t) => (
              <option key={t.tag} value={t.tag}>{t.tag}（{t.count}）</option>
            ))}
          </select>
          <Button onClick={() => load(1)}>検索</Button>
        </div>

        {/* 件数 */}
        <p className="text-sm text-muted-foreground">
          {loading ? "読み込み中..." : `${total.toLocaleString()} 件`}
          {filterTag && <span className="ml-2">｜ タグ: <span className="font-medium text-foreground">{filterTag}</span></span>}
        </p>

        {/* 一覧テーブル */}
        <div className="admin-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">メールアドレス / 氏名</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">会社・部署</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">タグ</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">ステータス</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">登録日</th>
                  <th className="px-4 py-3 text-xs w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    <RefreshCw className="size-4 animate-spin inline mr-2" />読み込み中...
                  </td></tr>
                )}
                {!loading && subscribers.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    購読者が見つかりません
                  </td></tr>
                )}
                {subscribers.map((s) => (
                  editingId === s.id ? (
                    <tr key={s.id} className="bg-primary/5">
                      <td className="px-3 py-2" colSpan={5}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <div><Label className="text-xs">氏名</Label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="h-8 text-xs mt-0.5" /></div>
                          <div><Label className="text-xs">会社</Label><Input value={editForm.company} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} className="h-8 text-xs mt-0.5" /></div>
                          <div><Label className="text-xs">部署</Label><Input value={editForm.department} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))} className="h-8 text-xs mt-0.5" /></div>
                          <div><Label className="text-xs">電話</Label><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="h-8 text-xs mt-0.5" /></div>
                          <div><Label className="text-xs">タグ（カンマ区切り）</Label><Input value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} className="h-8 text-xs mt-0.5" placeholder="タグ1, タグ2" /></div>
                          <div><Label className="text-xs">メモ</Label><Input value={editForm.note} onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} className="h-8 text-xs mt-0.5" /></div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="h-7 text-xs gap-1" disabled={saving} onClick={() => handleSaveEdit(s.id)}><Check className="size-3" />{saving ? "保存中..." : "保存"}</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditingId(null)}><X className="size-3" />キャンセル</Button>
                        </div>
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  ) : (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground text-xs">{s.email}</div>
                        {s.name && <div className="text-muted-foreground text-xs mt-0.5">{s.name}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {s.company && <div>{s.company}</div>}
                        {s.department && <div className="text-xs opacity-70">{s.department}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_LABEL[s.status]?.color ?? ""}`}>
                          {STATUS_LABEL[s.status]?.label ?? s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {new Date(s.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(s)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="編集"><Pencil className="size-3.5" /></button>
                          <button onClick={() => setDeleteTarget(s)} className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors" title="削除"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>前へ</Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => load(page + 1)}>次へ</Button>
          </div>
        )}
      </div>

      {/* ===== 追加フォーム モーダル ===== */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false); }}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold">購読者を追加</h2>
              <button onClick={() => setShowAddForm(false)} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="p-6 space-y-3">
              <div><Label className="text-sm">メールアドレス <span className="text-red-500">*</span></Label><Input value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className="mt-1" placeholder="example@example.com" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">氏名</Label><Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
                <div><Label className="text-sm">会社名</Label><Input value={addForm.company} onChange={(e) => setAddForm((f) => ({ ...f, company: e.target.value }))} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">部署</Label><Input value={addForm.department} onChange={(e) => setAddForm((f) => ({ ...f, department: e.target.value }))} className="mt-1" /></div>
                <div><Label className="text-sm">電話番号</Label><Input value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1" /></div>
              </div>
              <div><Label className="text-sm">タグ（カンマ区切り）</Label><Input value={addForm.tags} onChange={(e) => setAddForm((f) => ({ ...f, tags: e.target.value }))} className="mt-1" placeholder="会員, フォーラム2025" /></div>
              <div><Label className="text-sm">メモ</Label><Input value={addForm.note} onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>キャンセル</Button>
              <Button size="sm" disabled={adding} onClick={handleAdd}>{adding ? "追加中..." : "追加"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CSV インポート モーダル ===== */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowImport(false); setImportResult(null); } }}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold">CSVインポート</h2>
              <button onClick={() => { setShowImport(false); setImportResult(null); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">CSVファイルを選択（ヘッダー行必須）</p>
                <p className="text-xs text-muted-foreground mb-3">対応カラム: <code className="bg-muted px-1 rounded">email, name, company, department, phone, note, tags</code></p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  {importFile ? importFile.name : "ファイルを選択"}
                </Button>
              </div>
              <div>
                <Label className="text-sm">一括タグ付与（カンマ区切り）</Label>
                <Input value={importTags} onChange={(e) => setImportTags(e.target.value)} className="mt-1" placeholder="フォーラム2025, 新規リスト" />
                <p className="text-xs text-muted-foreground mt-1">全インポート行に共通で付与するタグ</p>
              </div>
              {importResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-4">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">インポート完了</p>
                  <div className="mt-1 text-sm text-emerald-600 dark:text-emerald-300 space-y-0.5">
                    <p>追加: <strong>{importResult.imported}</strong> 件</p>
                    <p>スキップ（重複）: <strong>{importResult.skipped}</strong> 件</p>
                    <p>合計: <strong>{importResult.total}</strong> 件</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" size="sm" onClick={() => { setShowImport(false); setImportResult(null); }}>閉じる</Button>
              <Button size="sm" disabled={importing || !importFile} onClick={handleImport}>{importing ? "インポート中..." : "インポート実行"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 削除確認 モーダル ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">削除の確認</h2>
            <p className="text-sm text-muted-foreground">
              以下の購読者を削除しますか？この操作は取り消せません。
            </p>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm font-medium">{deleteTarget.email}</p>
              {deleteTarget.name && <p className="text-xs text-muted-foreground mt-0.5">{deleteTarget.name}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
              <Button variant="destructive" size="sm" disabled={deleting} onClick={() => handleDelete(deleteTarget.id)}>
                {deleting ? "削除中..." : "削除"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
