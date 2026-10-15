using Microsoft.Extensions.Options;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Services;

/// <summary>
/// Check-class embeddable payroll/tax stub. Does not call live APIs and does not invent WH-347 percents.
/// Fail closed when a vendor is selected without credentials.
/// </summary>
public sealed class CheckPayrollTaxEngine(IOptions<PayrollTaxOptions> options) : IPayrollTaxEngine
{
    public const string OverlayPackName = "us_tax";

    private readonly PayrollTaxOptions _options = options.Value;

    public string OverlayPack => OverlayPackName;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.Vendor);

    public Task<Result<PayrollTaxCalculationResult>> CalculateAsync(
        PayrollTaxCalculationRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _ = request;

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            return Task.FromResult(Result.Failure<PayrollTaxCalculationResult>(
                "Payroll tax vendor credentials are not configured. Tax amounts will not be invented.",
                "TAX_VENDOR_NOT_CONFIGURED"));
        }

        return Task.FromResult(Result.Failure<PayrollTaxCalculationResult>(
            "Check-class tax adapter is a stub and does not call live vendor APIs. Net remains a proxy until a real vendor client is wired.",
            "TAX_VENDOR_NOT_IMPLEMENTED"));
    }
}

public sealed class PayrollTaxOptions
{
    public const string SectionName = "Payroll:Tax";

    /// <summary>Vendor id: check, symmetry, vertex, adp, paychex. Empty means tax pack is not wired.</summary>
    public string Vendor { get; set; } = string.Empty;

    /// <summary>Vendor API credential. Never invent tax when this is missing.</summary>
    public string? ApiKey { get; set; }
}
