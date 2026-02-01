"use client";

import { motion } from "framer-motion";
import { Calendar, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* グラデーション背景 */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "linear-gradient(135deg, hsl(262, 83%, 58%) 0%, hsl(330, 81%, 60%) 40%, hsl(36, 100%, 50%) 100%)",
        }}
      />

      {/* 浮かぶ装飾球体 */}
      <motion.div
        className="absolute top-20 left-10 w-32 h-32 rounded-full blur-xl"
        style={{ backgroundColor: "hsl(199, 89%, 48%, 0.3)" }}
        animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-20 w-48 h-48 rounded-full blur-xl"
        style={{ backgroundColor: "hsl(330, 81%, 60%, 0.3)" }}
        animate={{ y: [0, 20, 0], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full blur-lg"
        style={{ backgroundColor: "hsl(36, 100%, 50%, 0.4)" }}
        animate={{ x: [0, 15, 0], y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* コンテンツ */}
      <div className="relative z-10 container mx-auto px-4 text-center text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* バッジ */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">2026年 最新セミナー情報</span>
          </motion.div>

          {/* 見出し */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            あなたの
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(199, 89%, 68%), white, hsl(36, 100%, 60%))",
              }}
            >
              キャリアを加速する
            </span>
            セミナー
          </h1>

          {/* サブタイトル */}
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
            最先端のビジネススキルから、テクノロジートレンドまで。
            業界トップの講師陣による、実践的なセミナーを多数開催中。
          </p>

          {/* ボタン */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
              onClick={() => {
                document
                  .getElementById("seminar-list")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Calendar className="w-5 h-5 mr-2" />
              セミナーを探す
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/10 font-semibold px-8 py-6 text-lg rounded-full bg-transparent"
            >
              <Users className="w-5 h-5 mr-2" />
              会員登録
            </Button>
          </div>

          {/* 統計情報 */}
          <motion.div
            className="flex flex-wrap justify-center gap-8 md:gap-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {[
              { value: "500+", label: "開催セミナー" },
              { value: "10,000+", label: "参加者数" },
              { value: "98%", label: "満足度" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ボトムウェーブ */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-auto">
          <path
            fill="hsl(240, 20%, 98%)"
            d="M0,64L48,69.3C96,75,192,85,288,90.7C384,96,480,96,576,85.3C672,75,768,53,864,48C960,43,1056,53,1152,58.7C1248,64,1344,64,1392,64L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
          />
        </svg>
      </div>
    </section>
  );
}
