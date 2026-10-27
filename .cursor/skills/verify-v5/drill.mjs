// Cost-item drill-down coverage for the nav crawl (#706: /app/jobs/:number/cost-items/:code).
// The seeded item list is derived from the seed, links are discovered on the seeded job pages the crawl
// already visits, and every seeded item must be found by every role at every width and loaded at
// least once per role. Pure parts are covered by checks.test.mjs; the browser parts by crawl-mustfail.test.mjs.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCrawlRow, PAGE_BUDGET_MS } from "./checks.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Cost-item drill-down path exactly as the app links it (cost-table.tsx CostCodeLabel). */
export function drillPath(job, code) {
  return `/app/jobs/${job}/cost-items/${encodeURIComponent(code)}`;
}

export const DRILL_PATH = /^\/app\/jobs\/[^/]+\/cost-items\/(?!search$)[^/]+$/;

/**
 * Which roles can open cost-item drill-downs. #706 ships them to every role (no role gate in
 * proxy.ts or the page). A role set to false is not skipped: it must see no drill-down links on the
 * job page and the drill-down URL must be refused (see drillAccessFailures).
 */
export const DRILL_ROLE_ACCESS = { executive: true, pm: true, superintendent: true, foreman: true };

/** Leaf codes of an estimate CSV (code,parent_code,…): every code no other row names as its parent. */
export function csvLeafCodes(csv) {
  const rows = String(csv).trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
  const parents = new Set(rows.map((r) => (r[1] ?? "").trim()).filter(Boolean));
  return rows.map((r) => (r[0] ?? "").trim()).filter((c) => c && !parents.has(c));
}

/**
 * Seeded cost-item leaves per job a fresh sandbox has: seed() leaf rows, then seedActionHistory's typed
 * actions in order (estimate.importCsv replaces a job's leaves with the CSV leaves; a CO's new line
 * codes become leaves only when changeOrder.approve runs). → { [jobNumber]: sorted codes }.
 * @param {{ jobs: {id: string, number: string}[], costItems: {jobId: string, code: string, isLeaf?: boolean}[] }} seedRows
 * @param {{ action: string, input: any }[]} runs
 */
export function seedDrillItems(seedRows, runs = []) {
  const numberById = new Map(seedRows.jobs.map((j) => [j.id, j.number]));
  const leaves = new Map(seedRows.jobs.map((j) => [j.number, new Set()]));
  for (const c of seedRows.costItems) {
    if (c.isLeaf === false) continue; // schema default is true
    leaves.get(numberById.get(c.jobId))?.add(c.code);
  }
  const priced = new Map();
  for (const { action, input } of runs) {
    const job = input?.job;
    if (action === "estimate.importCsv" && leaves.has(job)) leaves.set(job, new Set(csvLeafCodes(input.csv)));
    if (action === "changeOrder.price") priced.set(`${job}/${input.changeOrder}`, (input.coLines ?? []).map((l) => l.code));
    if (action === "changeOrder.approve") for (const code of priced.get(`${job}/${input.changeOrder}`) ?? []) leaves.get(job)?.add(code);
  }
  return Object.fromEntries([...leaves].map(([job, codes]) => [job, [...codes].sort()]));
}

export function drillItemCount(seedItems) {
  return Object.values(seedItems).reduce((n, codes) => n + codes.length, 0);
}

/** Every seeded item as { job, code, path }, in a stable order (job, then code). */
export function drillItemList(seedItems) {
  return Object.keys(seedItems)
    .sort()
    .flatMap((job) => seedItems[job].map((code) => ({ job, code, path: drillPath(job, code) })));
}

/**
 * Which drill-downs each role×width loads. Sampled so runtime stays sane, but complete: item i goes to
 * width (i + roleIndex) % widths for every role, so each role loads every seeded item exactly once,
 * every width gets ~1/4 of the items per role, and across the 4 roles each item is loaded at every width.
 * → Map "role@width" → items.
 */
export function drillLoadPlan(seedItems, { roles, widths }) {
  const items = drillItemList(seedItems);
  const plan = new Map();
  roles.forEach((role, ri) => {
    widths.forEach((w) => plan.set(`${role}@${w}`, []));
    items.forEach((it, i) => plan.get(`${role}@${widths[(i + ri) % widths.length]}`).push(it));
  });
  return plan;
}

export function expectedDrillLoads(seedItems, roles) {
  return roles.length * drillItemCount(seedItems);
}

/** Collect the cost-item links a user can see in the job page's cost tree, scrolling the virtualized list. */
export async function discoverDrillLinks(page) {
  return page.evaluate(async () => {
    const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));
    const boxes = [...document.querySelectorAll('[data-testid="cost-tree-scroll"], [data-testid="cost-tree-scroll-mobile"]')].filter(
      (el) => el.getClientRects().length > 0 && el.clientHeight > 0,
    );
    const found = new Set();
    const collect = (box) => {
      for (const a of box.querySelectorAll('a[data-testid^="cost-code-link-"]')) {
        if (a.getClientRects().length > 0) found.add(a.getAttribute("href"));
      }
    };
    for (const box of boxes) {
      box.scrollTop = 0;
      await tick();
      collect(box);
      for (let guard = 0; guard < 2000 && box.scrollTop + box.clientHeight < box.scrollHeight - 1; guard++) {
        const before = box.scrollTop;
        box.scrollTop = before + Math.max(20, Math.floor(box.clientHeight / 2));
        await tick();
        collect(box);
        if (box.scrollTop === before) break;
      }
      box.scrollTop = 0;
    }
    const visibleHrefs = (sel) => [...document.querySelectorAll(sel)].filter((a) => a.getClientRects().length > 0).map((a) => a.getAttribute("href"));
    return {
      containers: boxes.length,
      hrefs: [...found],
      estimateStatus: document.querySelector('[data-testid="estimate-status"]')?.getAttribute("data-status") ?? null,
      planCardHrefs: visibleHrefs('a[data-testid="plan-detail-link"]'),
    };
  });
}

// ---- 5.0.2 Part C crawl check 4 (docs/v5/specs/5.0.2-crew-rates-and-field-history.md) ----
// "verify-v5 crawl adds one cost item page and one plan page per active job for all 4 roles and 4 viewports.
//  Every load 200, 0 banned strings, under 1.5 s."

export const PART_C_CHECK_4 = "Part C crawl check 4";
export const PLAN_PATH = /^\/app\/jobs\/[^/]+\/plans\/[^/]+$/;

/** Plan-page links a user can see on a loaded cost-item page (labor rows link to their plan). */
export async function costItemPlanLinks(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('a[data-testid="cost-entry-plan-link"]')].filter((a) => a.getClientRects().length > 0).map((a) => a.getAttribute("href")),
  );
}

/**
 * The cost item check 4 loads for role index ri × width index wi on an active job: one of the job's seeded
 * items whose labor links to a plan, rotated so different role×widths open different items.
 */
export function partCItemFor(planLinked, job, ri, wi, nWidths) {
  const codes = planLinked[job] ?? [];
  return codes.length ? codes[(ri * nWidths + wi) % codes.length] : null;
}

/**
 * Check 4 → failure strings. records: [{ role, width, job, costItemPath, planPath, planSource }] from crawl();
 * discovery: the drill discovery records (estimateStatus per job page). Hard check: the active jobs the job
 * pages show (estimate approved) must equal the seed's; every role × width × active job needs a cost item
 * row and a plan row (an unreachable one fails), and each passes every per-load crawl check (200, no
 * banned string, ≤ budget, …).
 */
export function partCFailures(rows, records, discovery, seedActive, { roles, widths, budgetMs = PAGE_BUDGET_MS }) {
  const f = [];
  const tag = (m) => `${PART_C_CHECK_4}: ${m}`;
  const want = [...seedActive].sort();
  for (const role of roles) {
    for (const width of widths) {
      const shown = discovery.filter((d) => d.role === role && d.width === width && d.estimateStatus === "approved").map((d) => d.job).sort();
      if (JSON.stringify(shown) !== JSON.stringify(want)) f.push(tag(`${role}@${width} active jobs on the job pages [${shown.join(", ")}] ≠ seed [${want.join(", ")}]`));
      for (const job of want) {
        const where = `${role}@${width} ${job}`;
        const rec = records.find((r) => r.role === role && r.width === width && r.job === job);
        for (const kind of ["cost-item", "plan"]) {
          const p = kind === "cost-item" ? rec?.costItemPath : rec?.planPath;
          const row = p && rows.find((r) => r.role === role && r.width === width && r.partC === kind && r.path === p);
          if (!row) {
            f.push(tag(`${where} has no reachable ${kind === "cost-item" ? "cost item" : "plan"} page${rec?.why?.[kind] ? ` (${rec.why[kind]})` : ""}`));
            continue;
          }
          for (const x of evaluateCrawlRow(row, { budgetMs })) f.push(tag(x));
        }
      }
    }
  }
  return f;
}

/**
 * Discovery vs seed → failure strings. records: [{ role, width, job, hrefs }]. A role with access must
 * find exactly the seeded items on every seeded job page at every width (fewer, extra, or a missing
 * record fails); a role without access must find none.
 */
export function drillDiscoveryFailures(records, seedItems, { roles, widths, access = DRILL_ROLE_ACCESS }) {
  const f = [];
  for (const role of roles) {
    for (const width of widths) {
      for (const job of Object.keys(seedItems)) {
        const where = `${role}@${width} /app/jobs/${job}`;
        const rec = records.find((r) => r.role === role && r.width === width && r.job === job);
        if (!rec) {
          f.push(`${where}: drill-down discovery did not run`);
          continue;
        }
        const want = new Set(seedItems[job].map((c) => drillPath(job, c)));
        const got = new Set(rec.hrefs);
        if (access[role] === false) {
          if (got.size > 0) f.push(`${where}: role without drill-down access sees ${got.size} cost-item links`);
          continue;
        }
        const missing = [...want].filter((h) => !got.has(h));
        const extra = [...got].filter((h) => !want.has(h));
        if (missing.length || extra.length) {
          f.push(
            `${where}: found ${[...got].filter((h) => want.has(h)).length} of ${want.size} seeded cost-item drill-downs` +
              (missing.length ? `; missing ${missing.map((h) => h.split("/").pop()).join(", ")}` : "") +
              (extra.length ? `; unexpected ${extra.join(", ")}` : ""),
          );
        }
      }
    }
  }
  return f;
}

/**
 * The only parent env vars the seed subprocess (tsx) gets. Everything else (VERIFY_TOKEN, DATABASE_URL,
 * GH/GitHub tokens, NODE_OPTIONS, V5_SEED_STRESS, …) stays out: the seed is pure and needs no secret.
 */
export const SEED_CHILD_ENV_ALLOW = Object.freeze(["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "TZ", "SystemRoot", "WINDIR"]);

/** Minimal env for a seed subprocess: only SEED_CHILD_ENV_ALLOW keys present in `parent`. */
export function seedChildEnv(parent = process.env) {
  return Object.fromEntries(SEED_CHILD_ENV_ALLOW.filter((k) => typeof parent[k] === "string").map((k) => [k, parent[k]]));
}

/** Parent env keys that reached the child but are not allowlisted (keys the child runtime adds itself are ignored). */
export function leakedSeedEnvKeys(childKeys, parent = process.env) {
  return childKeys.filter((k) => Object.hasOwn(parent, k) && !SEED_CHILD_ENV_ALLOW.includes(k)).sort();
}

/**
 * Drill-down loads → failure strings: each crawled drill row passes evaluateCrawlRow, every role with
 * access loaded every seeded item at least once, and a role without access was refused (no 200 page
 * with the cost-item tiles).
 */
export function drillCoverageFailures(rows, seedItems, { roles, access = DRILL_ROLE_ACCESS, budgetMs = PAGE_BUDGET_MS }) {
  const f = [];
  // Only rows the drill-down crawl loaded (`drill: true`) count: a Part C cost-item row has the same
  // path shape but must not stand in for a role's drill-down load of that item.
  const drillRows = rows.filter((r) => r.drill === true && DRILL_PATH.test(r.path));
  for (const role of roles) {
    for (const it of drillItemList(seedItems)) {
      const mine = drillRows.filter((r) => r.role === role && r.path === it.path);
      if (mine.length === 0) {
        f.push(`${role} ${it.path}: seeded cost item never loaded`);
        continue;
      }
      if (access[role] === false) {
        for (const r of mine) {
          // S1: a load that threw proves no refusal.
          if (r.loadFailed) { f.push(`${role}@${r.width} ${it.path}: ${r.error ?? "load failed"} (refusal not proven)`); continue; }
          if (r.status === 200 && (r.seededCounts?.costItemTiles ?? 0) > 0) f.push(`${role}@${r.width} ${it.path}: role without drill-down access was shown the cost item`);
        }
      }
    }
  }
  for (const r of drillRows) if (access[r.role] !== false) f.push(...evaluateCrawlRow(r, { budgetMs }));
  return f;
}

/**
 * Seeded drill-down items from the repo's seed: seed() rows plus seedActionHistory's recorded actions
 * (run through tsx with seed-stub/preload.cjs, no database). Also checks the recorder saw
 * SEED_HISTORY_RUNS actions so a silently skipped history cannot shrink the list.
 */
export function loadSeedDrillItems(repo) {
  return loadSeedCrawlTargets(repo).items;
}

/**
 * Seed-derived crawl targets: `items` (seedDrillItems), `active` (jobs whose estimate is approved — the
 * spec's active jobs) and `planLinked` (per active job, seeded items with labor posted from a plan line, so
 * the cost item page links a plan page).
 */
export function loadSeedCrawlTargets(repo, { parentEnv = process.env, childEnv = seedChildEnv(parentEnv) } = {}) {
  const v5 = path.join(repo, "v5");
  const script = `(async () => {
    // tsx may load these as CommonJS; named exports then sit on .default.
    const named = (m, key) => (m[key] ? m : m.default);
    const { seed } = named(await import(${JSON.stringify(path.join(v5, "src", "seed", "index.ts"))}), "seed");
    const history = named(await import(${JSON.stringify(path.join(v5, "src", "seed", "history.ts"))}), "seedActionHistory");
    const companyId = "00000000-0000-4000-8000-000000000099";
    const now = new Date("2026-10-19T00:00:00Z");
    const rows = seed(companyId, now);
    globalThis.__seedRuns = [];
    await history.seedActionHistory(companyId, now);
    process.stdout.write(JSON.stringify({
      jobs: rows.jobs.map((j) => ({ id: j.id, number: j.number, estimateStatus: j.estimateStatus })),
      planLinked: (() => {
        const lines = new Set(rows.dailyPlanLines.map((l) => l.id));
        const byId = new Map(rows.costItems.map((c) => [c.id, c]));
        const num = new Map(rows.jobs.map((j) => [j.id, j.number]));
        const out = {};
        for (const e of rows.costEntries) {
          if (!e.sourcePlanLineId || !lines.has(e.sourcePlanLineId)) continue;
          const c = byId.get(e.costItemId);
          (out[num.get(c.jobId)] ??= new Set()).add(c.code);
        }
        return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
      })(),
      costItems: rows.costItems.map((c) => ({ jobId: c.jobId, code: c.code, isLeaf: c.isLeaf })),
      runs: globalThis.__seedRuns.map((r) => ({ action: r.action, input: r.input })),
      expectedRuns: history.SEED_HISTORY_RUNS,
      envKeys: Object.keys(process.env),
    }));
  })().catch((e) => { console.error(e); process.exit(1); });`;
  const out = execFileSync(path.join(v5, "node_modules", ".bin", "tsx"), ["--require", path.join(here, "seed-stub", "preload.cjs"), "-e", script], {
    encoding: "utf8",
    cwd: v5,
    env: childEnv,
  });
  const raw = JSON.parse(out.trim());
  // The child reports its own env keys; any non-allowlisted parent var (VERIFY_TOKEN, DATABASE_URL, …) is a hard error.
  const leaked = leakedSeedEnvKeys(raw.envKeys ?? [], parentEnv);
  if (!Array.isArray(raw.envKeys) || leaked.length) throw new Error(`seed subprocess env leaked parent vars: ${Array.isArray(raw.envKeys) ? leaked.join(", ") : "child did not report its env"}`);
  if (raw.runs.length !== raw.expectedRuns) throw new Error(`seed history recorded ${raw.runs.length} actions, SEED_HISTORY_RUNS is ${raw.expectedRuns}`);
  const items = seedDrillItems(raw, raw.runs);
  if (drillItemCount(items) === 0) throw new Error("seed has no cost-item leaves");
  const active = raw.jobs.filter((j) => j.estimateStatus === "approved").map((j) => j.number).sort();
  if (active.length === 0) throw new Error("seed has no active (estimate approved) jobs");
  const planLinked = Object.fromEntries(active.map((j) => [j, (raw.planLinked[j] ?? []).filter((c) => items[j]?.includes(c))]));
  return { items, active, planLinked, childEnvKeys: [...raw.envKeys].sort() };
}
