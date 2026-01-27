"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface BookingFormProps {
  seminarId: string;
}

export function BookingForm({ seminarId }: BookingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      seminar_id: seminarId,
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      company: formData.get("company") as string,
      department: formData.get("department") as string,
      phone: formData.get("phone") as string,
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "予約に失敗しました");
      }

      const result = await res.json();
      toast.success("予約が完了しました");
      router.push(
        `/seminars/${seminarId}/confirmation?rid=${result.id}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "予約に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          氏名 <span className="text-red-500">*</span>
        </Label>
        <Input id="name" name="name" required placeholder="山田 太郎" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          メールアドレス <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="taro@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">会社名</Label>
        <Input id="company" name="company" placeholder="株式会社○○" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">部署</Label>
        <Input id="department" name="department" placeholder="営業部" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">電話番号</Label>
        <Input id="phone" name="phone" type="tel" placeholder="03-1234-5678" />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "予約中..." : "予約する"}
      </Button>
    </form>
  );
}
