"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { normalizeLineBreaks } from "@/lib/utils";
import type { Seminar, ParticipationMethod } from "@/lib/types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FORMAT_LABEL: Record<string, string> = {
  venue: "会場",
  online: "オンライン",
  hybrid: "ハイブリッド",
};

interface ReservationData {
  id: string;
  name: string;
  email: string;
  company: string;
  department: string;
  phone: string;
  status: string;
  participation_method?: ParticipationMethod;
}

export default function ManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: seminarId } = use(params);
  const searchParams = useSearchParams();
  const rid = searchParams.get("rid");
  const router = useRouter();

  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // フォーム state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [participationMethod, setParticipationMethod] = useState<ParticipationMethod | "">("");

  useEffect(() => {
    // セミナー情報を取得
    fetch(`/api/seminars/${seminarId}`)
      .then((res) => res.json())
      .then((data) => setSeminar(data))
      .catch(() => {});

    // 予約情報を取得（マスターから spreadsheet_id を先に取得してから予約を検索）
    if (rid) {
      fetch(`/api/seminars/${seminarId}`)
        .then((res) => res.json())
        .then(async (sem: Seminar) => {
          if (!sem.spreadsheet_id) return;
          const res = await fetch(`/api/reservations?spreadsheet_id=${sem.spreadsheet_id}`);
          const reservations: ReservationData[] = await res.json();
          const found = reservations.find((r) => r.id === rid);
          if (found) {
            setReservation(found);
            setName(found.name);
            setEmail(found.email);
            setCompany(found.company);
            setDepartment(found.department);
            setPhone(found.phone);
            setParticipationMethod(found.participation_method || "");
          }
        })
        .catch(() => {});
    }
  }, [seminarId, rid]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seminar_id: seminarId,
          id: rid,
          name,
          email,
          company,
          department,
          phone,
          participation_method: participationMethod || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "更新に失敗しました");
      }
      // レスポンスで返された値で再設定
      const updated = await res.json();
      setReservation((prev) => prev ? { ...prev, ...updated } : prev);
      toast.success("予約情報を更新しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seminar_id: seminarId, id: rid }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "キャンセルに失敗しました");
      }
      setCancelled(true);
      toast.success("予約をキャンセルしました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "キャンセルに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // ロード中
  if (!seminar || !reservation) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  // キャンセル完了画面
  if (cancelled) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-gray-700">
              予約をキャンセルしました
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="whitespace-pre-line font-medium">{normalizeLineBreaks(seminar.title)}</h3>
              <p className="text-sm text-muted-foreground">{formatDate(seminar.date)}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              お申し込みをキャンセルいたしました。<br />
              再度お申し込みの場合はセミナー一覧からお申し込みください。
            </p>
            <Link href="/seminars" className="block">
              <Button className="w-full" variant="secondary">
                セミナー一覧に戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/seminars/${seminarId}`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← セミナー詳細に戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>予約の変更・キャンセル</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* セミナー情報サマリー */}
          <div className="rounded-lg bg-gray-50 p-4 space-y-2">
            <h3 className="whitespace-pre-line font-semibold text-base">{normalizeLineBreaks(seminar.title)}</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>開催日時</span>
                <span>{formatDate(seminar.date)}</span>
              </div>
              <div className="flex justify-between">
                <span>終了時刻</span>
                <span>{seminar.end_time || ""}</span>
              </div>
              <div className="flex justify-between">
                <span>登壇者</span>
                <div className="text-right">
                  <div>
                    <span className="font-bold">{seminar.speaker}</span> 氏
                  </div>
                  {seminar.speaker_title && (
                    <div className="text-sm text-gray-600">{seminar.speaker_title}</div>
                  )}
                </div>
              </div>
              {seminar.format && (
                <div className="flex justify-between">
                  <span>開催形式</span>
                  <span>{FORMAT_LABEL[seminar.format] || seminar.format}</span>
                </div>
              )}
            </div>
          </div>

          {/* 予約情報編集フォーム */}
          <form onSubmit={handleUpdate} className="space-y-4">
            <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wide">お申し込み情報の変更</h4>

            <div className="space-y-2">
              <Label htmlFor="name">
                氏名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                メールアドレス <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">会社名</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">部署</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* 参加方法（オンライン/会場/ハイブリッドに応じて表示） */}
            {seminar.format && (seminar.format === "online" || seminar.format === "venue" || seminar.format === "hybrid") && (
              <div className="space-y-2">
                <Label>参加方法</Label>
                <div className="flex flex-col gap-2">
                  {(seminar.format === "venue" || seminar.format === "hybrid") && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="participation_method"
                        value="venue"
                        checked={participationMethod === "venue"}
                        onChange={() => setParticipationMethod("venue")}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span>会場で参加する</span>
                    </label>
                  )}
                  {(seminar.format === "online" || seminar.format === "hybrid") && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="participation_method"
                        value="online"
                        checked={participationMethod === "online"}
                        onChange={() => setParticipationMethod("online")}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span>オンラインで参加する</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "更新中..." : "予約情報を更新する"}
            </Button>
          </form>

          {/* キャンセル */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-3">キャンセル</h4>
            <p className="text-sm text-muted-foreground mb-3">
              キャンセルすると予約は無効になります。再申し込みは別途お申し込みください。
            </p>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={loading}
              onClick={handleCancel}
            >
              {loading ? "キャンセル中..." : "予約をキャンセルする"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
