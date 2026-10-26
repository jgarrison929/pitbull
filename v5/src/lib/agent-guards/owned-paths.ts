import { BUILDER_FORBIDDEN_TOUCH } from "./paths";

/**
 * Feature builders must not edit verify-v5 or proxy.ts in the same change set
 * as product work — those files are owned by dedicated slices.
 *
 * Bypass (CI): PR title contains exact `[owned-path-ok]` (case-sensitive),
 * or an exact label element `owned-path-ok` (case-sensitive, no trim).
 * Not the last commit subject — that was too easy to forget on later pushes.
 * Lookalikes (`OWNED-PATH-OK`, `x,owned-path-ok`, leading space) must not bypass.
 * CI passes labels as a JSON array (`toJSON(...labels.*.name)`), never comma-joined.
 */

export const OWNED_PATH_OK_TITLE = /\[owned-path-ok\]/;
export const OWNED_PATH_OK_LABEL = "owned-path-ok";

export function touchesBuilderForbidden(paths: string[]): string[] {
  const norm = paths.map((p) => p.replace(/\\/g, "/"));
  const hits: string[] = [];
  for (const forbidden of BUILDER_FORBIDDEN_TOUCH) {
    const prefix = forbidden.replace(/\\/g, "/");
    for (const p of norm) {
      if (
        p === prefix ||
        p.startsWith(prefix + "/") ||
        (prefix.startsWith("v5/") &&
          (p === prefix.slice(3) || p.startsWith(prefix.slice(3) + "/")))
      ) {
        hits.push(p);
      }
    }
  }
  return [...new Set(hits)];
}

/**
 * Parse OWNED_PATHS_PR_LABELS from CI. Expects a JSON string array.
 * Never comma-splits or trims — a label literally named `x,owned-path-ok`
 * must stay one element and must not grant bypass.
 */
export function parseOwnedPathPrLabels(raw: string | null | undefined): string[] {
  if (raw == null || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is string => typeof x === "string");
}

/** True when bypass is granted via PR title or labels. */
export function ownedPathBypassAllowed(opts: {
  prTitle?: string | null;
  labels?: readonly string[] | null;
}): boolean {
  if (opts.prTitle && OWNED_PATH_OK_TITLE.test(opts.prTitle)) return true;
  // Exact element match only — no toLowerCase, trim, or substring/includes.
  if (opts.labels?.some((l) => l === OWNED_PATH_OK_LABEL)) return true;
  return false;
}

/** True when the change set looks like a feature PR that also touched owned paths. */
export function featurePrTouchesOwnedPaths(paths: string[]): boolean {
  const forbidden = touchesBuilderForbidden(paths);
  if (forbidden.length === 0) return false;
  const product = paths.some((p) => {
    const n = p.replace(/\\/g, "/");
    return (
      n.includes("v5/src/") ||
      n.startsWith("src/") ||
      n.includes("v5/tests/") ||
      n.startsWith("tests/")
    );
  });
  const onlyOwned = paths.every((p) => {
    const n = p.replace(/\\/g, "/");
    return (
      touchesBuilderForbidden([n]).length > 0 ||
      n.endsWith("AGENTS.md") ||
      n.includes("agent-guards")
    );
  });
  return product && !onlyOwned && forbidden.length > 0;
}
