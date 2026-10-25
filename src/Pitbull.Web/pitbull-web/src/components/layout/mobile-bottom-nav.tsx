"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { buildFieldReportHref } from "@/lib/projects";
import { getRoleDefaults, workspaces, getWorkspaceLandingHref } from "./workspaces";
import { resolveActiveMobileTabHref } from "./nav-utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();

  const roleConfig = getRoleDefaults(user?.roles, user?.roleProfile);
  const mobileTabs = roleConfig.mobileTabs;
  const activeHref = resolveActiveMobileTabHref(pathname, mobileTabs);
  // When already inside a project route, pass job into Field Report pick list.
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)/i);
  const currentProjectId = projectMatch?.[1] ?? null;

  function tabHref(href: string): string {
    if (href === "/daily-reports/mobile" && currentProjectId) {
      return buildFieldReportHref(currentProjectId);
    }
    return href;
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex h-14 items-center justify-around px-1">
          {mobileTabs.map((tab) => {
            const href = tabHref(tab.href);
            const active = activeHref === tab.href;
            return (
              <Link
                key={tab.href}
                href={href}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
                  active
                    ? "text-amber-500 font-medium"
                    : "text-muted-foreground"
                )}
              >
                <span className="text-base leading-none">{tab.icon}</span>
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
            <SheetTitle>Workspaces</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 px-4 pb-6">
            {workspaces.map((ws) => {
              const landingHref = getWorkspaceLandingHref(ws.id);
              const active = pathname.startsWith(landingHref) && landingHref !== "/";
              return (
                <Link
                  key={ws.id}
                  href={landingHref}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-[44px] flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                    active
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-500 font-medium"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="text-lg leading-none">{ws.icon}</span>
                  <span>{ws.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
