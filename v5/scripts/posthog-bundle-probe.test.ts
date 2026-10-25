import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Next only inlines `process.env.NEXT_PUBLIC_*` when those member expressions
 * appear literally in the client graph. This probe builds with a dummy key and
 * greps the client bundle — it must go red if someone reverts to
 * `resolvePostHogClientConfig(env = process.env)`.
 */
const PROBE_KEY = "phc_buildprobe";
const PROBE_DIST = ".next-posthog-probe";
const v5Root = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(v5Root, PROBE_DIST);
const tsconfigPath = join(v5Root, "tsconfig.json");
const tsconfigBefore = readFileSync(tsconfigPath, "utf8");

afterAll(() => {
  rmSync(distDir, { recursive: true, force: true });
  // `next build` with an alternate distDir rewrites tsconfig include paths.
  writeFileSync(tsconfigPath, tsconfigBefore);
});

function walkJsFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJsFiles(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

describe("PostHog NEXT_PUBLIC_* client bundle inlining", () => {
  it(
    `next build embeds ${PROBE_KEY} in client static JS when the key is set`,
    { timeout: 180_000 },
    () => {
      rmSync(distDir, { recursive: true, force: true });

      const build = spawnSync("npx", ["next", "build"], {
        cwd: v5Root,
        env: {
          ...process.env,
          NEXT_PUBLIC_POSTHOG_KEY: PROBE_KEY,
          NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
          POSTHOG_BUNDLE_PROBE_DIST: PROBE_DIST,
          CI: process.env.CI ?? "true",
        },
        encoding: "utf8",
        timeout: 170_000,
      });
      if (build.status !== 0) {
        throw new Error(
          `posthog bundle probe build failed (status ${build.status}):\n` +
            `${build.stdout ?? ""}\n${build.stderr ?? ""}`,
        );
      }

      const staticDir = join(distDir, "static");
      const jsFiles = walkJsFiles(staticDir);
      expect(jsFiles.length).toBeGreaterThan(0);

      const hits = jsFiles.filter((f) =>
        readFileSync(f, "utf8").includes(PROBE_KEY),
      );
      expect(
        hits,
        `Expected ${PROBE_KEY} in client JS under ${staticDir}. ` +
          "If this fails, NEXT_PUBLIC_POSTHOG_KEY is not being read via a " +
          "literal process.env.NEXT_PUBLIC_POSTHOG_KEY expression.",
      ).not.toHaveLength(0);
    },
  );
});
