"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw, Plus, Trash2,
  Users, Building2, CalendarCheck, Tag, Sparkles, X, Eye,
  Send,
} from "lucide-react";

// ─── 型定義 ───────────────────────────────────────────────
type ConditionDomain   = { type: "domain";   domains: string[] };
type ConditionEvent    = { type: "event";    seminar_id: string; seminar_title: string; attendance_type: "registered" | "attended" };
type ConditionKeyword  = { type: "keyword";  field: "department" | "company"; keywords: string[] };
type ListCondition = ConditionDomain | ConditionEvent | ConditionKeyword;

interface NewsletterList {
  id: string;
  name: string;
  description: string;
  conditions: ListCondition[];
  preview_count: number;
  created_at: string;
  updated_at: string;
}

interface Seminar { id: string; title: string; date: string; }

// ─── 日時フォーマット ─────────────────────────────────────
function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

// ─── 条件の説明テキスト ──────────────────────────────────
function conditionLabel(c: ListCondition): string {
  if (c.type === "domain")  return `ドメイン: ${c.domains.join(", ")}`;
  if (c.type === "event")   return `${c.attendance_type === "attended" ? "出席" : "参加登録"}: ${c.seminar_title || c.seminar_id}`;
  if (c.type === "keyword") return `${c.field === "department" ? "部署" : "会社"}: ${c.keywords.join(", ")}`;
  return "";
}

// ═══════════════════════════════════════════════════════════
// メインページ
// ═══════════════════════════════════════════════════════════
export default function NewsletterListPage() {
  const [lists, setLists] = useState<NewsletterList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingList, setEditingList] = useState<NewsletterList | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter/lists");
      const data = await res.json();
      setLists(Array.isArray(data) ? data : []);
    } catch {
      toast.error("リストの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  function openNew() {
    setEditingList(null);
    setShowBuilder(true);
  }

  function openEdit(list: NewsletterList) {
    setEditingList(list);
    setShowBuilder(true);
  }

  async function deleteList(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const res = await fetch(`/api/newsletter/lists/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("削除しました");
      loadLists();
    } else {
      toast.error("削除に失敗しました");
    }
  }

  if (showBuilder) {
    return (
      <ListBuilder
        initial={editingList}
        onClose={() => { setShowBuilder(false); loadLists(); }}
      />
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">リスト設定・配信</h1>
          <p className="admin-description mt-1">送信対象リストの条件設定・プレビュー・配信実行</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadLists} className="gap-1.5">
            <RefreshCw className="size-3.5" />更新
          </Button>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="size-3.5" />新規リスト作成
          </Button>
        </div>
      </div>

      {/* リスト一覧 */}
      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Users className="size-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">配信リストがありません</p>
          <p className="text-xs mt-1">「新規リスト作成」から送信対象の条件を設定してください。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div key={list.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{list.name || "（名称なし）"}</p>
                  {list.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{list.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {list.conditions.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{conditionLabel(c)}</Badge>
                    ))}
                    {list.conditions.length === 0 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">全購読者</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {list.preview_count > 0 && (
                    <span className="text-xs text-muted-foreground">{list.preview_count.toLocaleString()}件</span>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(list)}>編集</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteList(list.id, list.name)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">作成: {fmt(list.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// リストビルダー（条件エディタ）
// ═══════════════════════════════════════════════════════════
function ListBuilder({
  initial,
  onClose,
}: {
  initial: NewsletterList | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [conditions, setConditions] = useState<ListCondition[]>(initial?.conditions ?? []);
  const [saving, setSaving] = useState(false);

  // プレビュー
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ count: number; samples: { email: string; name: string; company: string }[] } | null>(null);

  // 条件追加パネル
  const [addingType, setAddingType] = useState<"domain" | "event" | "keyword" | null>(null);

  // ─ ドメイン追加 ─
  const [domainInput, setDomainInput] = useState("");

  // ─ イベント参加 ─
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loadingSeminars, setLoadingSeminars] = useState(false);
  const [selectedSeminar, setSelectedSeminar] = useState("");
  const [attendanceType, setAttendanceType] = useState<"registered" | "attended">("registered");

  // ─ キーワード ─
  const [kwField, setKwField] = useState<"department" | "company">("department");
  const [kwInput, setKwInput] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [pendingKeywords, setPendingKeywords] = useState<string[]>([]);

  // セミナー一覧読み込み
  useEffect(() => {
    if (addingType !== "event") return;
    setLoadingSeminars(true);
    fetch("/api/seminars?status=published&limit=100")
      .then((r) => r.json())
      .then((d) => setSeminars(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingSeminars(false));
  }, [addingType]);

  // ─ プレビュー実行 ─
  async function runPreview() {
    setPreviewing(true);
    setPreview(null);
    try {
      // 未保存の場合: preview-conditions エンドポイントを使う（conditions を body に直接渡す）
      // 保存済みの場合: /api/newsletter/lists/[id]/preview を使う
      const url = initial
        ? `/api/newsletter/lists/${initial.id}/preview`
        : `/api/newsletter/lists/preview-conditions`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
    } catch {
      toast.error("プレビューに失敗しました");
    } finally {
      setPreviewing(false);
    }
  }

  // ─ 保存 ─
  async function save() {
    if (!name.trim()) { toast.error("リスト名を入力してください"); return; }
    setSaving(true);
    try {
      if (initial) {
        const res = await fetch(`/api/newsletter/lists/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, conditions, preview_count: preview?.count ?? initial.preview_count }),
        });
        if (!res.ok) throw new Error();
        toast.success("保存しました");
      } else {
        const res = await fetch("/api/newsletter/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, conditions }),
        });
        if (!res.ok) throw new Error();
        toast.success("リストを作成しました");
      }
      onClose();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // ─ 条件を削除 ─
  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
    setPreview(null);
  }

  // ─ ドメイン条件を追加 ─
  function addDomainCondition() {
    const domains = domainInput.split(/[\s,、]+/).map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (domains.length === 0) { toast.error("ドメインを入力してください"); return; }
    setConditions((prev) => [...prev, { type: "domain", domains }]);
    setDomainInput("");
    setAddingType(null);
    setPreview(null);
  }

  // ─ イベント条件を追加 ─
  function addEventCondition() {
    if (!selectedSeminar) { toast.error("セミナーを選択してください"); return; }
    const s = seminars.find((s) => s.id === selectedSeminar);
    setConditions((prev) => [...prev, {
      type: "event",
      seminar_id: selectedSeminar,
      seminar_title: s?.title ?? selectedSeminar,
      attendance_type: attendanceType,
    }]);
    setSelectedSeminar("");
    setAddingType(null);
    setPreview(null);
  }

  // ─ キーワード条件を追加 ─
  function addKeywordCondition() {
    const keywords = [...new Set([
      ...pendingKeywords,
      ...kwInput.split(/[\s,、]+/).map((k) => k.trim()).filter(Boolean),
    ])];
    if (keywords.length === 0) { toast.error("キーワードを入力してください"); return; }
    setConditions((prev) => [...prev, { type: "keyword", field: kwField, keywords }]);
    setKwInput("");
    setPendingKeywords([]);
    setAiSuggestions([]);
    setAddingType(null);
    setPreview(null);
  }

  // ─ AI 提案 ─
  async function requestAiSuggest() {
    if (!aiQuery.trim()) { toast.error("検索したい条件を入力してください"); return; }
    setAiSuggesting(true);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/newsletter/lists/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery, field: kwField }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiSuggestions(data.keywords ?? []);
      if (data.keywords?.length === 0) toast.info("一致する値が見つかりませんでした");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 提案に失敗しました");
    } finally {
      setAiSuggesting(false);
    }
  }

  function toggleSuggestion(kw: string) {
    setPendingKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {initial ? "リストを編集" : "新規リスト作成"}
          </h1>
          <p className="admin-description mt-1">送信対象の絞り込み条件を設定します（AND 結合）</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>← 一覧に戻る</Button>
      </div>

      {/* 基本情報 */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">リスト名 <span className="text-destructive">*</span></label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：2025年1月セミナー参加者"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">メモ（任意）</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="このリストの用途や説明を記入（任意）"
          />
        </div>
      </div>

      {/* 絞り込み条件 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">絞り込み条件</h2>
          <span className="text-xs text-muted-foreground">複数条件はすべて AND 結合</span>
        </div>

        {/* 設定済み条件 */}
        {conditions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            条件なし（全ての購読者が対象）
          </div>
        ) : (
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {c.type === "domain"  && <Building2 className="size-3.5 text-muted-foreground shrink-0" />}
                  {c.type === "event"   && <CalendarCheck className="size-3.5 text-muted-foreground shrink-0" />}
                  {c.type === "keyword" && <Tag className="size-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-sm">{conditionLabel(c)}</span>
                </div>
                <button onClick={() => removeCondition(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 条件追加パネル */}
        {addingType === null ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddingType("domain")} className="gap-1.5">
              <Building2 className="size-3.5" />会社ドメイン
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddingType("event")} className="gap-1.5">
              <CalendarCheck className="size-3.5" />イベント参加
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddingType("keyword")} className="gap-1.5">
              <Tag className="size-3.5" />部署・会社キーワード
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {addingType === "domain"  && "会社ドメインで絞り込み"}
                {addingType === "event"   && "イベント参加履歴で絞り込み"}
                {addingType === "keyword" && "部署・会社キーワードで絞り込み"}
              </p>
              <button onClick={() => setAddingType(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            {/* ─ ドメイン入力 ─ */}
            {addingType === "domain" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    ドメイン（複数はカンマ・スペース区切り）
                  </label>
                  <Input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="例：company.co.jp, example.com"
                    onKeyDown={(e) => e.key === "Enter" && addDomainCondition()}
                  />
                  <p className="text-xs text-muted-foreground">
                    @以降のドメインで後方一致検索します（例：co.jp を指定すると〜.co.jp も一致）
                  </p>
                </div>
                <Button size="sm" onClick={addDomainCondition}>条件を追加</Button>
              </div>
            )}

            {/* ─ イベント参加 ─ */}
            {addingType === "event" && (
              <div className="space-y-3">
                {loadingSeminars ? (
                  <p className="text-sm text-muted-foreground">セミナー一覧を読み込み中…</p>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">セミナーを選択</label>
                    <select
                      value={selectedSeminar}
                      onChange={(e) => setSelectedSeminar(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">選択してください</option>
                      {seminars.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}{s.date ? ` (${s.date.slice(0, 10)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">参加タイプ</label>
                  <div className="flex gap-3">
                    {(["registered", "attended"] as const).map((t) => (
                      <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input
                          type="radio"
                          value={t}
                          checked={attendanceType === t}
                          onChange={() => setAttendanceType(t)}
                        />
                        {t === "registered" ? "参加登録済み" : "実際に出席"}
                      </label>
                    ))}
                  </div>
                  {attendanceType === "attended" && (
                    <p className="text-xs text-amber-600">※ 出席は事後アンケート回答を指標として判定します</p>
                  )}
                </div>
                <Button size="sm" onClick={addEventCondition} disabled={!selectedSeminar}>条件を追加</Button>
              </div>
            )}

            {/* ─ キーワード ─ */}
            {addingType === "keyword" && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  {(["department", "company"] as const).map((f) => (
                    <label key={f} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input
                        type="radio"
                        value={f}
                        checked={kwField === f}
                        onChange={() => { setKwField(f); setAiSuggestions([]); setPendingKeywords([]); }}
                      />
                      {f === "department" ? "部署名" : "会社名"}
                    </label>
                  ))}
                </div>

                {/* AI 提案 */}
                <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    <p className="text-xs font-medium">AI で候補を検索</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      placeholder={kwField === "department" ? "例：マーケティング、営業部長" : "例：食品メーカー、商社"}
                      className="flex-1 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && requestAiSuggest()}
                    />
                    <Button variant="outline" size="sm" onClick={requestAiSuggest} disabled={aiSuggesting} className="gap-1.5 shrink-0">
                      <Sparkles className="size-3.5" />{aiSuggesting ? "検索中…" : "AI 検索"}
                    </Button>
                  </div>
                  {aiSuggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">候補をクリックして選択：</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiSuggestions.map((kw) => (
                          <button
                            key={kw}
                            onClick={() => toggleSuggestion(kw)}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              pendingKeywords.includes(kw)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background hover:bg-muted"
                            }`}
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 手動入力 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">手動でキーワードを追加（カンマ区切り）</label>
                  <Input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    placeholder="例：営業, sales, マーケ"
                  />
                </div>

                {/* 選択済みキーワード */}
                {pendingKeywords.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">選択済み：</p>
                    <div className="flex flex-wrap gap-1">
                      {pendingKeywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="gap-1 text-xs">
                          {kw}
                          <button onClick={() => toggleSuggestion(kw)} className="ml-0.5 hover:text-destructive">
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={addKeywordCondition}
                  disabled={pendingKeywords.length === 0 && !kwInput.trim()}
                >
                  条件を追加
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* プレビュー */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">プレビュー</h2>
          <Button variant="outline" size="sm" onClick={runPreview} disabled={previewing} className="gap-1.5">
            <Eye className="size-3.5" />{previewing ? "確認中…" : "件数を確認"}
          </Button>
        </div>
        {preview ? (
          <div className="space-y-2">
            <p className="text-sm">
              対象: <span className="font-bold text-primary">{preview.count.toLocaleString()}</span> 件
            </p>
            {preview.samples.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium">メールアドレス</th>
                      <th className="px-3 py-2 text-left font-medium">名前</th>
                      <th className="px-3 py-2 text-left font-medium">会社</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.samples.map((s) => (
                      <tr key={s.email}>
                        <td className="px-3 py-2 font-mono">{s.email}</td>
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.company}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.count > preview.samples.length && (
                  <p className="px-3 py-2 text-xs text-muted-foreground bg-muted/10">
                    他 {(preview.count - preview.samples.length).toLocaleString()} 件…
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">「件数を確認」をクリックすると対象人数が表示されます。</p>
        )}
      </div>

      {/* 保存 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>キャンセル</Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          <Send className="size-3.5" />{saving ? "保存中…" : "リストを保存"}
        </Button>
      </div>
    </div>
  );
}

