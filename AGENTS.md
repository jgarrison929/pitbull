# Agent instructions — Pitbull Construction Solutions

Construction ERP (modular monolith). Prefer **truth over polish**: label metric proxies honestly; never invent executive KPIs.

## Stack (current)

- **API:** .NET 10, ASP.NET Core, EF Core 10, PostgreSQL 17 + RLS  
- **Web:** Next.js 16, React 19, Tailwind 4, shadcn/ui  
- **Auth:** JWT + Identity roles (`Admin`/`Manager`/`Supervisor`/`User`) + RBAC **permissions** claims  
- **Pattern:** Controllers inject `I*Service` — **do not add MediatR to controllers**  
- **Version:** root `VERSION` + `CHANGELOG.md` (Keep a Changelog; ISO published timestamps)

## Demo personas (Explore as a role)

When `Demo:Enabled=true`: CEO / CFO / PM / Estimator via `POST /api/auth/demo-role-login`.

| Key | Email | Title drives home UX |
|-----|--------|----------------------|
| ceo | ceo@demo.local | Chief Executive Officer → **executive** layout + Executive briefing |
| cfo | cfo@demo.local | Chief Financial Officer → **controller** layout |
| pm | pm@demo.local | Project Manager → **pm** layout |
| estimator | estimator@demo.local | Estimator → **estimator** layout |

**Persona resolution** is title-first via `RoleProfileResolver` (briefing, dashboard prefs, welcome tour). JWT includes `job_title` + `role_profile`. Identity role alone is **not** enough (Manager ≠ Executive).

## Docs truth

| Source of truth | Secondary |
|-----------------|-----------|
| `src/`, tests, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/ROLE-EXPERIENCE.md` | Historical design notes under `docs/architecture/` (see its README) |
| Live Railway: `deploy/RAILWAY-*.md` | Older multi-env notes in `docs/deployment/*` |

## Version bumps

Per `CONTRIBUTING.md`: update `VERSION`, web `package.json`, API csproj Version props, Docker ARGs together. Stamp CHANGELOG headers with ISO date+time.

## Safety

- Demo users: `IsDemoUser` + `DemoRestrictionMiddleware` (admin GET-only, no DELETE)  
- Never commit secrets; Railway env via platform config  
