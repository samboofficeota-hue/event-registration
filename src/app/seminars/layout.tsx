import { Header } from "@/components/header";

export default function SeminarsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
