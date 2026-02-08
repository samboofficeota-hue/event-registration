import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  ArrowLeft,
  Ticket,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedSection } from "@/components/animated-section";
import { getSeminarById } from "@/lib/seminars";
import { normalizeLineBreaks } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export const dynamic = "force-dynamic";

/** Google Drive ファイルURLを直接画像URLに変換（共有設定対応） */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";
  if (url.includes("uc?export=view") || url.includes("uc?export=download")) {
    return url.replace("uc?export=download", "uc?export=view");
  }
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200`;
  }
  return "/9553.png";
}

/** duration_minutes を「○分」で表示（例: 90分） */
function formatDuration(minutes: number): string {
  return `${minutes}分`;
}

/** 開催形式の日本語表記 */
function formatLabel(f: string): string {
  if (f === "online") return "オンライン";
  if (f === "hybrid") return "ハイブリッド";
  return "会場";
}

/** 開催形式のカラー */
const formatColors: Record<string, string> = {
  online: "bg-cyan-500 text-white",
  venue: "bg-purple-600 text-white",
  hybrid: "bg-pink-500 text-white",
};

const highlights = [
  "業界トップクラスの講師による直接指導",
  "実践的なワークショップ形式",
  "参加者同士のネットワーキング機会",
  "質疑応答セッションあり",
  "参加証明書の発行",
];

export default async function SeminarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const seminar = await getSeminarById(id);
  if (!seminar) {
    return notFound();
  }

  const isFull = seminar.current_bookings >= seminar.capacity;
  const isPast = new Date(seminar.date) < new Date();
  const spotsLeft = seminar.capacity - seminar.current_bookings;
  const progressPercent = (seminar.current_bookings / seminar.capacity) * 100;
  const date = new Date(seminar.date);

  return (
    <div className="min-h-screen bg-background">
      {/* ヒーロー画像エリア（オーバーレイなしで画像を明確に表示） */}
      <div className="seminar-detail-hero relative w-full overflow-hidden bg-background">
        <img
          src={resolveImageUrl(seminar.image_url)}
          alt={seminar.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/9553.png";
          }}
        />
        {/* 戻りボタンのみ画像上に表示 */}
        <Link
          href="/seminars"
          className="absolute left-6 top-6 z-10 inline-flex items-center"
        >
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-lg"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            戻る
          </Button>
        </Link>
      </div>

      {/* タイトルブロック（画像の下に配置） */}
      <div className="seminar-detail-content section-stack">
        <div>
          <Badge
            className={`mb-4 ${formatColors[seminar.format] ?? "bg-purple-600 text-white"}`}
          >
            {formatLabel(seminar.format)}
          </Badge>
          <h1 className="mb-4 whitespace-pre-line text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            {normalizeLineBreaks(seminar.title)}
          </h1>
          <div className="flex flex-wrap gap-2">
            {seminar.target === "members_only" && (
              <Badge variant="secondary">会員限定</Badge>
            )}
            {(isFull || isPast) && (
              <Badge variant="destructive">
                {isFull ? "満席" : "終了済み"}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* 左カラム: 概要・特徴・講師 */}
          <div className="lg:col-span-2 section-stack">
            {/* セミナー概要 */}
            <AnimatedSection transition={{ delay: 0.1 }}>
              <Card className="seminar-detail-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    セミナー概要
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-muted-foreground leading-relaxed text-lg">
                    {normalizeLineBreaks(seminar.description)}
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* このセミナーの特徴 */}
            <AnimatedSection transition={{ delay: 0.2 }}>
              <Card className="seminar-detail-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    このセミナーの特徴
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {highlights.map((highlight, index) => (
                      <AnimatedSection
                        key={index}
                        as="li"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-foreground">{highlight}</span>
                      </AnimatedSection>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* 講師紹介 */}
            <AnimatedSection transition={{ delay: 0.3 }}>
              <Card className="seminar-detail-card overflow-hidden">
                <div className="h-1.5 bg-primary" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    講師紹介
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-full border-4 border-border bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-2xl text-foreground">
                        登壇者： <span className="font-bold">{seminar.speaker}</span> 氏
                      </div>
                      {seminar.speaker_title && (
                        <p className="mt-1 text-muted-foreground">
                          {seminar.speaker_title}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Meet リンク（オンライン・ハイブリッド） */}
            {seminar.meet_url &&
              (seminar.format === "online" || seminar.format === "hybrid") && (
                <AnimatedSection transition={{ delay: 0.35 }}>
                  <Card className="seminar-detail-card bg-muted/50">
                    <CardContent className="p-6">
                      <p className="mb-2 text-sm font-semibold text-foreground">
                        参加方法
                      </p>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {seminar.format === "online"
                          ? "オンライン開催です。以下のリンクから参加できます。"
                          : "ハイブリッド開催です。オンライン参加の場合は以下のリンクを使用してください。"}
                      </p>
                      <a
                        href={seminar.meet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all"
                      >
                        {seminar.meet_url}
                      </a>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              )}
          </div>

          {/* 右サイドバー: 予約情報 */}
          <div className="block-stack">
            <AnimatedSection transition={{ delay: 0.2 }}>
              <Card className="seminar-detail-card sticky top-6">
                <div className="h-1.5 rounded-t-xl bg-primary" />
                <CardContent className="p-6 block-stack">
                  {/* 参加状況プログレス */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">参加状況</span>
                      <span className="font-medium text-foreground">
                        {seminar.current_bookings}/{seminar.capacity}人
                      </span>
                    </div>
                    {/* プログレスバー */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressPercent >= 90 ? "bg-destructive" : "bg-primary"}`}
                      style={{
                        width: `${Math.min(progressPercent, 100)}%`,
                      }}
                    />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      残り{" "}
                      <span className="font-bold text-primary">
                        {isFull ? 0 : spotsLeft}
                      </span>{" "}
                      席
                    </p>
                  </div>

                  {/* 詳細情報 */}
                  <div className="block-stack-tight">
                    {/* 開催日 */}
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">開催日</p>
                        <p className="font-medium text-foreground text-sm">
                          {format(date, "yyyy年M月d日 (E)", { locale: ja })}
                        </p>
                      </div>
                    </div>

                    {/* 時間 */}
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <Clock className="w-5 h-5 text-accent flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">時間</p>
                        <p className="font-medium text-foreground text-sm">
                          {format(date, "HH:mm", { locale: ja })} ～{" "}
                          {formatDuration(seminar.duration_minutes)}
                        </p>
                      </div>
                    </div>

                    {/* 開催形式 */}
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <MapPin className="w-5 h-5 text-secondary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">開催形式</p>
                        <p className="font-medium text-foreground text-sm">
                          {formatLabel(seminar.format)}
                        </p>
                      </div>
                    </div>

                    {/* 対象 */}
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <Users className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">対象</p>
                        <p className="font-medium text-foreground text-sm">
                          {seminar.target === "members_only"
                            ? "会員限定"
                            : "一般公開"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 予約ボタン */}
                  {!isFull && !isPast ? (
                    <Link href={`/seminars/${seminar.id}/booking`}>
                      <Button
                        size="lg"
                        className="w-full rounded-xl h-14 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Ticket className="w-5 h-5 mr-2" />
                        申し込む
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full rounded-xl h-14 text-lg font-semibold"
                      disabled
                    >
                      {isFull ? "満席です" : "開催済みです"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="bg-card border-t border-border py-8 mt-12">
        <div className="content-container text-center text-muted-foreground">
          <p>© 2026 Seminar Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
