import { HeroSection } from "@/components/hero-section";
import { NoteArticlesSection } from "@/components/note-articles-section";
import { SeminarListClient } from "@/components/seminar-list-client";
import { getPublishedSeminarsForTenant } from "@/lib/seminars";

export const dynamic = "force-dynamic";

export default async function WhgcSeminarsPage() {
  const seminars = await getPublishedSeminarsForTenant("whgc-seminars");

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <NoteArticlesSection />
      <SeminarListClient seminars={seminars} basePath="/whgc-seminars" />
    </div>
  );
}
