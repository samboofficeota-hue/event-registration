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
import {
  ClipboardList,
  FileEdit,
  Pencil,
  ExternalLink,
  Ban,
  Plus,
} from "lucide-react";

type SeminarWithSurveyStatus = Seminar & {
  has_pre_survey?: boolean;
  has_post_survey?: boolean;
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
          return (
            <Card
              key={s.id}
              className="flex flex-col shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <CardTitle className="line-clamp-2 text-base font-semibold text-foreground">
                  {s.title}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(s.date).toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 pb-2">
                {s.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {s.current_bookings}/{s.capacity}名
                  </Badge>
                  <Badge variant="outline">
                    {statusLabel[s.status] ?? s.status}
                  </Badge>
                  {hasSheet ? (
                    <>
                      <Badge
                        variant={hasPre ? "default" : "secondary"}
                        className={hasPre ? "" : "text-muted-foreground"}
                      >
                        事前 {hasPre ? "作成済" : "未作成"}
                      </Badge>
                      <Badge
                        variant={hasPost ? "default" : "secondary"}
                        className={hasPost ? "" : "text-muted-foreground"}
                      >
                        事後 {hasPost ? "作成済" : "未作成"}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline">シート未作成</Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={
                      selectedSeminarId === s.id ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      setSelectedSeminarId(selectedSeminarId === s.id ? null : s.id)
                    }
                  >
                    <ClipboardList className="size-4" />
                    予約一覧を見る
                  </Button>
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
