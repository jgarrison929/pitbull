using System.Security.Claims;
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
/// Applies global query filters for multi-tenancy and soft deletes.
/// </summary>
public class PitbullDbContext(
    DbContextOptions<PitbullDbContext> options,
    ITenantContext tenantContext,
    IHttpContextAccessor? httpContextAccessor = null)
    : IdentityDbContext<AppUser, AppRole, Guid>(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();

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

        // Apply global query filters for all entities inheriting BaseEntity
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                // Combined tenant isolation + soft delete filter (defense in depth)
                builder.Entity(entityType.ClrType)
                    .HasQueryFilter(CreateTenantAndSoftDeleteFilter(entityType.ClrType));

                // Tenant index on every BaseEntity table
                builder.Entity(entityType.ClrType)
                    .HasIndex("TenantId");
            }
        }

        // Apply module-specific configurations
        builder.ApplyConfigurationsFromAssembly(typeof(PitbullDbContext).Assembly);
        foreach (var assembly in _moduleAssemblies)
        {
            builder.ApplyConfigurationsFromAssembly(assembly);
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
                    entry.Entity.TenantId = tenantContext.TenantId;
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

        // Domain events will be dispatched via MediatR
        // This requires IMediator to be injected - will add in next iteration
        // TODO: Implement actual domain event dispatching when MediatR is available
    }

    /// <summary>
    /// Creates a query filter that enforces both tenant isolation and soft delete.
    /// This provides defense-in-depth security alongside PostgreSQL RLS policies.
    /// </summary>
    private System.Linq.Expressions.LambdaExpression CreateTenantAndSoftDeleteFilter(Type entityType)
    {
        var parameter = System.Linq.Expressions.Expression.Parameter(entityType, "e");
        
        // Condition 1: IsDeleted == false (soft delete)
        var isDeletedProperty = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.IsDeleted));
        var notDeletedCondition = System.Linq.Expressions.Expression.Equal(
            isDeletedProperty,
            System.Linq.Expressions.Expression.Constant(false));
        
        // Condition 2: TenantId == Current Tenant (tenant isolation)
        var tenantIdProperty = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.TenantId));
        var currentTenantCondition = System.Linq.Expressions.Expression.Equal(
            tenantIdProperty,
            System.Linq.Expressions.Expression.Property(
                System.Linq.Expressions.Expression.Field(null, typeof(PitbullDbContext), nameof(tenantContext)),
                nameof(ITenantContext.TenantId)));
        
        // Combine both conditions with AND
        var combinedCondition = System.Linq.Expressions.Expression.AndAlso(
            notDeletedCondition,
            currentTenantCondition);
            
        return System.Linq.Expressions.Expression.Lambda(combinedCondition, parameter);
    }
}
