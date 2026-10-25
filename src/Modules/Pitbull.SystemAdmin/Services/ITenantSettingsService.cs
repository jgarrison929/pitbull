using Pitbull.Core.CQRS;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Services;

public interface ITenantSettingsService
{
    Task<Result<TenantSettingsDto>> GetSettingsAsync(CancellationToken ct = default);
    Task<Result<TenantSettingsDto>> UpsertSettingsAsync(UpsertTenantSettingsCommand command, CancellationToken ct = default);
}

public record TenantSettingsDto(
    Guid Id,
    string CompanyName,
    string? LogoUrl,
    string? PrimaryColor,
    string? Address,
    string? City,
    string? State,
    string? ZipCode,
    string? Phone,
    string? Website,
    string? TaxId,
    string Timezone,
    string DateFormat,
    string Currency,
    int FiscalYearStartMonth,
    bool EnableTimeTracking,
    bool EnableBidManagement,
    bool EnableDocumentManagement,
    bool EnableSubcontractorPortal
);

public record UpsertTenantSettingsCommand(
    string CompanyName,
    string? LogoUrl,
    string? PrimaryColor,
    string? Address,
    string? City,
    string? State,
    string? ZipCode,
    string? Phone,
    string? Website,
    string? TaxId,
    string? Timezone,
    string? DateFormat,
    string? Currency,
    int? FiscalYearStartMonth,
    bool? EnableTimeTracking,
    bool? EnableBidManagement,
    bool? EnableDocumentManagement,
    bool? EnableSubcontractorPortal
);
