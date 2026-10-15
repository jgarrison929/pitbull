using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Services;

public sealed record IngestTaxTableVersionCommand(
    PayrollTaxVendor Vendor,
    string Jurisdiction,
    DateOnly EffectiveDate,
    string ContentHash,
    string? Notes = null);

public interface ITaxTableVersionIngestService
{
    Task<Result<TaxTableVersion>> IngestAsync(
        IngestTaxTableVersionCommand command,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Records vendor snapshot metadata. This is not an IRS scrape and does not store percentage tables.
/// </summary>
public sealed class TaxTableVersionIngestService(
    PitbullDbContext db,
    ILogger<TaxTableVersionIngestService> logger) : ITaxTableVersionIngestService
{
    public async Task<Result<TaxTableVersion>> IngestAsync(
        IngestTaxTableVersionCommand command,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Jurisdiction))
            return Result.Failure<TaxTableVersion>("Jurisdiction is required", "VALIDATION_ERROR");

        if (string.IsNullOrWhiteSpace(command.ContentHash))
            return Result.Failure<TaxTableVersion>("Content hash is required", "VALIDATION_ERROR");

        TaxTableVersion version = new()
        {
            Vendor = command.Vendor,
            Jurisdiction = command.Jurisdiction.Trim(),
            EffectiveDate = command.EffectiveDate,
            ContentHash = command.ContentHash.Trim(),
            ImportedAt = DateTime.UtcNow,
            Notes = command.Notes
        };

        db.Set<TaxTableVersion>().Add(version);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(version);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to ingest tax table version for {Vendor} {Jurisdiction}", command.Vendor, command.Jurisdiction);
            return Result.Failure<TaxTableVersion>("Failed to ingest tax table version", "DATABASE_ERROR");
        }
    }
}
