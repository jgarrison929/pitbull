import { BUILDER_FORBIDDEN_TOUCH } from "./paths";

/**
 * Feature builders must not edit verify-v5 or proxy.ts in the same change set
 * as product work — those files are owned by dedicated slices.
 *
 * Bypass (CI): PR title contains exact `[owned-path-ok]` (case-sensitive),
 * or label `owned-path-ok`. Not the last commit subject — that was too easy
 * to forget on later pushes. Lookalikes like `[OWNED-PATH-OK]` must not bypass.
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

/** True when bypass is granted via PR title or labels. */
export function ownedPathBypassAllowed(opts: {
  prTitle?: string | null;
  labels?: readonly string[] | null;
}): boolean {
  if (opts.prTitle && OWNED_PATH_OK_TITLE.test(opts.prTitle)) return true;
  if (opts.labels?.some((l) => l.toLowerCase() === OWNED_PATH_OK_LABEL))
    return true;
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
