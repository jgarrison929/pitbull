namespace Pitbull.Core.Domain;

/// <summary>
/// Marker interface for entities that belong to a specific company.
/// Entities implementing this have a CompanyId column and participate
/// in company-level query filtering and RLS enforcement.
/// </summary>
public interface ICompanyScoped
{
    Guid CompanyId { get; set; }
}
