import { Suspense } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

// The frame is static. The sidebar (user, workspaces) and page content read the session,
// so each streams in behind its own Suspense boundary.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarFallback />}>
        <AppSidebar />
      </Suspense>
      {/* min-w-0 so wide content (tables) scrolls inside the page instead of widening it. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="mr-2 h-4 w-px bg-border" aria-hidden />
          <span className="text-sm text-muted-foreground">ClubIntel</span>
        </header>
        {/* SidebarInset is the page's <main>; this is just its padding. */}
        <div className="min-w-0 flex-1 p-4 md:p-6">
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SidebarFallback() {
  return (
    // Fixed widths: the static shell can't use random values.
    <div className="hidden w-(--sidebar-width) shrink-0 flex-col gap-3 border-r bg-sidebar p-3 md:flex">
      <Skeleton className="h-10 w-full" />
      {["w-3/4", "w-2/3", "w-1/2"].map((w) => (
        <Skeleton key={w} className={`h-6 ${w}`} />
      ))}
    </div>
  );
}

function PageFallback() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
