import { Header } from "@/components/header";

export default function SeminarsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      {children}
    </div>
  );
}
