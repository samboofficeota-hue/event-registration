"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "ダッシュボード", icon: "📊" },
  { href: "/admin/seminars", label: "セミナー管理", icon: "📅" },
  { href: "/admin/reservations", label: "予約一覧", icon: "📋" },
  { href: "/admin/surveys", label: "アンケート結果", icon: "📝" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-gray-50 p-4">
      <div className="mb-6">
        <Link href="/admin" className="text-lg font-bold text-gray-900">
          管理画面
        </Link>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-200 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 border-t pt-4">
        <Link
          href="/seminars"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          公開サイトへ →
        </Link>
      </div>
    </aside>
  );
}
