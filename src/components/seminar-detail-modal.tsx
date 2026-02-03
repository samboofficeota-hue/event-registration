"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  X,
  Ticket,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Seminar } from "@/lib/types";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SeminarDetailModalProps {
  seminar: Seminar | null;
  onClose: () => void;
}

/** Google Drive ファイルURLを直接画像URLに変換 */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";

  // 既に uc?export=view 形式なら そのまま返す
  if (url.includes("uc?export=view") || url.includes("uc?export=download")) {
    // download形式の場合はview形式に変換（より安定）
    return url.replace("uc?export=download", "uc?export=view");
  }

  // /file/d/{id}/view 形式から変換
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    const fileId = match[1];
    // サムネイル画像URLを使用（より軽量で高速）
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  // マッチしない場合は汎用画像
  return "/9553.png";
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

export function SeminarDetailModal({ seminar, onClose }: SeminarDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  if (!mounted || !seminar) return null;

  const isFull = seminar.current_bookings >= seminar.capacity;
  const isPast = new Date(seminar.date) < new Date();
  const spotsLeft = seminar.capacity - seminar.current_bookings;
  const progressPercent = (seminar.current_bookings / seminar.capacity) * 100;
  const date = new Date(seminar.date);

  const modalContent = (
    <AnimatePresence>
      {/* オーバーレイ */}
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-black z-[100]"
        onClick={handleClose}
      />

      {/* モーダルコンテナ */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-0 z-[101] flex justify-center overflow-y-auto"
      >
        <div className="w-full lg:w-[70%] min-h-full bg-white text-gray-900 relative">
          {/* 閉じるボタン */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-[102] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ヒーロー画像エリア（16:9固定、白背景） */}
          <div className="relative w-full aspect-[16/9] bg-white">
            <img
              src={resolveImageUrl(seminar.image_url)}
              alt={seminar.title}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/9553.png";
              }}
            />
            {/* グラデーション遮光 */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent" />

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
                <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
                  {seminar.title}
                </h2>
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
                <Card className="bg-white border border-gray-200 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      セミナー概要
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 leading-relaxed text-lg">
                      {seminar.description}
                    </p>
                  </CardContent>
                </Card>

                {/* このセミナーの特徴 */}
                <Card className="bg-white border border-gray-200 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-pink-500" />
                      このセミナーの特徴
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {highlights.map((highlight, index) => (
                        <li
                          key={index}
                          className="flex items-center gap-3"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-gray-900">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* 講師紹介 */}
                <Card className="bg-white border border-gray-200 shadow-xl overflow-hidden">
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
                      <div className="w-24 h-24 rounded-full border-4 border-primary/20 bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-12 h-12 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">
                          {seminar.speaker}
                        </h3>
                        {seminar.speaker_title && (
                          <p className="text-gray-600">
                            {seminar.speaker_title}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Meet リンク（オンライン・ハイブリッド） */}
                {seminar.meet_url &&
                  (seminar.format === "online" || seminar.format === "hybrid") && (
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
                  )}
              </div>

              {/* 右サイドバー: 予約情報 */}
              <div className="space-y-6">
                <Card className="bg-white border border-gray-200 shadow-xl">
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
                        <span className="text-gray-600">参加状況</span>
                        <span className="font-medium text-gray-900">
                          {seminar.current_bookings}/{seminar.capacity}人
                        </span>
                      </div>
                      {/* プログレスバー */}
                      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
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
                      <p className="text-sm text-gray-600 mt-2">
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
                      <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                        <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">開催日</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {format(date, "yyyy年M月d日 (E)", { locale: ja })}
                          </p>
                        </div>
                      </div>

                      {/* 時間 */}
                      <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                        <Clock className="w-5 h-5 text-pink-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">時間</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {format(date, "HH:mm", { locale: ja })} ～{" "}
                            {formatDuration(seminar.duration_minutes)}
                          </p>
                        </div>
                      </div>

                      {/* 開催形式 */}
                      <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                        <MapPin className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">開催形式</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {formatLabel(seminar.format)}
                          </p>
                        </div>
                      </div>

                      {/* 対象 */}
                      <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                        <Users className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">対象</p>
                          <p className="font-medium text-gray-900 text-sm">
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

                    <p className="text-xs text-center text-gray-500 mt-4">
                      キャンセルポリシーが適用されます
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* フッター */}
          <footer className="bg-white border-t border-gray-200 py-8">
            <div className="container mx-auto px-4 text-center text-gray-500">
              <p>© 2026 Seminar Hub. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
