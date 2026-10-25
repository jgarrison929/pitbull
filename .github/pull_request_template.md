## Summary

What does this PR do? (one version step only)

## Spec

- [ ] Linked or referenced: `docs/specs/…` (or docs/260712 for agent-infra)
- [ ] Version row acceptance criteria addressed

## Version stamp (required for ship)

- [ ] Root `VERSION`
- [ ] `src/Pitbull.Web/pitbull-web/package.json`
- [ ] `src/Pitbull.Api/Pitbull.Api.csproj` Version / AssemblyVersion / FileVersion / InformationalVersion
- [ ] Docker ARG defaults if applicable
- [ ] `CHANGELOG.md` — `## [x.y.z] - ISO-8601-with-offset`

**This PR bumps:** `x.y.z` → `x.y.z+1` (exactly one step; see `docs/260712/VERSION-WORKFLOW.md`)

## Help center

- [ ] N/A (no user-visible flow change), **or**
- [ ] Updated `help/page.tsx` in this PR

## Test plan

- [ ] `./scripts/preflight.ps1 -FullWeb -DotNet` (or note why partial)
- [ ] Unit / integration / E2E named in the goal prompt
- [ ] Mobile: no client-side ledger aggregation; truth rules intact

## Checklist

- [ ] Single clean PR for one version
- [ ] No secrets committed
- [ ] Demo restrictions respected if touching admin paths
