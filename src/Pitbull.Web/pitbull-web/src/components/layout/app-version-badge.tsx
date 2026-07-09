"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { getAppVersionLabel } from "@/lib/app-version";
import { cn } from "@/lib/utils";

type AppVersionBadgeProps = {
  /** Extra classes (e.g. when embedded in the sidebar instead of fixed). */
  className?: string;
  /** Use fixed corner placement (default true). Set false when embedding. */
  fixed?: boolean;
};

/**
 * Always-visible app version. Fixed bottom-left on every page; links to About when signed in.
 */
export function AppVersionBadge({ className, fixed = true }: AppVersionBadgeProps) {
  const { isAuthenticated } = useAuth();
  const label = getAppVersionLabel();

  const classes = cn(
    "text-[10px] font-mono tabular-nums tracking-tight select-none",
    "text-muted-foreground/70 hover:text-muted-foreground transition-colors",
    fixed &&
      "fixed bottom-2 left-2 z-[60] rounded-md bg-background/80 backdrop-blur-sm border border-border/60 px-1.5 py-0.5 shadow-sm pointer-events-auto max-lg:bottom-[4.25rem]",
    className
  );

  if (isAuthenticated) {
    return (
      <Link
        href="/settings/about"
        className={classes}
        title="About this version"
        aria-label={`Application version ${label}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <span className={classes} title="Application version" aria-label={`Application version ${label}`}>
      {label}
    </span>
  );
}
