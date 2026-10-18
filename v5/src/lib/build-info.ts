import pkg from "../../package.json";

export type BuildInfo = {
  version: string;
  commit: string;
  buildTime: string;
};

/** Version comes from package.json, build time is stamped by next build, commit comes from the deploy environment. */
export function getBuildInfo(env: Record<string, string | undefined> = process.env): BuildInfo {
  const commit = env.RAILWAY_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? "unknown";
  return {
    version: pkg.version,
    commit: commit === "unknown" ? commit : commit.slice(0, 12),
    // Inlined at build time by next.config.ts.
    buildTime: process.env.BUILD_TIME ?? "unknown",
  };
}
