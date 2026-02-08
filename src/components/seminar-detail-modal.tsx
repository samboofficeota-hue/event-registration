"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, X, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Seminar } from "@/lib/types";
import { normalizeLineBreaks } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SeminarDetailModalProps {
  seminar: Seminar | null;
  onClose: () => void;
  /** テナント用のベースパス（例: /whgc-seminars）。未指定時は /seminars */
  basePath?: string;
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

export function SeminarDetailModal({
  seminar,
  onClose,
  basePath = "/seminars",
}: SeminarDetailModalProps) {
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
        {/* モーダル本体：背景黒。ヒーロー下のマージン間はこの黒が表示される */}
        <div className="w-full lg:w-[70%] min-h-full bg-black relative">
          {/* 閉じるボタン */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-[102] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ヒーロー：メイン画像 ＋ メインタイトル。その下に margin-bottom で次のセクションとの間隔 */}
          <header
            className="flex flex-shrink-0 flex-col mb-12 lg:mb-8"
            aria-label="ヒーロー"
          >
            <div className="relative w-full overflow-hidden bg-neutral-800 aspect-[16/9]">
              <img
                src={resolveImageUrl(seminar.image_url)}
                alt={seminar.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/9553.png";
                }}
              />
            </div>
            <div className="w-full max-w-[1280px] mx-auto bg-white px-8 lg:px-12 pt-6 pb-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-2xl font-bold leading-tight tracking-tight text-gray-900 min-w-0 flex-1 whitespace-pre-line md:text-4xl">
                  {normalizeLineBreaks(seminar.title)}
                </h2>
                <Badge
                  className={`flex-shrink-0 ${formatColors[seminar.format] ?? "bg-purple-600 text-white"}`}
                >
                  {formatLabel(seminar.format)}
                </Badge>
              </div>
              {(isFull || isPast) && (
                <div className="pt-2">
                  <Badge variant="destructive">
                    {isFull ? "満席" : "終了済み"}
                  </Badge>
                </div>
              )}
            </div>
          </header>

          {/* セミナー詳細セクション：背景白。タイトルと同じ左余白（px-8 lg:px-12）で開始位置を揃える */}
          <section
            className="section-stack flex-shrink-0 bg-white pt-6 pb-8 lg:pt-8 lg:pb-10"
            aria-label="詳細"
          >
            <div className="w-full max-w-[1280px] mx-auto px-8 lg:px-12">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* 左カラム: 1.概要 2.講師 3.定員・会員限定ボタン */}
                <div className="lg:col-span-2 section-stack">
                  {/* 1. セミナー概要（テキストのみ） */}
                  <div>
                    <p className="whitespace-pre-line text-gray-600 leading-relaxed text-lg">
                      {normalizeLineBreaks(seminar.description)}
                    </p>
                  </div>

                  {/* 2. 講師（名前／肩書き、参考URL、写真アイコンなし） */}
                  <div className="block-stack">
                    <div className="text-2xl text-gray-900">
                      講師： <span className="font-bold">{seminar.speaker}</span>
                    </div>
                    {seminar.speaker_title && (
                      <p className="text-gray-600">{seminar.speaker_title}</p>
                    )}
                    {seminar.speaker_reference_url && (
                      <a
                        href={seminar.speaker_reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all text-sm"
                      >
                        参考URL
                      </a>
                    )}
                  </div>

                  {/* 3. 定員・会員限定をボタン（Badge）で表示 */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">
                      定員 {seminar.capacity}名
                    </Badge>
                    <Badge
                      variant={seminar.target === "members_only" ? "default" : "secondary"}
                      className="text-sm"
                    >
                      {seminar.target === "members_only" ? "会員限定" : "一般公開"}
                    </Badge>
                  </div>
                </div>

                {/* 右カラム: セミナー情報（タイトル・開催日時・開催形式・申し込みボタン） */}
                <div className="block-stack">
                  <div className="seminar-detail-card overflow-hidden border border-gray-200 bg-white p-6 block-stack">
                    <h3 className="text-lg font-semibold text-gray-900">セミナー情報</h3>
                    <div className="block-stack-tight">
                      <div>
                        <p className="text-xs text-gray-500">タイトル</p>
                        <p className="font-medium text-gray-900 whitespace-pre-line">
                          {normalizeLineBreaks(seminar.title)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-gray-100 p-3">
                        <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">開催日</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {format(date, "yyyy年M月d日 (E)", { locale: ja })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-gray-100 p-3">
                        <Clock className="w-5 h-5 text-pink-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">時間</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {format(date, "HH:mm", { locale: ja })} ～{" "}
                            {formatDuration(seminar.duration_minutes)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">開催形式</p>
                        <p className="font-medium text-gray-900 text-sm">
                          {formatLabel(seminar.format)}
                        </p>
                      </div>
                    </div>

                    {!isFull && !isPast ? (
                      <a href={`${basePath}/${seminar.id}/booking`} className="block">
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
                  </div>
                </div>
              </div>
            </div>
            </section>

          {/* フッター */}
          <footer className="bg-white border-t border-gray-200 py-8">
            <div className="content-container text-center text-gray-500">
              <p>© 2026 Seminar Hub. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
