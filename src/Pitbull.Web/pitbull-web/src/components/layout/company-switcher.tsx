"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/company-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CompanySwitcherProps {
  /** Variant for different placement contexts */
  variant?: "sidebar" | "header";
}

/**
 * Company switcher dropdown — prominently shows the active company
 * and allows switching between companies the user has access to.
 *
 * Inspired by Vista/Viewpoint's company selector:
 * - Always visible, always clear which company you're in
 * - Quick switch without page reload
 * - Shows company code + name
 */
export function CompanySwitcher({ variant = "sidebar" }: CompanySwitcherProps) {
  const { activeCompany, companies, hasMultipleCompanies, switchCompany, isLoading } =
    useCompany();

  // Don't render if no companies loaded yet or only one company
  if (isLoading || companies.length === 0) {
    return null;
  }

  // Single company — show as static badge, no dropdown
  if (!hasMultipleCompanies && activeCompany) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 rounded-lg",
          variant === "sidebar"
            ? "text-neutral-300"
            : "text-foreground"
        )}
      >
        <Building2
          className={cn(
            "h-4 w-4 shrink-0",
            variant === "sidebar" ? "text-amber-400" : "text-amber-500"
          )}
        />
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant="secondary"
            className={cn(
              "font-mono text-[10px] px-1.5 py-0 shrink-0",
              variant === "sidebar"
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-amber-100 text-amber-700 border-amber-200"
            )}
          >
            {activeCompany.code}
          </Badge>
          <span className="text-sm font-medium truncate">
            {activeCompany.shortName || activeCompany.name}
          </span>
        </div>
      </div>
    );
  }

  const handleSwitch = async (companyId: string) => {
    if (companyId === activeCompany?.id) return;
    try {
      await switchCompany(companyId);
      const target = companies.find((c) => c.id === companyId);
      toast.success(`Switched to ${target?.shortName || target?.name}`);
    } catch {
      toast.error("Failed to switch company");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-amber-500/50",
            variant === "sidebar"
              ? "text-neutral-300 hover:bg-white/5 hover:text-white"
              : "text-foreground hover:bg-muted"
          )}
        >
          <Building2
            className={cn(
              "h-4 w-4 shrink-0",
              variant === "sidebar" ? "text-amber-400" : "text-amber-500"
            )}
          />
          {activeCompany ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge
                variant="secondary"
                className={cn(
                  "font-mono text-[10px] px-1.5 py-0 shrink-0",
                  variant === "sidebar"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-amber-100 text-amber-700 border-amber-200"
                )}
              >
                {activeCompany.code}
              </Badge>
              <span className="truncate text-left">
                {activeCompany.shortName || activeCompany.name}
              </span>
            </div>
          ) : (
            <span className="flex-1 text-left truncate">Select Company</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          "w-72",
          variant === "sidebar" && "bg-[#1a1a2e] border-white/10 text-white"
        )}
      >
        <DropdownMenuLabel
          className={cn(
            "text-xs uppercase tracking-wider",
            variant === "sidebar" ? "text-neutral-400" : "text-muted-foreground"
          )}
        >
          Switch Company
        </DropdownMenuLabel>
        <DropdownMenuSeparator
          className={variant === "sidebar" ? "bg-white/10" : undefined}
        />
        {companies.map((company) => {
          const isActive = company.id === activeCompany?.id;

          return (
            <DropdownMenuItem
              key={company.id}
              onClick={() => handleSwitch(company.id)}
              className={cn(
                "flex items-center gap-3 cursor-pointer",
                variant === "sidebar" &&
                  (isActive
                    ? "bg-amber-500/15 text-amber-400"
                    : "focus:bg-white/5 focus:text-white")
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge
                  variant="secondary"
                  className={cn(
                    "font-mono text-[10px] px-1.5 py-0 shrink-0",
                    variant === "sidebar"
                      ? isActive
                        ? "bg-amber-500/30 text-amber-400 border-amber-500/40"
                        : "bg-white/10 text-neutral-400 border-white/10"
                      : isActive
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {company.code}
                </Badge>
                <span className="truncate font-medium">
                  {company.shortName || company.name}
                </span>
              </div>
              {isActive && (
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    variant === "sidebar" ? "text-amber-400" : "text-amber-500"
                  )}
                />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
