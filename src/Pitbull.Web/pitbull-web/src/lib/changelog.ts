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
};

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

export async function fetchChangelog(params?: {
  current?: boolean;
  version?: string;
  limit?: number;
}): Promise<ChangelogResponse> {
  const qs = new URLSearchParams();
  if (params?.current) qs.set("current", "true");
  if (params?.version) qs.set("version", params.version);
  if (params?.limit != null) qs.set("limit", String(params.limit));

  const url = `${API_BASE_URL}/api/changelog${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Changelog request failed (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const releasesRaw = (data.releases ?? data.Releases ?? []) as Record<string, unknown>[];
  return {
    appVersion: (data.appVersion ?? data.AppVersion ?? null) as string | null,
    sourcePath: (data.sourcePath ?? data.SourcePath ?? null) as string | null,
    releases: releasesRaw.map(normalizeRelease),
  };
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
