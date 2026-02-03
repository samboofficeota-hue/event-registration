"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
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

    if (!formData.name || !formData.email) {
      toast.error("お名前とメールアドレスは必須です");
      return;
    }

    // メールアドレスの簡易バリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("有効なメールアドレスを入力してください");
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/")}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        セミナー一覧に戻る
      </Button>

      <h1 className="text-3xl font-bold mb-6">セミナー予約</h1>

      {/* セミナー情報カード */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{seminar.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 開催日 */}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">開催日</p>
              <p className="font-medium">
                {format(date, "yyyy年M月d日 (E)", { locale: ja })}
              </p>
            </div>
          </div>

          {/* 時間 */}
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-pink-500" />
            <div>
              <p className="text-xs text-muted-foreground">時間</p>
              <p className="font-medium">
                {format(date, "HH:mm", { locale: ja })} ～{" "}
                {seminar.duration_minutes}分
              </p>
            </div>
          </div>

          {/* 開催形式 */}
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-cyan-500" />
            <div>
              <p className="text-xs text-muted-foreground">開催形式</p>
              <p className="font-medium">{formatLabel(seminar.format)}</p>
            </div>
          </div>

          {/* 残席 */}
          <div className="mt-4 p-3 bg-primary/10 rounded-lg">
            <p className="text-sm font-medium">
              残席:{" "}
              <span className="text-primary text-lg font-bold">
                {seminar.capacity - seminar.current_bookings}
              </span>{" "}
              / {seminar.capacity}席
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 申し込みフォーム */}
      <Card>
        <CardHeader>
          <CardTitle>参加者情報</CardTitle>
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
                placeholder="山田 太郎"
              />
            </div>

            {/* メールアドレス */}
            <div className="space-y-2">
              <Label htmlFor="email">
                メールアドレス <span className="text-red-500">*</span>
              </Label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="example@email.com"
              />
            </div>

            {/* 会社名 */}
            <div className="space-y-2">
              <Label htmlFor="company">会社名</Label>
              <input
                id="company"
                name="company"
                type="text"
                value={formData.company}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="株式会社サンプル"
              />
            </div>

            {/* 部署 */}
            <div className="space-y-2">
              <Label htmlFor="department">部署</Label>
              <input
                id="department"
                name="department"
                type="text"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="営業部"
              />
            </div>

            {/* 電話番号 */}
            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="090-1234-5678"
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
                className="flex-1"
              >
                {loading ? "予約中..." : "予約を確定する"}
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
