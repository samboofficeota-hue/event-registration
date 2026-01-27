import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingForm } from "@/components/booking-form";
import type { Seminar } from "@/lib/types";

async function getSeminar(id: string): Promise<Seminar | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/seminars/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seminar = await getSeminar(id);

  if (!seminar || seminar.status !== "published") {
    notFound();
  }

  const isFull = seminar.current_bookings >= seminar.capacity;
  if (isFull) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="mb-4 text-2xl font-bold">満席です</h1>
        <p className="text-muted-foreground">
          申し訳ありませんが、このセミナーは定員に達しました。
        </p>
        <Link
          href="/seminars"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          セミナー一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/seminars/${id}`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← セミナー詳細に戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>予約フォーム</CardTitle>
          <p className="text-sm text-muted-foreground">{seminar.title}</p>
        </CardHeader>
        <CardContent>
          <BookingForm seminarId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
