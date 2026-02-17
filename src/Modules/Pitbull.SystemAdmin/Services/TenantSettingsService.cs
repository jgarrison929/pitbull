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
        var settings = await db.Set<TenantSettings>().FirstOrDefaultAsync(ct);

        if (settings is null)
        {
            settings = new TenantSettings();
            db.Set<TenantSettings>().Add(settings);
        }

        settings.CompanyName = command.CompanyName;
        settings.LogoUrl = command.LogoUrl;
        settings.PrimaryColor = command.PrimaryColor;
        settings.Address = command.Address;
        settings.City = command.City;
        settings.State = command.State;
        settings.ZipCode = command.ZipCode;
        settings.Phone = command.Phone;
        settings.Website = command.Website;
        settings.TaxId = command.TaxId;
        settings.Timezone = command.Timezone ?? "America/Los_Angeles";
        settings.DateFormat = command.DateFormat ?? "MM/dd/yyyy";
        settings.Currency = command.Currency ?? "USD";
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
