"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: string;
  absolutePath?: string;   // basePath を無視して絶対パスでリンクする場合に指定
  superAdminOnly?: boolean; // true の場合、共通管理画面（/manage-console）のみ表示
}

interface NavGroup {
  type: "group";
  label: string;
  icon: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const navEntries: NavEntry[] = [
  { path: "", label: "実施一覧", icon: "📊" },
  { path: "/reservations", label: "予約一覧", icon: "📋" },
  { path: "/member-domains", label: "会員企業ドメイン", icon: "📧" },
  { path: "/surveys", label: "アンケート結果", icon: "📝" },
  {
    type: "group",
    label: "メール配信",
    icon: "📨",
    items: [
      { path: "/email-schedules", label: "配信スケジュール", icon: "🗓️" },
      { path: "/email-templates", label: "テンプレート管理", icon: "📄" },
    ],
  },
  { path: "/newsletter", label: "メルマガ管理", icon: "📬", absolutePath: "/super-manage-console/newsletter", superAdminOnly: true },
];

interface AdminSidebarProps {
  /** 管理画面のベースパス（例: /manage-console または /whgc-seminars/manage-console） */
  basePath?: string;
  /** 公開サイトへのリンク（例: /seminars または /whgc-seminars） */
  publicPath?: string;
}

export function AdminSidebar({
  basePath = "/super-manage-console",
  publicPath = "/seminars",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isSuperAdmin = basePath === "/super-manage-console";

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace(`${basePath}/login`);
    router.refresh();
  }

  // メール配信グループが現在のパスに含まれていれば初期展開
  const emailPaths = ["/email-templates", "/email-schedules"];
  const defaultOpen = emailPaths.some((p) => pathname.startsWith(`${basePath}${p}`));
  const [emailGroupOpen, setEmailGroupOpen] = useState(defaultOpen);

  return (
    <aside className="admin-sidebar flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar font-sans">
      <div className="px-5 py-5 pb-3">
        <Link
          href={basePath}
          className="text-lg font-bold tracking-tight text-sidebar-foreground"
        >
          {isSuperAdmin ? "メルマガ管理画面" : "管理画面"}
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 pb-4">
        {navEntries
          .filter((entry) => {
            // スーパー管理者: superAdminOnly のみ表示
            if (isSuperAdmin) return "superAdminOnly" in entry && entry.superAdminOnly;
            // テナント管理者: superAdminOnly を非表示、グループはそのまま表示
            return !("superAdminOnly" in entry && entry.superAdminOnly);
          })
          .map((entry) => {
          if ("type" in entry && entry.type === "group") {
            const isGroupActive = entry.items.some((item) =>
              pathname.startsWith(`${basePath}${item.path}`)
            );
            return (
              <div key={entry.label}>
                <button
                  onClick={() => setEmailGroupOpen((v) => !v)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
                    isGroupActive
                      ? "bg-sidebar-primary/10 text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span className="text-base">{entry.icon}</span>
                  <span className="flex-1 text-left">{entry.label}</span>
                  {emailGroupOpen
                    ? <ChevronDown className="h-4 w-4 opacity-60" />
                    : <ChevronRight className="h-4 w-4 opacity-60" />
                  }
                </button>
                {emailGroupOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                    {entry.items.map((item) => {
                      const href = `${basePath}${item.path}`;
                      const isActive = pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex items-center rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const item = entry as NavItem;
          const href = item.absolutePath ?? `${basePath}${item.path}`;
          const isActive =
            item.path === ""
              ? pathname === basePath
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 space-y-3">
        <Link
          href={publicPath}
          className="text-[0.8125rem] text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
        >
          公開サイトへ →
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 text-[0.8125rem] text-sidebar-foreground/60 hover:text-red-500 transition-colors"
        >
          <LogOut className="size-3.5" />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
