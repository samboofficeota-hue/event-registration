import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="force-light flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-background p-6 font-sans text-foreground">
        {children}
      </main>
    </div>
  );
}
