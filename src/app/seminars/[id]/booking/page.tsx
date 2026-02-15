"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { normalizeLineBreaks } from "@/lib/utils";
import type { Seminar, ParticipationMethod } from "@/lib/types";

export default function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    department: "",
    phone: "",
  });
  const [emailConfirm, setEmailConfirm] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [participationMethod, setParticipationMethod] = useState<ParticipationMethod | "">("");
  const [showMemberOnlyModal, setShowMemberOnlyModal] = useState(false);

  useEffect(() => {
    fetch(`/api/seminars/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSeminar(data);
        // オンライン/会場のみの場合は参加方法を初期設定
        if (data.format === "online") setParticipationMethod("online");
        else if (data.format === "venue") setParticipationMethod("venue");
        else setParticipationMethod("");
        // ステータスチェック
        if (data.status !== "published") {
          toast.error("このセミナーは現在予約を受け付けていません");
          router.push("/");
        }
        if (data.current_bookings >= data.capacity) {
          toast.error("定員に達しました");
          router.push("/");
        }
      })
      .catch(() => {
        toast.error("セミナー情報の取得に失敗しました");
        router.push("/");
      });
  }, [id, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.company) {
      toast.error("お名前、メールアドレス、会社名は必須です");
      return;
    }

    // メールアドレスの形式チェック（HTML5 type="email" に加え @ とドメインの . を必須）
    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      toast.error("有効なメールアドレスを入力してください");
      return;
    }

    // 二重入力の一致チェック
    if (email !== emailConfirm.trim()) {
      toast.error("メールアドレスが一致しません。もう一度ご確認ください。");
      return;
    }

    // ハイブリッドの場合は参加方法を必須
    const format = seminar?.format ?? "online";
    const method: ParticipationMethod =
      format === "hybrid"
        ? (participationMethod === "venue" || participationMethod === "online"
            ? participationMethod
            : "")
        : format === "venue"
          ? "venue"
          : "online";
    if (format === "hybrid" && !method) {
      toast.error("参加方法（会場またはオンライン）を選択してください");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seminar_id: id,
          ...formData,
          email: formData.email.trim(),
          invitation_code: invitationCode.trim() || undefined,
          participation_method: method,
        }),
      });

      if (res.status === 403) {
        setShowMemberOnlyModal(true);
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "予約に失敗しました");
      }

      const booking = await res.json();

      toast.success(booking.already_registered ? "登録済みです。確認メールを再送しました。" : "予約が完了しました！");

      const params = new URLSearchParams({ booking_id: booking.id });
      if (booking.reservation_number) params.set("reservation_number", booking.reservation_number);
      router.push(`/seminars/${id}/confirmation?${params.toString()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "予約に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (!seminar) {
    return (
      <div className="container mx-auto px-4 py-20">
        <p className="text-center text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const date = new Date(seminar.date);
  const formatLabel = (format: string) => {
    switch (format) {
      case "venue":
        return "会場開催";
      case "online":
        return "オンライン";
      case "hybrid":
        return "ハイブリッド";
      default:
        return format;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {/* 戻るボタン */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href={`/seminars?id=${id}`}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          セミナー詳細に戻る
        </Link>
      </Button>

      <h1 className="text-3xl font-bold mb-6">セミナー予約</h1>

      {/* セミナー情報カード */}
      <Card className="seminar-detail-card mb-8 overflow-hidden">
        <div className="h-1.5 rounded-t-xl bg-primary" />
        <CardHeader>
          <CardTitle className="whitespace-pre-line">{normalizeLineBreaks(seminar.title)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* 左列: 開催日・時間・開催形式 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">開催日</p>
                  <p className="font-medium">
                    {format(date, "yyyy年M月d日 (E)", { locale: ja })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-pink-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">時間</p>
                  <p className="font-medium">
                    {format(date, "HH:mm", { locale: ja })} ～{" "}
                    {seminar.end_time || ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">開催形式</p>
                  <p className="font-medium">{formatLabel(seminar.format)}</p>
                </div>
              </div>
            </div>

            {/* 右列: 講師・会員限定・定員 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">講師</p>
                  <p>
                    <span className="font-bold">{seminar.speaker}</span> 氏
                  </p>
                  {seminar.speaker_title ? (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {seminar.speaker_title}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {seminar.target === "members_only" ? "会員限定" : "一般公開"}
                {"　"}
                定員 {seminar.capacity}名
                {seminar.current_bookings >= seminar.capacity
                  ? "（満席）"
                  : "（残席あり）"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 申し込みフォーム */}
      <Card className="seminar-detail-card overflow-hidden">
        <div className="h-1.5 rounded-t-xl bg-primary" />
        <CardHeader>
          <CardTitle>ご参加者情報</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 氏名 */}
            <div className="space-y-2">
              <Label htmlFor="name">
                お名前 <span className="text-red-500">*</span>
              </Label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* メールアドレス */}
            <div className="space-y-2">
              <Label htmlFor="email">
                メールアドレス <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                （会社のメールアドレスでご登録ください）
              </p>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* メールアドレス（確認） */}
            <div className="space-y-2">
              <Label htmlFor="emailConfirm">
                メールアドレス（確認） <span className="text-red-500">*</span>
              </Label>
              <input
                id="emailConfirm"
                name="emailConfirm"
                type="email"
                required
                autoComplete="off"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 会社名 */}
            <div className="space-y-2">
              <Label htmlFor="company">
                会社名 <span className="text-red-500">*</span>
              </Label>
              <input
                id="company"
                name="company"
                type="text"
                required
                value={formData.company}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 部署名 */}
            <div className="space-y-2">
              <Label htmlFor="department">部署名</Label>
              <input
                id="department"
                name="department"
                type="text"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 招待コード（会員限定セミナーのみ） */}
            {seminar.target === "members_only" && (
              <div className="space-y-2">
                <Label htmlFor="invitation_code">招待コード</Label>
                <p className="text-xs text-muted-foreground">
                  会員でない場合は、お手元の招待コードを入力してください。
                </p>
                <input
                  id="invitation_code"
                  name="invitation_code"
                  type="text"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  autoComplete="off"
                />
              </div>
            )}

            {/* 参加方法（会場 / オンライン / ハイブリッドに応じて表示） */}
            <div className="space-y-3">
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

            {/* 注意事項 */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                ※ 予約完了後、登録されたメールアドレスに確認メールが送信されます。
                <br />※ キャンセルする場合は、確認メールに記載されているリンクからお手続きください。
              </p>
            </div>

            {/* 送信ボタン（カード中央） */}
            <div className="flex flex-col items-center pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full max-w-md text-white rounded-xl h-14 text-lg font-semibold"
                style={{
                  background:
                    "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                }}
              >
                {loading ? "送信中..." : "この内容で申し込む"}
              </Button>
              <Link
                href="/seminars"
                className="mt-4 text-sm text-muted-foreground hover:underline"
              >
                キャンセルする
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 会員限定アラートモーダル（403時） */}
      <Dialog open={showMemberOnlyModal} onOpenChange={setShowMemberOnlyModal}>
        <DialogContent className="sm:max-w-md" aria-describedby="member-only-booking-desc">
          <DialogHeader>
            <DialogTitle>このセミナーは会員限定のものとなります</DialogTitle>
          </DialogHeader>
          <DialogDescription id="member-only-booking-desc" asChild>
            <p className="text-sm text-muted-foreground">
              会員企業のメールアドレスでお申し込みいただくか、招待コードをお持ちの場合は入力のうえお申し込みください。
            </p>
          </DialogDescription>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowMemberOnlyModal(false);
                router.push("/seminars");
              }}
            >
              セミナー一覧へ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
