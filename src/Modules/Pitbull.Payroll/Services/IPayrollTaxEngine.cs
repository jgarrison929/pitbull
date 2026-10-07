using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Payroll.Services;

/// <summary>
/// US tax overlay pack adapter. Pitbull owns hours, union rates, and certified payroll.
/// Tax content and calculation are a vendor system of record. No in-house 3000-jurisdiction engine.
/// </summary>
public interface IPayrollTaxEngine
{
    string OverlayPack { get; }
    bool IsConfigured { get; }

    Task<Result<PayrollTaxCalculationResult>> CalculateAsync(
        PayrollTaxCalculationRequest request,
        CancellationToken cancellationToken = default);
}

public sealed record EmployeeTaxProfile(
    Guid EmployeeId,
    W4FilingStatus FilingStatus,
    decimal AdditionalWithholding,
    bool Exempt,
    string? ResidenceState,
    string? ResidenceLocality);

public sealed record EmployeeWageSlice(
    Guid EmployeeId,
    decimal GrossPay,
    string? WorkState,
    Guid? ProjectId);

public sealed record PayrollTaxCalculationRequest(
    Guid PayrollRunId,
    DateOnly PayDate,
    IReadOnlyList<EmployeeWageSlice> Wages,
    IReadOnlyList<EmployeeTaxProfile> TaxProfiles,
    Guid? TaxTableVersionId);

public sealed record PayrollTaxComponent(
    Guid EmployeeId,
    string ComponentCode,
    decimal Amount);

public sealed record PayrollTaxCalculationResult(
    Guid? TaxTableVersionId,
    IReadOnlyList<PayrollTaxComponent> Components,
    IReadOnlyDictionary<Guid, decimal> NetByEmployee);
