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
  Eye, Settings, StopCircle, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import { buildPreviewHtml } from "@/lib/email/client-preview";

// ─── 型定義 ───────────────────────────────────────────────
type ConditionDomain  = { type: "domain";  domains: string[] };
type ConditionEvent   = { type: "event";   seminar_id: string; seminar_title: string; attendance_type: "registered" | "attended" };
type ConditionKeyword = { type: "keyword"; field: "department" | "company"; keywords: string[] };
type ConditionTag     = { type: "tag";     tags: string[] };
type ListCondition = ConditionDomain | ConditionEvent | ConditionKeyword | ConditionTag;

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
  body?: string;
  status: string;
  scheduled_at: string | null;
  list_id: string | null;
  header_color?: string;
  footer_text?: string | null;
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
  if (c.type === "tag")     return `スマートタグ: ${c.tags.join(", ")}`;
  return "";
}

// ═══════════════════════════════════════════════════════════
// リスト一覧ページ
// ═══════════════════════════════════════════════════════════
export default function NewsletterListPage() {
  const [lists, setLists] = useState<NewsletterList[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingList, setEditingList] = useState<NewsletterList | null | "new">(null);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [previewModal, setPreviewModal] = useState<{ list: NewsletterList; campaign: Campaign } | null>(null);
  const [scheduleModal, setScheduleModal] = useState<NewsletterList | null>(null);
  const [emailSettingListId, setEmailSettingListId] = useState<string | null>(null);
  const [emailSettingCampaignId, setEmailSettingCampaignId] = useState("");
  const [schedCampaignId, setSchedCampaignId] = useState("");
  const [schedDateTime, setSchedDateTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const [listsRes, campaignsRes] = await Promise.all([
        fetch("/api/newsletter/lists"),
        fetch("/api/newsletter/campaigns"),
      ]);
      const listsData = await listsRes.json();
      const campaignsData = await campaignsRes.json();
      setLists(Array.isArray(listsData) ? listsData : []);
      setAllCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  // 配信リストに紐づいたスケジュール済みキャンペーンを返す
  function scheduledCampaignFor(listId: string): Campaign | undefined {
    return allCampaigns.find((c) => c.list_id === listId && c.status === "scheduled");
  }

  // 配信停止: キャンペーンを draft に戻す
  async function stopDelivery(listId: string) {
    const campaign = scheduledCampaignFor(listId);
    if (!campaign) return;
    if (!confirm(`「${campaign.subject || "（件名なし）"}」の配信予約を取り消しますか？`)) return;
    try {
      await fetch(`/api/newsletter/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft", scheduled_at: null, list_id: null }),
      });
      toast.success("配信予約を取り消しました");
      loadLists();
    } catch {
      toast.error("取り消しに失敗しました");
    }
  }

  // 配信予約モーダルを開く（既存スケジュール or 最初の下書きを自動選択）
  function openScheduleModal(list: NewsletterList) {
    const existing = scheduledCampaignFor(list.id);
    const fallback = allCampaigns.find((c) => c.status === "draft" || c.status === "scheduled");
    const picked = existing ?? fallback ?? null;
    setSchedCampaignId(picked?.id ?? "");
    // UTC → JST に変換して datetime-local 入力欄にセット（+9時間）
    if (existing?.scheduled_at) {
      const utcMs = new Date(existing.scheduled_at).getTime();
      const jstIso = new Date(utcMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
      setSchedDateTime(jstIso);
    } else {
      setSchedDateTime("");
    }
    setScheduleModal(list);
  }

  // 配信予約を保存
  async function saveSchedule() {
    if (!scheduleModal || !schedCampaignId) { toast.error("メールを選択してください"); return; }
    if (!schedDateTime) { toast.error("配信日時を設定してください"); return; }
    setScheduling(true);
    try {
      const utc = new Date(schedDateTime).toISOString();
      const res = await fetch(`/api/newsletter/campaigns/${schedCampaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_id: scheduleModal.id, scheduled_at: utc, status: "scheduled" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("配信予約を設定しました");
      setScheduleModal(null);
      loadLists();
    } catch (e: any) {
      toast.error(e.message ?? "設定に失敗しました");
    } finally {
      setScheduling(false);
    }
  }

  // メール確認モーダルを開く（全データを取得してから表示）
  async function openPreviewModal(list: NewsletterList) {
    const candidate = scheduledCampaignFor(list.id)
      ?? allCampaigns.find((c) => c.list_id === list.id)
      ?? allCampaigns[0];
    if (!candidate) { toast.error("確認できるメールがありません"); return; }
    try {
      const res = await fetch(`/api/newsletter/campaigns/${candidate.id}`);
      const full = await res.json();
      setPreviewModal({ list, campaign: { ...candidate, ...full } });
    } catch {
      toast.error("メールの取得に失敗しました");
    }
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
          {lists.map((list) => {
            const scheduled = scheduledCampaignFor(list.id);
            return (
              <div key={list.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                {/* 上段: 名前・メタ情報・削除 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{list.name || "（名称なし）"}</p>
                    {list.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{list.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      <p className="text-xs text-muted-foreground">
                        メンバー: <span className="font-medium text-foreground">{list.preview_count.toLocaleString()}</span> 件
                      </p>
                      {scheduled ? (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <Clock className="size-3" />
                          配信予約: {new Date(scheduled.scheduled_at!).toLocaleString("ja-JP")}
                          <span className="text-muted-foreground">「{scheduled.subject || "（件名なし）"}」</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => deleteList(list.id, list.name)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* 下段: ボタン */}
                <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <Button variant="outline" size="sm" onClick={() => setEditingList(list)} className="gap-1.5">
                    <Settings className="size-3.5" />リスト編集
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      if (emailSettingListId === list.id) {
                        setEmailSettingListId(null);
                        setEmailSettingCampaignId("");
                      } else {
                        setEmailSettingListId(list.id);
                        setEmailSettingCampaignId("");
                      }
                    }}
                    className="gap-1.5"
                  >
                    <FileText className="size-3.5" />メール設定
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openScheduleModal(list)} className="gap-1.5">
                    <Clock className="size-3.5" />配信予約
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => stopDelivery(list.id)}
                    disabled={!scheduled}
                    className={`gap-1.5 ${scheduled ? "text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" : "text-muted-foreground"}`}
                  >
                    <StopCircle className="size-3.5" />配信停止
                  </Button>
                </div>

                {/* メール設定 インライン展開 */}
                {emailSettingListId === list.id && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <select
                      value={emailSettingCampaignId}
                      onChange={(e) => setEmailSettingCampaignId(e.target.value)}
                      className="flex-1 min-w-52 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">-- メールを選択 --</option>
                      {allCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.subject || "（件名なし）"}
                          {c.status === "scheduled" && c.list_id === list.id
                            ? " ［予約済］"
                            : c.status === "sent"
                              ? " ［送信済］"
                              : " ［下書き］"}
                        </option>
                      ))}
                    </select>
                    {emailSettingCampaignId && (
                      <Button
                        variant="outline" size="sm"
                        onClick={async () => {
                          const c = allCampaigns.find((c) => c.id === emailSettingCampaignId);
                          if (!c) return;
                          try {
                            const res = await fetch(`/api/newsletter/campaigns/${c.id}`);
                            const full = await res.json();
                            setPreviewModal({ list, campaign: { ...c, ...full } });
                          } catch {
                            toast.error("メールの取得に失敗しました");
                          }
                        }}
                        className="gap-1.5 shrink-0"
                      >
                        <Eye className="size-3.5" />メール確認
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── メール確認モーダル ─── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0">
            <div>
              <p className="text-sm font-semibold">メール確認 — {previewModal.list.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                件名: {previewModal.campaign.subject || "（件名なし）"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* キャンペーン切替 */}
              {allCampaigns.length > 1 && (
                <select
                  value={previewModal.campaign.id}
                  onChange={async (e) => {
                    const c = allCampaigns.find((c) => c.id === e.target.value);
                    if (!c) return;
                    const res = await fetch(`/api/newsletter/campaigns/${c.id}`);
                    const full = await res.json();
                    setPreviewModal({ ...previewModal, campaign: { ...c, ...full } });
                  }}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none"
                >
                  {allCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject || "（件名なし）"} [{c.status}]
                    </option>
                  ))}
                </select>
              )}
              <button onClick={() => setPreviewModal(null)} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <iframe
            srcDoc={buildPreviewHtml(
              (previewModal.campaign as any).body ?? "",
              (previewModal.campaign as any).header_color ?? "dark",
              (previewModal.campaign as any).footer_text ?? null
            )}
            title="メールプレビュー"
            className="flex-1 w-full border-none"
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {/* ─── 配信予約モーダル ─── */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold">配信予約</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{scheduleModal.name}</p>
              </div>
              <button onClick={() => setScheduleModal(null)} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {schedCampaignId ? (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">送信メール</p>
                  <p className="text-sm font-medium mt-0.5">
                    {allCampaigns.find((c) => c.id === schedCampaignId)?.subject || "（件名なし）"}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700">送信するメールがありません。メール作成・編集で下書きを作成してください。</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">配信日時</label>
                <input
                  type="datetime-local"
                  value={schedDateTime}
                  onChange={(e) => setSchedDateTime(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">現時刻より 1 時間以降の時間を設定してください（毎時自動実行）</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setScheduleModal(null)}>キャンセル</Button>
                <Button size="sm" onClick={saveSchedule} disabled={scheduling || !schedCampaignId || !schedDateTime} className="gap-1.5">
                  <Clock className="size-3.5" />{scheduling ? "設定中…" : "予約を確定"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// リストビルダー（メンバー管理）
// ═══════════════════════════════════════════════════════════
function ListBuilder({ initial, onClose }: { initial: NewsletterList | null; onClose: () => void }) {
  // 新規作成後は currentListId が設定され、isNew が false に変わる
  const [currentListId, setCurrentListId] = useState<string | null>(initial?.id ?? null);
  const isNew = !currentListId;
  const listId = currentListId;

  // ─ 基本情報 ─
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  // ─ 絞り込み条件 ─ initial から読み込む
  const [conditions, setConditions] = useState<ListCondition[]>(initial?.conditions ?? []);
  const [addingType, setAddingType] = useState<"domain" | "event" | "keyword" | "tag" | null>(null);
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

  // ─ スマートタグ絞り込み ─
  const [availableTags, setAvailableTags] = useState<{ tag: string; count: number }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // ─ スマートタグ付与パネル ─
  const [showSmartTag, setShowSmartTag] = useState(false);
  const [smartTagRule, setSmartTagRule] = useState("member_domain");
  const [smartTagTenant, setSmartTagTenant] = useState("whgc-seminars");
  const [smartTagName, setSmartTagName] = useState("");
  const [smartTagPreviewCount, setSmartTagPreviewCount] = useState<number | null>(null);
  const [smartTagPreviewList, setSmartTagPreviewList] = useState<{ id: string; email: string; name: string; company: string; department: string }[]>([]);
  const [showSmartTagList, setShowSmartTagList] = useState(false);
  const [smartTagPreviewing, setSmartTagPreviewing] = useState(false);
  const [smartTagApplying, setSmartTagApplying] = useState(false);
  const [smartTagSelectedIds, setSmartTagSelectedIds] = useState<Set<string>>(new Set());
  const [smartTagAddingMembers, setSmartTagAddingMembers] = useState(false);
  const [smartTagTotal, setSmartTagTotal] = useState<number | null>(null);   // 全件数
  const [smartTagOffset, setSmartTagOffset] = useState(0);                  // 現在のオフセット
  const [smartTagHasMore, setSmartTagHasMore] = useState(false);            // 次のページあり
  const [smartTagLoadingMore, setSmartTagLoadingMore] = useState(false);

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


  const MEMBER_LIMIT = 50;
  const SEARCH_LIMIT = 200;

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

  function addTagCondition() {
    if (selectedTags.length === 0) { toast.error("タグを選択してください"); return; }
    setConditions((prev) => [...prev, { type: "tag", tags: selectedTags }]);
    setSelectedTags([]); setAddingType(null); setSearchResult(null);
  }

  async function loadAvailableTags() {
    try {
      const res = await fetch("/api/newsletter/tags");
      if (res.ok) setAvailableTags(await res.json());
    } catch { /* ignore */ }
  }

  // ─ スマートタグ プレビュー（初回・リセット） ─
  async function previewSmartTag() {
    setSmartTagPreviewing(true);
    setSmartTagPreviewCount(null);
    setSmartTagTotal(null);
    setSmartTagPreviewList([]);
    setSmartTagSelectedIds(new Set());
    setSmartTagOffset(0);
    setSmartTagHasMore(false);
    setShowSmartTagList(false);
    try {
      const res = await fetch("/api/newsletter/subscribers/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: smartTagRule, tenant: smartTagTenant, preview: true, offset: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSmartTagPreviewCount(data.count);       // このページの件数
      setSmartTagTotal(data.total);              // 全件数
      setSmartTagPreviewList(data.subscribers ?? []);
      setSmartTagOffset(data.count);             // 次回のオフセット
      setSmartTagHasMore(data.has_more ?? false);
      if ((data.total ?? 0) > 0) setShowSmartTagList(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "プレビューに失敗しました"); }
    finally { setSmartTagPreviewing(false); }
  }

  // ─ スマートタグ 次の500件を追加読み込み ─
  async function loadMoreSmartTag() {
    setSmartTagLoadingMore(true);
    try {
      const res = await fetch("/api/newsletter/subscribers/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: smartTagRule, tenant: smartTagTenant, preview: true, offset: smartTagOffset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSmartTagPreviewList((prev) => [...prev, ...(data.subscribers ?? [])]);
      setSmartTagOffset((prev) => prev + (data.count ?? 0));
      setSmartTagHasMore(data.has_more ?? false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "追加読み込みに失敗しました"); }
    finally { setSmartTagLoadingMore(false); }
  }

  // ─ スマートタグ 選択者をリストに追加 ─
  async function addSmartTagSelectedToList() {
    if (!listId) { toast.error("先にリストを保存してください"); return; }
    if (smartTagSelectedIds.size === 0) { toast.error("追加する対象を選択してください"); return; }
    setSmartTagAddingMembers(true);
    try {
      const res = await fetch(`/api/newsletter/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber_ids: [...smartTagSelectedIds] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.added} 件をリストに追加しました`);
      setSmartTagSelectedIds(new Set());
      await loadMembers(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setSmartTagAddingMembers(false);
    }
  }

  // ─ スマートタグ 付与（複数タグ対応） ─
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
      // タグ一覧を再取得（絞り込みチップに反映）
      loadAvailableTags();
    } catch (e) { toast.error(e instanceof Error ? e.message : "タグ付与に失敗しました"); }
    finally { setSmartTagApplying(false); }
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
    // page=1（新規検索）の時のみ選択をリセット。ページ送りでは引き継ぐ
    if (page === 1) setSelectedIds(new Set());
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
        // 新規作成：POST してそのまま編集継続（閉じない）
        const res = await fetch("/api/newsletter/lists", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, conditions }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        // 作成後は編集モードに移行（エディターは閉じない）
        setCurrentListId(data.id);
        toast.success("リストを作成しました。引き続きメンバーを追加できます。");
      } else {
        // 編集保存：PUT して閉じる
        const res = await fetch(`/api/newsletter/lists/${listId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, conditions, preview_count: memberTotal }),
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
      {/* スマートタグ付与パネル */}
      {/* ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSmartTag((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        >
          <Sparkles className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">スマートタグ</span>
          <span className="text-xs text-muted-foreground ml-1">条件に合う購読者に一括でタグを付与</span>
          <span className="ml-auto">{showSmartTag ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}</span>
        </button>

        {showSmartTag && (
          <div className="border-t border-border p-4 space-y-4">
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

              {/* 対象者リスト（チェックボックス付き） */}
              {showSmartTagList && smartTagPreviewList.length > 0 && (
                <div className="rounded-lg border border-primary/20 overflow-hidden">
                  {/* ヘッダー: 全件選択 + 選択数表示 */}
                  <div className="px-3 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={smartTagSelectedIds.size === smartTagPreviewList.length && smartTagPreviewList.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSmartTagSelectedIds(new Set(smartTagPreviewList.map((s) => s.id)));
                          } else {
                            setSmartTagSelectedIds(new Set());
                          }
                        }}
                      />
                      <span className="text-xs font-medium text-primary">全件選択</span>
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {smartTagPreviewList.length.toLocaleString()} 件表示中
                      {smartTagTotal !== null && (
                        <span> / 全 <span className="font-medium text-foreground">{smartTagTotal.toLocaleString()}</span> 件</span>
                      )}
                    </span>
                    {smartTagSelectedIds.size > 0 && (
                      <span className="text-xs text-primary font-semibold ml-auto">
                        {smartTagSelectedIds.size.toLocaleString()} 件選択中
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-border">
                        {smartTagPreviewList.map((s) => {
                          const checked = smartTagSelectedIds.has(s.id);
                          return (
                            <tr
                              key={s.id}
                              className={`cursor-pointer transition-colors hover:bg-muted/20 ${checked ? "bg-primary/5" : ""}`}
                              onClick={() => setSmartTagSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                                return next;
                              })}
                            >
                              <td className="w-8 px-3 py-2 text-center">
                                {checked
                                  ? <CheckSquare className="size-3.5 text-primary mx-auto" />
                                  : <Square className="size-3.5 text-muted-foreground mx-auto" />}
                              </td>
                              <td className="px-3 py-2 font-mono">{s.email}</td>
                              <td className="px-3 py-2">{s.name || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {s.company}
                                {s.department && <span className="ml-1 opacity-70">/ {s.department}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* 次の500件を読み込む */}
                  {smartTagHasMore && (
                    <div className="px-3 py-2 border-t border-border flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreSmartTag}
                        disabled={smartTagLoadingMore}
                        className="gap-1.5 w-full text-xs"
                      >
                        <ChevronDown className="size-3.5" />
                        {smartTagLoadingMore
                          ? "読み込み中…"
                          : `次の 500 件を表示（残り ${(smartTagTotal! - smartTagPreviewList.length).toLocaleString()} 件）`}
                      </Button>
                    </div>
                  )}

                  {/* リストに追加ボタン */}
                  <div className="px-3 py-2.5 border-t border-primary/10 bg-primary/5 flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={addSmartTagSelectedToList}
                      disabled={smartTagSelectedIds.size === 0 || smartTagAddingMembers || !listId}
                      className="gap-1.5"
                    >
                      <Users className="size-3.5" />
                      {smartTagAddingMembers ? "追加中…" : `選択した ${smartTagSelectedIds.size} 件をリストに追加`}
                    </Button>
                    {!listId && (
                      <span className="text-xs text-muted-foreground">※ 先にリストを保存してください</span>
                    )}
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
          </div>
        )}
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
            <Button variant="outline" size="sm" onClick={() => { setAddingType("tag"); loadAvailableTags(); }} className="gap-1.5">
              <Sparkles className="size-3.5" />スマートタグ
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {addingType === "domain"  && "会社ドメインで絞り込み"}
                {addingType === "event"   && "イベント参加履歴で絞り込み"}
                {addingType === "keyword" && "部署・会社キーワードで絞り込み"}
                {addingType === "tag"     && "スマートタグで絞り込み"}
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

            {addingType === "tag" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  選択したタグを持つ購読者を絞り込みます（複数選択は OR 結合）
                </p>
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">タグが登録されていません</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {availableTags.map(({ tag, count }) => {
                      const selected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSelectedTags((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                          )}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border bg-background hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          <Tag className="size-2.5" />{tag}
                          <span className="opacity-60">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedTags.length > 0 && (
                  <p className="text-xs text-primary font-medium">
                    選択中: {selectedTags.join("、")}
                  </p>
                )}
                <Button size="sm" onClick={addTagCondition} disabled={selectedTags.length === 0} className="gap-1.5">
                  <Sparkles className="size-3.5" />条件を設定
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
