"use client";

import { motion, type Transition, type TargetAndTransition } from "framer-motion";
import type { ReactNode } from "react";

interface AnimatedSectionProps {
  children: ReactNode;
  /** アニメーション開始時の状態 */
  initial?: TargetAndTransition | boolean;
  /** アニメーション終了時の状態 */
  animate?: TargetAndTransition | boolean;
  /** トランジション設定 */
  transition?: Transition;
  /** 追加のClassName */
  className?: string;
  /** レンダルするHTML要素の種類 */
  as?: "div" | "h1" | "li" | "ul";
}

/**
 * Server Component から呼べるアニメーションラッパー。
 * children を motion で包んで、フェードイン・スライドアプなどのアニメーションを付与する。
 */
export function AnimatedSection({
  children,
  initial = { opacity: 0, y: 20 },
  animate = { opacity: 1, y: 0 },
  transition = {},
  className,
  as = "div",
}: AnimatedSectionProps) {
  const Component = motion[as];

  return (
    <Component
      initial={initial}
      animate={animate}
      transition={transition}
      className={className}
    >
      {children}
    </Component>
  );
}
