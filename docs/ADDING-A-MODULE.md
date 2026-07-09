# Adding a New Module to Pitbull

**Current (2026-05+):** Direct service injection + marker-based registration. **No MediatR in controllers.** See docs/ARCHITECTURE.md and source for settled patterns.

This guide uses a hypothetical **Contracts** module (example only; adapt names).

**WARNING:** Older versions of this doc described a MediatR-heavy CQRS pattern with handlers in controllers. That is deprecated for new code. Controllers use constructor-injected `I*Service`.

---

## Prerequisites
- .NET 10 SDK
- Familiarity with docs/ARCHITECTURE.md and docs/ADDING-A-MODULE.md (patterns, Dockerfile updates, no RenameColumn in migrations, etc.)
- Run `dotnet build` and `cd src/Pitbull.Web/pitbull-web && npm run build` before PRs

---

## Step 1: Create the Project

```bash
cd src/Modules
dotnet new classlib -n Pitbull.Contracts -f net10.0
cd Pitbull.Contracts
dotnet add reference ../Pitbull.Core/Pitbull.Core.csproj
dotnet sln add ../../.. src/Modules/Pitbull.Contracts/Pitbull.Contracts.csproj   # adjust as needed
cd ../../..
dotnet sln Pitbull.sln add src/Modules/Pitbull.Contracts/Pitbull.Contracts.csproj
cd src/Pitbull.Api
dotnet add reference ../Modules/Pitbull.Contracts/Pitbull.Contracts.csproj
```

Add NuGet only as needed (FluentValidation, EF Core usually transitively via Core).

**Critical:** Also update `src/Pitbull.Api/Dockerfile` with a COPY for the new .csproj (or Railway build breaks).

---

## Step 2: Folder Structure (Service-Oriented)

```
Pitbull.Contracts/
  Domain/
    Subcontract.cs
    ...
  Data/
    SubcontractConfiguration.cs   # (or ContractsConfiguration.cs)
  Services/
    IContractService.cs
    ContractService.cs
  Features/
    CreateContractCommand.cs      # only for module registration marker (minimal)
  (optional other folders)
```

Use **services** (interface + impl) for business logic. CQRS commands exist only where needed for `AddPitbullModule<T>` registration.

## Step 3: Domain + EF Config

All entities inherit `BaseEntity` from Core.

Always:
- `builder.ToTable("snake_case");`
- Enums: `.HasConversion<string>()`
- Money: `.HasPrecision(18, 2)`
- Unique per tenant: `HasIndex(x => new { x.TenantId, x.Number }).IsUnique()`
- Global query filter for !IsDeleted (usually in base or per module)

See existing configs in other modules for examples.

## Step 4: Service (the real pattern)

```csharp
// Services/IContractService.cs
public interface IContractService
{
    Task<ContractDto?> GetAsync(Guid id, CancellationToken ct);
    Task<PagedResult<ContractDto>> ListAsync(int page, int pageSize, CancellationToken ct);
    Task<ContractDto> CreateAsync(CreateContractDto dto, CancellationToken ct);
    // ...
}

// Services/ContractService.cs
public class ContractService(PitbullDbContext db, ITenantContext tenant, ICompanyContext company)
    : IContractService
{
    public async Task<ContractDto?> GetAsync(Guid id, CancellationToken ct)
    {
        var entity = await db.Set<Subcontract>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
        // map + return
        return null;
    }
    // ...
}
```

Services registered via `AddPitbullModuleServices<TMarker>()`.

## Step 5: Marker for Registration

```csharp
// Features/CreateContractCommand.cs (or ContractsModuleMarker.cs)
namespace Pitbull.Contracts.Features;

public record CreateContractCommand;   // empty marker only; used for assembly + module registration
```

(Actual command DTOs live with services or in Api layer where needed.)

## Step 6: Register in Program.cs (THREE places)

1. Assembly for EF discovery:
   ```csharp
   PitbullDbContext.RegisterModuleAssembly(typeof(CreateContractCommand).Assembly);
   ```

2. MediatR/validators (if you have any handlers):
   ```csharp
   builder.Services.AddPitbullModule<CreateContractCommand>();
   ```

3. Direct services:
   ```csharp
   builder.Services.AddPitbullModuleServices<CreateContractCommand>();
   ```

See exact usage in current Program.cs for other modules (BillingModuleMarker etc.).

## Step 7: Controller (Direct Service Injection)

```csharp
[ApiController]
[Route("api/contracts")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Contracts")]
public class ContractsController(IContractService contractService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ContractDto>>> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await contractService.ListAsync(page, pageSize, HttpContext.RequestAborted);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ContractDto>> Create([FromBody] CreateContractDto dto)
    {
        var created = await contractService.CreateAsync(dto, HttpContext.RequestAborted);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }
}
```

**Rules:**
- Primary constructor for services
- `[Authorize]`
- Use `PagedResult<T>`
- Never inject IMediator in controllers
- Return ActionResult or use helpers

## Step 8: Migration

```bash
cd src/Pitbull.Api
dotnet ef migrations add AddContractsModule -p src/Modules/Pitbull.Core -s src/Pitbull.Api
```

- NEVER `RenameColumn`, `RenameTable`, `DROP TABLE`, raw TRUNCATE in migrations.
- Follow all migration safety rules documented in docs/ARCHITECTURE.md and enforced by CI.

## Step 9: Verify

```bash
dotnet build Pitbull.sln --configuration Release   # 0 warnings
cd src/Pitbull.Web/pitbull-web && npm run build && npm run lint
dotnet test ...
```

Add to Dockerfile COPY line before committing.

Update any relevant historical notes in docs/archive/ if new patterns emerge.

---

## Quick Checklist

- [ ] New Pitbull.* module project + sln + Api ref + **Dockerfile COPY**
- [ ] BaseEntity entities + EF config (snake, (18,2), string enums, TenantId indexes)
- [ ] IXXXService + XXXService
- [ ] Marker type for registration
- [ ] 3 registrations in Program.cs (assembly, AddPitbullModule, AddPitbullModuleServices)
- [ ] Controller with direct service, [Authorize], rate limit
- [ ] Migration (safe)
- [ ] Build + lint green
- [ ] Tests (unit for service + controller tests with claims)
- [ ] !IsDeleted filter on all reads
- [ ] Filter by tenant/company as appropriate

**Always cross-check current modules (e.g. Pitbull.Billing, Pitbull.TimeTracking) for the live pattern rather than this doc alone.**
