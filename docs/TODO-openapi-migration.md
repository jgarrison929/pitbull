# TODO: Migrate from Swashbuckle to .NET 9 Built-in OpenAPI

**Created:** 2026-05-01
**Priority:** Medium (non-urgent, current setup works on Swashbuckle 7.2.0)
**Context:** Swashbuckle 10.x upgrade caused production crash due to Microsoft.OpenApi v1→v2 breaking changes.

## Current State

- **Swashbuckle.AspNetCore 7.2.0** — generates OpenAPI spec + serves Swagger UI
- **Microsoft.AspNetCore.OpenApi 9.0.13** — already referenced but **unused** (no `AddOpenApi()` / `MapOpenApi()` calls)
- **Microsoft.OpenApi 1.6.22** (v1) — transitive, used by both packages above
- **Only 2 files touch Swagger/OpenApi:**
  - `src/Pitbull.Api/Program.cs` — `AddSwaggerGen()`, `UseSwagger()`, `UseSwaggerUI()`
  - `src/Pitbull.Api/Middleware/SwaggerAuthMiddleware.cs` — JWT-gated access to `/swagger/*`

## Why Migrate?

1. **Swashbuckle is effectively unmaintained.** No official .NET 8 release, maintenance issues ongoing.
2. **.NET 9 ships first-party OpenAPI support** via `Microsoft.AspNetCore.OpenApi` — better long-term bet.
3. **AOT compatibility** — built-in support works with Native AOT; Swashbuckle doesn't.
4. **Eliminates the v1/v2 type confusion** — no more `Microsoft.OpenApi.Models.*` vs `Microsoft.OpenApi.*` namespace issues.
5. **One less dependency** to audit and maintain.

## Migration Plan

### Step 1: Replace Swashbuckle document generation with built-in OpenAPI

```csharp
// BEFORE (Swashbuckle)
builder.Services.AddSwaggerGen(c => { ... });
app.UseSwagger();

// AFTER (built-in .NET 9)
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, ct) =>
    {
        document.Info = new()
        {
            Title = "Pitbull Construction Solutions — API Reference",
            Version = "v1",
            Description = "...",
            Contact = new() { Name = "...", Email = "...", Url = new Uri("...") },
            License = new() { Name = "Proprietary" }
        };
        return Task.CompletedTask;
    });
});
app.MapOpenApi(); // serves at /openapi/v1.json
```

### Step 2: Keep Swagger UI (or switch to Scalar)

Built-in OpenAPI only generates the JSON spec — no UI included.

**Option A: Keep Swagger UI** (minimal change)
- Install `Swashbuckle.AspNetCore.SwaggerUI` only (not the full Swashbuckle package)
- Point it at `/openapi/v1.json`

```csharp
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/openapi/v1.json", "Pitbull API v1");
});
```

**Option B: Switch to Scalar** (modern, better UI)
- `dotnet add package Scalar.AspNetCore`
- Replace `UseSwaggerUI()` with `app.MapScalarApiReference()`

### Step 3: Update SwaggerAuthMiddleware

- Update path matching from `/swagger` to whatever path the new UI serves on
- Or use ASP.NET authorization policies on the OpenAPI endpoint directly

### Step 4: Remove Swashbuckle dependency

```xml
<!-- REMOVE from Pitbull.Api.csproj -->
<PackageReference Include="Swashbuckle.AspNetCore" Version="7.2.0" />

<!-- KEEP (already there) -->
<PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="9.0.13" />
```

### Step 5: Add JWT security scheme via transformer

```csharp
options.AddDocumentTransformer((document, context, ct) =>
{
    document.Components ??= new();
    document.Components.SecuritySchemes["Bearer"] = new()
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT Authorization header..."
    };
    return Task.CompletedTask;
});
```

## Blockers / Considerations

- **XML comment support** — built-in OpenAPI in .NET 9 does NOT support XML doc comments natively.
  Expected in .NET 10. We currently use `c.IncludeXmlComments(xmlPath)` in Swashbuckle.
  Workaround: custom transformer or wait for .NET 10.
- **Security requirement on all operations** — need operation transformer to add Bearer requirement globally.
- **Test the `/swagger/*` auth middleware** — must update path or add new auth for `/openapi/*`.

## Decision

**Not urgent.** Swashbuckle 7.2.0 works fine on .NET 9 with OpenApi v1 types.
Revisit when:
- Upgrading to .NET 10 (which will have full XML comment support)
- Swashbuckle 7.x stops working with a future .NET SDK
- We want AOT compilation
