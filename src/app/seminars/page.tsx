import { HeroSection } from "@/components/hero-section";
import { SeminarListClient } from "@/components/seminar-list-client";
import { getPublishedSeminars } from "@/lib/seminars";

export const dynamic = "force-dynamic";

export default async function SeminarsPage() {
  const seminars = await getPublishedSeminars();

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <SeminarListClient seminars={seminars} />
    </div>
  );
}
