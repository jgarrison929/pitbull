## Summary

What does this PR do? (one version step only)

## Spec

- [ ] Linked or referenced: `docs/specs/…` (or docs/260712 for agent-infra)
- [ ] Version row acceptance criteria addressed

## Version stamp (required for ship)

- [ ] Root `VERSION`
- [ ] `v5/package.json` (same version as root `VERSION`)
- [ ] `v5/src/content/changelog.ts`
- [ ] Docker ARG defaults if applicable
- [ ] `CHANGELOG.md` — `## [x.y.z] - ISO-8601-with-offset`

**This PR bumps:** `x.y.z` → `x.y.z+1` (exactly one step; see `AGENTS.md` and `docs/roadmap.md`)

## Test plan

- [ ] From `v5/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` (the v5 job under ci-gate)
- [ ] Unit / integration / E2E named in the goal prompt
- [ ] Mobile: no client-side ledger aggregation; truth rules intact

## Before / After

- [ ] This description says what changed (tree, screen, or no UI change)

## Checklist

- [ ] Single clean PR for one version
- [ ] No secrets committed
- [ ] Demo restrictions respected if touching admin paths
