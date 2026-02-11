"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Search, AlertCircle } from "lucide-react";
import { normalizeLineBreaks } from "@/lib/utils";
import type { Seminar } from "@/lib/types";

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
}

export default function BookingManagePage() {
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // モーダル用state
  const [modalOpen, setModalOpen] = useState(false);
  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [seminarId, setSeminarId] = useState("");
  const [rid, setRid] = useState("");
  const [loadingModal, setLoadingModal] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // フォーム
  const [fname, setFname] = useState("");
  const [femail, setFemail] = useState("");
  const [fcompany, setFcompany] = useState("");
  const [fdepartment, setFdepartment] = useState("");
  const [fphone, setFphone] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = number.trim();
    if (!n) {
      setError("予約番号を入力してください");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings/by-number?number=${encodeURIComponent(n)}`
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "予約番号が見つかりません");
        return;
      }
      const data = await res.json();
      const foundSeminarId = data.seminar_id;
      const foundRid = data.reservation_id;
      setSeminarId(foundSeminarId);
      setRid(foundRid);

      // セミナーと予約情報を取得してモーダル表示
      setCancelled(false);
      setModalOpen(true);
      setLoadingModal(true);
      setSeminar(null);
      setReservation(null);

      try {
        const semRes = await fetch(`/api/seminars/${foundSeminarId}`);
        const sem: Seminar = await semRes.json();
        setSeminar(sem);

        if (sem.spreadsheet_id) {
          const resRes = await fetch(`/api/reservations?spreadsheet_id=${sem.spreadsheet_id}`);
          const reservations: ReservationData[] = await resRes.json();
          const found = reservations.find((r) => r.id === foundRid);
          if (found) {
            setReservation(found);
            setFname(found.name);
            setFemail(found.email);
            setFcompany(found.company);
            setFdepartment(found.department);
            setFphone(found.phone);
          }
        }
      } catch {
        setError("予約情報の読み込みに失敗しました");
        setModalOpen(false);
      } finally {
        setLoadingModal(false);
      }
    } catch {
      setError("予約番号が見つかりません");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoadingModal(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seminar_id: seminarId,
          id: rid,
          name: fname,
          email: femail,
          company: fcompany,
          department: fdepartment,
          phone: fphone,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "更新に失敗しました");
      }
      const updated = await res.json();
      setReservation((prev) => prev ? { ...prev, ...updated } : prev);
      toast.success("予約情報を更新しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setLoadingModal(false);
    }
  }

  async function handleCancel() {
    if (!confirm("予約をキャンセルしますか？")) return;
    setLoadingModal(true);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "キャンセルに失敗しました");
    } finally {
      setLoadingModal(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/seminars"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          セミナー一覧に戻る
        </Link>

        <Card className="seminar-detail-card overflow-hidden">
          <div className="h-1.5 rounded-t-xl bg-primary" />
          <CardHeader>
            <CardTitle className="text-foreground">
              予約の変更・キャンセル
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              メールに記載の予約番号を入力してください。確認後、申し込み内容の変更やキャンセルができます。
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reservation-number">予約番号</Label>
                <Input
                  id="reservation-number"
                  type="text"
                  placeholder="例: 2604-a1bc"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    if (error) setError("");
                  }}
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full rounded-xl h-12"
              >
                <Search className="w-4 h-4 mr-2" />
                {loading ? "確認中..." : "確認"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* エラーメッセージをカード下に表示 */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* 変更・キャンセルモーダル */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {loadingModal && !seminar ? (
            <div className="py-8 text-center text-muted-foreground">読み込み中...</div>
          ) : cancelled ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-gray-700">
                  予約をキャンセルしました
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {seminar && (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h3 className="whitespace-pre-line font-medium">{normalizeLineBreaks(seminar.title)}</h3>
                    <p className="text-sm text-muted-foreground">{formatDate(seminar.date)}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  お申し込みをキャンセルいたしました。<br />
                  再度お申し込みの場合はセミナー一覧からお申し込みください。
                </p>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => setModalOpen(false)}
                >
                  閉じる
                </Button>
              </div>
            </>
          ) : seminar && reservation ? (
            <>
              <DialogHeader>
                <DialogTitle>予約の変更・キャンセル</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
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
                    <Label htmlFor="modal-name">
                      氏名 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="modal-name"
                      value={fname}
                      onChange={(e) => setFname(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-email">
                      メールアドレス <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="modal-email"
                      type="email"
                      value={femail}
                      onChange={(e) => setFemail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-company">会社名</Label>
                    <Input
                      id="modal-company"
                      value={fcompany}
                      onChange={(e) => setFcompany(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-department">部署</Label>
                    <Input
                      id="modal-department"
                      value={fdepartment}
                      onChange={(e) => setFdepartment(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-phone">電話番号</Label>
                    <Input
                      id="modal-phone"
                      type="tel"
                      value={fphone}
                      onChange={(e) => setFphone(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loadingModal}>
                    {loadingModal ? "更新中..." : "予約情報を更新する"}
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
                    disabled={loadingModal}
                    onClick={handleCancel}
                  >
                    {loadingModal ? "キャンセル中..." : "予約をキャンセルする"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">読み込み中...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
