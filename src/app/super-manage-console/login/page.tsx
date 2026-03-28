"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function SuperLoginForm() {
  const router = useRouter();
  const [tenantPassword, setTenantPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, tenantPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "ログインに失敗しました");
      }

      toast.success("ログインしました");
      router.replace("/super-manage-console");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="force-light flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-foreground">全体管理ログイン</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantPassword">テナント管理パスワード</Label>
              <Input
                id="tenantPassword"
                type="password"
                value={tenantPassword}
                onChange={(e) => setTenantPassword(e.target.value)}
                required
                placeholder="テナント管理者パスワード"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">全体管理パスワード</Label>
              <Input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                placeholder="全体管理者パスワード"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuperLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="force-light flex min-h-screen items-center justify-center bg-background">
          <Card className="w-full max-w-sm border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-center text-foreground">全体管理ログイン</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <SuperLoginForm />
    </Suspense>
  );
}
