import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  featurePrTouchesOwnedPaths,
  ownedPathBypassAllowed,
  parseOwnedPathPrLabels,
  touchesBuilderForbidden,
} from "./owned-paths";

const checkOwnedPathsScriptPath = join(
  import.meta.dirname,
  "../../../scripts/check-owned-paths.mjs",
);
const checkOwnedPathsScript = readFileSync(checkOwnedPathsScriptPath, "utf8");

/** Run check-owned-paths.mjs; stdout distinguishes label skip vs path ok. */
function runOwnedPathsCheck(env: Record<string, string>) {
  return spawnSync(process.execPath, [checkOwnedPathsScriptPath], {
    encoding: "utf8",
    env: { ...process.env, CI: "1", ...env },
  });
}

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "owned-paths-test",
      GIT_AUTHOR_EMAIL: "owned-paths-test@example.com",
      GIT_COMMITTER_NAME: "owned-paths-test",
      GIT_COMMITTER_EMAIL: "owned-paths-test@example.com",
    },
  });
  if (r.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${r.stderr || r.stdout || r.status}`,
    );
  }
  return (r.stdout ?? "").trim();
}

describe("owned paths — verify-v5 / proxy.ts", () => {
  it("must-fail: feature PR that also edits verify-v5", () => {
    const paths = [
      "v5/src/server/cost-item-page.ts",
      ".cursor/skills/verify-v5/verify.mjs",
    ];
    expect(touchesBuilderForbidden(paths).length).toBeGreaterThan(0);
    expect(featurePrTouchesOwnedPaths(paths)).toBe(true);
  });

  it("must-fail: feature PR that also edits src/proxy.ts", () => {
    const paths = [
      "v5/src/components/app/page.tsx",
      "v5/src/proxy.ts",
    ];
    expect(featurePrTouchesOwnedPaths(paths)).toBe(true);
  });

  it("allows a verify-v5-only change set", () => {
    const paths = [
      ".cursor/skills/verify-v5/verify.mjs",
      ".cursor/skills/verify-v5/checks.mjs",
    ];
    expect(featurePrTouchesOwnedPaths(paths)).toBe(false);
  });

  it("allows product work that leaves owned paths alone", () => {
    const paths = [
      "v5/src/server/cost-item-page.ts",
      "v5/src/lib/agent-guards/paths.ts",
    ];
    expect(featurePrTouchesOwnedPaths(paths)).toBe(false);
  });

  it("bypass is PR title or label — not commit subject", () => {
    expect(
      ownedPathBypassAllowed({ prTitle: "[owned-path-ok] sync verify skill" }),
    ).toBe(true);
    expect(
      ownedPathBypassAllowed({ labels: ["owned-path-ok", "ready"] }),
    ).toBe(true);
    expect(ownedPathBypassAllowed({ prTitle: "feat: sync verify" })).toBe(
      false,
    );
    // Commit subjects must not grant bypass.
    expect(
      ownedPathBypassAllowed({
        prTitle: "feat: sync",
        labels: [],
      }),
    ).toBe(false);
  });

  it("must-fail: lookalike title marker does not bypass (case-sensitive)", () => {
    expect(
      ownedPathBypassAllowed({ prTitle: "[OWNED-PATH-OK] sync verify skill" }),
    ).toBe(false);
    expect(
      ownedPathBypassAllowed({ prTitle: "[Owned-Path-Ok] sync verify skill" }),
    ).toBe(false);
    // CI script must stay case-sensitive (no /i on the title marker).
    expect(checkOwnedPathsScript).toMatch(/\/\\\[owned-path-ok\\\]\/\.test/);
    expect(checkOwnedPathsScript).not.toMatch(
      /\/\\\[owned-path-ok\\\]\/i\.test/,
    );
  });

  it("must-fail: lookalike labels do not bypass (exact element match)", () => {
    // Case variants (Verify e6/y1, e7/y2, y3, y17).
    expect(ownedPathBypassAllowed({ labels: ["OWNED-PATH-OK"] })).toBe(false);
    expect(ownedPathBypassAllowed({ labels: ["Owned-Path-Ok"] })).toBe(false);
    expect(ownedPathBypassAllowed({ labels: ["owned-path-OK"] })).toBe(false);
    expect(
      ownedPathBypassAllowed({ labels: ["ready", "OWNED-PATH-OK"] }),
    ).toBe(false);
    // Comma inside a single label name (Verify e14/y4, y5) — not split.
    expect(ownedPathBypassAllowed({ labels: ["x,owned-path-ok"] })).toBe(
      false,
    );
    expect(ownedPathBypassAllowed({ labels: ["owned-path-ok,x"] })).toBe(
      false,
    );
    // Leading / trailing space (Verify y6, y7) — no trim.
    expect(ownedPathBypassAllowed({ labels: [" owned-path-ok"] })).toBe(false);
    expect(ownedPathBypassAllowed({ labels: ["owned-path-ok "] })).toBe(false);
    // Exact still works.
    expect(ownedPathBypassAllowed({ labels: ["owned-path-ok"] })).toBe(true);
    expect(
      ownedPathBypassAllowed({ labels: ["ready", "owned-path-ok"] }),
    ).toBe(true);
  });

  it("must-fail: M22 — label match is === not .includes (substring)", () => {
    // Mutant M22: `l.includes(OWNED_PATH_OK_LABEL)` stays GREEN without these.
    expect(ownedPathBypassAllowed({ labels: ["not-owned-path-ok"] })).toBe(
      false,
    );
    expect(ownedPathBypassAllowed({ labels: ["pre-owned-path-ok"] })).toBe(
      false,
    );
    expect(ownedPathBypassAllowed({ labels: ["owned-path-ok-pending"] })).toBe(
      false,
    );
    expect(ownedPathBypassAllowed({ labels: ["owned-path-okay"] })).toBe(
      false,
    );
    // Source contract: exact ===, not .includes on the label string.
    expect(checkOwnedPathsScript).toMatch(/l === "owned-path-ok"/);
    expect(checkOwnedPathsScript).not.toMatch(
      /labelsRaw\.includes\(["']owned-path-ok["']\)/,
    );
  });

  it("parses OWNED_PATHS_PR_LABELS as JSON array — never comma-splits", () => {
    expect(parseOwnedPathPrLabels('["owned-path-ok","ready"]')).toEqual([
      "owned-path-ok",
      "ready",
    ]);
    // Single label whose name contains a comma stays one element.
    expect(parseOwnedPathPrLabels('["x,owned-path-ok"]')).toEqual([
      "x,owned-path-ok",
    ]);
    expect(parseOwnedPathPrLabels('[" owned-path-ok"]')).toEqual([
      " owned-path-ok",
    ]);
    // Comma-joined legacy form is not JSON → no labels (no ambiguous split).
    expect(parseOwnedPathPrLabels("owned-path-ok,ready")).toEqual([]);
    expect(parseOwnedPathPrLabels("")).toEqual([]);
    expect(parseOwnedPathPrLabels(null)).toEqual([]);
  });

  it("must-fail: M23 — script rejects lookalikes / substrings (no string includes)", () => {
    const noSkip = (labelsJson: string) => {
      const r = runOwnedPathsCheck({
        OWNED_PATHS_PR_TITLE: "feat: product change",
        OWNED_PATHS_PR_LABELS: labelsJson,
        // No base → outside product fail path; we only care about label skip.
        OWNED_PATHS_BASE_SHA: "",
        OWNED_PATHS_BASE: "origin/main",
      });
      const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
      expect(out).not.toMatch(/skipped \(label owned-path-ok\)/);
    };

    noSkip('["OWNED-PATH-OK"]');
    noSkip('["Owned-Path-Ok"]');
    noSkip('["owned-path-OK"]');
    noSkip('["ready","OWNED-PATH-OK"]');
    noSkip('["x,owned-path-ok"]');
    noSkip('["owned-path-ok,x"]');
    noSkip('[" owned-path-ok"]');
    noSkip('["owned-path-ok "]');
    // Substring mutant (M23: labelsRaw.includes) would wrongly skip these.
    noSkip('["not-owned-path-ok"]');
    noSkip('["pre-owned-path-ok"]');
    noSkip('["owned-path-ok-pending"]');

    const ok = runOwnedPathsCheck({
      OWNED_PATHS_PR_TITLE: "feat: product change",
      OWNED_PATHS_PR_LABELS: '["owned-path-ok"]',
    });
    expect(`${ok.stdout ?? ""}`).toMatch(/skipped \(label owned-path-ok\)/);
    expect(ok.status).toBe(0);

    // Script must parse JSON — no split/trim/toLowerCase on the labels env.
    expect(checkOwnedPathsScript).toMatch(/JSON\.parse/);
    expect(checkOwnedPathsScript).not.toMatch(
      /OWNED_PATHS_PR_LABELS[\s\S]{0,200}\.split\(["'],["']\)/,
    );
    expect(checkOwnedPathsScript).not.toMatch(
      /labelsRaw[\s\S]{0,80}\.toLowerCase\(/,
    );
    expect(checkOwnedPathsScript).not.toMatch(
      /\.map\(\(s\)\s*=>\s*s\.trim\(\)\.toLowerCase\(\)\)/,
    );
  });

  it("G3 must-fail: CI=1 + undiffable base SHA exits nonzero (fail closed)", () => {
    // Mutant G3: `if (inCi)` → `if (false)` warn-skips and stays GREEN without this.
    const r = runOwnedPathsCheck({
      CI: "1",
      GITHUB_ACTIONS: "1",
      OWNED_PATHS_PR_TITLE: "feat: product change",
      OWNED_PATHS_PR_LABELS: "[]",
      // Valid-looking SHA that is not in this repo and cannot be fetched.
      OWNED_PATHS_BASE_SHA: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    expect(r.status, out).not.toBe(0);
    expect(out).toMatch(/fail closed/i);
    expect(out).toMatch(/cannot diff/i);
  });

  it("G5 must-fail: feature file + v5/src/proxy.ts → script exits 1", () => {
    // Mutant G5: drop `v5/src/proxy.ts` from script forbiddenPrefixes → survives
    // without a script-level change-set test (TS helper uses paths.ts separately).
    expect(checkOwnedPathsScript).toMatch(
      /forbiddenPrefixes\s*=\s*\[[^\]]*["']v5\/src\/proxy\.ts["']/,
    );

    const root = mkdtempSync(join(tmpdir(), "owned-paths-g5-"));
    try {
      git(root, ["init"]);
      git(root, ["checkout", "-b", "main"]);

      mkdirSync(join(root, "v5", "scripts"), { recursive: true });
      writeFileSync(
        join(root, "v5", "scripts", "check-owned-paths.mjs"),
        checkOwnedPathsScript,
      );
      writeFileSync(join(root, "README.md"), "base\n");
      git(root, ["add", "."]);
      git(root, ["commit", "-m", "base"]);
      const baseSha = git(root, ["rev-parse", "HEAD"]);

      mkdirSync(join(root, "v5", "src", "server"), { recursive: true });
      writeFileSync(join(root, "v5", "src", "server", "a.ts"), "export {};\n");
      writeFileSync(join(root, "v5", "src", "proxy.ts"), "export {};\n");
      git(root, ["add", "."]);
      git(root, ["commit", "-m", "feature + proxy"]);

      const scriptInScratch = join(
        root,
        "v5",
        "scripts",
        "check-owned-paths.mjs",
      );
      const r = spawnSync(process.execPath, [scriptInScratch], {
        encoding: "utf8",
        env: {
          ...process.env,
          CI: "1",
          GITHUB_ACTIONS: "1",
          OWNED_PATHS_PR_TITLE: "feat: product change",
          OWNED_PATHS_PR_LABELS: "[]",
          OWNED_PATHS_BASE_SHA: baseSha,
        },
      });
      const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
      expect(r.status, out).toBe(1);
      expect(out).toMatch(/feature PR also touches owned paths/);
      expect(out).toMatch(/v5\/src\/proxy\.ts/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
