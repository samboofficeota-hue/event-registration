"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative py-12 md:py-16 flex items-center justify-center overflow-hidden">
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
        className="absolute top-10 left-10 w-24 h-24 rounded-full blur-xl"
        style={{ backgroundColor: "hsl(199, 89%, 48%, 0.3)" }}
        animate={{ y: [0, -15, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-10 right-16 w-32 h-32 rounded-full blur-xl"
        style={{ backgroundColor: "hsl(330, 81%, 60%, 0.3)" }}
        animate={{ y: [0, 15, 0], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* コンテンツ */}
      <div className="relative z-10 container mx-auto px-4 text-center text-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* バッジ */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">WHGCとは</span>
          </motion.div>

          {/* 見出し */}
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            公益資本主義を理解し
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(199, 89%, 68%), white, hsl(36, 100%, 60%))",
              }}
            >
              俯瞰的な視点と現場感覚を持った
            </span>
            ゲームチェンジャー人材の創出へ
          </h1>
        </motion.div>
      </div>

      {/* ボトムウェーブ */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" className="w-full h-auto">
          <path
            fill="hsl(240, 20%, 98%)"
            d="M0,32L48,34.7C96,37,192,43,288,45.3C384,48,480,48,576,42.7C672,37,768,27,864,24C960,21,1056,27,1152,29.3C1248,32,1344,32,1392,32L1440,32L1440,60L1392,60C1344,60,1248,60,1152,60C1056,60,960,60,864,60C768,60,672,60,576,60C480,60,384,60,288,60C192,60,96,60,48,60L0,60Z"
          />
        </svg>
      </div>
    </section>
  );
}
