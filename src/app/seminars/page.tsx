import { SeminarListClient } from "@/components/seminar-list-client";
import { getPublishedSeminars } from "@/lib/seminars";

export default async function SeminarsPage() {
  const seminars = await getPublishedSeminars();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">セミナー一覧</h1>
      <SeminarListClient seminars={seminars} />
    </div>
  );
}
