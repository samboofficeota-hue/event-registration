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
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export const dynamic = "force-dynamic";

/** Google Drive ファイルURLを直接画像URLに変換 */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";
  return url.replace(
    /\/file\/d\/([^/]+)\/view/,
    "https://drive.google.com/uc?export=download&id=$1"
  );
}

/** duration_minutes を「○時間○分」に変換 */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
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

  // ----- デバッグ用: 環境変数の存在確認 -----
  const debugEnv = {
    hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasKey: !!process.env.GOOGLE_PRIVATE_KEY,
    hasKeyId: !!process.env.GOOGLE_PRIVATE_KEY_ID,
    hasSheetId: !!process.env.GOOGLE_SPREADSHEET_ID,
  };

  let seminar = null;
  let debugError: string | null = null;
  try {
    seminar = await getSeminarById(id);
  } catch (e) {
    debugError = e instanceof Error ? e.message : String(e);
  }

  // デバッグ情報を一時的にレスポンスで返す
  if (!seminar) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-xl w-full bg-card rounded-xl shadow-xl p-8 font-mono text-sm">
          <h1 className="text-xl font-bold text-destructive mb-4">DEBUG: セミナー取得失敗</h1>
          <p className="text-muted-foreground mb-2">ID: {id}</p>
          <div className="bg-muted rounded-lg p-4 mb-4 whitespace-pre-wrap">
            <p className="font-bold text-foreground mb-2">環境変数の存在:</p>
            {JSON.stringify(debugEnv, null, 2)}
          </div>
          {debugError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 whitespace-pre-wrap">
              <p className="font-bold text-red-700 mb-1">エラー:</p>
              <p className="text-red-600">{debugError}</p>
            </div>
          )}
          {!debugError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-700">エラーなし・データも返されていない（IDが見つからないか、データが空の可能性あり）</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isFull = seminar.current_bookings >= seminar.capacity;
  const isPast = new Date(seminar.date) < new Date();
  const spotsLeft = seminar.capacity - seminar.current_bookings;
  const progressPercent = (seminar.current_bookings / seminar.capacity) * 100;
  const date = new Date(seminar.date);

  return (
    <div className="min-h-screen bg-background">
      {/* ヒーロー画像エリア */}
      <div className="relative h-[50vh] md:h-[60vh]">
        <img
          src={resolveImageUrl(seminar.image_url)}
          alt={seminar.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/9553.png";
          }}
        />
        {/* グラデーション遮光 */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        {/* 戻りボタン */}
        <a
          href="/seminars"
          className="absolute top-6 left-6 z-10 inline-flex items-center"
        >
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
        </a>

        {/* タイトルオーバーライ */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="container mx-auto">
            {/* 開催形式バッジ */}
            <Badge
              className={`mb-4 ${formatColors[seminar.format] || "bg-purple-600 text-white"}`}
            >
              {formatLabel(seminar.format)}
            </Badge>
            {/* タイトル */}
            <AnimatedSection
              as="h1"
              className="text-3xl md:text-5xl font-bold text-foreground mb-4"
            >
              {seminar.title}
            </AnimatedSection>
            {/* 対象バッジ */}
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
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 左カラム: 概要・特徴・講師 */}
          <div className="lg:col-span-2 space-y-8">
            {/* セミナー概要 */}
            <AnimatedSection transition={{ delay: 0.1 }}>
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    セミナー概要
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed text-lg">
                    {seminar.description}
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* このセミナーの特徴 */}
            <AnimatedSection transition={{ delay: 0.2 }}>
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-500" />
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
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-foreground">{highlight}</span>
                      </AnimatedSection>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* 講師紹介 */}
            <AnimatedSection transition={{ delay: 0.3 }}>
              <Card className="border-0 shadow-xl overflow-hidden">
                {/* グラデーション上バー */}
                <div
                  className="h-1.5"
                  style={{
                    background:
                      "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%), hsl(36, 100%, 50%))",
                  }}
                />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    講師紹介
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    {/* アバター（アイコン代用） */}
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">
                        {seminar.speaker}
                      </h3>
                      {seminar.speaker_title && (
                        <p className="text-muted-foreground">
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
                  <Card className="border border-blue-200 shadow-xl bg-blue-50">
                    <CardContent className="p-6">
                      <p className="mb-2 text-sm font-semibold text-blue-800">
                        参加方法
                      </p>
                      <p className="mb-3 text-xs text-blue-600">
                        {seminar.format === "online"
                          ? "オンライン開催です。以下のリンクから参加できます。"
                          : "ハイブリッド開催です。オンライン参加の場合は以下のリンクを使用してください。"}
                      </p>
                      <a
                        href={seminar.meet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-700 hover:underline break-all"
                      >
                        {seminar.meet_url}
                      </a>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              )}
          </div>

          {/* 右サイドバー: 予約情報 */}
          <div className="space-y-6">
            <AnimatedSection transition={{ delay: 0.2 }}>
              <Card className="border-0 shadow-xl sticky top-6">
                {/* グラデーション上バー */}
                <div
                  className="h-1.5 rounded-t-lg"
                  style={{
                    background:
                      "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                  }}
                />
                <CardContent className="p-6">
                  {/* 参加状況プログレス */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">参加状況</span>
                      <span className="font-medium text-foreground">
                        {seminar.current_bookings}/{seminar.capacity}人
                      </span>
                    </div>
                    {/* プログレスバー */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(progressPercent, 100)}%`,
                          background:
                            progressPercent >= 90
                              ? "hsl(0, 84%, 60%)"
                              : "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
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
                  <div className="space-y-3 mb-6">
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
                      <Clock className="w-5 h-5 text-pink-500 flex-shrink-0" />
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
                      <MapPin className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">開催形式</p>
                        <p className="font-medium text-foreground text-sm">
                          {formatLabel(seminar.format)}
                        </p>
                      </div>
                    </div>

                    {/* 対象 */}
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <Users className="w-5 h-5 text-orange-500 flex-shrink-0" />
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
                    <a href={`/seminars/${seminar.id}/booking`}>
                      <Button
                        size="lg"
                        className="w-full text-white rounded-xl h-14 text-lg font-semibold"
                        style={{
                          background:
                            "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                        }}
                      >
                        <Ticket className="w-5 h-5 mr-2" />
                        申し込む
                      </Button>
                    </a>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full rounded-xl h-14 text-lg font-semibold"
                      disabled
                    >
                      {isFull ? "満席です" : "開催済みです"}
                    </Button>
                  )}

                  <p className="text-xs text-center text-muted-foreground mt-4">
                    キャンセルポリシーが適用されます
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="bg-card border-t border-border py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2026 Seminar Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
