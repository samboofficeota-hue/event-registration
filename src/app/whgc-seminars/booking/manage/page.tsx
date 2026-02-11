"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";

const TENANT = "whgc-seminars";

export default function WhgcBookingManagePage() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = number.trim();
    if (!n) {
      toast.error("予約番号を入力してください");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings/by-number?number=${encodeURIComponent(n)}&tenant=${TENANT}`
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "予約番号が見つかりません");
        return;
      }
      const data = await res.json();
      router.push(
        `/seminars/${data.seminar_id}/manage?rid=${data.reservation_id}`
      );
    } catch {
      toast.error("予約番号が見つかりません");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/whgc-seminars"
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
                  onChange={(e) => setNumber(e.target.value)}
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
      </div>
    </div>
  );
}
