"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * セミナー管理は予約一覧に統合したため、/admin/seminars は予約一覧へリダイレクトします。
 */
export default function AdminSeminarsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/reservations");
  }, [router]);
  return (
    <p className="text-sm text-muted-foreground">予約一覧へ移動しています...</p>
  );
}
