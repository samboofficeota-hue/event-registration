import { AdminSidebar } from "@/components/admin-sidebar";

export default function WhgcSeminarsAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="force-light flex min-h-screen">
      <AdminSidebar
        basePath="/whgc-seminars/manage-console"
        publicPath="/whgc-seminars"
      />
      <main className="admin-main flex-1 overflow-auto bg-background font-sans text-foreground">
        {children}
      </main>
    </div>
  );
}
