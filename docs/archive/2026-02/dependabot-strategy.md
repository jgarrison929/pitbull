# Dependabot Queue Management Strategy

## Current Status (2026-02-03 06:00 AM)
- **CI Queue:** Backlogged (2 queued self-hosted runs)
- **Open PRs:** 8 Dependabot updates, mostly major versions
- **Last successful CI:** ✅ All tests passing (112/112 unit + 1/1 integration)

## Risk Assessment by PR

### 🔴 High Risk - Major Version Updates
**PR #108: actions/checkout v4→v6**
- Breaking changes: credential persistence to $RUNNER_TEMP
- Requires runner version v2.329.0+
- Action: Test locally first, verify runner compatibility

**PR #109: actions/setup-node v4→v6** 
- Breaking changes: automatic caching behavior
- May affect npm/yarn workflows
- Action: Review package.json, test caching behavior

**PR #116: Swashbuckle.AspNetCore 7.2.0→10.1.1**
- Major version jump across 3 versions
- Potential OpenAPI/Swagger breaking changes
- Action: Review API documentation generation

### 🟡 Medium Risk - Infrastructure Updates
**PR #112: Microsoft group updates (6 packages)**
- EF Core, ASP.NET Core, extensions
- Usually safe but comprehensive
- Action: Review change logs, test core functionality

**PR #114: Infrastructure group updates (4 packages)**
- Supporting libraries and tools
- Lower risk but should be tested
- Action: Batch test with Microsoft updates

### 🟢 Low Risk - Test Dependencies  
**PR #113: Testing group updates (4 packages)**
- FluentAssertions, xunit, test SDK
- Isolated to test projects
- Action: Run test suite, verify no breaking changes

## Recommended Strategy

### Phase 1: CI Stabilization
1. Wait for CI queue to clear
2. Ensure develop branch remains green
3. Monitor self-hosted runner status

### Phase 2: Safe Updates First
1. Start with testing dependencies (#113)
2. Validate with full test suite run
3. Merge if green, provides confidence

### Phase 3: Infrastructure Updates
1. Handle Microsoft package updates (#112, #114) together
2. Test locally first with `dotnet build` and `dotnet test`
3. Watch for EF migration or API contract changes

### Phase 4: GitHub Actions Updates
1. Test actions/checkout and setup-node in feature branch
2. Verify runner compatibility on self-hosted environment  
3. Check for any workflow failures or caching issues

### Phase 5: API Dependencies
1. Handle Swashbuckle update last
2. Verify OpenAPI spec generation still works
3. Check API documentation and Swagger UI

## Next Actions
- [x] Monitor CI queue for clearance
- [x] Start with testing dependencies (#113) ✅ MERGED
- [ ] Complete Microsoft updates (#112) - waiting for rebase
- [ ] **URGENT:** Review MediatR licensing implications in #114
- [ ] Create testing branch for GitHub Actions updates
- [ ] Document any breaking changes found during testing
- [ ] Coordinate with Josh for any runner infrastructure updates needed

## CRITICAL DISCOVERY - PR #114 ⚠️
**MediatR v12.4.1 → v14.0.0 introduces COMMERCIAL LICENSING:**
- Now requires license key for commercial use
- Could break entire CQRS architecture if not handled
- Need Josh to evaluate: purchase license vs. find alternative
- **DO NOT MERGE until licensing resolved**

**FluentValidation v11 → v12:** Major API changes, drops .NET 6/7
**Serilog v9 → v10:** .NET 10 dependencies

## Progress Log
- ✅ PR #113: Testing dependencies merged safely
- 🔄 PR #112: Microsoft patches (9.0.x) - rebasing due to conflicts  
- ⚠️ PR #114: Infrastructure - BLOCKED on licensing issues
- ⏳ PR #108/109: GitHub Actions - awaiting safer PRs first