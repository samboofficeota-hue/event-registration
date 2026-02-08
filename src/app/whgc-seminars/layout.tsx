import { Header } from "@/components/header";

export default function WhgcSeminarsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="force-light min-h-screen bg-background">
      <Header basePath="/whgc-seminars" />
      {children}
    </div>
  );
}
