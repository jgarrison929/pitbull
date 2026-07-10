"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { getAppVersionLabel } from "@/lib/app-version";
import { fetchChangelog, type ChangelogRelease } from "@/lib/changelog";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChangelogReleaseView } from "@/components/changelog/changelog-notes";

type AppVersionBadgeProps = {
  /** Extra classes (e.g. when embedded in the sidebar instead of fixed). */
  className?: string;
  /** Use fixed corner placement (default true). Set false when embedding. */
  fixed?: boolean;
};

/**
 * Always-visible app version. Fixed bottom-left on every page.
 * Click opens release notes for the current version (from CHANGELOG.md via API).
 */
export function AppVersionBadge({ className, fixed = true }: AppVersionBadgeProps) {
  const { isAuthenticated } = useAuth();
  const label = getAppVersionLabel();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [release, setRelease] = useState<ChangelogRelease | null>(null);
  const [apiVersion, setApiVersion] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchChangelog({ current: true });
      setApiVersion(data.appVersion);
      setRelease(data.releases[0] ?? null);
    } catch {
      setError(true);
      setRelease(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && release === null && !loading && !error) {
      void load();
    }
  }, [open, release, loading, error, load]);

  const classes = cn(
    "text-[10px] font-mono tabular-nums tracking-tight select-none",
    "text-muted-foreground/70 hover:text-muted-foreground transition-colors",
    "cursor-pointer",
    fixed &&
      "fixed bottom-2 left-2 z-[60] rounded-md bg-background/80 backdrop-blur-sm border border-border/60 px-1.5 py-0.5 shadow-sm pointer-events-auto max-lg:bottom-[4.25rem]",
    className
  );

  return (
    <>
      <button
        type="button"
        className={classes}
        title="What's new in this version"
        aria-label={`Application version ${label}. Open release notes.`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>What&apos;s new</DialogTitle>
            <DialogDescription>
              Release notes for {label}
              {apiVersion && apiVersion !== label.replace(/^v/i, "")
                ? ` (API v${apiVersion})`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="py-1">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading changelog…</p>
            )}
            {error && (
              <p className="text-sm text-muted-foreground">
                Could not load changelog. Check that the API is reachable.
              </p>
            )}
            {!loading && !error && release && (
              <ChangelogReleaseView release={release} compact />
            )}
            {!loading && !error && !release && (
              <p className="text-sm text-muted-foreground">
                No notes found for this version yet.
              </p>
            )}
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            {isAuthenticated ? (
              <Button variant="outline" asChild>
                <Link href="/settings/about#changelog" onClick={() => setOpen(false)}>
                  Full changelog
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
