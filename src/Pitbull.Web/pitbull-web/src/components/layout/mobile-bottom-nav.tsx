"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  FileText,
  MoreHorizontal,
  FolderKanban,
  CheckSquare,
  Users,
  Truck,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface TabItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPaths?: string[];
}

const tabs: TabItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    matchPaths: ["/"],
  },
  {
    label: "Time Entry",
    href: "/time-tracking",
    icon: Clock,
    matchPaths: ["/time-tracking"],
  },
  {
    label: "Daily Reports",
    href: "/daily-reports/mobile",
    icon: FileText,
    matchPaths: ["/daily-reports"],
  },
];

interface MoreLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const moreLinks: MoreLink[] = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Approvals", href: "/time-tracking/approval", icon: CheckSquare },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Equipment", href: "/equipment", icon: Truck },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isTabActive(pathname: string, tab: TabItem): boolean {
  if (tab.href === "/") {
    return pathname === "/";
  }
  return (
    tab.matchPaths?.some((p) => pathname.startsWith(p)) ??
    pathname.startsWith(tab.href)
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const active = isTabActive(pathname, tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
                  active
                    ? "text-amber-500 font-medium"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
              moreOpen
                ? "text-amber-500 font-medium"
                : "text-muted-foreground"
            )}
            aria-label="More navigation options"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 px-4 pb-6">
            {moreLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-[44px] flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                    active
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-500 font-medium"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
