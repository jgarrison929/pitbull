"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AppSidebar } from "./app-sidebar";
import { NotificationCenter } from "./notification-center";
import { ConnectionStatus } from "./connection-status";
import { HelpPanel } from "@/components/help/help-panel";
import { Sun, Moon, Monitor, Building2, Settings, HelpCircle, ChevronsUpDown, Check } from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/company-context";

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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { activeCompany, companies, hasMultipleCompanies, switchCompany } = useCompany();
  const breadcrumbs = getBreadcrumbs(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const cycleTheme = () => {
    // Cycle: light -> dark -> system -> light
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getThemeIcon = () => {
    if (theme === "system") {
      return <Monitor className="h-4 w-4" />;
    }
    return resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  const getThemeLabel = () => {
    if (theme === "light") return "Light mode";
    if (theme === "dark") return "Dark mode";
    return "System theme";
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-white dark:bg-neutral-900 px-4 lg:px-6">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-10 w-10 min-h-[44px] min-w-[44px] text-lg"
              aria-label="Open navigation menu"
            >
              &#x2630;
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex flex-col h-full [&_aside]:flex [&_aside]:flex-col [&_aside]:min-h-0 [&_aside]:h-full [&_aside]:w-full [&_aside]:lg:w-full">
              <AppSidebar variant="mobile" onNavigate={() => setMobileOpen(false)} />
            </div>
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

        {/* Active Company Switcher (visible on desktop) */}
        {activeCompany && hasMultipleCompanies && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden lg:flex items-center gap-1.5 ml-2 px-2 py-1 rounded-md hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                <Building2 className="h-3.5 w-3.5 text-amber-500" />
                <Badge
                  variant="secondary"
                  className="bg-amber-50 text-amber-700 border-amber-200 font-mono text-[10px] px-1.5 py-0 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                >
                  {activeCompany.code}
                </Badge>
                <span className="text-xs text-muted-foreground max-w-[160px] truncate">
                  {activeCompany.shortName || activeCompany.name}
                </span>
                <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Switch Company
              </div>
              <DropdownMenuSeparator />
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => company.id !== activeCompany.id && switchCompany(company.id)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Badge
                    variant="secondary"
                    className={cn(
                      "font-mono text-[10px] px-1.5 py-0 shrink-0",
                      company.id === activeCompany.id
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {company.code}
                  </Badge>
                  <span className="truncate font-medium text-sm">
                    {company.shortName || company.name}
                  </span>
                  {company.id === activeCompany.id && (
                    <Check className="h-4 w-4 shrink-0 ml-auto text-amber-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {activeCompany && !hasMultipleCompanies && (
          <div className="hidden lg:flex items-center gap-1.5 ml-2">
            <Building2 className="h-3.5 w-3.5 text-amber-500" />
            <Badge
              variant="secondary"
              className="bg-amber-50 text-amber-700 border-amber-200 font-mono text-[10px] px-1.5 py-0 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
            >
              {activeCompany.code}
            </Badge>
            <span className="text-xs text-muted-foreground max-w-[160px] truncate">
              {activeCompany.shortName || activeCompany.name}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Connection status */}
        <ConnectionStatus />

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={cycleTheme}
              aria-label={`Current: ${getThemeLabel()}. Click to change.`}
            >
              {getThemeIcon()}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getThemeLabel()}</p>
          </TooltipContent>
        </Tooltip>

        {/* Help / Glossary */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => setHelpOpen(true)}
              aria-label="Open help glossary"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Help & Glossary</p>
          </TooltipContent>
        </Tooltip>

        {/* Notifications */}
        <NotificationCenter />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 min-h-[44px] min-w-[44px]"
              aria-label="User menu"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-medium" aria-hidden="true">
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
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Profile & Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Help Panel (rendered outside header to avoid z-index issues) */}
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} pathname={pathname} />
    </>
  );
}
