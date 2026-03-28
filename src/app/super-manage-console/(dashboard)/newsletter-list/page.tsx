"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw, Plus, Trash2, Users, Building2, CalendarCheck, Tag, Sparkles,
  X, Search, CheckSquare, Square, ChevronLeft, ChevronRight,
  ShieldCheck, AlertTriangle, ArrowLeftRight, Send, Clock, FileText,
} from "lucide-react";

// ─── 型定義 ───────────────────────────────────────────────
type ConditionDomain  = { type: "domain";  domains: string[] };
type ConditionEvent   = { type: "event";   seminar_id: string; seminar_title: string; attendance_type: "registered" | "attended" };
type ConditionKeyword = { type: "keyword"; field: "department" | "company"; keywords: string[] };
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

interface Subscriber {
  id: string;
  email: string;
  name: string;
  company: string;
  department: string;
}

interface Member {
  subscriber_id: string;
  email: string;
  name: string;
  company: string;
  added_at: string;
  sub_status: string;
}

interface Campaign {
  id: string;
  subject: string;
  status: string;
  scheduled_at: string | null;
  list_id: string | null;
  created_at: string;
}

interface DuplicateGroup {
  name: string;
  count: number;
  subscribers: { id: string; email: string; company: string }[];
}

interface ReversedName {
  id: string;
  email: string;
  current_name: string;
  suggested_name: string;
  reason: string;
}

// ─── ユーティリティ ───────────────────────────────────────
function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

function conditionLabel(c: ListCondition): string {
  if (c.type === "domain")  return `ドメイン: ${c.domains.join(", ")}`;
  if (c.type === "event")   return `${c.attendance_type === "attended" ? "出席" : "参加登録"}: ${c.seminar_title || c.seminar_id}`;
  if (c.type === "keyword") return `${c.field === "department" ? "部署" : "会社"}: ${c.keywords.join(", ")}`;
  return "";
}

// ═══════════════════════════════════════════════════════════
// リスト一覧ページ
// ═══════════════════════════════════════════════════════════
export default function NewsletterListPage() {
  const [lists, setLists] = useState<NewsletterList[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingList, setEditingList] = useState<NewsletterList | null | "new">(null);

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

  if (editingList === "new") {
    return <ListBuilder initial={null} onClose={() => { setEditingList(null); loadLists(); }} />;
  }
  if (editingList) {
    return <ListBuilder initial={editingList} onClose={() => { setEditingList(null); loadLists(); }} />;
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">リスト設定・配信</h1>
          <p className="admin-description mt-1">送信対象リストの作成・編集・メンバー管理</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadLists} className="gap-1.5">
            <RefreshCw className="size-3.5" />更新
          </Button>
          <Button size="sm" onClick={() => setEditingList("new")} className="gap-1.5">
            <Plus className="size-3.5" />新規リスト作成
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Users className="size-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">配信リストがありません</p>
          <p className="text-xs mt-1">「新規リスト作成」から送信対象を設定してください。</p>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    メンバー: <span className="font-medium text-foreground">{list.preview_count.toLocaleString()}</span> 件
                    　作成: {fmt(list.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditingList(list)}>
                    編集・メンバー管理
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => deleteList(list.id, list.name)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// リストビルダー（メンバー管理）
// ═══════════════════════════════════════════════════════════
function ListBuilder({ initial, onClose }: { initial: NewsletterList | null; onClose: () => void }) {
  const isNew = !initial;
  const listId = initial?.id ?? null;

  // ─ 基本情報 ─
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  // ─ 絞り込み条件 ─
  const [conditions, setConditions] = useState<ListCondition[]>([]);
  const [addingType, setAddingType] = useState<"domain" | "event" | "keyword" | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loadingSeminars, setLoadingSeminars] = useState(false);
  const [selectedSeminar, setSelectedSeminar] = useState("");
  const [attendanceType, setAttendanceType] = useState<"registered" | "attended">("registered");
  const [kwField, setKwField] = useState<"department" | "company">("department");
  const [kwInput, setKwInput] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [pendingKeywords, setPendingKeywords] = useState<string[]>([]);

  // ─ 検索結果 ─
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    total: number;
    subscribers: Subscriber[];
    already_in_list: string[];
    page: number;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers] = useState(false);

  // ─ 現在のリストメンバー ─
  const [members, setMembers] = useState<Member[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberPage, setMemberPage] = useState(1);
  const [membersLoading, setMembersLoading] = useState(false);

  // ─ AI品質チェック ─
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityResult, setQualityResult] = useState<{
    duplicates: DuplicateGroup[];
    reversed_names: ReversedName[];
  } | null>(null);

  // ─ 配信設定 ─
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number } | null>(null);

  const MEMBER_LIMIT = 50;
  const SEARCH_LIMIT = 50;

  // ─ メンバー読み込み ─
  const loadMembers = useCallback(async (page: number) => {
    if (!listId) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/newsletter/lists/${listId}/members?page=${page}&limit=${MEMBER_LIMIT}`);
      const data = await res.json();
      setMembers(data.members ?? []);
      setMemberTotal(data.total ?? 0);
      setMemberPage(page);
    } catch {
      toast.error("メンバーの取得に失敗しました");
    } finally {
      setMembersLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    if (listId) loadMembers(1);
  }, [listId, loadMembers]);

  // ─ キャンペーン一覧読み込み ─
  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/newsletter/campaigns");
      const data = await res.json();
      const all: Campaign[] = Array.isArray(data) ? data : [];
      // draft/scheduled のみ表示
      setCampaigns(all.filter((c) => c.status === "draft" || c.status === "scheduled"));
    } catch {
      toast.error("メール一覧の取得に失敗しました");
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (listId) loadCampaigns();
  }, [listId, loadCampaigns]);

  // ─ 配信予約 ─
  async function scheduleDelivery() {
    if (!selectedCampaignId) { toast.error("メールを選択してください"); return; }
    if (!scheduledAt) { toast.error("配信日時を設定してください"); return; }
    if (!listId) { toast.error("先にリストを保存してください"); return; }
    setScheduling(true);
    try {
      // scheduled_at は JST 入力 → UTC に変換
      const utc = new Date(scheduledAt).toISOString();
      const res = await fetch(`/api/newsletter/campaigns/${selectedCampaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_id: listId, scheduled_at: utc, status: "scheduled" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "失敗"); }
      toast.success("配信予約を設定しました");
      loadCampaigns();
    } catch (e: any) {
      toast.error(e.message ?? "配信予約の設定に失敗しました");
    } finally {
      setScheduling(false);
    }
  }

  // ─ 今すぐ送信 ─
  async function sendNow() {
    if (!selectedCampaignId) { toast.error("メールを選択してください"); return; }
    if (!listId) { toast.error("先にリストを保存してください"); return; }
    if (!confirm("今すぐ全メンバーに送信しますか？")) return;
    setSending(true);
    setSendProgress(null);
    try {
      // まず list_id を設定
      await fetch(`/api/newsletter/campaigns/${selectedCampaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_id: listId }),
      });
      // バッチ送信ループ
      let offset = 0;
      while (true) {
        const res = await fetch(`/api/newsletter/campaigns/${selectedCampaignId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "送信失敗"); }
        const result = await res.json();
        setSendProgress({ sent: (result.next_offset ?? offset), total: result.total ?? 0 });
        if (!result.has_more) break;
        offset = result.next_offset;
      }
      toast.success("送信が完了しました");
      loadCampaigns();
    } catch (e: any) {
      toast.error(e.message ?? "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  // ─ セミナー一覧読み込み ─
  useEffect(() => {
    if (addingType !== "event") return;
    setLoadingSeminars(true);
    fetch("/api/seminars?status=published&limit=100")
      .then((r) => r.json())
      .then((d) => setSeminars(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingSeminars(false));
  }, [addingType]);

  // ─ 条件ビルダー操作 ─
  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
    setSearchResult(null);
  }

  function addDomainCondition() {
    const domains = domainInput.split(/[\s,、]+/).map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (domains.length === 0) { toast.error("ドメインを入力してください"); return; }
    setConditions((prev) => [...prev, { type: "domain", domains }]);
    setDomainInput(""); setAddingType(null); setSearchResult(null);
  }

  function addEventCondition() {
    if (!selectedSeminar) { toast.error("セミナーを選択してください"); return; }
    const s = seminars.find((s) => s.id === selectedSeminar);
    setConditions((prev) => [...prev, { type: "event", seminar_id: selectedSeminar, seminar_title: s?.title ?? selectedSeminar, attendance_type: attendanceType }]);
    setSelectedSeminar(""); setAddingType(null); setSearchResult(null);
  }

  function addKeywordCondition() {
    const keywords = [...new Set([...pendingKeywords, ...kwInput.split(/[\s,、]+/).map((k) => k.trim()).filter(Boolean)])];
    if (keywords.length === 0) { toast.error("キーワードを入力してください"); return; }
    setConditions((prev) => [...prev, { type: "keyword", field: kwField, keywords }]);
    setKwInput(""); setPendingKeywords([]); setAiSuggestions([]); setAddingType(null); setSearchResult(null);
  }

  async function requestAiSuggest() {
    if (!aiQuery.trim()) { toast.error("検索したい条件を入力してください"); return; }
    setAiSuggesting(true); setAiSuggestions([]);
    try {
      const res = await fetch("/api/newsletter/lists/ai-suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
    setPendingKeywords((prev) => prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]);
  }

  // ─ 検索実行 ─
  async function runSearch(page = 1) {
    setSearching(true);
    setSearchResult(null);
    setSelectedIds(new Set());
    try {
      const res = await fetch("/api/newsletter/subscribers/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditions,
          page,
          limit: SEARCH_LIMIT,
          exclude_list_id: listId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResult({ ...data, page });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "検索に失敗しました");
    } finally {
      setSearching(false);
    }
  }

  // ─ 選択操作 ─
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!searchResult) return;
    const newSet = new Set(selectedIds);
    searchResult.subscribers.forEach((s) => {
      if (!searchResult.already_in_list.includes(s.id)) newSet.add(s.id);
    });
    setSelectedIds(newSet);
  }

  function clearSelection() { setSelectedIds(new Set()); }

  // ─ リストに追加（保存済みリストのみ） ─
  async function addSelectedToList() {
    if (!listId) {
      toast.error("先にリストを保存してください");
      return;
    }
    if (selectedIds.size === 0) { toast.error("追加する対象を選択してください"); return; }
    setAddingMembers(true);
    try {
      const res = await fetch(`/api/newsletter/lists/${listId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber_ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.added} 件をリストに追加しました`);
      setSelectedIds(new Set());
      setSearchResult(null);
      setConditions([]);
      await loadMembers(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setAddingMembers(false);
    }
  }

  // ─ メンバー削除 ─
  async function removeMember(subscriberId: string) {
    if (!listId) return;
    try {
      const res = await fetch(`/api/newsletter/lists/${listId}/members`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber_ids: [subscriberId] }),
      });
      if (!res.ok) throw new Error();
      toast.success("削除しました");
      await loadMembers(memberPage);
      setQualityResult(null);
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  // ─ 全メンバー削除 ─
  async function clearAllMembers() {
    if (!listId) return;
    if (!confirm("リストの全メンバーを削除しますか？")) return;
    try {
      await fetch(`/api/newsletter/lists/${listId}/members`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      toast.success("全メンバーを削除しました");
      await loadMembers(1);
      setQualityResult(null);
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  // ─ AI品質チェック ─
  async function runQualityCheck() {
    if (!listId) return;
    setQualityLoading(true); setQualityResult(null);
    try {
      const res = await fetch(`/api/newsletter/lists/${listId}/quality-check`, {
        method: "POST", headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQualityResult(data);
      if (data.duplicates.length === 0 && data.reversed_names.length === 0) {
        toast.success("問題は検出されませんでした");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "チェックに失敗しました");
    } finally {
      setQualityLoading(false);
    }
  }

  // ─ リスト保存 ─
  async function save() {
    if (!name.trim()) { toast.error("リスト名を入力してください"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch("/api/newsletter/lists", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, conditions: [] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        toast.success("リストを作成しました。メンバーを追加できます。");
        // 作成後、編集モードで続行
        onClose();
      } else {
        const res = await fetch(`/api/newsletter/lists/${listId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, conditions: [], preview_count: memberTotal }),
        });
        if (!res.ok) throw new Error();
        toast.success("保存しました");
        onClose();
      }
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const notInList = searchResult?.subscribers.filter(
    (s) => !searchResult.already_in_list.includes(s.id)
  ) ?? [];
  const selectedNotInList = [...selectedIds].filter(
    (id) => !searchResult?.already_in_list.includes(id)
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "新規リスト作成" : "リストを編集"}
          </h1>
          <p className="admin-description mt-1">
            絞り込みで対象を検索し、選択してリストに追加します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>← 一覧に戻る</Button>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving ? "保存中…" : isNew ? "リストを作成" : "保存して閉じる"}
          </Button>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">リスト名 <span className="text-destructive">*</span></label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：2025年1月セミナー参加者" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">メモ（任意）</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="このリストの用途や説明（任意）" />
        </div>
      </div>

      {/* ─────────────────────────────── */}
      {/* STEP 1: 絞り込みで検索 */}
      {/* ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Search className="size-4 text-primary" />
            絞り込みで対象を検索
          </h2>
          <span className="text-xs text-muted-foreground">複数条件はすべて AND 結合</span>
        </div>

        {/* 設定済み条件 */}
        {conditions.length > 0 && (
          <div className="space-y-1.5">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  {c.type === "domain"  && <Building2 className="size-3.5 text-muted-foreground shrink-0" />}
                  {c.type === "event"   && <CalendarCheck className="size-3.5 text-muted-foreground shrink-0" />}
                  {c.type === "keyword" && <Tag className="size-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-sm">{conditionLabel(c)}</span>
                </div>
                <button onClick={() => removeCondition(i)} className="text-muted-foreground hover:text-destructive">
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
          <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
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

            {addingType === "domain" && (
              <div className="space-y-2">
                <Input
                  value={domainInput} onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="例：company.co.jp, example.com"
                  onKeyDown={(e) => e.key === "Enter" && addDomainCondition()}
                />
                <p className="text-xs text-muted-foreground">@以降のドメインで後方一致検索</p>
                <Button size="sm" onClick={addDomainCondition}>条件を設定</Button>
              </div>
            )}

            {addingType === "event" && (
              <div className="space-y-3">
                {loadingSeminars ? <p className="text-sm text-muted-foreground">読み込み中…</p> : (
                  <select
                    value={selectedSeminar} onChange={(e) => setSelectedSeminar(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">セミナーを選択してください</option>
                    {seminars.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}{s.date ? ` (${s.date.slice(0,10)})` : ""}</option>
                    ))}
                  </select>
                )}
                <div className="flex gap-3">
                  {(["registered", "attended"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" value={t} checked={attendanceType === t} onChange={() => setAttendanceType(t)} />
                      {t === "registered" ? "参加登録済み" : "実際に出席"}
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={addEventCondition} disabled={!selectedSeminar}>条件を設定</Button>
              </div>
            )}

            {addingType === "keyword" && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  {(["department", "company"] as const).map((f) => (
                    <label key={f} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" value={f} checked={kwField === f}
                        onChange={() => { setKwField(f); setAiSuggestions([]); setPendingKeywords([]); }} />
                      {f === "department" ? "部署名" : "会社名"}
                    </label>
                  ))}
                </div>
                <div className="rounded-lg border border-border bg-background p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    <p className="text-xs font-medium">AI で候補を検索</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
                      placeholder={kwField === "department" ? "例：マーケティング" : "例：食品メーカー"}
                      className="flex-1 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && requestAiSuggest()}
                    />
                    <Button variant="outline" size="sm" onClick={requestAiSuggest} disabled={aiSuggesting} className="gap-1.5 shrink-0">
                      <Sparkles className="size-3.5" />{aiSuggesting ? "検索中…" : "AI 検索"}
                    </Button>
                  </div>
                  {aiSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestions.map((kw) => (
                        <button key={kw} onClick={() => toggleSuggestion(kw)}
                          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                            pendingKeywords.includes(kw)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:bg-muted"
                          }`}
                        >{kw}</button>
                      ))}
                    </div>
                  )}
                </div>
                <Input value={kwInput} onChange={(e) => setKwInput(e.target.value)} placeholder="直接入力（カンマ区切り）" />
                {pendingKeywords.length > 0 && (
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
                )}
                <Button size="sm" onClick={addKeywordCondition} disabled={pendingKeywords.length === 0 && !kwInput.trim()}>
                  条件を設定
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 検索実行ボタン */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={() => runSearch(1)}
            disabled={searching}
            className="gap-1.5"
            size="sm"
          >
            <Search className="size-3.5" />
            {searching ? "検索中…" : "対象リストを表示"}
          </Button>
          {conditions.length === 0 && (
            <span className="text-xs text-muted-foreground">条件なしの場合は全購読者が対象</span>
          )}
        </div>

        {/* 検索結果 */}
        {searchResult && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                検索結果: <span className="font-bold text-primary">{searchResult.total.toLocaleString()}</span> 件
                {searchResult.already_in_list.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    （うち {searchResult.already_in_list.length} 件は既にリストに存在）
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <CheckSquare className="size-3.5" />全件選択
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={clearSelection} className="text-xs text-muted-foreground hover:underline">
                    選択解除
                  </button>
                )}
              </div>
            </div>

            {searchResult.subscribers.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="w-8 px-3 py-2"></th>
                      <th className="px-3 py-2 text-left font-medium">メールアドレス</th>
                      <th className="px-3 py-2 text-left font-medium">名前</th>
                      <th className="px-3 py-2 text-left font-medium">会社</th>
                      <th className="px-3 py-2 text-left font-medium">部署</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {searchResult.subscribers.map((s) => {
                      const inList = searchResult.already_in_list.includes(s.id);
                      const checked = selectedIds.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors ${inList ? "opacity-40" : "cursor-pointer hover:bg-muted/20"} ${checked ? "bg-primary/5" : ""}`}
                          onClick={() => !inList && toggleSelect(s.id)}
                        >
                          <td className="px-3 py-2 text-center">
                            {inList ? (
                              <Badge variant="outline" className="text-[10px] px-1">済</Badge>
                            ) : (
                              checked
                                ? <CheckSquare className="size-3.5 text-primary mx-auto" />
                                : <Square className="size-3.5 text-muted-foreground mx-auto" />
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">{s.email}</td>
                          <td className="px-3 py-2">{s.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.company}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.department}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* 検索結果ページネーション */}
                {searchResult.total > SEARCH_LIMIT && (
                  <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-2">
                    <Button size="sm" variant="outline" disabled={searchResult.page <= 1}
                      onClick={() => runSearch(searchResult.page - 1)} className="gap-1">
                      <ChevronLeft className="size-3.5" />前
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {searchResult.page} / {Math.ceil(searchResult.total / SEARCH_LIMIT)} ページ
                    </span>
                    <Button size="sm" variant="outline" disabled={searchResult.page >= Math.ceil(searchResult.total / SEARCH_LIMIT)}
                      onClick={() => runSearch(searchResult.page + 1)} className="gap-1">
                      次<ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">該当する購読者がいません</p>
            )}

            {/* リストに追加ボタン */}
            {notInList.length > 0 && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={addSelectedToList}
                  disabled={addingMembers || selectedNotInList.length === 0}
                  className="gap-1.5"
                  size="sm"
                >
                  <Plus className="size-3.5" />
                  {addingMembers
                    ? "追加中…"
                    : selectedNotInList.length > 0
                      ? `選択した ${selectedNotInList.length} 件をリストに追加`
                      : "追加する対象を選択してください"}
                </Button>
                {!listId && (
                  <span className="text-xs text-amber-600">
                    ※ 先に「リストを作成」してから追加してください
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────── */}
      {/* STEP 2: 現在のリストメンバー */}
      {/* ─────────────────────────────── */}
      {listId && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              現在のリストメンバー
              <Badge variant="secondary">{memberTotal.toLocaleString()} 件</Badge>
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={runQualityCheck}
                disabled={qualityLoading || memberTotal === 0}
                className="gap-1.5"
              >
                <ShieldCheck className="size-3.5" />
                {qualityLoading ? "チェック中…" : "AI品質チェック"}
              </Button>
              {memberTotal > 0 && (
                <Button
                  variant="ghost" size="sm"
                  onClick={clearAllMembers}
                  className="text-destructive hover:text-destructive gap-1.5"
                >
                  <Trash2 className="size-3.5" />全削除
                </Button>
              )}
            </div>
          </div>

          {/* AI品質チェック結果 */}
          {qualityResult && (qualityResult.duplicates.length > 0 || qualityResult.reversed_names.length > 0) && (
            <div className="space-y-3">
              {qualityResult.duplicates.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />同名・複数メール（{qualityResult.duplicates.length} グループ）
                  </p>
                  {qualityResult.duplicates.map((g, i) => (
                    <div key={i} className="text-xs text-amber-700">
                      <span className="font-medium">{g.name}</span>：{g.subscribers.map((s) => s.email).join(" / ")}
                    </div>
                  ))}
                </div>
              )}
              {qualityResult.reversed_names.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <ArrowLeftRight className="size-3.5" />姓名逆転の可能性（{qualityResult.reversed_names.length} 件）
                  </p>
                  {qualityResult.reversed_names.map((r) => (
                    <div key={r.id} className="text-xs text-blue-700">
                      {r.email}：{r.current_name} → <span className="font-medium">{r.suggested_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* メンバーテーブル */}
          {membersLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          ) : memberTotal === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
              <Users className="size-6 mx-auto mb-2 opacity-30" />
              <p className="text-sm">まだメンバーがいません</p>
              <p className="text-xs mt-1">上の検索でメンバーを追加してください</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium">メールアドレス</th>
                      <th className="px-3 py-2 text-left font-medium">名前</th>
                      <th className="px-3 py-2 text-left font-medium">会社</th>
                      <th className="px-3 py-2 text-left font-medium">追加日</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {members.map((m) => (
                      <tr key={m.subscriber_id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono">{m.email}</td>
                        <td className="px-3 py-2">
                          {m.name}
                          {m.sub_status !== "active" && (
                            <Badge variant="outline" className="ml-1 text-[10px] text-muted-foreground">停止</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{m.company}</td>
                        <td className="px-3 py-2 text-muted-foreground">{fmt(m.added_at)}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeMember(m.subscriber_id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* メンバーページネーション */}
              {memberTotal > MEMBER_LIMIT && (
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="outline" disabled={memberPage <= 1}
                    onClick={() => loadMembers(memberPage - 1)} className="gap-1">
                    <ChevronLeft className="size-3.5" />前
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {memberPage} / {Math.ceil(memberTotal / MEMBER_LIMIT)} ページ
                  </span>
                  <Button size="sm" variant="outline" disabled={memberPage >= Math.ceil(memberTotal / MEMBER_LIMIT)}
                    onClick={() => loadMembers(memberPage + 1)} className="gap-1">
                    次<ChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* STEP 3: 配信設定               */}
      {/* ─────────────────────────────── */}
      {listId && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Send className="size-4 text-primary" />
            配信設定
          </h2>

          {/* キャンペーン選択 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">送信するメールを選択</label>
            {campaignsLoading ? (
              <p className="text-xs text-muted-foreground">読み込み中…</p>
            ) : campaigns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <FileText className="size-5 mx-auto mb-1.5 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">配信可能なメールがありません</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  メール作成・編集メニューで下書きを作成してください
                </p>
              </div>
            ) : (
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- メールを選択 --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject || "（件名なし）"}
                    {c.status === "scheduled" && c.list_id === listId
                      ? ` ［予約済: ${new Date(c.scheduled_at!).toLocaleString("ja-JP")}］`
                      : c.status === "scheduled"
                        ? " ［他リストで予約中］"
                        : " ［下書き］"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedCampaignId && (
            <div className="space-y-4 pt-1">
              {/* 配信予約 */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />配信日時予約
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={scheduleDelivery}
                    disabled={scheduling || !scheduledAt}
                    className="gap-1.5 shrink-0"
                  >
                    <Clock className="size-3.5" />
                    {scheduling ? "設定中…" : "予約を設定"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  設定した日時に GitHub Actions が自動で送信します（毎日 JST 10:00 実行）
                </p>
              </div>

              {/* 今すぐ送信 */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Send className="size-3.5 text-muted-foreground" />今すぐ送信
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={sendNow}
                    disabled={sending}
                    className="gap-1.5"
                  >
                    <Send className="size-3.5" />
                    {sending ? "送信中…" : `このリスト（${memberTotal.toLocaleString()} 件）に送信`}
                  </Button>
                  {sendProgress && (
                    <span className="text-xs text-muted-foreground">
                      {sendProgress.sent.toLocaleString()} / {sendProgress.total.toLocaleString()} 件送信済み
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 保存ボタン */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>キャンセル</Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? "保存中…" : isNew ? "リストを作成" : "保存して閉じる"}
        </Button>
      </div>
    </div>
  );
}
