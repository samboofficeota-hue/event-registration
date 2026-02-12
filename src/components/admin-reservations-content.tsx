"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Seminar, Reservation } from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  FileEdit,
  Pencil,
  ExternalLink,
  Ban,
  Plus,
  Clock,
  MapPin,
  Users,
  ArrowRight,
  Copy,
} from "lucide-react";

type SeminarWithSurveyStatus = Seminar & {
  has_pre_survey?: boolean;
  has_post_survey?: boolean;
};

function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";
  if (url.includes("uc?export=view") || url.includes("uc?export=download")) {
    return url.replace("uc?export=download", "uc?export=view");
  }
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  }
  return "/9553.png";
}



const formatColors: Record<string, string> = {
  online: "bg-cyan-500 text-white",
  venue: "bg-purple-600 text-white",
  hybrid: "bg-pink-500 text-white",
};

/** アンケートURLコピーボタン */
function CopyLinkButton({
  seminarId,
  type,
  publicBase,
}: {
  seminarId: string;
  type: "pre" | "post";
  publicBase: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const surveyType = type === "pre" ? "pre-survey" : "post-survey";
    const path = `${publicBase}/${seminarId}/${surveyType}`;
    const fullUrl =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      toast.success("アンケートURLをコピーしました");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 shrink-0"
      onClick={handleCopy}
      title={`${type === "pre" ? "事前" : "事後"}アンケートURLをコピー`}
    >
      <Copy className={`size-3.5 ${copied ? "text-green-600" : "text-muted-foreground"}`} />
    </Button>
  );
}

export interface AdminReservationsContentProps {
  /** 管理画面のベースパス（例: /admin または /whgc-seminars/admin） */
  adminBase: string;
  /** テナント指定時はそのテナントのセミナーのみ取得・更新する */
  tenant?: string;
}

export function AdminReservationsContent({
  adminBase,
  tenant,
}: AdminReservationsContentProps) {
  const [seminars, setSeminars] = useState<SeminarWithSurveyStatus[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRes, setLoadingRes] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadSeminars() {
    try {
      const params = new URLSearchParams({ with_survey_status: "1" });
      if (tenant) params.set("tenant", tenant);
      const res = await fetch(`/api/seminars?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const sorted = [...data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setSeminars(sorted);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeminars();
  }, [tenant]);

  useEffect(() => {
    if (!selectedSeminarId) {
      setReservations([]);
      return;
    }
    const seminar = seminars.find((s) => s.id === selectedSeminarId);
    if (!seminar?.spreadsheet_id) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadingRes(true);
    });
    fetch(`/api/reservations?spreadsheet_id=${seminar.spreadsheet_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setReservations(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingRes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSeminarId, seminars]);

  const statusLabel: Record<string, string> = {
    draft: "下書き",
    published: "公開中",
    cancelled: "キャンセル済",
    completed: "終了",
  };

  async function handleStatusChange(id: string, newStatus: "draft" | "published") {
    setUpdatingStatusId(id);
    try {
      const body: { status: "draft" | "published"; tenant?: string } = { status: newStatus };
      if (tenant) body.tenant = tenant;
      const res = await fetch(`/api/seminars/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(
        newStatus === "published" ? "公開しました" : "下書きにしました"
      );
      await loadSeminars();
    } catch {
      toast.error("ステータスの更新に失敗しました");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("このセミナーをキャンセルしますか？")) return;
    setCancellingId(id);
    try {
      const url = tenant
        ? `/api/seminars/${id}?tenant=${encodeURIComponent(tenant)}`
        : `/api/seminars/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("セミナーをキャンセルしました");
      setSelectedSeminarId((prev) => (prev === id ? null : prev));
      await loadSeminars();
    } catch {
      toast.error("キャンセルに失敗しました");
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            予約一覧
          </h1>
          <p className="admin-description mt-2">
            セミナーの作成・編集・公開、予約確認、アンケートの作成ができます。
          </p>
        </div>
        <Link href={`${adminBase}/seminars/new`} className="shrink-0">
          <Button size="lg" className="gap-2 px-6 shadow-sm">
            <Plus className="size-5" />
            新規作成
          </Button>
        </Link>
      </header>

      <div className="admin-seminar-grid">
        {seminars.map((s) => {
          const hasPre = s.has_pre_survey ?? false;
          const hasPost = s.has_post_survey ?? false;
          const hasSheet = !!s.spreadsheet_id;
          const date = new Date(s.date);
          return (
            <Card
              key={s.id}
              className={`admin-card group flex h-full flex-col overflow-hidden ${
                s.status === "cancelled" ? "bg-muted" : "bg-card"
              }`}
            >
              <div
                className="relative w-full flex-shrink-0 overflow-hidden bg-muted"
                style={{ aspectRatio: "16/9" }}
              >
                <img
                  src={resolveImageUrl(s.image_url)}
                  alt={s.title}
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/9553.png";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                <Badge
                  className={`absolute left-4 top-4 ${formatColors[s.format] ?? "bg-purple-600 text-white"}`}
                >
                  {s.format === "online"
                    ? "オンライン"
                    : s.format === "venue"
                      ? "会場"
                      : "ハイブリッド"}
                </Badge>

                <Badge
                  variant={
                    s.status === "published"
                      ? "default"
                      : s.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                  }
                  className="absolute right-4 top-4"
                >
                  {statusLabel[s.status] ?? s.status}
                </Badge>

                <div className="absolute bottom-4 left-4 text-white">
                  <div className="text-2xl font-bold">
                    {format(date, "d", { locale: ja })}
                  </div>
                  <div className="text-sm opacity-90">
                    {format(date, "M月 (E)", { locale: ja })}
                  </div>
                </div>
              </div>

              <CardContent className="flex flex-1 flex-col p-5">
                <h3 className="mb-2 line-clamp-2 text-base font-bold leading-snug text-foreground">
                  {s.title}
                </h3>
                <p className="mb-4 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  {s.description || "—"}
                </p>

                <div className="mb-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                    <Clock className="size-4 shrink-0 text-primary" />
                    <span>
                      {format(date, "M月d日 (E) HH:mm", { locale: ja })} ～ {s.end_time || ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                    <MapPin className="size-4 shrink-0 text-pink-500" />
                    <span className="truncate">
                      {s.format === "online"
                        ? "オンライン開催"
                        : s.format === "hybrid"
                          ? "会場・オンライン(ハイブリッド)"
                          : "会場開催"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-[0.8125rem] text-foreground">
                    <Users className="mt-0.5 size-4 shrink-0 text-cyan-500" />
                    <div className="min-w-0">
                      <div>
                        登壇者： <span className="font-bold">{s.speaker}</span> 氏
                      </div>
                      {s.speaker_title && (
                        <div className="mt-0.5 text-muted-foreground">
                          {s.speaker_title}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {s.target === "members_only" && (
                  <div className="mb-4">
                    <Badge variant="secondary" className="text-xs">
                      会員限定
                    </Badge>
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                  <div className="text-[0.8125rem] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {s.current_bookings}/{s.capacity}
                    </span>
                    人 参加予定
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedSeminarId === s.id ? "default" : "outline"}
                    className="rounded-full px-4 py-2 text-[0.8125rem]"
                    onClick={() =>
                      setSelectedSeminarId(selectedSeminarId === s.id ? null : s.id)
                    }
                  >
                    予約一覧を見る
                    <ArrowRight className="ml-1 size-4" />
                  </Button>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 border-t border-border px-5 pb-5 pt-4">
                {hasSheet && (
                  <div className="admin-card-footer w-full">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={hasPre ? "default" : "outline"}
                        size="sm"
                        className={`gap-1.5 text-[0.8125rem] ${hasPre ? "bg-sky-600 hover:bg-sky-700 text-white" : "text-muted-foreground"}`}
                        asChild
                      >
                        <Link
                          href={`${adminBase}/survey-questions?seminarId=${s.id}&type=pre`}
                        >
                          <FileEdit className="size-3.5" />
                          事前アンケート
                        </Link>
                      </Button>
                      <CopyLinkButton
                        seminarId={s.id}
                        type="pre"
                        publicBase={tenant ? `/${tenant}` : "/seminars"}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={hasPost ? "default" : "outline"}
                        size="sm"
                        className={`gap-1.5 text-[0.8125rem] ${hasPost ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-muted-foreground"}`}
                        asChild
                      >
                        <Link
                          href={`${adminBase}/survey-questions?seminarId=${s.id}&type=post`}
                        >
                          <FileEdit className="size-3.5" />
                          事後アンケート
                        </Link>
                      </Button>
                      <CopyLinkButton
                        seminarId={s.id}
                        type="post"
                        publicBase={tenant ? `/${tenant}` : "/seminars"}
                      />
                    </div>
                  </div>
                )}
                <div className="admin-card-footer w-full border-t border-border pt-3">
                  <Button variant="outline" size="sm" className="gap-1.5 text-[0.8125rem]" asChild>
                    <Link href={`${adminBase}/seminars/${s.id}/edit`}>
                      <Pencil className="size-3.5" />
                      編集
                    </Link>
                  </Button>
                  {s.status !== "cancelled" &&
                    (s.status === "draft" || s.status === "published" ? (
                      <Select
                        value={s.status}
                        onValueChange={(v) =>
                          handleStatusChange(s.id, v as "draft" | "published")
                        }
                        disabled={updatingStatusId === s.id}
                      >
                        <SelectTrigger size="sm" className="w-[120px] text-[0.8125rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">下書き</SelectItem>
                          <SelectItem value="published">公開中</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground">
                        {statusLabel[s.status] ?? s.status}
                      </span>
                    ))}
                  {hasSheet && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${s.spreadsheet_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5 text-[0.8125rem]">
                        <ExternalLink className="size-3.5" />
                        スプシ
                      </Button>
                    </a>
                  )}
                  {s.status !== "cancelled" &&
                    s.status !== "completed" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 text-[0.8125rem]"
                      onClick={() => handleCancel(s.id)}
                      disabled={cancellingId === s.id}
                    >
                      <Ban className="size-3.5" />
                      {cancellingId === s.id ? "処理中..." : "キャンセル"}
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {seminars.length === 0 && (
        <p className="text-sm text-muted-foreground">セミナーがありません。</p>
      )}

      {selectedSeminarId && (
        <Card className="admin-card overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">予約詳細</CardTitle>
            <CardDescription className="text-[0.8125rem]">
              {seminars.find((s) => s.id === selectedSeminarId)?.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingRes ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {reservations.length}件の予約
                </p>
                <Table className="rounded-lg border border-border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>氏名</TableHead>
                      <TableHead>メール</TableHead>
                      <TableHead>会社名</TableHead>
                      <TableHead>部署</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>事前アンケート</TableHead>
                      <TableHead>事後アンケート</TableHead>
                      <TableHead>予約日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{r.company}</TableCell>
                        <TableCell>{r.department}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "confirmed"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {r.status === "confirmed" ? "確定" : "キャンセル"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.pre_survey_completed ? (
                            <Badge variant="default">回答済</Badge>
                          ) : (
                            <Badge variant="outline">未回答</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.post_survey_completed ? (
                            <Badge variant="default">回答済</Badge>
                          ) : (
                            <Badge variant="outline">未回答</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString("ja-JP")
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reservations.length === 0 && (
                  <p className="py-4 text-sm text-muted-foreground">
                    このセミナーの予約はまだありません。
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
