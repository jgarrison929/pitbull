using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.RFIs.Features.ListRfis;
using Pitbull.RFIs.Features.UpdateRfi;

namespace Pitbull.RFIs.Services;

public class RfiService : IRfiService
{
    private readonly PitbullDbContext _db;
    private readonly IValidator<CreateRfiCommand> _createValidator;
    private readonly IValidator<UpdateRfiCommand> _updateValidator;
    private readonly ILogger<RfiService> _logger;

    public RfiService(
        PitbullDbContext db,
        IValidator<CreateRfiCommand> createValidator,
        IValidator<UpdateRfiCommand> updateValidator,
        ILogger<RfiService> logger)
    {
        _db = db;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _logger = logger;
    }

    public async Task<Result<RfiDto>> GetRfiAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var rfi = await _db.Set<Rfi>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, cancellationToken);

        if (rfi is null)
            return Result.Failure<RfiDto>("RFI not found", "NOT_FOUND");

        return Result.Success(MapToDto(rfi));
    }

    public async Task<Result<PagedResult<RfiDto>>> GetRfisAsync(ListRfisQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Rfi>()
            .Where(r => !r.IsDeleted)
            .AsNoTracking();

        // Filter by project (required)
        dbQuery = dbQuery.Where(r => r.ProjectId == query.ProjectId);

        // Filter by status if specified
        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(r => r.Status == query.Status.Value);

        // Search functionality
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchTerm = query.Search.ToLower();
            dbQuery = dbQuery.Where(r =>
                r.Subject.ToLower().Contains(searchTerm.ToLower()) ||
                r.Question.ToLower().Contains(searchTerm));
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var rfis = await dbQuery
            .OrderByDescending(r => r.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToArrayAsync(cancellationToken);

        var dtos = rfis.Select(MapToDto).ToArray();
        var result = new PagedResult<RfiDto>(dtos, totalCount, query.Page, query.PageSize);
        return Result.Success(result);
    }

    public async Task<Result<RfiDto>> CreateRfiAsync(CreateRfiCommand command, CancellationToken cancellationToken = default)
    {
        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<RfiDto>(errors, "VALIDATION_ERROR");
        }

        // Auto-assign next sequential number for this project (from CreateRfiHandler logic)
        var maxNumber = await _db.Set<Rfi>()
            .Where(r => r.ProjectId == command.ProjectId)
            .MaxAsync(r => (int?)r.Number, cancellationToken) ?? 0;

        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = maxNumber + 1,
            Subject = command.Subject,
            Question = command.Question,
            Priority = command.Priority,
            DueDate = command.DueDate,
            ProjectId = command.ProjectId,
            Status = RfiStatus.Open,
            AssignedToUserId = command.AssignedToUserId,
            AssignedToName = command.AssignedToName,
            BallInCourtUserId = command.BallInCourtUserId ?? command.AssignedToUserId,
            BallInCourtName = command.BallInCourtName ?? command.AssignedToName,
            CreatedByName = command.CreatedByName,
            CreatedAt = DateTime.UtcNow
        };

        _db.Set<Rfi>().Add(rfi);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(rfi));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create RFI '{Subject}' for project {ProjectId}", command.Subject, command.ProjectId);
            return Result.Failure<RfiDto>("Failed to create RFI", "DATABASE_ERROR");
        }
    }

    public async Task<Result<RfiDto>> UpdateRfiAsync(UpdateRfiCommand command, CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<RfiDto>(errors, "VALIDATION_ERROR");
        }

        var rfi = await _db.Set<Rfi>()
            .FirstOrDefaultAsync(r => r.Id == command.Id, cancellationToken);

        if (rfi is null)
            return Result.Failure<RfiDto>("RFI not found", "NOT_FOUND");

        rfi.Subject = command.Subject;
        rfi.Question = command.Question;
        rfi.Priority = command.Priority;
        rfi.DueDate = command.DueDate;
        rfi.Status = command.Status;
        rfi.Answer = command.Answer;
        rfi.AnsweredAt = command.Answer is null ? rfi.AnsweredAt : DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(rfi));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<RfiDto>("RFI was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update RFI {RfiId}", command.Id);
            return Result.Failure<RfiDto>("Failed to update RFI", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteRfiAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var rfi = await _db.Set<Rfi>()
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, cancellationToken);

        if (rfi is null)
            return Result.Failure("RFI not found", "NOT_FOUND");

        rfi.IsDeleted = true;
        rfi.DeletedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete RFI {RfiId}", id);
            return Result.Failure("Failed to delete RFI", "DATABASE_ERROR");
        }
    }

    public async Task<Result<RfiCostImpactDto>> GetRfiCostImpactAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var rfi = await _db.Set<Rfi>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, cancellationToken);

        if (rfi is null)
            return Result.Failure<RfiCostImpactDto>("RFI not found", "NOT_FOUND");

        // Get linked change orders
        var changeOrders = await _db.Set<ChangeOrder>()
            .AsNoTracking()
            .Where(co => co.OriginatingRfiId == id && !co.IsDeleted)
            .OrderBy(co => co.CreatedAt)
            .ToListAsync(cancellationToken);

        // Calculate costs
        var directCost = changeOrders.Sum(co => co.Amount);
        var delayCost = changeOrders.Sum(co => co.DelayCost ?? 0);
        var totalCost = directCost + delayCost;

        // Calculate time metrics
        var now = DateTime.UtcNow;
        var closedOrNow = rfi.ClosedAt ?? now;
        var daysOpen = (int)(closedOrNow - rfi.CreatedAt).TotalDays;

        int? responseDelayDays = null;
        if (rfi.DueDate.HasValue && rfi.AnsweredAt.HasValue)
        {
            var delay = (rfi.AnsweredAt.Value - rfi.DueDate.Value).TotalDays;
            if (delay > 0)
                responseDelayDays = (int)delay;
        }

        // Build timeline
        var timeline = BuildTimeline(rfi, changeOrders);

        // Map change orders
        var linkedCOs = changeOrders.Select(co => new LinkedChangeOrderDto(
            co.Id,
            co.ChangeOrderNumber,
            co.Title,
            co.Amount,
            co.DelayDays,
            co.DelayCost,
            co.Status.ToString(),
            co.ApprovedDate
        )).ToList();

        return Result.Success(new RfiCostImpactDto(
            RfiId: rfi.Id,
            RfiNumber: rfi.Number,
            Subject: rfi.Subject,
            Status: rfi.Status.ToString(),
            DaysOpen: daysOpen,
            ResponseDelayDays: responseDelayDays,
            CreatedAt: rfi.CreatedAt,
            DueDate: rfi.DueDate,
            AnsweredAt: rfi.AnsweredAt,
            ClosedAt: rfi.ClosedAt,
            DirectCost: directCost,
            DelayCost: delayCost,
            TotalCost: totalCost,
            ChangeOrders: linkedCOs,
            Timeline: timeline
        ));
    }

    private static List<RfiTimelineEventDto> BuildTimeline(Rfi rfi, List<ChangeOrder> changeOrders)
    {
        var events = new List<RfiTimelineEventDto>
        {
            new(rfi.CreatedAt, "RFI Created", rfi.CreatedByName, null)
        };

        if (rfi.DueDate.HasValue)
        {
            events.Add(new(rfi.DueDate.Value, "Due Date", null, null));
        }

        if (rfi.AnsweredAt.HasValue)
        {
            var details = rfi.DueDate.HasValue && rfi.AnsweredAt > rfi.DueDate
                ? $"{(int)(rfi.AnsweredAt.Value - rfi.DueDate.Value).TotalDays} days late"
                : null;
            events.Add(new(rfi.AnsweredAt.Value, "Answer Received", null, details));
        }

        foreach (var co in changeOrders)
        {
            events.Add(new(co.CreatedAt, "Change Order Created", null, $"{co.ChangeOrderNumber}: {co.Title}"));

            if (co.ApprovedDate.HasValue)
            {
                events.Add(new(co.ApprovedDate.Value, "Change Order Approved", co.ApprovedBy, co.ChangeOrderNumber));
            }
        }

        if (rfi.ClosedAt.HasValue)
        {
            events.Add(new(rfi.ClosedAt.Value, "RFI Closed", null, null));
        }

        return events.OrderBy(e => e.Date).ToList();
    }

    private static RfiDto MapToDto(Rfi rfi)
    {
        return new RfiDto(
            rfi.Id,
            rfi.Number,
            rfi.Subject,
            rfi.Question,
            rfi.Answer,
            rfi.Status,
            rfi.Priority,
            rfi.DueDate,
            rfi.AnsweredAt,
            rfi.ClosedAt,
            rfi.ProjectId,
            rfi.BallInCourtUserId,
            rfi.BallInCourtName,
            rfi.AssignedToUserId,
            rfi.AssignedToName,
            rfi.CreatedByName,
            rfi.CreatedAt
        );
    }
}
