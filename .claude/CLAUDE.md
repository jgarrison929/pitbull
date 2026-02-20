# CLAUDE.md — Pitbull Construction Solutions

## Architecture
- .NET 9 modular monolith, CQRS, PostgreSQL 17, CAP event bus
- Multi-tenant (TenantId via RLS) + multi-company (CompanyId via ICompanyScoped)
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- This is YOUR dedicated worktree at /mnt/c/pitbull-claude. Do not touch /mnt/c/pitbull-private.

## File Conventions
- Entities: `src/Modules/Pitbull.{Module}/Entities/`
- EF Configs: `src/Pitbull.Api/Data/Configurations/`
- Services: `src/Modules/Pitbull.{Module}/Features/{Feature}/` (interface + implementation)
- Controllers: `src/Pitbull.Api/Controllers/`
- Migrations: `src/Pitbull.Api/Migrations/` — **NEVER delete, append-only**
- Unit Tests: `tests/Pitbull.Tests.Unit/Api/{Controller}Tests.cs`
- Frontend pages: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/`
- Sidebar nav: `src/Pitbull.Web/pitbull-web/src/components/layout/nav-items.ts`
- Command palette: `src/Pitbull.Web/pitbull-web/src/components/command-palette.tsx`
- API client: `src/Pitbull.Web/pitbull-web/src/lib/api.ts` — use `api<T>()` for all calls

## Entity Pattern
All entities inherit `BaseEntity` (Id, TenantId, CreatedAt, UpdatedAt, IsDeleted, CreatedBy, UpdatedBy).
Company-scoped entities implement `ICompanyScoped` (adds CompanyId).
EF configurations use snake_case table names. Always filter `!IsDeleted`.

## Service Pattern
Interface + implementation in `Features/{Feature}/` directory.
Constructor injection: `PitbullDbContext`, `ITenantContext`, `ICompanyContext`, `ILogger<T>`.
Registered automatically via assembly scanning (`AddPitbullModuleServices<T>`).

## Controller Pattern
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
public class ExampleController(IExampleService service, ICompanyContext companyContext) : ControllerBase
```
- Role-based: `[Authorize(Roles = "Admin,Manager")]`
- Error helpers: `this.BadRequestError()`, `this.NotFoundError()`, `this.UnauthorizedError()`
- Always check `companyContext.IsResolved` before operations
- Return `IActionResult`

## Test Pattern (xUnit + Moq)
```csharp
public class ExampleControllerTests
{
    private readonly Mock<IExampleService> _service = new();
    private readonly Mock<ICompanyContext> _companyContext = new();
    private readonly ExampleController _controller;

    public ExampleControllerTests()
    {
        _companyContext.Setup(c => c.IsResolved).Returns(true);
        _companyContext.Setup(c => c.CompanyId).Returns(Guid.NewGuid());
        _controller = new ExampleController(_service.Object, _companyContext.Object);
    }
}
```
Test: success, not-found (404), validation (400), auth (401/403), field passthrough.

## Frontend Pattern
- `api<T>()` from `src/lib/api.ts` for all API calls
- Components: shadcn/ui (Button, Input, Label, Select, Dialog, Table, Badge, Card, Skeleton)
- Icons: lucide-react
- Toasts: `toast` from sonner
- Loading states with `<Skeleton />` components
- Empty states with descriptive messages + icons
- Responsive: mobile-first Tailwind breakpoints

## Migration Rules
1. NEVER delete, squash, or modify existing migration files
2. ONE migration per feature branch
3. Designer.cs is REQUIRED — EF won't recognize migration without it
4. Before committing: check for duplicate CreateTable against recent migrations
5. If wrong, create corrective migration — don't edit original

## Branch Workflow
1. Create feature branch from current HEAD: `git checkout -b feature/my-feature`
2. Single commit with conventional message: `feat(module): description`
3. Push branch: `git push origin feature/my-feature`
4. Do NOT merge to main — River handles merges

## Validation (run before committing)
```bash
dotnet build Pitbull.sln --configuration Release
dotnet test tests/Pitbull.Tests.Unit --configuration Release --no-build
cd src/Pitbull.Web/pitbull-web && npm run build && npm run lint
```

## Do NOT
- Modify other modules' files unless explicitly asked
- Add NuGet packages without being asked
- Change Program.cs unless required
- Create files outside `(dashboard)` route group
- Work in /mnt/c/pitbull-private (that's the main repo, not your worktree)
