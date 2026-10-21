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

/** Version comes from package.json, build time is stamped by next build, commit comes from the deploy environment. */
export function getBuildInfo(
  env: Record<string, string | undefined> = process.env,
): BuildInfo {
  const commit = env.RAILWAY_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? "unknown";
  return {
    version: appVersion(),
    commit: commit === "unknown" ? commit : commit.slice(0, 12),
    // Inlined at build time by next.config.ts.
    buildTime: process.env.BUILD_TIME ?? "unknown",
  };
}
