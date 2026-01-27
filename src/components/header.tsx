"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/seminars" className="text-xl font-bold text-gray-900">
          オンラインセミナー
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/seminars"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            セミナー一覧
          </Link>
        </nav>
      </div>
    </header>
  );
}
