using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;
using Pitbull.Contracts.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

public interface IComplianceDocumentService
{
    Task<IReadOnlyList<ComplianceDocumentDto>> ListAsync(ComplianceDocumentListQuery query, CancellationToken cancellationToken = default);
    Task<ComplianceDocumentDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ComplianceDocumentDto> CreateAsync(CreateComplianceDocumentRequest request, CancellationToken cancellationToken = default);
    Task<ComplianceDocumentDto?> UpdateAsync(Guid id, UpdateComplianceDocumentRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ComplianceDocumentDto>> GetByEntityAsync(string entityType, Guid entityId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ComplianceDocumentDto>> GetExpiringAsync(int days, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ComplianceDocumentDto>> GetExpiredAsync(CancellationToken cancellationToken = default);
    Task<int> UpdateStatusesAsync(CancellationToken cancellationToken = default);
    Task<ComplianceScoreDto> GetComplianceScoreAsync(string entityType, Guid entityId, CancellationToken cancellationToken = default);
    Task<ComplianceDashboardDto> GetDashboardSummaryAsync(CancellationToken cancellationToken = default);
}

public class ComplianceDocumentService(PitbullDbContext db) : IComplianceDocumentService
{
    private const int DefaultExpiringSoonDays = 30;

    public async Task<IReadOnlyList<ComplianceDocumentDto>> ListAsync(
        ComplianceDocumentListQuery query,
        CancellationToken cancellationToken = default)
    {
        var dbQuery = db.Set<ComplianceDocument>()
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.EntityType))
        {
            dbQuery = dbQuery.Where(x => x.EntityType == query.EntityType);
        }

        if (query.EntityId.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.EntityId == query.EntityId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            dbQuery = dbQuery.Where(x => x.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.DocumentType))
        {
            dbQuery = dbQuery.Where(x => x.DocumentType == query.DocumentType);
        }

        var items = await dbQuery
            .OrderBy(x => x.ExpirationDate ?? DateTime.MaxValue)
            .ThenBy(x => x.DocumentType)
            .ToListAsync(cancellationToken);

        var names = await ResolveEntityNamesAsync(items, cancellationToken);
        return items.Select(x => MapDto(x, names)).ToList();
    }

    public async Task<ComplianceDocumentDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var document = await db.Set<ComplianceDocument>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (document is null)
            return null;

        var names = await ResolveEntityNamesAsync([document], cancellationToken);
        return MapDto(document, names);
    }

    public async Task<ComplianceDocumentDto> CreateAsync(
        CreateComplianceDocumentRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateEntityType(request.EntityType);
        ValidateDocumentType(request.DocumentType);
        ValidateStatus(request.Status);

        var document = new ComplianceDocument
        {
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            DocumentType = request.DocumentType,
            DocumentNumber = request.DocumentNumber,
            IssuedDate = request.IssuedDate,
            ExpirationDate = request.ExpirationDate,
            Status = ResolveStatus(request.Status, request.ExpirationDate),
            FileUrl = request.FileUrl,
            Notes = request.Notes
        };

        db.Set<ComplianceDocument>().Add(document);
        await db.SaveChangesAsync(cancellationToken);

        var names = await ResolveEntityNamesAsync([document], cancellationToken);
        return MapDto(document, names);
    }

    public async Task<ComplianceDocumentDto?> UpdateAsync(
        Guid id,
        UpdateComplianceDocumentRequest request,
        CancellationToken cancellationToken = default)
    {
        var document = await db.Set<ComplianceDocument>()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (document is null)
            return null;

        if (!string.IsNullOrWhiteSpace(request.EntityType))
        {
            ValidateEntityType(request.EntityType);
            document.EntityType = request.EntityType;
        }

        if (request.EntityId.HasValue)
        {
            document.EntityId = request.EntityId.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.DocumentType))
        {
            ValidateDocumentType(request.DocumentType);
            document.DocumentType = request.DocumentType;
        }

        if (!string.IsNullOrWhiteSpace(request.DocumentNumber))
        {
            document.DocumentNumber = request.DocumentNumber;
        }

        if (request.IssuedDate.HasValue)
            document.IssuedDate = request.IssuedDate;

        if (request.ExpirationDate.HasValue)
            document.ExpirationDate = request.ExpirationDate;

        if (request.ClearExpirationDate)
            document.ExpirationDate = null;

        if (request.Status is not null)
        {
            ValidateStatus(request.Status);
            document.Status = ResolveStatus(request.Status, document.ExpirationDate);
        }
        else
        {
            document.Status = ResolveStatus(document.Status, document.ExpirationDate);
        }

        if (request.FileUrl is not null)
            document.FileUrl = request.FileUrl;

        if (request.Notes is not null)
            document.Notes = request.Notes;

        await db.SaveChangesAsync(cancellationToken);

        var names = await ResolveEntityNamesAsync([document], cancellationToken);
        return MapDto(document, names);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var document = await db.Set<ComplianceDocument>()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (document is null)
            return false;

        db.Set<ComplianceDocument>().Remove(document);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<ComplianceDocumentDto>> GetByEntityAsync(
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken = default)
    {
        ValidateEntityType(entityType);

        var items = await db.Set<ComplianceDocument>()
            .AsNoTracking()
            .Where(x => x.EntityType == entityType && x.EntityId == entityId)
            .OrderBy(x => x.ExpirationDate ?? DateTime.MaxValue)
            .ToListAsync(cancellationToken);

        var names = await ResolveEntityNamesAsync(items, cancellationToken);
        return items.Select(x => MapDto(x, names)).ToList();
    }

    public async Task<IReadOnlyList<ComplianceDocumentDto>> GetExpiringAsync(
        int days,
        CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;
        var threshold = today.AddDays(days);

        var items = await db.Set<ComplianceDocument>()
            .AsNoTracking()
            .Where(x =>
                x.Status != "Revoked" &&
                x.ExpirationDate.HasValue &&
                x.ExpirationDate.Value.Date >= today &&
                x.ExpirationDate.Value.Date <= threshold)
            .OrderBy(x => x.ExpirationDate)
            .ToListAsync(cancellationToken);

        var names = await ResolveEntityNamesAsync(items, cancellationToken);
        return items.Select(x => MapDto(x, names)).ToList();
    }

    public async Task<IReadOnlyList<ComplianceDocumentDto>> GetExpiredAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;

        var items = await db.Set<ComplianceDocument>()
            .AsNoTracking()
            .Where(x =>
                x.Status != "Revoked" &&
                x.ExpirationDate.HasValue &&
                x.ExpirationDate.Value.Date < today)
            .OrderByDescending(x => x.ExpirationDate)
            .ToListAsync(cancellationToken);

        var names = await ResolveEntityNamesAsync(items, cancellationToken);
        return items.Select(x => MapDto(x, names)).ToList();
    }

    public async Task<int> UpdateStatusesAsync(CancellationToken cancellationToken = default)
    {
        var documents = await db.Set<ComplianceDocument>()
            .Where(x => x.Status != "Revoked")
            .ToListAsync(cancellationToken);

        var updates = 0;

        foreach (var document in documents)
        {
            var nextStatus = ResolveStatus(document.Status, document.ExpirationDate);
            if (nextStatus == document.Status)
                continue;

            document.Status = nextStatus;
            updates++;
        }

        if (updates > 0)
            await db.SaveChangesAsync(cancellationToken);

        return updates;
    }

    public async Task<ComplianceScoreDto> GetComplianceScoreAsync(
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken = default)
    {
        ValidateEntityType(entityType);

        var requiredTypes = ComplianceDocumentConstants.RequiredDocumentTypesByEntityType.TryGetValue(entityType, out var types)
            ? types
            : [];

        if (requiredTypes.Length == 0)
        {
            return new ComplianceScoreDto(entityType, entityId, 0, 0, 0, 0m);
        }

        var today = DateTime.UtcNow.Date;

        var docs = await db.Set<ComplianceDocument>()
            .AsNoTracking()
            .Where(x => x.EntityType == entityType && x.EntityId == entityId)
            .ToListAsync(cancellationToken);

        var currentTypes = docs
            .Where(x =>
                x.Status != "Revoked" &&
                x.Status != "Expired" &&
                (!x.ExpirationDate.HasValue || x.ExpirationDate.Value.Date >= today))
            .Select(x => x.DocumentType)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var currentCount = requiredTypes.Count(currentTypes.Contains);
        var requiredCount = requiredTypes.Length;
        var missingCount = requiredCount - currentCount;
        var score = requiredCount == 0
            ? 0m
            : Math.Round((decimal)currentCount / requiredCount * 100m, 2);

        return new ComplianceScoreDto(entityType, entityId, requiredCount, currentCount, missingCount, score);
    }

    public async Task<ComplianceDashboardDto> GetDashboardSummaryAsync(CancellationToken cancellationToken = default)
    {
        var total = await db.Set<ComplianceDocument>().CountAsync(cancellationToken);
        var active = await db.Set<ComplianceDocument>().CountAsync(x => x.Status == "Active", cancellationToken);
        var expiringSoon = await db.Set<ComplianceDocument>().CountAsync(x => x.Status == "ExpiringSoon", cancellationToken);
        var expired = await db.Set<ComplianceDocument>().CountAsync(x => x.Status == "Expired", cancellationToken);

        return new ComplianceDashboardDto(total, active, expiringSoon, expired);
    }

    private static ComplianceDocumentDto MapDto(
        ComplianceDocument document,
        IReadOnlyDictionary<Guid, string> namesByEntityId)
    {
        var daysUntilExpiration = document.ExpirationDate.HasValue
            ? (int)Math.Ceiling((document.ExpirationDate.Value.Date - DateTime.UtcNow.Date).TotalDays)
            : (int?)null;

        var entityName = namesByEntityId.TryGetValue(document.EntityId, out var resolvedName)
            ? resolvedName
            : $"{document.EntityType} {document.EntityId.ToString()[..8]}";

        return new ComplianceDocumentDto(
            document.Id,
            document.TenantId,
            document.EntityType,
            document.EntityId,
            document.DocumentType,
            document.DocumentNumber,
            document.IssuedDate,
            document.ExpirationDate,
            document.Status,
            document.FileUrl,
            document.Notes,
            document.CreatedAt,
            document.UpdatedAt,
            daysUntilExpiration,
            entityName);
    }

    private static string ResolveStatus(string? requestedStatus, DateTime? expirationDate)
    {
        if (requestedStatus == "Revoked")
            return "Revoked";

        if (!expirationDate.HasValue)
            return requestedStatus ?? "Active";

        var today = DateTime.UtcNow.Date;
        var expiration = expirationDate.Value.Date;

        if (expiration < today)
            return "Expired";

        if (expiration <= today.AddDays(DefaultExpiringSoonDays))
            return "ExpiringSoon";

        return "Active";
    }

    private static void ValidateEntityType(string entityType)
    {
        if (!ComplianceDocumentConstants.ValidEntityTypes.Contains(entityType))
            throw new ArgumentException($"Invalid entityType '{entityType}'.", nameof(entityType));
    }

    private static void ValidateDocumentType(string documentType)
    {
        if (!ComplianceDocumentConstants.ValidDocumentTypes.Contains(documentType))
            throw new ArgumentException($"Invalid documentType '{documentType}'.", nameof(documentType));
    }

    private static void ValidateStatus(string? status)
    {
        if (status is null)
            return;

        if (!ComplianceDocumentConstants.ValidStatuses.Contains(status))
            throw new ArgumentException($"Invalid status '{status}'.", nameof(status));
    }

    private async Task<IReadOnlyDictionary<Guid, string>> ResolveEntityNamesAsync(
        IReadOnlyCollection<ComplianceDocument> documents,
        CancellationToken cancellationToken)
    {
        if (documents.Count == 0)
            return new Dictionary<Guid, string>();

        var result = new Dictionary<Guid, string>();

        var employeeIds = documents
            .Where(x => x.EntityType == "Employee")
            .Select(x => x.EntityId)
            .Distinct()
            .ToArray();

        if (employeeIds.Length > 0)
        {
            var employees = await db.Set<Employee>()
                .AsNoTracking()
                .Where(x => employeeIds.Contains(x.Id))
                .Select(x => new { x.Id, x.FirstName, x.LastName })
                .ToListAsync(cancellationToken);

            foreach (var employee in employees)
            {
                result[employee.Id] = $"{employee.FirstName} {employee.LastName}".Trim();
            }
        }

        var subcontractorIds = documents
            .Where(x => x.EntityType == "Subcontractor")
            .Select(x => x.EntityId)
            .Distinct()
            .ToArray();

        if (subcontractorIds.Length > 0)
        {
            var subcontracts = await db.Set<Subcontract>()
                .AsNoTracking()
                .Where(x => subcontractorIds.Contains(x.Id))
                .Select(x => new { x.Id, x.SubcontractorName })
                .ToListAsync(cancellationToken);

            foreach (var subcontract in subcontracts)
            {
                result[subcontract.Id] = subcontract.SubcontractorName;
            }
        }

        var companyIds = documents
            .Where(x => x.EntityType == "Company")
            .Select(x => x.EntityId)
            .Distinct()
            .ToArray();

        if (companyIds.Length > 0)
        {
            var companies = await db.Set<Company>()
                .AsNoTracking()
                .Where(x => companyIds.Contains(x.Id))
                .Select(x => new { x.Id, x.Name })
                .ToListAsync(cancellationToken);

            foreach (var company in companies)
            {
                result[company.Id] = company.Name;
            }
        }

        return result;
    }
}

public record ComplianceDocumentListQuery(
    string? EntityType,
    Guid? EntityId,
    string? Status,
    string? DocumentType);

public record CreateComplianceDocumentRequest(
    string EntityType,
    Guid EntityId,
    string DocumentType,
    string DocumentNumber,
    DateTime? IssuedDate,
    DateTime? ExpirationDate,
    string? Status,
    string? FileUrl,
    string? Notes);

public record UpdateComplianceDocumentRequest(
    string? EntityType,
    Guid? EntityId,
    string? DocumentType,
    string? DocumentNumber,
    DateTime? IssuedDate,
    DateTime? ExpirationDate,
    bool ClearExpirationDate,
    string? Status,
    string? FileUrl,
    string? Notes);

public record ComplianceDocumentDto(
    Guid Id,
    Guid TenantId,
    string EntityType,
    Guid EntityId,
    string DocumentType,
    string DocumentNumber,
    DateTime? IssuedDate,
    DateTime? ExpirationDate,
    string Status,
    string? FileUrl,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    int? DaysUntilExpiration,
    string EntityName);

public record ComplianceScoreDto(
    string EntityType,
    Guid EntityId,
    int RequiredCount,
    int CurrentCount,
    int MissingCount,
    decimal ScorePercent);

public record ComplianceDashboardDto(
    int Total,
    int Active,
    int ExpiringSoon,
    int Expired);
