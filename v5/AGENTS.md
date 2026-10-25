<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Pitbull v5 — agent rules

Prefer **truth over polish**. Assume the next editor only opened the nearest file and will copy the shortest path that compiles — make that path the right one.

## Mistake → enforcement

| Rule | Enforcement (drop the row once the mistake cannot happen) |
|------|--------------------------------------------------------------|
| One working calendar: `src/lib/working-calendar.ts` only — never `lib/schedule/working-days.ts` | Architecture + `src/lib/agent-guards/paths.test.ts`; README in `src/lib/schedule/` |
| Page anatomy rename `page.tsx` → `page-shell.tsx` | **Parked** until the 5.0.3 queue lands — then a pure rename PR (`PARKED_PAGE_SHELL_RENAME`) |
| Must-fail tests observe the **live** send path — do not assert a formula shared with production | `agent-guards/must-fail.ts` (+ live check when `insert-work-pipeline.test.ts` exists) |
| PV must-fail maps finish→exclusive via `plannedFinishExclusiveOn` — do not hard-code both inputs | `weakPvMustFail` + cpm.test contract when present |
| CPM backward pass: seed/cap LF at **job finish** (SS-only successors) | `cpmCapsLfAtJobFinish` when `cpm.ts` ships |
| Working-day math is **indexed** (binary search on day numbers) — no per-day `Date` walks | `calendarUsesIndexedArithmetic` when calendar ships |
| No raw Tailwind palette / hex / oklch in product UI — theme tokens only | `no-raw-colors.ts` (+ allowlist until Part C lands; expiry 2026-11-30) |
| Never call Pitbull an "ERP"; no coming-soon / stub / lorem user copy | `banned-strings.test.ts` + roadmap bans |
| Do not edit `.cursor/skills/verify-v5` or `src/proxy.ts` in a feature PR | `npm run check:owned-paths` in CI (fail closed); bypass via exact PR title `[owned-path-ok]` (case-sensitive) or label `owned-path-ok` |
| Job / cost-item pages: fixed query budgets — no N+1 over history | `getDbQueryCount` + `*-query-budget.test.ts` |
| Staging `DATABASE_URL` = private `*.railway.internal`, not `DATABASE_PUBLIC_URL` / `*.proxy.rlwy.net` | `classifyDatabaseUrl` on `/health` as `dbNetwork` |
| No Recharts (or other heavy client chart) for simple SVG series | `no-recharts.test.ts` |
| `ALTER TYPE … ADD VALUE` only when allowlisted — `db-migrate.mjs` applies those outside a TX | `migrations.test.ts` + `ADD_VALUE_ALLOWLIST` |
| Visual baselines: `maxDiffPixels: 0`; every light shot gets a `-dark-` twin once dark theme ships | `visual.test.ts` |

Exceptions: comment the offending line with reason, expiry, and who approved. Prefer deleting the wrong API over documenting it.

## Product vocabulary

Construction **project controls** (jobs, cost, field plans, schedule, contracts) — not ERP, not accounting suite.
