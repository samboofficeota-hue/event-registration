"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { normalizeLineBreaks } from "@/lib/utils";
import type { Seminar } from "@/lib/types";

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

  useEffect(() => {
    fetch(`/api/seminars/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSeminar(data);
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

    setLoading(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seminar_id: id,
          ...formData,
          email: formData.email.trim(),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "予約に失敗しました");
      }

      const booking = await res.json();

      toast.success("予約が完了しました！");

      // 確認ページにリダイレクト
      router.push(`/seminars/${id}/confirmation?booking_id=${booking.id}`);
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
                    {seminar.duration_minutes}分
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

            {/* 注意事項 */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                ※ 予約完了後、登録されたメールアドレスに確認メールが送信されます。
                <br />※ キャンセルする場合は、確認メールに記載されているリンクからお手続きください。
              </p>
            </div>

            {/* 送信ボタン */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="flex-1 w-full text-white rounded-xl h-14 text-lg font-semibold"
                style={{
                  background:
                    "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                }}
              >
                {loading ? "送信中..." : "この内容で申し込む"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push("/")}
                disabled={loading}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
