// Release-candidate handover, starting at 5.0.4. Pure: git output and /status text come in as
// arguments, so checks.test.mjs can prove a wrong SHA and a wrong PR attribution fail.
// 5.0.2 and 5.0.3 stay on the per-PR flow and are refused here.

/** First version whose green PRs merge to rc/<version> and are verified once, at the rc head. */
export const RC_VERSION = "5.0.4";
/** Versions that keep a verify run per PR. Not an RC handover. */
export const PER_PR_VERSIONS = ["5.0.2", "5.0.3"];

function versionParts(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `version` is a 5.x.y at or after `floor` (default 5.0.4). 5.0.10 is after 5.0.4. */
export function rcVersionAtLeast(version, floor = RC_VERSION) {
  const a = versionParts(version);
  const b = versionParts(floor);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/**
 * Phone layout checks run for an RC handover (5.0.4 or later) or when `--phone-checks` is passed.
 * A per-PR run, including 5.0.2 and 5.0.3, leaves them off.
 */
export function phoneChecksEnabled({ rc, flag } = {}) {
  return flag === true || Boolean(rc);
}

/**
 * The browser run threw before it could finish. /status was not read when `statusRead` is still null,
 * which is the case when the deploy cannot be reached. A later throw, after the commit was scraped, is
 * a different check so the rc handover still names what it had already seen.
 */
export function browserFailureCheck(statusRead, message) {
  const detail = String(message ?? "").split("\n")[0] || "no error message";
  if (statusRead == null) return { name: "/status unreachable", ok: false, detail };
  return { name: "browser run stopped", ok: false, detail };
}

/**
 * --rc <sha> means this run is the handover of rc/<version> (default 5.0.4).
 * Returns { rc: { version, sha, branch } | null, error }.
 * target "production" is refused: production keeps the release-tag rule.
 * 5.0.2 and 5.0.3 are refused even when --rc is omitted.
 * A version at or after 5.0.4 is accepted when a SHA is present.
 */
export function resolveRcMode({ version = RC_VERSION, sha, commit, target } = {}) {
  const v = String(version ?? "").trim();
  if (PER_PR_VERSIONS.includes(v)) return { rc: null, error: `${v} stays on the per-PR flow; RC handover starts at ${RC_VERSION}` };
  if (sha == null || String(sha).trim() === "") return { rc: null, error: null };
  if (!rcVersionAtLeast(v)) return { rc: null, error: `RC flow starts at ${RC_VERSION} (got ${v || "(empty)"})` };
  const s = String(sha).trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(s)) return { rc: null, error: `--rc must be the full 40-char rc head SHA (got length ${s.length})` };
  if (commit != null && String(commit).trim() !== "" && String(commit).trim().toLowerCase() !== s) {
    return { rc: null, error: `--commit disagrees with --rc ${s}` };
  }
  if (target === "production") return { rc: null, error: "RC handover is staging; production keeps the release-tag rule" };
  return { rc: { version: v, sha: s, branch: `rc/${v}` }, error: null };
}

/**
 * Staging /status (or /health) shows the rc head and no other commit.
 * A 12-char prefix passes only when `resolve` maps it to this exact sha (same rule as shaMatches).
 * A different SHA fails. `resolve` may be omitted when `shown` is already 40 chars.
 */
export function evaluateRcHead({ rcSha, shown, resolve }) {
  const sha = String(rcSha ?? "").trim().toLowerCase();
  const got = String(shown ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) return { ok: false, failures: ["rc head is not a full 40-char SHA"], detail: sha || "(empty)" };
  // Inline the full-SHA compare so a test does not need checks.mjs's prefix resolver unless it passes one.
  const s = got.toLowerCase();
  if (/^[0-9a-f]{40}$/.test(s)) {
    const ok = s === sha;
    return ok
      ? { ok: true, failures: [], detail: s }
      : { ok: false, failures: [`staging serves ${s}, rc head is ${sha}`], detail: `${s} ≠ ${sha}` };
  }
  // Prefix: defer to the same matcher verify uses, injected so this file stays free of a cycle.
  if (typeof resolve === "function") {
    const full = resolve(s);
    const ok = typeof full === "string" && full.toLowerCase() === sha && sha.startsWith(s) && /^[0-9a-f]{7,}$/.test(s);
    return ok
      ? { ok: true, failures: [], detail: `${s} → ${sha}` }
      : { ok: false, failures: [`staging serves ${got || "(missing)"}, rc head is ${sha}`], detail: full ? `${s} → ${full} ≠ ${sha}` : `${got || "(missing)"} does not resolve to ${sha}` };
  }
  return { ok: false, failures: [`staging serves ${got || "(missing)"}, rc head is ${sha}`], detail: "shown commit is not the 40-char rc head" };
}

/** When an RC sha is set, main's "staging serves last green" comparison is not applied. */
export function deployedForMainRule(rcSha, deployedFull) {
  return rcSha ? undefined : deployedFull;
}

const PR_MERGE = /Merge pull request #(\d+)\b/i;
const PR_SQUASH = /\(#(\d+)\)\s*$/;

export function prNumberFromSubject(subject) {
  const merge = PR_MERGE.exec(String(subject ?? ""));
  if (merge) return Number(merge[1]);
  const squash = PR_SQUASH.exec(String(subject ?? ""));
  return squash ? Number(squash[1]) : null;
}

/** First-parent `git log` lines (`%H%x09%s`) → [{ sha, subject, number }]. Lines with no PR number are skipped. */
export function parseRcMerges(logText) {
  const merges = [];
  for (const line of String(logText ?? "").split("\n")) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const sha = line.slice(0, tab).trim().toLowerCase();
    const subject = line.slice(tab + 1).trim();
    const number = prNumberFromSubject(subject);
    if (!/^[0-9a-f]{40}$/.test(sha) || !number) continue;
    merges.push({ sha, subject, number, files: [] });
  }
  return merges;
}

/**
 * Paths a failing check is traced through. The first matching rule wins.
 * A merged PR is named only when its diff touches one of these paths.
 */
export const CHECK_PATHS = [
  { id: "phone-overflow", re: /document scrollWidth|horizontal overflow|job-strip element|job-strip missing/, paths: ["v5/src/app/layout.tsx", "v5/src/app/globals.css", "v5/src/components/app/shell.tsx"] },
  { id: "clipping", re: /clipped /, paths: ["v5/src/app/globals.css", "v5/src/components/app/"] },
  { id: "tap", re: /tap target/, paths: ["v5/src/app/globals.css", "v5/src/components/app/"] },
  { id: "text-size", re: /secondary text|input text/, paths: ["v5/src/app/", "v5/src/components/app/"] },
  { id: "one-tap", re: /one-tap primary|next-step/, paths: ["v5/src/server/next-steps.ts", "v5/src/app/app/"] },
  { id: "migration", re: /migration [\w.]+ is not applied|journal timestamps|rc migrations/, paths: ["v5/drizzle/"] },
  { id: "5.0.4-0", re: /5\.0\.4-0/, paths: ["v5/src/app/layout.tsx", "v5/src/components/app/shell.tsx"] },
  { id: "5.0.4-a", re: /5\.0\.4-a/, paths: ["v5/src/server/next-steps.ts", "v5/src/app/app/"] },
  { id: "5.0.4-b", re: /5\.0\.4-b/, paths: ["v5/src/components/app/"] },
  { id: "5.0.4-c", re: /5\.0\.4-c/, paths: ["v5/src/components/app/"] },
  { id: "5.0.4-d", re: /5\.0\.4-d/, paths: ["v5/src/app/app/", "v5/src/components/app/"] },
  { id: "5.0.4-e", re: /5\.0\.4-e/, paths: ["v5/src/components/app/"] },
  { id: "5.0.4-f", re: /5\.0\.4-f/, paths: ["v5/src/app/"] },
  { id: "5.0.4-g", re: /5\.0\.4-g/, paths: ["v5/src/app/app/"] },
];

function pathsFor(text) {
  return CHECK_PATHS.find((rule) => rule.re.test(text)) ?? null;
}

function fileHits(file, paths) {
  return paths.some((p) => file === p || (p.endsWith("/") && file.startsWith(p)));
}

/**
 * PRs on the rc (newest first, as `git log` prints them) whose files the check's rule names.
 * `prs` is empty when nothing on the rc touched those paths, or the check has no file rule.
 */
export function attributeFailure(text, merges) {
  const rule = pathsFor(text);
  if (!rule) return { prs: [], rule: null, detail: "no file map for this check" };
  const hits = (merges ?? []).filter((m) => (m.files ?? []).some((f) => fileHits(f, rule.paths)));
  if (!hits.length) return { prs: [], rule: rule.id, detail: `no merged PR on the rc changes ${rule.paths.join(", ")}` };
  return { prs: hits.map((h) => h.number), rule: rule.id, detail: `PR #${hits.map((h) => h.number).join(", #")}` };
}

/**
 * Failure lines inside a check detail. A crawl detail is `summary — failure; failure`, and the summary
 * can contain `; `. When the text after ` — ` contains `@<width>`, the tail is split and each failure
 * keeps that summary (`summary — failure`). Otherwise the whole detail is split on `; `.
 */
export function failureSegments(detail) {
  const text = String(detail ?? "").trim();
  if (!text) return [];
  const parts = text.split(/\s+—\s+/);
  if (parts.length > 1) {
    const summary = parts[0].trim();
    const tail = parts.slice(1).join(" — ").trim();
    if (summary && /@\d+\b/.test(tail)) {
      return tail.split(/;\s+/).map((s) => s.trim()).filter(Boolean).map((segment) => `${summary} — ${segment}`);
    }
  }
  return text.split(/;\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Copy failing checks, appending the PR trace to `detail`. Passing checks are unchanged.
 * Each failure line is attributed on its own and keeps the summary that preceded ` — `.
 * One line keeps `detail — PR #N`. Several lines read `summary — failure — PR #N`,
 * so the first matching rule cannot hide a later line.
 */
export function attributeChecks(checks, merges) {
  return (checks ?? []).map((c) => {
    if (c.ok) return { ...c, prs: [] };
    const segments = failureSegments(c.detail);
    if (segments.length <= 1) {
      const attr = attributeFailure(`${c.name} ${c.detail ?? ""}`, merges);
      const trace = attr.prs.length ? `PR #${attr.prs.join(", #")}` : attr.detail;
      return { ...c, prs: attr.prs, detail: `${c.detail ?? ""} — ${trace}` };
    }
    const prs = [];
    const rendered = [];
    for (const segment of segments) {
      const attr = attributeFailure(`${c.name} ${segment}`, merges);
      for (const n of attr.prs) if (!prs.includes(n)) prs.push(n);
      const trace = attr.prs.length ? `PR #${attr.prs.join(", #")}` : attr.detail;
      rendered.push(`${segment} — ${trace}`);
    }
    return { ...c, prs, detail: rendered.join("; ") };
  });
}

/** Journal tags present on the rc and absent on main. */
export function migrationsAdded(mainEntries, rcEntries) {
  const have = new Set((mainEntries ?? []).map((e) => e?.tag).filter(Boolean));
  return (rcEntries ?? []).filter((e) => e?.tag && !have.has(e.tag));
}

/**
 * The 4-digit migration id drizzle would skip, from the tag (`0021_later` → `0021`).
 * Falls back to the tag, then a padded idx, then the entry index.
 */
function skippedMigrationId(entry, index) {
  const tag = String(entry?.tag ?? "");
  const id = /^(\d{4})/.exec(tag);
  if (id) return id[1];
  if (tag) return tag;
  if (Number.isInteger(entry?.idx)) return String(entry.idx).padStart(4, "0");
  return `entry ${index}`;
}

/**
 * Idx values drizzle may skip between two applied entries. 0022 is reserved for an in-flight
 * migration and is the only gap that still passes. Any other missing idx fails closed.
 */
export const RESERVED_GAPS = ["0022"];

/**
 * Walk the journal in entry order (not sorted by `when`).
 * idx must strictly rise, tag and idx must be unique, and the tag's 4-digit prefix must equal idx.
 * A gap passes only when every missing idx is in RESERVED_GAPS.
 * An entry whose `when` is not strictly greater than the previous entry would be skipped:
 * drizzle stores `when` as `__drizzle_migrations.created_at` and no-ops a stamp that is not greater.
 * Equal `when` values fail. Returns one line per problem, including `0021 would be skipped`.
 */
export function journalSkipFailures(entries) {
  const list = entries ?? [];
  const f = [];
  const seenTags = new Set();
  const seenIdx = new Set();
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const id = skippedMigrationId(entry, i);
    const tag = entry?.tag;
    if (tag && seenTags.has(tag)) f.push(`${id} duplicate tag ${tag}`);
    if (tag) seenTags.add(tag);
    const prefix = /^(\d{4})/.exec(String(tag ?? ""))?.[1] ?? null;
    const padded = Number.isInteger(entry?.idx) ? String(entry.idx).padStart(4, "0") : null;
    if (padded && seenIdx.has(padded)) f.push(`${id} duplicate idx ${padded}`);
    if (padded) seenIdx.add(padded);
    if (prefix === null || padded === null || prefix !== padded) {
      f.push(`${id} tag prefix ${prefix ?? "(none)"} does not match idx ${padded ?? "(none)"}`);
    }
    if (i === 0) continue;
    const prevIdx = list[i - 1]?.idx;
    const curIdx = entry?.idx;
    const rising = Number.isInteger(prevIdx) && Number.isInteger(curIdx) && curIdx > prevIdx;
    if (!rising) f.push(`${id} idx is not strictly rising`);
    else {
      for (let g = prevIdx + 1; g < curIdx; g++) {
        const gap = String(g).padStart(4, "0");
        if (!RESERVED_GAPS.includes(gap)) f.push(`${gap} is an unreserved gap`);
      }
    }
    if (!(Number(entry?.when) > Number(list[i - 1]?.when))) f.push(`${id} would be skipped`);
  }
  return f;
}

/** Drizzle skips a migration whose `when` is not strictly greater than the previous entry. */
export function journalAppliesCleanly(entries) {
  return journalSkipFailures(entries).length === 0;
}

/**
 * Applied tags from a /status label (string) or a /health `migrations` value (array, label, null, "unavailable").
 * null means the list was not there. "unavailable" is not an empty list.
 */
export function appliedMigrationTags(value) {
  if (Array.isArray(value)) return value.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (value == null) return null;
  return parseMigrationsLabel(value);
}

/**
 * Every run, not only `--rc`: the journal at the expected commit, compared with /status and /health.
 * (a) idx strictly rises, tags and idx are unique, each tag prefix matches idx, gaps are only RESERVED_GAPS, and `when` strictly increases.
 * (b) Every journal tag is in both applied lists.
 * (c) Neither applied list has a tag the journal does not.
 * `readError` is set when `git show <sha>:v5/drizzle/meta/_journal.json` failed. That fails closed.
 */
export function evaluateAppliedJournal({ journal, statusLabel, healthMigrations, readError } = {}) {
  if (readError) return [String(readError)];
  const entries = journal ?? [];
  const f = [...journalSkipFailures(entries)];
  const tags = entries.map((e) => e?.tag).filter(Boolean);
  const known = new Set(tags);
  const side = (name, applied) => {
    if (applied == null) f.push(`${name} applied migrations are missing`);
    else if (applied === "unavailable") f.push(`${name} applied migrations are unavailable`);
    else {
      for (const tag of tags) if (!applied.includes(tag)) f.push(`${tag} is not applied on ${name}`);
      for (const tag of applied) if (!known.has(tag)) f.push(`${name} applied tag ${tag} is not in the journal`);
    }
  };
  side("/status", appliedMigrationTags(statusLabel));
  side("/health", appliedMigrationTags(healthMigrations));
  return f;
}

/** /status `status-migrations` label → tags, "unavailable", or null when there is no database. */
export function parseMigrationsLabel(label) {
  const s = String(label ?? "").trim();
  if (!s || s === "not-configured") return null;
  if (s === "unavailable") return "unavailable";
  if (s === "(none)") return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

/**
 * Every migration the rc adds over main must be in the applied list, the journal must be able to
 * apply (strictly increasing `when`), and /health must be ok. No added migrations → no health duplicate.
 */
export function evaluateRcMigrations({ added, journal, appliedLabel, healthOk }) {
  const f = [];
  if (!journalAppliesCleanly(journal)) f.push("rc journal timestamps do not strictly increase, so a new migration would not apply");
  if (!(added ?? []).length) return f;
  if (!healthOk) f.push("app is not healthy after the rc migrations");
  const applied = parseMigrationsLabel(appliedLabel);
  if (applied == null) f.push("applied migrations are missing; cannot show the new migrations applied");
  else if (applied === "unavailable") f.push("applied migrations are unavailable; cannot show the new migrations applied");
  else for (const m of added) if (!applied.includes(m.tag)) f.push(`migration ${m.tag} is not applied`);
  return f;
}

/**
 * Acceptance items from a 5.0.4 spec: the single "Acceptance check for …" heading, and each
 * numbered **Title** under "Checks for …".
 */
export function acceptanceItems(markdown) {
  const items = [];
  let section = null;
  let kind = null;
  let listCount = 0;
  const close = () => {
    // A "Checks for" section with no numbered titles is still one item.
    if (kind === "list" && section && listCount === 0) items.push({ section, title: `Checks for ${section}` });
    section = null;
    kind = null;
    listCount = 0;
  };
  for (const line of String(markdown ?? "").split("\n")) {
    const h = /^### (Acceptance check for|Checks for) (5\.0\.4-[0-9a-z]+)/.exec(line);
    if (h) {
      close();
      section = h[2];
      kind = h[1].startsWith("Acceptance") ? "single" : "list";
      if (kind === "single") items.push({ section, title: `Acceptance check for ${section}` });
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      close();
      continue;
    }
    if (kind !== "list" || !section) continue;
    const item = /^\d+\. \*\*(.+?)\*\*/.exec(line);
    if (item) {
      items.push({ section, title: item[1] });
      listCount += 1;
    }
  }
  close();
  return items;
}

/** One failure per acceptance item whose section this run did not execute. */
export function evaluateRcAcceptance(items, executedSections) {
  const done = new Set(executedSections ?? []);
  return (items ?? []).filter((item) => !done.has(item.section)).map((item) => `${item.section}: "${item.title}" is not executed`);
}

/**
 * Extra RC checks. The trust bar (banned words, crawl, reset, /status, M2/M4/M5, phone layout)
 * is the existing verify run; this does not repeat it or relax it.
 * `history` null means git failed. `crawlRan` false means the nav crawl never recorded rows.
 * 5.0.4-0 is executed only when the crawl ran (document scrollWidth, and the job-strip right edge). a–g stay "not executed".
 */
export function buildRcChecks({ history, historyError, crawlRan, crawlFailures, migrationsLabel, healthOk }) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });
  const merges = history?.merges ?? [];
  const added = history?.added ?? [];
  const prList = merges.map((m) => `#${m.number}`).join(", ") || "none";
  const tagList = added.map((m) => m.tag).join(", ") || "none";
  add(
    "rc history",
    history != null,
    history
      ? `${merges.length} merged PR(s) on ${history.branch} (${prList}); ${added.length} migration(s) added over main (${tagList})`
      : (historyError || "rc history is unavailable"),
  );
  const migFails = history
    ? evaluateRcMigrations({ added, journal: history.journal, appliedLabel: migrationsLabel, healthOk })
    : ["rc history is unavailable, so migrations were not checked"];
  add(
    "rc migrations apply and the app is healthy",
    migFails.length === 0,
    migFails.length === 0
      ? (added.length ? `${tagList} applied; /health ok` : "no migrations added over main")
      : migFails.join("; "),
  );

  const items = history ? acceptanceItems(history.spec) : [];
  if (!history) add("rc acceptance items", false, "spec was not read from the rc SHA");
  else if (!items.length) add("rc acceptance items", false, `no acceptance items in ${history.specPath ?? "(no spec at this SHA)"}`);
  else {
    const executed = crawlRan ? ["5.0.4-0"] : [];
    const groups = new Map();
    for (const line of evaluateRcAcceptance(items, executed)) {
      const section = line.split(":")[0];
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section).push(line);
    }
    for (const [section, lines] of groups) add(`acceptance ${section}`, false, lines.join("; "));
    if (crawlRan) {
      // Both clauses of the 5.0.4-0 acceptance sentence. Clause 2 is the job-strip right edge.
      const overflowFails = (crawlFailures ?? []).filter((f) => /document scrollWidth|job-strip element |job-strip missing/.test(f));
      add(
        "acceptance 5.0.4-0",
        overflowFails.length === 0,
        overflowFails.length
          ? overflowFails.slice(0, 6).join("; ")
          : "document scrollWidth ≤ viewport, and no job-strip element past clientWidth, at 320 and 390 on every nav-crawl load",
      );
    }
  }

  const clipFails = (crawlFailures ?? []).filter((f) => /clipped /.test(f) && /@(320|375|390)\b/.test(f));
  add(
    "ellipsis/clipping at ≤480",
    Boolean(crawlRan) && clipFails.length === 0,
    !crawlRan
      ? "nav crawl did not run"
      : clipFails.length
        ? clipFails.slice(0, 6).join("; ")
        : "no clipped money, status pill, table header, or unreachable secondary label at ≤480",
  );
  return checks;
}

/**
 * Read merged PRs, their files, and migration tags of `sha` versus `mainRef`.
 * First-parent history is the rc line: merge commits and squash commits that landed on the branch.
 * `git` is `(args: string[]) => string` (execFileSync encoding utf8).
 */
export function readRcHistory({ version = RC_VERSION, sha, git, mainRef = "origin/main" }) {
  const branch = `rc/${version}`;
  const log = git(["log", "--first-parent", `--format=%H%x09%s`, `${mainRef}..${sha}`]);
  const merges = parseRcMerges(log);
  for (const merge of merges) {
    const diff = git(["diff", "--name-only", `${merge.sha}^1`, merge.sha]);
    merge.files = String(diff ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  }
  const mainJournal = JSON.parse(git(["show", `${mainRef}:v5/drizzle/meta/_journal.json`]) || "{}");
  const rcJournal = JSON.parse(git(["show", `${sha}:v5/drizzle/meta/_journal.json`]) || "{}");
  // A trailing slash plus -r. `git ls-tree --name-only <sha> docs/v5/specs` (no slash, no -r)
  // prints only the directory, so the spec file would never match.
  const specList = String(git(["ls-tree", "-r", "--name-only", sha, "docs/v5/specs/"]) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const specPath = specList.find((name) => name.startsWith(`docs/v5/specs/${version}-`) && name.endsWith(".md"));
  const spec = specPath ? git(["show", `${sha}:${specPath}`]) : "";
  return {
    branch,
    merges,
    added: migrationsAdded(mainJournal.entries, rcJournal.entries),
    journal: rcJournal.entries ?? [],
    spec,
    specPath: specPath ?? null,
  };
}
