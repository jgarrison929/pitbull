"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AppSidebarMobile } from "./app-sidebar-mobile";

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: "Dashboard", href: "/" }];

  if (segments.length === 0) return crumbs;

  const labels: Record<string, string> = {
    projects: "Projects",
    bids: "Bids",
    new: "New",
    contracts: "Contracts",
    documents: "Documents",
  };

  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    crumbs.push({
      label: labels[segment] || segment,
      href: path,
    });
  }

  return crumbs;
}

export function AppHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-white px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="lg:hidden h-10 w-10 min-h-[44px] min-w-[44px] text-lg"
            aria-label="Open navigation menu"
          >
            ☰
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-[#1a1a2e]">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <AppSidebarMobile />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-neutral-300">/</span>}
            <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 min-h-[44px] min-w-[44px]"
            aria-label="User menu"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-medium" aria-hidden="true">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <span className="hidden sm:inline text-sm">{user?.name || "User"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-red-600">
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
