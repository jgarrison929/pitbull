import { API_BASE_URL } from "@/lib/config";

export type ChangelogRelease = {
  version: string;
  date: string | null;
  added: string[];
  changed: string[];
  fixed: string[];
  security: string[];
  removed: string[];
  deprecated: string[];
};

export type ChangelogResponse = {
  appVersion: string | null;
  sourcePath: string | null;
  releases: ChangelogRelease[];
  /** Total matching releases before offset/limit (for progressive load). */
  totalCount: number;
  offset: number;
  limit: number | null;
};

/** Default page size for in-app changelog history. */
export const CHANGELOG_PAGE_SIZE = 12;

/** ASP.NET serializes record props as camelCase by default. */
function normalizeRelease(raw: Record<string, unknown>): ChangelogRelease {
  const list = (key: string) => {
    const v = raw[key] ?? raw[key.charAt(0).toUpperCase() + key.slice(1)];
    return Array.isArray(v) ? (v as string[]) : [];
  };
  return {
    version: String(raw.version ?? raw.Version ?? ""),
    date: (raw.date ?? raw.Date ?? null) as string | null,
    added: list("added"),
    changed: list("changed"),
    fixed: list("fixed"),
    security: list("security"),
    removed: list("removed"),
    deprecated: list("deprecated"),
  };
}

function num(raw: unknown, fallback = 0): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export async function fetchChangelog(params?: {
  current?: boolean;
  version?: string;
  limit?: number;
  offset?: number;
  excludeUnreleased?: boolean;
}): Promise<ChangelogResponse> {
  const qs = new URLSearchParams();
  if (params?.current) qs.set("current", "true");
  if (params?.version) qs.set("version", params.version);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null && params.offset > 0) qs.set("offset", String(params.offset));
  if (params?.excludeUnreleased) qs.set("excludeUnreleased", "true");

  const url = `${API_BASE_URL}/api/changelog${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Changelog request failed (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const releasesRaw = (data.releases ?? data.Releases ?? []) as Record<string, unknown>[];
  const releases = releasesRaw.map(normalizeRelease);
  const totalCount = num(data.totalCount ?? data.TotalCount, releases.length);
  const offset = num(data.offset ?? data.Offset, params?.offset ?? 0);
  const limitRaw = data.limit ?? data.Limit;
  const limit =
    limitRaw == null
      ? (params?.limit ?? null)
      : num(limitRaw, params?.limit ?? 0) || null;

  return {
    appVersion: (data.appVersion ?? data.AppVersion ?? null) as string | null,
    sourcePath: (data.sourcePath ?? data.SourcePath ?? null) as string | null,
    releases,
    totalCount,
    offset,
    limit,
  };
}

/** Whether another page exists after this response. */
export function changelogHasMore(res: ChangelogResponse): boolean {
  return res.offset + res.releases.length < res.totalCount;
}

export function releaseHasNotes(r: ChangelogRelease): boolean {
  return (
    r.added.length +
      r.changed.length +
      r.fixed.length +
      r.security.length +
      r.removed.length +
      r.deprecated.length >
    0
  );
}

/**
 * Formats a changelog published stamp for display.
 * Date-only → locale date; ISO datetime → locale date + time (+ short timezone).
 */
export function formatReleasePublished(date: string | null | undefined): string | null {
  if (!date || !date.trim()) return null;
  const raw = date.trim();

  // Keep a Changelog date-only (no time component to invent)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
