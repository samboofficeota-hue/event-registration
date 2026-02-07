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
  ClipboardList,
  FileEdit,
  Pencil,
  ExternalLink,
  Ban,
  Plus,
  Clock,
  MapPin,
  Users,
  ArrowRight,
} from "lucide-react";

type SeminarWithSurveyStatus = Seminar & {
  has_pre_survey?: boolean;
  has_post_survey?: boolean;
};

/** Google Drive 画像URLを表示用に変換（フロントの seminar-card と同様） */
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

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

const formatColors: Record<string, string> = {
  online: "bg-cyan-500 text-white",
  venue: "bg-purple-600 text-white",
  hybrid: "bg-pink-500 text-white",
};

export default function AdminReservationsPage() {
  const [seminars, setSeminars] = useState<SeminarWithSurveyStatus[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState<string | null>(
    null
  );
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRes, setLoadingRes] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadSeminars() {
    try {
      const res = await fetch("/api/seminars?with_survey_status=1");
      const data = await res.json();
      if (Array.isArray(data)) setSeminars(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeminars();
  }, []);

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
      const res = await fetch(`/api/seminars/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
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
      const res = await fetch(`/api/seminars/${id}`, { method: "DELETE" });
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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            予約一覧
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            セミナーの作成・編集・公開、予約確認、アンケートの作成ができます。
          </p>
        </div>
        <Link href="/admin/seminars/new" className="shrink-0">
          <Button>
            <Plus className="size-4" />
            新規作成
          </Button>
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seminars.map((s) => {
          const hasPre = s.has_pre_survey ?? false;
          const hasPost = s.has_post_survey ?? false;
          const hasSheet = !!s.spreadsheet_id;
          const date = new Date(s.date);
          const isFull = s.current_bookings >= s.capacity;
          const spotsLeft = s.capacity - s.current_bookings;
          return (
            <Card
              key={s.id}
              className="group flex h-full flex-col overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              {/* 画像エリア（フロントの seminar-card と同様 16:9） */}
              <div className="relative w-full aspect-[16/9] overflow-hidden bg-white">
                <img
                  src={resolveImageUrl(s.image_url)}
                  alt={s.title}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/9553.png";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {/* 開催形式バッジ */}
                <Badge
                  className={`absolute left-4 top-4 ${formatColors[s.format] ?? "bg-purple-600 text-white"}`}
                >
                  {s.format === "online"
                    ? "オンライン"
                    : s.format === "venue"
                      ? "会場"
                      : "ハイブリッド"}
                </Badge>

                {/* ステータスバッジ（管理用） */}
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

                {/* 日付オーバーレイ */}
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="text-2xl font-bold">
                    {format(date, "d", { locale: ja })}
                  </div>
                  <div className="text-sm opacity-90">
                    {format(date, "M月 (E)", { locale: ja })}
                  </div>
                </div>
              </div>

              {/* コンテンツ（フロントと同様のレイアウト） */}
              <CardContent className="flex flex-1 flex-col p-5">
                <h3 className="mb-2 line-clamp-2 text-lg font-bold text-foreground">
                  {s.title}
                </h3>
                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                  {s.description || "—"}
                </p>

                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4 text-primary" />
                    <span>
                      {format(date, "M月d日 (E) HH:mm", { locale: ja })} ・{" "}
                      {formatDuration(s.duration_minutes)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 text-pink-500" />
                    <span className="truncate">
                      {s.format === "online"
                        ? "オンライン開催"
                        : s.format === "hybrid"
                          ? "会場・オンライン(ハイブリッド)"
                          : "会場開催"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="size-4 text-cyan-500" />
                    <span className="truncate">
                      登壇者: {s.speaker}
                      {s.speaker_title && (
                        <span className="text-muted-foreground">
                          （{s.speaker_title}）
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* バッジ: 会員限定・残席・事前/事後・管理用 */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {s.target === "members_only" && (
                    <Badge variant="secondary" className="text-xs">
                      会員限定
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    残席: {isFull ? "なし" : `${spotsLeft}名`}
                  </Badge>
                  {hasSheet ? (
                    <>
                      <Badge
                        variant={hasPre ? "default" : "secondary"}
                        className={hasPre ? "text-xs" : "text-xs text-muted-foreground"}
                      >
                        事前 {hasPre ? "作成済" : "未作成"}
                      </Badge>
                      <Badge
                        variant={hasPost ? "default" : "secondary"}
                        className={hasPost ? "text-xs" : "text-xs text-muted-foreground"}
                      >
                        事後 {hasPost ? "作成済" : "未作成"}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      シート未作成
                    </Badge>
                  )}
                </div>

                {/* 参加予定 + 詳細ボタン風（予約一覧を見る） */}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">
                      {s.current_bookings}/{s.capacity}人
                    </span>{" "}
                    参加予定
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedSeminarId === s.id ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() =>
                      setSelectedSeminarId(selectedSeminarId === s.id ? null : s.id)
                    }
                  >
                    予約一覧を見る
                    <ArrowRight className="ml-1 size-4" />
                  </Button>
                </div>
              </CardContent>

              {/* 管理操作フッター */}
              <CardFooter className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {hasSheet && (
                    <>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link
                          href={`/admin/survey-questions?seminarId=${s.id}&type=pre`}
                        >
                          <FileEdit className="size-4" />
                          事前アンケート
                        </Link>
                      </Button>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link
                          href={`/admin/survey-questions?seminarId=${s.id}&type=post`}
                        >
                          <FileEdit className="size-4" />
                          事後アンケート
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/seminars/${s.id}/edit`}>
                      <Pencil className="size-4" />
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
                        <SelectTrigger size="sm" className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">下書き</SelectItem>
                          <SelectItem value="published">公開中</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {statusLabel[s.status] ?? s.status}
                      </span>
                    ))}
                  {hasSheet && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${s.spreadsheet_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="size-4" />
                        スプシ
                      </Button>
                    </a>
                  )}
                  {s.status !== "cancelled" &&
                    s.status !== "completed" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancel(s.id)}
                      disabled={cancellingId === s.id}
                    >
                      <Ban className="size-4" />
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
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              予約詳細
            </CardTitle>
            <CardDescription>
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
