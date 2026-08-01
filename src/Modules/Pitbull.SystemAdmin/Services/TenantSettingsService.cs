using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Services;

public class TenantSettingsService(PitbullDbContext db) : ITenantSettingsService
{
    public async Task<Result<TenantSettingsDto>> GetSettingsAsync(CancellationToken ct = default)
    {
        var settings = await db.Set<TenantSettings>()
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (settings is null)
        {
            // Return defaults when no settings row exists yet
            return Result.Success(new TenantSettingsDto(
                Guid.Empty, "My Company", null, null, null, null, null, null, null, null, null,
                "America/Los_Angeles", "MM/dd/yyyy", "USD", 1, true, true, true, false));
        }

        return Result.Success(MapToDto(settings));
    }

    public async Task<Result<TenantSettingsDto>> UpsertSettingsAsync(UpsertTenantSettingsCommand command, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(command.CompanyName))
            return Result.Failure<TenantSettingsDto>("Company name is required", "VALIDATION_ERROR");
        if (command.CompanyName.Trim().Length > 200)
            return Result.Failure<TenantSettingsDto>("Company name cannot exceed 200 characters", "VALIDATION_ERROR");
        if (command.LogoUrl is { Length: > 500 })
            return Result.Failure<TenantSettingsDto>("Logo URL cannot exceed 500 characters", "VALIDATION_ERROR");
        if (command.PrimaryColor is { Length: > 20 })
            return Result.Failure<TenantSettingsDto>("Primary color cannot exceed 20 characters", "VALIDATION_ERROR");
        if (command.Address is { Length: > 300 })
            return Result.Failure<TenantSettingsDto>("Address cannot exceed 300 characters", "VALIDATION_ERROR");
        if (command.City is { Length: > 100 })
            return Result.Failure<TenantSettingsDto>("City cannot exceed 100 characters", "VALIDATION_ERROR");
        if (command.State is { Length: > 50 })
            return Result.Failure<TenantSettingsDto>("State cannot exceed 50 characters", "VALIDATION_ERROR");
        if (command.ZipCode is { Length: > 20 })
            return Result.Failure<TenantSettingsDto>("Zip code cannot exceed 20 characters", "VALIDATION_ERROR");
        if (command.Phone is { Length: > 30 })
            return Result.Failure<TenantSettingsDto>("Phone cannot exceed 30 characters", "VALIDATION_ERROR");
        if (command.Website is { Length: > 200 })
            return Result.Failure<TenantSettingsDto>("Website cannot exceed 200 characters", "VALIDATION_ERROR");
        if (command.TaxId is { Length: > 50 })
            return Result.Failure<TenantSettingsDto>("Tax ID cannot exceed 50 characters", "VALIDATION_ERROR");
        if (command.Timezone is { Length: > 50 })
            return Result.Failure<TenantSettingsDto>("Timezone cannot exceed 50 characters", "VALIDATION_ERROR");
        if (command.DateFormat is { Length: > 20 })
            return Result.Failure<TenantSettingsDto>("Date format cannot exceed 20 characters", "VALIDATION_ERROR");
        if (command.Currency is { Length: > 10 })
            return Result.Failure<TenantSettingsDto>("Currency cannot exceed 10 characters", "VALIDATION_ERROR");
        if (command.FiscalYearStartMonth is < 1 or > 12)
            return Result.Failure<TenantSettingsDto>("Fiscal year start month must be between 1 and 12", "VALIDATION_ERROR");

        var settings = await db.Set<TenantSettings>().FirstOrDefaultAsync(ct);

        if (settings is null)
        {
            settings = new TenantSettings();
            db.Set<TenantSettings>().Add(settings);
        }

        settings.CompanyName = command.CompanyName.Trim();
        settings.LogoUrl = command.LogoUrl?.Trim();
        settings.PrimaryColor = command.PrimaryColor?.Trim();
        settings.Address = command.Address?.Trim();
        settings.City = command.City?.Trim();
        settings.State = command.State?.Trim();
        settings.ZipCode = command.ZipCode?.Trim();
        settings.Phone = command.Phone?.Trim();
        settings.Website = command.Website?.Trim();
        settings.TaxId = command.TaxId?.Trim();
        settings.Timezone = string.IsNullOrWhiteSpace(command.Timezone) ? "America/Los_Angeles" : command.Timezone.Trim();
        settings.DateFormat = string.IsNullOrWhiteSpace(command.DateFormat) ? "MM/dd/yyyy" : command.DateFormat.Trim();
        settings.Currency = string.IsNullOrWhiteSpace(command.Currency) ? "USD" : command.Currency.Trim().ToUpperInvariant();
        settings.FiscalYearStartMonth = command.FiscalYearStartMonth ?? 1;
        settings.EnableTimeTracking = command.EnableTimeTracking ?? true;
        settings.EnableBidManagement = command.EnableBidManagement ?? true;
        settings.EnableDocumentManagement = command.EnableDocumentManagement ?? true;
        settings.EnableSubcontractorPortal = command.EnableSubcontractorPortal ?? false;

        await db.SaveChangesAsync(ct);

        return Result.Success(MapToDto(settings));
    }

    private static TenantSettingsDto MapToDto(TenantSettings s) => new(
        s.Id, s.CompanyName, s.LogoUrl, s.PrimaryColor,
        s.Address, s.City, s.State, s.ZipCode, s.Phone, s.Website, s.TaxId,
        s.Timezone, s.DateFormat, s.Currency, s.FiscalYearStartMonth,
        s.EnableTimeTracking, s.EnableBidManagement, s.EnableDocumentManagement, s.EnableSubcontractorPortal);
}
