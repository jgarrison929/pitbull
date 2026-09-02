using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Services;

public record PayComponentDto(Guid Id, string Code, string Name, PayComponentKind Kind, bool IsTaxable, bool IsFringe, bool IsCash, string OverlayPack);

public record CreatePayComponentCommand(
    string Code,
    string Name,
    PayComponentKind Kind = PayComponentKind.Earning,
    bool IsTaxable = true,
    bool IsFringe = false,
    bool IsCash = true,
    string OverlayPack = "core");

public interface IPayComponentService
{
    Task<Result<IReadOnlyList<PayComponentDto>>> ListAsync(CancellationToken cancellationToken = default);
    Task<Result<PayComponentDto>> CreateAsync(CreatePayComponentCommand command, CancellationToken cancellationToken = default);
}

public class PayComponentService(PitbullDbContext db, ILogger<PayComponentService> logger) : IPayComponentService
{
    public async Task<Result<IReadOnlyList<PayComponentDto>>> ListAsync(CancellationToken cancellationToken = default)
    {
        List<PayComponent> items = await db.Set<PayComponent>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Code)
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<PayComponentDto>>(items.Select(Map).ToList());
    }

    public async Task<Result<PayComponentDto>> CreateAsync(CreatePayComponentCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Code) || string.IsNullOrWhiteSpace(command.Name))
            return Result.Failure<PayComponentDto>("Code and name are required", "VALIDATION_ERROR");

        string code = command.Code.Trim().ToUpperInvariant();
        bool duplicate = await db.Set<PayComponent>().AnyAsync(x => x.Code == code && !x.IsDeleted, cancellationToken);
        if (duplicate)
            return Result.Failure<PayComponentDto>("A pay component with this code already exists", "DUPLICATE_CODE");

        PayComponent entity = new()
        {
            Code = code,
            Name = command.Name.Trim(),
            Kind = command.Kind,
            IsTaxable = command.IsTaxable,
            IsFringe = command.IsFringe,
            IsCash = command.IsCash,
            OverlayPack = string.IsNullOrWhiteSpace(command.OverlayPack) ? "core" : command.OverlayPack.Trim()
        };

        db.Set<PayComponent>().Add(entity);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(Map(entity));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create pay component {Code}", code);
            return Result.Failure<PayComponentDto>("Failed to create pay component", "DATABASE_ERROR");
        }
    }

    private static PayComponentDto Map(PayComponent x) => new(x.Id, x.Code, x.Name, x.Kind, x.IsTaxable, x.IsFringe, x.IsCash, x.OverlayPack);
}
