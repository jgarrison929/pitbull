using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Data;

/// <summary>
/// EF Core SaveChanges interceptor that automatically captures all entity
/// creates, updates, and deletes as audit log entries with before/after diffs.
/// </summary>
public class AuditInterceptor(
    ITenantContext tenantContext,
    IHttpContextAccessor httpContextAccessor) : SaveChangesInterceptor
{
    // Prevent re-entrancy when we save audit logs themselves
    private bool _isSaving;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    // Entity types to skip auditing (audit logs themselves, identity tables, etc.)
    private static readonly HashSet<string> SkippedTypes =
    [
        nameof(AuditLog),
        "IdentityUserToken`1",
        "IdentityUserLogin`1",
        "IdentityUserClaim`1",
        "IdentityRoleClaim`1"
    ];

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (_isSaving || eventData.Context is not PitbullDbContext db)
            return await base.SavingChangesAsync(eventData, result, cancellationToken);

        var auditEntries = CollectAuditEntries(db);

        // Store pending entries using AsyncLocal for retrieval in SavedChangesAsync
        PendingAuditEntries.Value = auditEntries;

        return await base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        if (_isSaving || eventData.Context is not PitbullDbContext db)
            return await base.SavedChangesAsync(eventData, result, cancellationToken);

        var auditEntries = PendingAuditEntries.Value;
        PendingAuditEntries.Value = null;

        if (auditEntries is { Count: > 0 })
        {
            // Finalize entries that were waiting for DB-generated IDs
            var logs = new List<AuditLog>();
            foreach (var entry in auditEntries)
            {
                // For Added entities, the ID is now available after save
                if (entry.EntityId == null && entry.EntityEntry != null)
                {
                    var idProp = entry.EntityEntry.Properties
                        .FirstOrDefault(p => p.Metadata.Name == "Id");
                    if (idProp != null)
                        entry.EntityId = idProp.CurrentValue?.ToString();
                }

                logs.Add(entry.ToAuditLog());
            }

            // Save audit logs in a separate call to avoid infinite recursion
            _isSaving = true;
            try
            {
                db.Set<AuditLog>().AddRange(logs);
                await db.SaveChangesAsync(cancellationToken);
            }
            finally
            {
                _isSaving = false;
            }
        }

        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    private List<AuditEntry> CollectAuditEntries(PitbullDbContext db)
    {
        var entries = new List<AuditEntry>();
        var tenantId = tenantContext.TenantId;

        if (tenantId == Guid.Empty)
            return entries;

        var (userId, userEmail, userName, ipAddress, userAgent) = GetUserInfo();

        foreach (var entityEntry in db.ChangeTracker.Entries())
        {
            if (entityEntry.State == EntityState.Detached ||
                entityEntry.State == EntityState.Unchanged)
                continue;

            var entityType = entityEntry.Entity.GetType();
            var typeName = entityType.Name;

            if (SkippedTypes.Contains(typeName))
                continue;

            // Skip owned entities (they're part of their parent)
            if (entityEntry.Metadata.IsOwned())
                continue;

            var entry = new AuditEntry
            {
                TenantId = tenantId,
                UserId = userId,
                UserEmail = userEmail,
                UserName = userName,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                ResourceType = typeName,
                EntityEntry = entityEntry
            };

            switch (entityEntry.State)
            {
                case EntityState.Added:
                    entry.Action = AuditAction.Create;
                    entry.Description = $"Created {typeName}";
                    entry.Changes = CaptureAddedValues(entityEntry);
                    break;

                case EntityState.Modified:
                    entry.Action = AuditAction.Update;
                    var (changes, changedProps) = CaptureModifiedValues(entityEntry);
                    if (changes.Count == 0)
                        continue; // No actual changes
                    entry.Changes = changes;
                    entry.Description = $"Updated {typeName}: {string.Join(", ", changedProps)}";
                    break;

                case EntityState.Deleted:
                    entry.Action = AuditAction.Delete;
                    entry.Description = $"Deleted {typeName}";
                    entry.Changes = CaptureDeletedValues(entityEntry);
                    break;

                default:
                    continue;
            }

            // Try to get entity ID (may be null for Added entities before save)
            var idProperty = entityEntry.Properties
                .FirstOrDefault(p => p.Metadata.Name == "Id");
            if (idProperty?.CurrentValue != null)
                entry.EntityId = idProperty.CurrentValue.ToString();

            entries.Add(entry);
        }

        return entries;
    }

    private static Dictionary<string, PropertyChange> CaptureAddedValues(EntityEntry entry)
    {
        var changes = new Dictionary<string, PropertyChange>();
        foreach (var prop in entry.Properties)
        {
            if (ShouldSkipProperty(prop))
                continue;
            changes[prop.Metadata.Name] = new PropertyChange
            {
                NewValue = SerializeValue(prop.CurrentValue)
            };
        }
        return changes;
    }

    private static (Dictionary<string, PropertyChange> Changes, List<string> ChangedProps) CaptureModifiedValues(EntityEntry entry)
    {
        var changes = new Dictionary<string, PropertyChange>();
        var changedProps = new List<string>();

        foreach (var prop in entry.Properties)
        {
            if (ShouldSkipProperty(prop))
                continue;

            if (!prop.IsModified)
                continue;

            var original = SerializeValue(prop.OriginalValue);
            var current = SerializeValue(prop.CurrentValue);

            if (original == current)
                continue;

            changes[prop.Metadata.Name] = new PropertyChange
            {
                OldValue = original,
                NewValue = current
            };
            changedProps.Add(prop.Metadata.Name);
        }

        return (changes, changedProps);
    }

    private static Dictionary<string, PropertyChange> CaptureDeletedValues(EntityEntry entry)
    {
        var changes = new Dictionary<string, PropertyChange>();
        foreach (var prop in entry.Properties)
        {
            if (ShouldSkipProperty(prop))
                continue;
            changes[prop.Metadata.Name] = new PropertyChange
            {
                OldValue = SerializeValue(prop.OriginalValue)
            };
        }
        return changes;
    }

    private static bool ShouldSkipProperty(PropertyEntry prop)
    {
        // Skip shadow properties and navigation-related fields
        var name = prop.Metadata.Name;
        return name is "xmin" or "TenantId" or "CompanyId"
            || prop.Metadata.IsShadowProperty();
    }

    private static string? SerializeValue(object? value)
    {
        if (value == null) return null;
        if (value is DateTime dt) return dt.ToString("O");
        if (value is DateTimeOffset dto) return dto.ToString("O");
        if (value is Guid g) return g.ToString();
        if (value is Enum e) return e.ToString();
        return value.ToString();
    }

    private (Guid? UserId, string? Email, string? Name, string? Ip, string? Agent) GetUserInfo()
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext == null)
            return (null, null, "System", null, null);

        var user = httpContext.User;
        Guid? userId = null;
        string? email = null;
        string? name = null;

        if (user?.Identity?.IsAuthenticated == true)
        {
            var sub = user.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? user.FindFirstValue("sub");
            if (Guid.TryParse(sub, out var uid))
                userId = uid;

            email = user.FindFirstValue(ClaimTypes.Email)
                   ?? user.FindFirstValue("email");
            name = user.FindFirstValue("full_name")
                  ?? user.FindFirstValue(ClaimTypes.Name);
        }

        var ip = httpContext.Connection.RemoteIpAddress?.ToString();
        var agent = httpContext.Request.Headers.UserAgent.ToString();
        if (string.IsNullOrEmpty(agent)) agent = null;

        return (userId, email, name, ip, agent);
    }

    // Thread-safe storage for pending audit entries between SavingChanges and SavedChanges
    private static readonly AsyncLocal<List<AuditEntry>?> PendingAuditEntries = new();
}

internal class AuditEntry
{
    public Guid TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public AuditAction Action { get; set; }
    public string ResourceType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string Description { get; set; } = string.Empty;
    public Dictionary<string, PropertyChange>? Changes { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    // Retained temporarily to read generated IDs after save
    public EntityEntry? EntityEntry { get; set; }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public AuditLog ToAuditLog()
    {
        string? changesJson = Changes is { Count: > 0 }
            ? JsonSerializer.Serialize(Changes, JsonOptions)
            : null;

        return AuditLog.Create(
            tenantId: TenantId,
            userId: UserId,
            userEmail: UserEmail,
            userName: UserName,
            action: Action,
            resourceType: ResourceType,
            resourceId: EntityId,
            description: Description,
            changes: changesJson,
            ipAddress: IpAddress,
            userAgent: UserAgent);
    }
}

internal class PropertyChange
{
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
}
