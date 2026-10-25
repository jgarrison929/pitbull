"use client";

import { Badge } from "@/components/ui/badge";
import type { ChangelogRelease } from "@/lib/changelog";
import { formatReleasePublished, releaseHasNotes } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const SECTION_ORDER: { key: keyof ChangelogRelease; label: string }[] = [
  { key: "added", label: "Added" },
  { key: "changed", label: "Changed" },
  { key: "fixed", label: "Fixed" },
  { key: "security", label: "Security" },
  { key: "deprecated", label: "Deprecated" },
  { key: "removed", label: "Removed" },
];

function stripMdBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

export function ChangelogReleaseView({
  release,
  compact = false,
  className,
}: {
  release: ChangelogRelease;
  compact?: boolean;
  className?: string;
}) {
  if (!releaseHasNotes(release) && release.version.toLowerCase() !== "unreleased") {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No notes for v{release.version}.
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          {release.version.toLowerCase() === "unreleased"
            ? "Unreleased"
            : `v${release.version}`}
        </Badge>
        {formatReleasePublished(release.date) && (
          <time
            dateTime={release.date ?? undefined}
            className="text-xs text-muted-foreground tabular-nums"
            title={release.date ?? undefined}
          >
            {formatReleasePublished(release.date)}
          </time>
        )}
      </div>

      {SECTION_ORDER.map(({ key, label }) => {
        const items = release[key];
        if (!Array.isArray(items) || items.length === 0) return null;
        const shown = compact ? items.slice(0, 6) : items;
        const more = compact && items.length > shown.length ? items.length - shown.length : 0;

        return (
          <div key={key} className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/90">
              {shown.map((item, i) => (
                <li key={`${key}-${i}`} className="leading-snug">
                  {stripMdBold(item)}
                </li>
              ))}
            </ul>
            {more > 0 && (
              <p className="text-xs text-muted-foreground pl-4">+{more} more…</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChangelogList({
  releases,
  compact = false,
}: {
  releases: ChangelogRelease[];
  compact?: boolean;
}) {
  if (releases.length === 0) {
    return <p className="text-sm text-muted-foreground">No changelog entries available.</p>;
  }

  return (
    <div className="space-y-8">
      {releases.map((r) => (
        <ChangelogReleaseView key={r.version} release={r} compact={compact} />
      ))}
    </div>
  );
}
