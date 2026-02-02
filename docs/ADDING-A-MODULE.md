# Adding a New Module to Pitbull

Step-by-step guide for adding a new domain module (e.g., Contracts, Documents, Billing).

This uses a hypothetical **Contracts** module as the example.

---

## Prerequisites

- .NET 9.0 SDK installed
- PostgreSQL running locally
- Familiarity with the patterns in [BEST-PRACTICES.md](./BEST-PRACTICES.md)

---

## Step 1: Create the Project

```bash
# From the repo root
cd src/Modules
dotnet new classlib -n Pitbull.Contracts -f net9.0

# Add project references
cd Pitbull.Contracts
dotnet add reference ../Pitbull.Core/Pitbull.Core.csproj

# Add required NuGet packages
dotnet add package MediatR
dotnet add package FluentValidation
dotnet add package FluentValidation.DependencyInjectionExtensions
dotnet add package Microsoft.EntityFrameworkCore

# Add to solution
cd ../../..
dotnet sln add src/Modules/Pitbull.Contracts/Pitbull.Contracts.csproj

# Reference from the API project
cd src/Pitbull.Api
dotnet add reference ../Modules/Pitbull.Contracts/Pitbull.Contracts.csproj
```

## Step 2: Create the Folder Structure

```
Pitbull.Contracts/
  Domain/
    Contract.cs
    ContractStatus.cs
  Data/
    ContractConfiguration.cs
  Features/
    CreateContract/
      CreateContractCommand.cs
      CreateContractHandler.cs
      CreateContractValidator.cs
    GetContract/
      GetContractQuery.cs
      GetContractHandler.cs
    ListContracts/
      ListContractsQuery.cs
      ListContractsHandler.cs
```

## Step 3: Create Domain Entities

Every entity must inherit from `BaseEntity`. This gives you the ID, tenant ID, audit fields, soft delete, and domain events for free.

```csharp
// Domain/Contract.cs
using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

public class Contract : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;  // e.g. "CON-2026-001"
    public ContractStatus Status { get; set; } = ContractStatus.Draft;
    public decimal Value { get; set; }
    public DateTime? ExecutedDate { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string? Description { get; set; }

    // FK to Project (cross-aggregate, nullable)
    public Guid? ProjectId { get; set; }
}
```

```csharp
// Domain/ContractStatus.cs
namespace Pitbull.Contracts.Domain;

public enum ContractStatus
{
    Draft,
    PendingReview,
    Executed,
    Expired,
    Terminated
}
```

## Step 4: Create EF Configuration

```csharp
// Data/ContractConfiguration.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Contracts.Domain;

namespace Pitbull.Contracts.Data;

public class ContractConfiguration : IEntityTypeConfiguration<Contract>
{
    public void Configure(EntityTypeBuilder<Contract> builder)
    {
        builder.ToTable("contracts");                              // snake_case table name
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Title).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Number).HasMaxLength(50).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(2000);
        builder.Property(c => c.Value).HasPrecision(18, 2);       // Always specify precision for decimals
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(50);  // Enums as strings

        builder.HasIndex(c => new { c.TenantId, c.Number }).IsUnique();  // Unique per tenant
        builder.HasIndex(c => c.Status);
    }
}
```

**Checklist for configurations:**
- [ ] Table name is snake_case
- [ ] String properties have `HasMaxLength()`
- [ ] Required strings have `.IsRequired()`
- [ ] Decimal properties have `HasPrecision(18, 2)` (or `18, 4` for quantities)
- [ ] Enums use `HasConversion<string>().HasMaxLength(50)`
- [ ] Unique indexes include `TenantId`
- [ ] Child collections use cascade delete
- [ ] Cross-aggregate FKs use restrict delete

## Step 5: Create Feature Handlers (CQRS)

### Create Command

```csharp
// Features/CreateContract/CreateContractCommand.cs
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.CreateContract;

public record CreateContractCommand(
    string Title,
    string Number,
    decimal Value,
    string? Description,
    Guid? ProjectId
) : ICommand<ContractDto>;

public record ContractDto(
    Guid Id,
    string Title,
    string Number,
    string Status,
    decimal Value,
    string? Description,
    Guid? ProjectId,
    DateTime CreatedAt
);
```

```csharp
// Features/CreateContract/CreateContractHandler.cs
using MediatR;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.CreateContract;

public class CreateContractHandler(PitbullDbContext db)
    : IRequestHandler<CreateContractCommand, Result<ContractDto>>
{
    public async Task<Result<ContractDto>> Handle(
        CreateContractCommand request, CancellationToken cancellationToken)
    {
        var contract = new Contract
        {
            Title = request.Title,
            Number = request.Number,
            Value = request.Value,
            Description = request.Description,
            ProjectId = request.ProjectId
        };

        db.Set<Contract>().Add(contract);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapToDto(contract));
    }

    internal static ContractDto MapToDto(Contract c) => new(
        c.Id, c.Title, c.Number, c.Status.ToString(),
        c.Value, c.Description, c.ProjectId, c.CreatedAt
    );
}
```

### Validator

```csharp
// Features/CreateContract/CreateContractValidator.cs
using FluentValidation;

namespace Pitbull.Contracts.Features.CreateContract;

public class CreateContractValidator : AbstractValidator<CreateContractCommand>
{
    public CreateContractValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Contract title is required")
            .MaximumLength(200);

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Contract number is required")
            .MaximumLength(50);

        RuleFor(x => x.Value)
            .GreaterThanOrEqualTo(0).WithMessage("Contract value cannot be negative");
    }
}
```

### Query

```csharp
// Features/GetContract/GetContractQuery.cs
using Pitbull.Contracts.Features.CreateContract;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.GetContract;

public record GetContractQuery(Guid Id) : IQuery<ContractDto>;
```

```csharp
// Features/GetContract/GetContractHandler.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateContract;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.GetContract;

public class GetContractHandler(PitbullDbContext db)
    : IRequestHandler<GetContractQuery, Result<ContractDto>>
{
    public async Task<Result<ContractDto>> Handle(
        GetContractQuery request, CancellationToken cancellationToken)
    {
        var contract = await db.Set<Contract>()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (contract is null)
            return Result.Failure<ContractDto>("Contract not found", "NOT_FOUND");

        return Result.Success(CreateContractHandler.MapToDto(contract));
    }
}
```

## Step 6: Register the Module in Program.cs

Open `src/Pitbull.Api/Program.cs` and add two lines:

```csharp
using Pitbull.Contracts.Features.CreateContract;  // Add this import

// Near the other RegisterModuleAssembly calls:
PitbullDbContext.RegisterModuleAssembly(typeof(CreateContractCommand).Assembly);

// Near the other AddPitbullModule calls:
builder.Services.AddPitbullModule<CreateContractCommand>();
```

## Step 7: Create the Controller

```csharp
// src/Pitbull.Api/Controllers/ContractsController.cs
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Contracts.Features.CreateContract;
using Pitbull.Contracts.Features.GetContract;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]                    // Always at the class level
public class ContractsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateContractCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetContractQuery(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}
```

**Controller checklist:**
- [ ] `[ApiController]` attribute
- [ ] `[Route("api/[controller]")]`
- [ ] `[Authorize]` at class level
- [ ] Primary constructor injection for `IMediator`
- [ ] Inherits `ControllerBase` (not `Controller` -- we don't need views)
- [ ] POST returns `CreatedAtAction` with location header
- [ ] Error responses use `new { error = "...", code = "..." }`

## Step 8: Add Migration

```bash
cd src/Pitbull.Api

# Make sure the project builds first
dotnet build

# Create the migration
dotnet ef migrations add AddContracts -- --environment Development
```

The migration will be created in `src/Pitbull.Api/Migrations/`. It auto-applies on next startup.

## Step 9: Build and Test

```bash
# Build the full solution
dotnet build

# Run the API
dotnet run --project src/Pitbull.Api

# Test with curl
curl -X POST http://localhost:5000/api/contracts \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Subcontractor Agreement", "number": "CON-2026-001", "value": 150000}'
```

---

## Quick Reference Checklist

When adding a new module, make sure you've done all of these:

- [ ] Created class library project under `src/Modules/`
- [ ] Added reference to `Pitbull.Core`
- [ ] Added NuGet packages (MediatR, FluentValidation, EF Core)
- [ ] Added project to solution file
- [ ] Added project reference from `Pitbull.Api`
- [ ] Created domain entities inheriting `BaseEntity`
- [ ] Created EF configurations with snake_case table names
- [ ] Created feature folders with command/query + handler + validator
- [ ] Registered module assembly in `Program.cs` (`RegisterModuleAssembly`)
- [ ] Registered module services in `Program.cs` (`AddPitbullModule`)
- [ ] Created controller with `[Authorize]`
- [ ] Added and verified migration
- [ ] Built successfully
- [ ] Tested the endpoints manually or with integration tests
