#!/usr/bin/env node
/**
 * Capture README screenshots from the live Pitbull v5 demo.
 *
 * Prerequisites (from repo root):
 *   cd v5 && npm ci && npx playwright install chromium
 *   # WebP encode (one of):
 *   #   - cwebp on PATH, or
 *   #   - sharp under scripts/.capture-tools (auto-installed on first run)
 *
 * Usage:
 *   node scripts/capture-readme-screenshots.mjs
 *   node scripts/capture-readme-screenshots.mjs --url https://demo.pcserp.app
 *   node scripts/capture-readme-screenshots.mjs --out docs/images/v5
 *
 * Signs in via the demo role picker (no credentials). Viewport 1440×900, light theme.
 * Writes WebP under ~300 KB each.
 */

import { createRequire } from "node:module";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const requireFromV5 = createRequire(path.join(ROOT, "v5", "package.json"));

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = flag("--url", "https://demo.pcserp.app").replace(/\/$/, "");
const OUT = path.resolve(ROOT, flag("--out", "docs/images/v5"));
const VIEWPORT = { width: 1440, height: 900 };
const MAX_BYTES = 300 * 1024;
const TOOLS = path.join(ROOT, "scripts", ".capture-tools");

const { chromium } = requireFromV5("playwright");

async function loadSharp() {
  const pkg = path.join(TOOLS, "package.json");
  if (!existsSync(path.join(TOOLS, "node_modules", "sharp"))) {
    console.log("Installing sharp into scripts/.capture-tools (gitignored)…");
    mkdirSync(TOOLS, { recursive: true });
    writeFileSync(
      pkg,
      JSON.stringify({ name: "capture-tools", private: true }, null, 2),
    );
    const r = spawnSync(
      "npm",
      ["install", "sharp@^0.33.5", "--no-fund", "--no-audit"],
      { cwd: TOOLS, encoding: "utf8", stdio: "inherit" },
    );
    if (r.status !== 0) throw new Error("npm install sharp failed");
  }
  const req = createRequire(pkg);
  return req("sharp");
}

async function ensureSharpOrCwebp() {
  const hasCwebp = spawnSync("cwebp", ["-version"], { encoding: "utf8" }).status === 0;
  if (hasCwebp) return { kind: "cwebp" };
  const sharp = await loadSharp();
  return { kind: "sharp", sharp };
}

async function signIn(page, role = "pm") {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByTestId(`role-${role}`).click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 30_000 });
  await page.getByTestId("signed-in-as").waitFor({ state: "visible" });
  await settle(page);
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
  const banned = await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const hits = [];
    for (const w of [
      "Something went wrong",
      "Application error",
      "coming soon",
      "TODO",
      "placeholder",
      "not implemented",
    ]) {
      if (new RegExp(String.raw`\b${w}\b`, "i").test(text)) hits.push(w);
    }
    // Toast / error surface heuristics
    const toast = document.querySelector("[data-sonner-toast],[role='alert']");
    if (toast && /error|failed|unable/i.test(toast.textContent ?? "")) {
      hits.push("error toast");
    }
    return hits;
  });
  if (banned.length) {
    throw new Error(`Page shows banned copy: ${banned.join(", ")} @ ${page.url()}`);
  }
}

async function waitReady(page, testId) {
  await page.getByTestId(testId).first().waitFor({ state: "visible", timeout: 30_000 });
  await settle(page);
}

async function expectActionAnswered(run) {
  const name = ((await run.getByTestId("action-name").textContent()) ?? "").trim();
  const summary = ((await run.getByTestId("action-summary").textContent()) ?? "").trim();
  if (!name || !summary) {
    throw new Error(`Assistant run missing name/summary: name=${name}`);
  }
  if (/couldn't|refused|unknown/i.test(summary) && /99-999|no job/i.test(summary)) {
    throw new Error(`Assistant refused unexpectedly: ${summary}`);
  }
}

async function encodeWebp(pngBuffer, outPath, encoder) {
  if (encoder.kind === "cwebp") {
    const tmp = `${outPath}.src.png`;
    await writeFile(tmp, pngBuffer);
    for (const q of [82, 72, 62, 52]) {
      const r = spawnSync("cwebp", ["-q", String(q), "-m", "6", "-mt", tmp, "-o", outPath], {
        encoding: "utf8",
      });
      if (r.status !== 0) continue;
      const buf = await readFile(outPath);
      if (buf.length <= MAX_BYTES) {
        spawnSync("rm", ["-f", tmp]);
        return buf.length;
      }
    }
    spawnSync("rm", ["-f", tmp]);
    throw new Error(`${outPath} could not compress under ${MAX_BYTES} with cwebp`);
  }

  const sharp = encoder.sharp;
  for (const quality of [82, 72, 62, 52]) {
    const buf = await sharp(pngBuffer).webp({ quality, effort: 6 }).toBuffer();
    if (buf.length <= MAX_BYTES) {
      await writeFile(outPath, buf);
      return buf.length;
    }
  }
  // Last resort: slight downscale
  const buf = await sharp(pngBuffer)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 60, effort: 6 })
    .toBuffer();
  await writeFile(outPath, buf);
  if (buf.length > MAX_BYTES) {
    throw new Error(`${outPath} is ${buf.length} bytes (>${MAX_BYTES})`);
  }
  return buf.length;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} name
 * @param {{kind:string, sharp?:unknown}} encoder
 * @param {(page: import('playwright').Page) => Promise<void>} prepare
 * @param {{ target?: import('playwright').Locator }} [opts]
 */
async function shot(page, name, encoder, prepare, opts = {}) {
  if (prepare) await prepare(page);
  await settle(page);
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  const png = opts.target
    ? await opts.target.screenshot({ type: "png", animations: "disabled" })
    : await page.screenshot({
        type: "png",
        fullPage: false,
        animations: "disabled",
      });
  const outPath = path.join(OUT, `${name}.webp`);
  const bytes = await encodeWebp(png, outPath, encoder);
  console.log(`  ${name}.webp  ${(bytes / 1024).toFixed(1)} KB  ← ${page.url()}`);
  return { path: outPath, bytes };
}

async function main() {
  console.log(`Capturing from ${BASE}`);
  console.log(`Output: ${OUT}`);
  await mkdir(OUT, { recursive: true });
  const encoder = await ensureSharpOrCwebp();

  const browser = await chromium.launch({
    headless: true,
    args: ["--font-render-hinting=none"],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    try {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } catch {
      /* ignore */
    }
  });

  await signIn(page, "pm");

  const results = [];

  results.push(
    await shot(page, "portfolio", encoder, async (p) => {
      await p.goto(`${BASE}/app`, { waitUntil: "networkidle" });
      await waitReady(p, "job-link");
    }),
  );

  results.push(
    await shot(page, "job-25-031", encoder, async (p) => {
      await p.goto(`${BASE}/app/jobs/25-031`, { waitUntil: "networkidle" });
      await waitReady(p, "job-earned");
      await waitReady(p, "job-actual");
      await waitReady(p, "job-cpi");
      // Bring cost / EV tiles into the first viewport (plan card sits above them).
      await p.getByTestId("job-earned").first().scrollIntoViewIfNeeded();
      await settle(p);
    }),
  );

  // Cost item: prefer /cost-items/[code] when the deploy has it (5.0.2+);
  // on 5.0.1 production the cost tree on the job page is the drill surface.
  {
    let costTarget = null;
    results.push(
      await shot(
        page,
        "cost-item-04-210",
        encoder,
        async (p) => {
          const res = await p.goto(`${BASE}/app/jobs/25-031/cost-items/04-210`, {
            waitUntil: "networkidle",
          });
          if (res && res.ok() && (await p.getByTestId("cost-item-ev").count()) > 0) {
            await waitReady(p, "cost-item-ev");
            await waitReady(p, "cost-item-ac");
            costTarget = null; // full page
            return;
          }
          await p.goto(`${BASE}/app/jobs/25-031`, { waitUntil: "networkidle" });
          await waitReady(p, "cost-table");
          await p.getByTestId("earned-mh-04-210").first().scrollIntoViewIfNeeded();
          costTarget = p.getByTestId("cost-table").first();
          await costTarget.scrollIntoViewIfNeeded();
          await settle(p);
        },
        { get target() { return costTarget; } },
      ),
    );
  }

  // Daily plan: prefer plan detail page when linked; else element shot of plan card.
  {
    let planTarget = null;
    results.push(
      await shot(
        page,
        "daily-plan",
        encoder,
        async (p) => {
          await p.goto(`${BASE}/app/jobs/25-031`, { waitUntil: "networkidle" });
          await waitReady(p, "plan-card");
          const detail = p.getByTestId("plan-detail-link");
          if ((await detail.count()) > 0) {
            await detail.first().click();
            await p.waitForURL(/\/app\/jobs\/25-031\/plans\//);
            await waitReady(p, "plan-detail-lines");
            planTarget = null;
            return;
          }
          planTarget = p.getByTestId("plan-card").first();
          await planTarget.scrollIntoViewIfNeeded();
          await waitReady(p, "plan-line");
        },
        { get target() { return planTarget; } },
      ),
    );
  }

  results.push(
    await shot(page, "change-order-co-001", encoder, async (p) => {
      await p.goto(`${BASE}/app/jobs/25-031#change-orders`, {
        waitUntil: "networkidle",
      });
      const ledger = p.locator('[data-testid="co-ledger"]').first();
      await ledger.waitFor({ state: "visible", timeout: 30_000 });
      const card = ledger
        .locator('[data-testid="co-card"][data-co-number="1"]')
        .first();
      await card.waitFor({ state: "visible", timeout: 30_000 });
      await card.scrollIntoViewIfNeeded();
      await settle(p);
    }),
  );

  results.push(
    await shot(page, "assistant-rail", encoder, async (p) => {
      await p.goto(`${BASE}/app/jobs/25-031`, { waitUntil: "networkidle" });
      const rail = p.getByTestId("assistant-rail");
      await rail.getByTestId("assistant-input").waitFor({ state: "visible" });
      const before = await rail.getByTestId("action-run").count();
      await rail
        .getByTestId("assistant-input")
        .fill("Why is Cedar Creek over budget?");
      await rail.getByRole("button", { name: "Send" }).click();
      await rail.getByTestId("action-run").nth(before).waitFor({ state: "visible" });
      const run = rail.getByTestId("action-run").last();
      await run.getByTestId("action-name").waitFor({ state: "visible" });
      await run.getByTestId("action-summary").waitFor({ state: "visible" });
      await expectActionAnswered(run);
      await run.scrollIntoViewIfNeeded();
      await settle(p);
    }),
  );

  await browser.close();

  // Sanity: every file exists and is under budget
  for (const r of results) {
    await access(r.path);
    if (r.bytes > MAX_BYTES) throw new Error(`${r.path} over budget`);
  }

  console.log("\nDone:");
  for (const r of results) {
    console.log(`  ${path.relative(ROOT, r.path)} (${(r.bytes / 1024).toFixed(1)} KB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
