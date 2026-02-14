namespace Pitbull.Core.MultiTenancy;

/// <summary>
/// Provides the current company context for the request.
/// Set by CompanyMiddleware from header/JWT/user default.
/// </summary>
public interface ICompanyContext
{
    Guid CompanyId { get; }
    string CompanyCode { get; }
    string CompanyName { get; }
    bool IsResolved { get; }

    /// <summary>
    /// All company IDs the current user has access to (cached per request).
    /// Used for cross-company queries and access validation.
    /// </summary>
    IReadOnlyList<Guid> AccessibleCompanyIds { get; }
}

/// <summary>
/// Mutable company context set by middleware.
/// </summary>
public class CompanyContext : ICompanyContext
{
    public Guid CompanyId { get; set; }
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public bool IsResolved => CompanyId != Guid.Empty;

    private List<Guid> _accessibleCompanyIds = [];
    public IReadOnlyList<Guid> AccessibleCompanyIds => _accessibleCompanyIds.AsReadOnly();

    public void SetAccessibleCompanies(IEnumerable<Guid> companyIds)
    {
        _accessibleCompanyIds = companyIds.ToList();
    }
}
