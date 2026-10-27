import pkg from "../../package.json";
import { changelog } from "@/content/changelog";

export type BuildInfo = {
  version: string;
  commit: string;
  buildTime: string;
};

/** Release version: package.json, which must match the newest changelog entry. */
export function appVersion(): string {
  return pkg.version;
}

/** Newest changelog version — used to keep package.json honest in tests. */
export function changelogVersion(): string {
  return changelog[0]?.version ?? pkg.version;
}

/**
 * Visible /status commit. A hex sha of 7 or more characters shows its first
 * 12; anything else (including "unknown") is left whole. The sr-only line
 * and the title keep the full value.
 */
export function shortCommitSha(commit: string): string {
  return /^[0-9a-f]{7,}$/i.test(commit) ? commit.slice(0, 12) : commit;
}

/** Version comes from package.json, build time is stamped by next build, commit comes from the deploy environment. */
export function getBuildInfo(
  env: Record<string, string | undefined> = process.env,
): BuildInfo {
  // Full SHA when the deploy env provides it (Railway / CI). Do not truncate —
  // verify-v5 and operators need the 40-char commit without a git lookup.
  const commit = env.RAILWAY_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? "unknown";
  return {
    version: appVersion(),
    commit,
    // Inlined at build time by next.config.ts.
    buildTime: process.env.BUILD_TIME ?? "unknown",
  };
}
