"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, Upload, RefreshCw, Trash2, Pencil, X, Check } from "lucide-react";

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
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
              <Upload className="size-3.5" />CSVインポート
            </Button>
            <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-1.5">
              <Plus className="size-3.5" />追加
            </Button>
          </div>
        </div>

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
          <Button size="sm" onClick={() => load(1)} className="h-9">検索</Button>
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
              <Button variant="outline" onClick={() => setShowAddForm(false)}>キャンセル</Button>
              <Button disabled={adding} onClick={handleAdd}>{adding ? "追加中..." : "追加"}</Button>
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
              <Button variant="outline" onClick={() => { setShowImport(false); setImportResult(null); }}>閉じる</Button>
              <Button disabled={importing || !importFile} onClick={handleImport}>{importing ? "インポート中..." : "インポート実行"}</Button>
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
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
              <Button variant="destructive" disabled={deleting} onClick={() => handleDelete(deleteTarget.id)}>
                {deleting ? "削除中..." : "削除"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
