import { SeminarCard } from "@/components/seminar-card";
import type { Seminar } from "@/lib/types";

async function getSeminars(): Promise<Seminar[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/seminars?status=published`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function SeminarsPage() {
  const seminars = await getSeminars();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">セミナー一覧</h1>
      {seminars.length === 0 ? (
        <p className="text-muted-foreground">
          現在、公開中のセミナーはありません。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seminars.map((seminar) => (
            <SeminarCard key={seminar.id} seminar={seminar} />
          ))}
        </div>
      )}
    </div>
  );
}
