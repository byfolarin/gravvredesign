import { Sidebar } from "../_components/sidebar/sidebar";
import { TopBar } from "../_components/top-bar";

const user = { name: "Oluwatobi Bello", email: "tbello@kredete.com" };

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app-fill flex bg-background">
      <Sidebar workspace="Kredete" user={user} />
      <div className="content-theme my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/8 bg-surface">
        {/* Top bar rests on the page surface, no fill of its own */}
        <TopBar />
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
