"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, Upload, RefreshCw, Trash2, Pencil, X, Check, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle, Sparkles, ArrowLeftRight, ArrowDownToLine, Tag, GitMerge } from "lucide-react";

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

interface PendingEntry {
  id: string;
  newName: string;
  newCompany: string;
  newDepartment: string;
  newPhone: string;
  newNote: string;
  newTags: string;
  createdAt: string;
}

interface ImportPendingGroup {
  existingId: string;
  email: string;
  currentName: string;
  currentCompany: string;
  currentDepartment: string;
  currentPhone: string;
  currentNote: string;
  currentTags: string;
  currentStatus: string;
  pending: PendingEntry[];
}

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
  const [importResult, setImportResult] = useState<{ imported: number; skipped?: number; pending?: number; total: number } | null>(null);
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

  // 重複レビュー
  const [showPending, setShowPending] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<ImportPendingGroup[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null); // existingId

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

  // タグ別一括削除
  const [showDeleteByTag, setShowDeleteByTag] = useState(false);
  const [deleteByTagName, setDeleteByTagName] = useState("");
  const [deleteByTagCount, setDeleteByTagCount] = useState<number | null>(null);
  const [deleteByTagPreviewing, setDeleteByTagPreviewing] = useState(false);
  const [deleteByTagDeleting, setDeleteByTagDeleting] = useState(false);

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
      const tags = addForm.tags.split(/[,、]/).map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, tags }),
      });
      const data = await res.json();

      if (res.status === 409) {
        // 重複メール → pending に保存してレビューへ
        const importRes = await fetch("/api/newsletter/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: [{ ...addForm }],
            filename: "手動追加",
            source: "manual",
            tags,
          }),
        });
        if (!importRes.ok) throw new Error("保留の保存に失敗しました");
        toast.info("このメールアドレスは既に登録済みのため「重複レビュー」に保留しました");
        setShowAddForm(false);
        setAddForm(EMPTY_FORM);
        setPendingTotal((prev) => prev + 1);
        // 重複レビューパネルを開く
        setShowPending(true);
        loadPending();
        return;
      }

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

      // カラム名の正規化マップ（日本語・Sansan等の別名 → 内部フィールド名）
      const COL_MAP: Record<string, string> = {
        // email
        "email": "email", "e-mail": "email", "mail": "email", "メール": "email",
        "メールアドレス": "email", "email(1)": "email", "email（1）": "email",
        "e-mail(1)": "email", "メール(1)": "email",
        // name（フルネーム列）
        "name": "name", "氏名": "name", "名前": "name", "お名前": "name",
        "フルネーム": "name", "担当者名": "name",
        // 姓・名を別列で持つCSV（Sansanなど）→ 後で結合
        "姓": "last_name", "名": "first_name",
        "last_name": "last_name", "first_name": "first_name",
        "family_name": "last_name", "given_name": "first_name",
        // company
        "company": "company", "会社名": "company", "会社": "company",
        "勤務先": "company", "所属": "company", "organization": "company",
        // department
        "department": "department", "部署名": "department", "部署": "department",
        "部門": "department", "部門名": "department",
        // phone
        "phone": "phone", "電話": "phone", "電話番号": "phone", "tel": "phone",
        "携帯": "phone", "携帯電話": "phone",
        // note（役職・メモ・備考も note に格納）
        "note": "note", "メモ": "note", "備考": "note", "コメント": "note",
        "役職": "note",
        // tags
        "tags": "tags", "tag": "tags", "タグ": "tags",
      };

      const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const headers = rawHeaders.map((h) => {
        const lower = h.toLowerCase().trim();
        return COL_MAP[lower] ?? COL_MAP[h] ?? lower;
      });

      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
        // 姓・名が別列の場合、「姓 名」順で name に結合（name 列が空の場合のみ）
        if (!row.name && (row.last_name || row.first_name)) {
          row.name = [row.last_name, row.first_name].filter(Boolean).join(" ");
        }
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

  // 重複保留の読み込み
  async function loadPending() {
    setPendingLoading(true);
    try {
      const res = await fetch("/api/newsletter/import-pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingGroups(data.groups ?? []);
      setPendingTotal(data.total ?? 0);
    } catch (e) { toast.error(e instanceof Error ? e.message : "読み込みに失敗しました"); }
    finally { setPendingLoading(false); }
  }

  // データを採用（existingId: 対象グループ, adoptPendingId: null=既存採用, id=pending採用）
  async function adoptData(existingId: string, adoptPendingId: string | null) {
    setAdoptingId(existingId);
    try {
      const res = await fetch("/api/newsletter/import-pending/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingId, adoptPendingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("採用しました。他の候補は非アクティブにしました");
      setPendingGroups((prev) => prev.filter((g) => g.existingId !== existingId));
      setPendingTotal((prev) => Math.max(0, prev - 1));
      if (adoptPendingId) load(page);
    } catch (e) { toast.error(e instanceof Error ? e.message : "処理に失敗しました"); }
    finally { setAdoptingId(null); }
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

  // スマートタグ 付与（複数タグ対応：カンマ・読点・改行で分割）
  async function applySmartTag() {
    const tagNames = smartTagName.split(/[,、\n]+/).map((t) => t.trim()).filter(Boolean);
    if (tagNames.length === 0) { toast.error("タグ名を入力してください"); return; }
    setSmartTagApplying(true);
    try {
      const res = await fetch("/api/newsletter/subscribers/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: smartTagRule, tenant: smartTagTenant, tagNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const tagLabel = tagNames.length === 1 ? `「${tagNames[0]}」` : `${tagNames.length} 種類のタグ`;
      toast.success(`${data.tagged} 件に${tagLabel}を付与しました`);
      setSmartTagName("");
      setSmartTagPreviewCount(null);
      load(1); loadTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "タグ付与に失敗しました"); }
    finally { setSmartTagApplying(false); }
  }

  // タグ別一括削除 プレビュー
  async function previewDeleteByTag() {
    if (!deleteByTagName.trim()) { toast.error("タグ名を入力してください"); return; }
    setDeleteByTagPreviewing(true);
    setDeleteByTagCount(null);
    try {
      const res = await fetch("/api/newsletter/subscribers/delete-by-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: deleteByTagName.trim(), preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleteByTagCount(data.count);
    } catch (e) { toast.error(e instanceof Error ? e.message : "確認に失敗しました"); }
    finally { setDeleteByTagPreviewing(false); }
  }

  // タグ別一括削除 実行
  async function executeDeleteByTag() {
    if (!deleteByTagName.trim() || deleteByTagCount === null) return;
    setDeleteByTagDeleting(true);
    try {
      const res = await fetch("/api/newsletter/subscribers/delete-by-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: deleteByTagName.trim(), preview: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`「${deleteByTagName}」タグの購読者 ${data.deleted} 件を削除しました`);
      setShowDeleteByTag(false);
      setDeleteByTagName("");
      setDeleteByTagCount(null);
      load(1); loadTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "削除に失敗しました"); }
    finally { setDeleteByTagDeleting(false); }
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
              onClick={() => { setShowPending((v) => !v); if (!showPending) loadPending(); }}
              className={`gap-1.5 relative ${pendingTotal > 0 ? "border-amber-400 text-amber-700 hover:bg-amber-50" : ""}`}
            >
              <GitMerge className="size-3.5" />重複レビュー
              {pendingTotal > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                  {pendingTotal > 9 ? "9+" : pendingTotal}
                </span>
              )}
              {showPending ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
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
            <Button variant="outline" size="sm" onClick={() => { setShowDeleteByTag(true); setDeleteByTagCount(null); }} className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
              <Trash2 className="size-3.5" />タグで削除
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

        {/* ─── 重複レビューパネル ─── */}
        {showPending && (
          <div className="rounded-xl border border-amber-200 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 bg-amber-50/60 dark:bg-amber-900/20">
              <div className="flex items-center gap-2">
                <GitMerge className="size-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">重複レビュー</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  CSVインポート時に保留された重複データ
                </span>
                {pendingTotal > 0 && (
                  <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                    {pendingTotal} 件
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={loadPending} disabled={pendingLoading} className="gap-1.5 border-amber-300 hover:bg-amber-50">
                <RefreshCw className={`size-3.5 ${pendingLoading ? "animate-spin" : ""}`} />更新
              </Button>
            </div>

            {pendingLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin inline mr-2" />読み込み中…
              </div>
            )}

            {!pendingLoading && pendingGroups.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Check className="size-4 inline mr-2 text-emerald-500" />保留中の重複データはありません
              </div>
            )}

            {!pendingLoading && pendingGroups.length > 0 && (
              <div className="divide-y divide-amber-100">
                {pendingGroups.map((group) => {
                  const isAdopting = adoptingId === group.existingId;
                  // 全候補カード: [現在のDB情報, ...pending候補]
                  const cards = [
                    {
                      id: null as string | null,
                      label: "現在の登録情報（DB）",
                      labelColor: "text-muted-foreground",
                      headerColor: "bg-muted/30 border-border",
                      borderColor: "border-border",
                      bgColor: "bg-muted/10",
                      fields: [
                        { label: "氏名", val: group.currentName, base: undefined as string | undefined },
                        { label: "会社", val: group.currentCompany, base: undefined as string | undefined },
                        { label: "部署", val: group.currentDepartment, base: undefined as string | undefined },
                        { label: "電話", val: group.currentPhone, base: undefined as string | undefined },
                        { label: "メモ", val: group.currentNote, base: undefined as string | undefined },
                        { label: "タグ", val: group.currentTags, base: undefined as string | undefined },
                      ],
                    },
                    ...group.pending.map((p, i) => ({
                      id: p.id,
                      label: group.pending.length === 1 ? "新しい情報（インポート）" : `候補 ${i + 1}（インポート）`,
                      labelColor: "text-amber-700",
                      headerColor: "bg-amber-100/50 border-amber-200",
                      borderColor: "border-amber-200",
                      bgColor: "bg-amber-50/30 dark:bg-amber-900/10",
                      fields: [
                        { label: "氏名", val: p.newName, base: group.currentName },
                        { label: "会社", val: p.newCompany, base: group.currentCompany },
                        { label: "部署", val: p.newDepartment, base: group.currentDepartment },
                        { label: "電話", val: p.newPhone, base: group.currentPhone },
                        { label: "メモ", val: p.newNote, base: group.currentNote },
                        { label: "タグ", val: p.newTags, base: group.currentTags },
                      ],
                    })),
                  ];

                  return (
                    <div key={group.existingId} className="p-4 space-y-3">
                      {/* メールアドレス */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium">{group.email}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          {group.pending.length + 1} 件の候補
                        </span>
                      </div>

                      {/* 候補カード一覧 */}
                      <div className={`grid gap-3 ${cards.length === 2 ? "grid-cols-2" : cards.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                        {cards.map((card) => (
                          <div key={card.id ?? "__existing__"} className={`rounded-lg border ${card.borderColor} ${card.bgColor} overflow-hidden flex flex-col`}>
                            <div className={`px-3 py-1.5 border-b ${card.headerColor}`}>
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${card.labelColor}`}>
                                {card.label}
                              </span>
                            </div>
                            <div className="px-3 py-2 space-y-1 text-xs flex-1">
                              {card.fields.map(({ label, val, base }) => {
                                const isDiff = base !== undefined && val && val !== base;
                                return (
                                  <div key={label} className="flex gap-2">
                                    <span className="w-8 shrink-0 text-muted-foreground">{label}</span>
                                    <span className={
                                      !val ? "text-muted-foreground/50 italic"
                                        : isDiff ? "font-medium text-amber-800 dark:text-amber-300"
                                          : "text-foreground"
                                    }>
                                      {val || "—"}
                                    </span>
                                    {isDiff && <span className="text-[9px] text-amber-500 shrink-0">変更あり</span>}
                                  </div>
                                );
                              })}
                            </div>
                            {/* 採用ボタン */}
                            <div className="px-3 py-2 border-t border-border/50">
                              <Button
                                size="sm"
                                variant={card.id === null ? "outline" : "default"}
                                disabled={isAdopting}
                                onClick={() => adoptData(group.existingId, card.id)}
                                className="w-full h-7 text-xs gap-1"
                              >
                                <Check className="size-3" />
                                {isAdopting ? "処理中…" : "このデータを採用"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">付与するタグ名</label>
                  <Input
                    value={smartTagName}
                    onChange={(e) => setSmartTagName(e.target.value)}
                    placeholder="例: WHGC会員企業, 会員, 2025年度"
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">カンマ区切りで複数のタグを一括付与できます</p>
                </div>
                {/* 入力済みタグのプレビューチップ */}
                {smartTagName.trim() && (
                  <div className="flex flex-wrap gap-1.5">
                    {smartTagName.split(/[,、\n]+/).map((t) => t.trim()).filter(Boolean).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs text-primary font-medium">
                        <Tag className="size-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={applySmartTag}
                  disabled={smartTagApplying || !smartTagName.trim()}
                  className="gap-1.5"
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

      {/* ===== タグ別一括削除 モーダル ===== */}
      {showDeleteByTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteByTag(false); }}>
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-red-600 dark:text-red-400">タグで一括削除</h2>
                <p className="text-xs text-muted-foreground mt-0.5">指定したタグを持つ購読者をすべて削除します</p>
              </div>
              <button onClick={() => setShowDeleteByTag(false)} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* タグ選択 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">削除するタグ名</label>
                <div className="flex gap-2">
                  <select
                    value={deleteByTagName}
                    onChange={(e) => { setDeleteByTagName(e.target.value); setDeleteByTagCount(null); }}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">タグを選択…</option>
                    {tags.map(({ tag, count }) => (
                      <option key={tag} value={tag}>{tag}（{count.toLocaleString()}件）</option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" onClick={previewDeleteByTag} disabled={deleteByTagPreviewing || !deleteByTagName} className="shrink-0">
                    {deleteByTagPreviewing ? "確認中…" : "件数確認"}
                  </Button>
                </div>
              </div>

              {/* 確認メッセージ */}
              {deleteByTagCount !== null && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 space-y-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    「{deleteByTagName}」タグの購読者 {deleteByTagCount.toLocaleString()} 件を削除します
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">この操作は取り消せません。削除してよろしいですか？</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteByTag(false)}>キャンセル</Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={executeDeleteByTag}
                  disabled={deleteByTagDeleting || deleteByTagCount === null || deleteByTagCount === 0}
                  className="gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  {deleteByTagDeleting ? "削除中…" : `${deleteByTagCount ?? 0} 件を削除`}
                </Button>
              </div>
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
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-4 space-y-2">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">インポート完了</p>
                  <div className="text-sm text-emerald-600 dark:text-emerald-300 space-y-0.5">
                    <p>新規追加: <strong>{importResult.imported}</strong> 件</p>
                    <p>重複保留: <strong>{importResult.pending}</strong> 件</p>
                    <p>合計: <strong>{importResult.total}</strong> 件</p>
                  </div>
                  {(importResult.pending ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => { setShowImport(false); setImportResult(null); setShowPending(true); loadPending(); }}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                    >
                      <GitMerge className="size-3.5" />重複 {importResult.pending} 件を確認する →
                    </button>
                  )}
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
