using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Data;

/// <summary>
/// Main EF Core DbContext for Pitbull.
/// Inherits from IdentityDbContext for ASP.NET Identity support.
/// Applies global query filters for multi-tenancy, company isolation, and soft deletes.
/// </summary>
public class PitbullDbContext(
    DbContextOptions<PitbullDbContext> options,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    IHttpContextAccessor? httpContextAccessor = null,
    IMediator? mediator = null)
    : IdentityDbContext<AppUser, AppRole, Guid>(options)
{
    // Explicit fields for Expression.Field() access in query filters.
    // Primary constructor parameters generate compiler-mangled backing fields
    // that can't be found by name via reflection, so we need these.
    private readonly ITenantContext _tenantContext = tenantContext;
    private readonly ICompanyContext _companyContext = companyContext;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<UserCompanyAccess> UserCompanyAccess => Set<UserCompanyAccess>();

    // Module assemblies to scan for IEntityTypeConfiguration
    private static readonly List<System.Reflection.Assembly> _moduleAssemblies = [];

    public static void RegisterModuleAssembly(System.Reflection.Assembly assembly)
    {
        if (!_moduleAssemblies.Contains(assembly))
            _moduleAssemblies.Add(assembly);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Rename Identity tables to something cleaner
        builder.Entity<AppUser>(e => e.ToTable("users"));
        builder.Entity<AppRole>(e => e.ToTable("roles"));
        builder.Entity<IdentityUserRole<Guid>>(e => e.ToTable("user_roles"));
        builder.Entity<IdentityUserClaim<Guid>>(e => e.ToTable("user_claims"));
        builder.Entity<IdentityUserLogin<Guid>>(e => e.ToTable("user_logins"));
        builder.Entity<IdentityRoleClaim<Guid>>(e => e.ToTable("role_claims"));
        builder.Entity<IdentityUserToken<Guid>>(e => e.ToTable("user_tokens"));

        // Tenant configuration
        builder.Entity<Tenant>(e =>
        {
            e.ToTable("tenants");
            e.HasKey(t => t.Id);
            e.HasIndex(t => t.Slug).IsUnique();
            e.Property(t => t.Settings).HasColumnType("jsonb");
        });

        // Company configuration
        builder.Entity<Company>(e =>
        {
            e.ToTable("companies");
            e.HasKey(c => c.Id);
            e.Property(c => c.Code).HasMaxLength(20).IsRequired();
            e.Property(c => c.Name).HasMaxLength(200).IsRequired();
            e.Property(c => c.ShortName).HasMaxLength(50);
            e.Property(c => c.TaxId).HasMaxLength(50);
            e.Property(c => c.Address).HasMaxLength(500);
            e.Property(c => c.City).HasMaxLength(100);
            e.Property(c => c.State).HasMaxLength(50);
            e.Property(c => c.ZipCode).HasMaxLength(20);
            e.Property(c => c.Phone).HasMaxLength(50);
            e.Property(c => c.Website).HasMaxLength(200);
            e.Property(c => c.Email).HasMaxLength(200);
            e.Property(c => c.LogoUrl).HasMaxLength(500);
            e.Property(c => c.PrimaryColor).HasMaxLength(20);
            e.Property(c => c.Currency).HasMaxLength(10).HasDefaultValue("USD");
            e.Property(c => c.Timezone).HasMaxLength(50).HasDefaultValue("America/Los_Angeles");
            e.Property(c => c.DateFormat).HasMaxLength(20).HasDefaultValue("MM/dd/yyyy");
            e.Property(c => c.Settings).HasColumnType("jsonb").HasDefaultValue("{}");
            e.Property(c => c.PayPeriodType)
                .HasMaxLength(20)
                .HasDefaultValue("Weekly");
            e.Property(c => c.DefaultWorkWeekDays)
                .HasMaxLength(100)
                .HasDefaultValue("Mon,Tue,Wed,Thu,Fri");

            e.HasIndex(c => new { c.TenantId, c.Code }).IsUnique();

            // TimecardSettings as owned entity (stored as columns on companies table)
            e.OwnsOne(c => c.TimecardSettings, ts =>
            {
                ts.Property(t => t.TimecardMode)
                    .HasColumnName("TimecardMode")
                    .HasConversion<int>()
                    .HasDefaultValue(TimecardMode.Daily);

                ts.Property(t => t.WeeklyEntryMode)
                    .HasColumnName("WeeklyEntryMode")
                    .HasConversion<int>()
                    .HasDefaultValue(WeeklyEntryMode.Detailed);

                ts.Property(t => t.DefaultProjectId)
                    .HasColumnName("DefaultProjectId");

                ts.Property(t => t.RequirePhase)
                    .HasColumnName("RequirePhase")
                    .HasDefaultValue(false);

                ts.Property(t => t.RequireEquipment)
                    .HasColumnName("RequireEquipment")
                    .HasDefaultValue(false);
            });

            // OvertimeSettings as owned entity (stored as columns on companies table)
            e.OwnsOne(c => c.OvertimeSettings, ot =>
            {
                ot.Property(o => o.Enabled)
                    .HasColumnName("OtEnabled")
                    .HasDefaultValue(true);

                ot.Property(o => o.DailyOtThreshold)
                    .HasColumnName("DailyOtThreshold")
                    .HasPrecision(5, 2)
                    .HasDefaultValue(8m);

                ot.Property(o => o.WeeklyOtThreshold)
                    .HasColumnName("WeeklyOtThreshold")
                    .HasPrecision(5, 2)
                    .HasDefaultValue(40m);

                ot.Property(o => o.DailyDtThreshold)
                    .HasColumnName("DailyDtThreshold")
                    .HasPrecision(5, 2)
                    .HasDefaultValue(12m);

                ot.Property(o => o.CaliforniaOtRules)
                    .HasColumnName("CaliforniaOtRules")
                    .HasDefaultValue(false);
            });
        });

        // UserCompanyAccess configuration
        builder.Entity<UserCompanyAccess>(e =>
        {
            e.ToTable("user_company_access");
            e.HasKey(uca => uca.Id);
            e.HasOne(uca => uca.User)
                .WithMany()
                .HasForeignKey(uca => uca.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(uca => uca.Company)
                .WithMany()
                .HasForeignKey(uca => uca.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(uca => uca.CompanyRole).HasMaxLength(50);
            e.HasIndex(uca => new { uca.TenantId, uca.UserId, uca.CompanyId }).IsUnique();
        });

        // AppUser configuration
        builder.Entity<AppUser>(e =>
        {
            e.HasOne(u => u.Tenant)
                .WithMany()
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(u => new { u.TenantId, u.Email });
        });

        // AppRole configuration
        builder.Entity<AppRole>(e =>
        {
            e.HasIndex(r => new { r.TenantId, r.Name });
        });

        // Apply module-specific configurations FIRST so all entity types are registered
        // before we apply global query filters. Entities discovered only through
        // IEntityTypeConfiguration (e.g., Equipment) would be missed by the filter
        // loop if configurations are applied after it.
        builder.ApplyConfigurationsFromAssembly(typeof(PitbullDbContext).Assembly);
        foreach (var assembly in _moduleAssemblies)
        {
            builder.ApplyConfigurationsFromAssembly(assembly);
        }

        // Apply global query filters for all entities inheriting BaseEntity
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                if (typeof(ICompanyScoped).IsAssignableFrom(entityType.ClrType))
                {
                    // Company-scoped: TenantId + CompanyId + IsDeleted filter
                    builder.Entity(entityType.ClrType)
                        .HasQueryFilter(CreateTenantCompanyAndSoftDeleteFilter(entityType.ClrType));

                    // CompanyId index on company-scoped entity tables
                    builder.Entity(entityType.ClrType)
                        .HasIndex("CompanyId");
                }
                else
                {
                    // Tenant-scoped only: TenantId + IsDeleted filter (existing)
                    builder.Entity(entityType.ClrType)
                        .HasQueryFilter(CreateTenantAndSoftDeleteFilter(entityType.ClrType));
                }

                // Tenant index on every BaseEntity table
                builder.Entity(entityType.ClrType)
                    .HasIndex("TenantId");
            }
        }
    }

    /// <summary>
    /// Auto-populate audit fields on save.
    /// </summary>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var currentUserId = GetCurrentUserId();
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    // Skip tenant ID assignment for special cases during system operations
                    if (_tenantContext.TenantId != Guid.Empty)
                    {
                        entry.Entity.TenantId = _tenantContext.TenantId;
                    }

                    // Auto-set CompanyId for company-scoped entities from session context
                    if (entry.Entity is ICompanyScoped companyScoped
                        && companyScoped.CompanyId == Guid.Empty
                        && _companyContext.IsResolved)
                    {
                        companyScoped.CompanyId = _companyContext.CompanyId;
                    }

                    // Only set CreatedAt if not explicitly set (default DateTime is DateTime.MinValue)
                    if (entry.Entity.CreatedAt == default)
                        entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy = currentUserId;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = currentUserId;
                    break;
                case EntityState.Deleted:
                    // Soft delete: mark as deleted instead of actual removal
                    entry.State = EntityState.Modified;
                    entry.Entity.IsDeleted = true;
                    entry.Entity.DeletedAt = now;
                    entry.Entity.DeletedBy = currentUserId;
                    break;
            }
        }

        // Ensure PostgreSQL session variables are set for RLS before save operations
        if (_tenantContext.TenantId != Guid.Empty)
        {
            try
            {
                await Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT set_config('app.current_tenant', {_tenantContext.TenantId.ToString()}, false);",
                    cancellationToken);

                // Set company session variable for RLS
                var companyIdStr = _companyContext.IsResolved
                    ? _companyContext.CompanyId.ToString()
                    : "";
                await Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT set_config('app.current_company', {companyIdStr}, false);",
                    cancellationToken);
            }
            catch (Exception ex)
            {
                // In unit tests with in-memory providers, this will fail - that's OK
                Console.WriteLine($"[DEBUG] Could not set PostgreSQL session variable: {ex.Message}");
            }
        }

        // Dispatch domain events after save
        var result = await base.SaveChangesAsync(cancellationToken);
        DispatchDomainEvents();
        return result;
    }

    private string GetCurrentUserId()
    {
        var user = httpContextAccessor?.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            // Try to get the user ID from JWT 'sub' claim
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? user.FindFirstValue("sub");

            if (!string.IsNullOrEmpty(userId))
                return userId;
        }

        // Fallback for system operations (migrations, background jobs, etc.)
        return "system";
    }

    private void DispatchDomainEvents()
    {
        var entities = ChangeTracker.Entries<BaseEntity>()
            .Where(e => e.Entity.DomainEvents.Count != 0)
            .Select(e => e.Entity)
            .ToList();

        var domainEvents = entities.SelectMany(e => e.DomainEvents).ToList();
        entities.ForEach(e => e.ClearDomainEvents());

        // Dispatch domain events via MediatR (if available)
        if (mediator != null)
        {
            foreach (var domainEvent in domainEvents)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await mediator.Publish(domainEvent);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[PitbullDbContext] Domain event handling failed: {ex.GetType().Name}: {ex.Message}");
                    }
                });
            }
        }
    }

    /// <summary>
    /// Creates a query filter that enforces both tenant isolation and soft delete.
    /// Used for tenant-scoped entities (NOT company-scoped).
    /// </summary>
    private System.Linq.Expressions.LambdaExpression CreateTenantAndSoftDeleteFilter(Type entityType)
    {
        var parameter = System.Linq.Expressions.Expression.Parameter(entityType, "e");

        var isDeletedProperty = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.IsDeleted));
        var notDeletedCondition = System.Linq.Expressions.Expression.Equal(
            isDeletedProperty,
            System.Linq.Expressions.Expression.Constant(false));

        var tenantIdProperty = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.TenantId));
        var currentTenantCondition = System.Linq.Expressions.Expression.Equal(
            tenantIdProperty,
            System.Linq.Expressions.Expression.Property(
                System.Linq.Expressions.Expression.Field(System.Linq.Expressions.Expression.Constant(this), nameof(_tenantContext)),
                nameof(ITenantContext.TenantId)));

        var combinedCondition = System.Linq.Expressions.Expression.AndAlso(
            notDeletedCondition,
            currentTenantCondition);

        return System.Linq.Expressions.Expression.Lambda(combinedCondition, parameter);
    }

    /// <summary>
    /// Creates a query filter that enforces tenant + company isolation + soft delete.
    /// When CompanyContext.CompanyId == Guid.Empty, allows all companies within tenant.
    /// </summary>
    private System.Linq.Expressions.LambdaExpression CreateTenantCompanyAndSoftDeleteFilter(Type entityType)
    {
        var parameter = System.Linq.Expressions.Expression.Parameter(entityType, "e");

        // !IsDeleted
        var isDeletedProperty = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.IsDeleted));
        var notDeletedCondition = System.Linq.Expressions.Expression.Equal(
            isDeletedProperty,
            System.Linq.Expressions.Expression.Constant(false));

        // TenantId == tenantContext.TenantId
        var tenantIdProperty = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.TenantId));
        var currentTenantCondition = System.Linq.Expressions.Expression.Equal(
            tenantIdProperty,
            System.Linq.Expressions.Expression.Property(
                System.Linq.Expressions.Expression.Field(System.Linq.Expressions.Expression.Constant(this), nameof(_tenantContext)),
                nameof(ITenantContext.TenantId)));

        // companyContext.CompanyId
        var companyContextField = System.Linq.Expressions.Expression.Field(System.Linq.Expressions.Expression.Constant(this), nameof(_companyContext));
        var companyContextCompanyId = System.Linq.Expressions.Expression.Property(
            companyContextField,
            nameof(ICompanyContext.CompanyId));

        // CompanyId (on entity)
        var companyIdProperty = System.Linq.Expressions.Expression.Property(parameter, nameof(ICompanyScoped.CompanyId));

        // companyContext.CompanyId == Guid.Empty (means: no company filter, show all)
        var noCompanyFilter = System.Linq.Expressions.Expression.Equal(
            companyContextCompanyId,
            System.Linq.Expressions.Expression.Constant(Guid.Empty));

        // entity.CompanyId == companyContext.CompanyId
        var companyMatch = System.Linq.Expressions.Expression.Equal(
            companyIdProperty,
            companyContextCompanyId);

        // (no filter) OR (match)
        var companyCondition = System.Linq.Expressions.Expression.OrElse(
            noCompanyFilter,
            companyMatch);

        // !IsDeleted AND TenantId match AND (no company filter OR CompanyId match)
        var combinedCondition = System.Linq.Expressions.Expression.AndAlso(
            System.Linq.Expressions.Expression.AndAlso(
                notDeletedCondition,
                currentTenantCondition),
            companyCondition);

        return System.Linq.Expressions.Expression.Lambda(combinedCondition, parameter);
    }
}
