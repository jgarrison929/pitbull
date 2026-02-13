using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features;
using Pitbull.Bids.Features.Shared;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.ConvertBidToProject;

namespace Pitbull.Bids.Services;

public class BidService : IBidService
{
    private readonly PitbullDbContext _db;
    private readonly IValidator<CreateBidCommand> _createValidator;
    private readonly IValidator<UpdateBidCommand> _updateValidator;
    private readonly ILogger<BidService> _logger;

    public BidService(
        PitbullDbContext db,
        IValidator<CreateBidCommand> createValidator,
        IValidator<UpdateBidCommand> updateValidator,
        ILogger<BidService> logger)
    {
        _db = db;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _logger = logger;
    }

    public async Task<Result<BidDto>> GetBidAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var bid = await _db.Set<Bid>()
            .Include(b => b.Items)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (bid is null)
            return Result.Failure<BidDto>("Bid not found", "NOT_FOUND");

        return Result.Success(MapToDto(bid));
    }

    public async Task<Result<PagedResult<BidDto>>> GetBidsAsync(ListBidsQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Bid>().Include(b => b.Items).AsNoTracking();

        // Apply filters
        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(b => b.Status == query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchTerm = query.Search.ToLower();
            dbQuery = dbQuery.Where(b =>
                b.Name.ToLower().Contains(searchTerm) ||
                b.Number.ToLower().Contains(searchTerm));
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var bids = await dbQuery
            .OrderByDescending(b => b.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToArrayAsync(cancellationToken);

        var dtos = bids.Select(MapToDto).ToArray();
        var result = new PagedResult<BidDto>(dtos, totalCount, query.Page, query.PageSize);
        return Result.Success(result);
    }

    public async Task<Result<BidDto>> CreateBidAsync(CreateBidCommand command, CancellationToken cancellationToken = default)
    {
        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<BidDto>(errors, "VALIDATION_ERROR");
        }

        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = command.Name,
            Number = command.Number,
            Status = BidStatus.Draft,
            EstimatedValue = command.EstimatedValue,
            BidDate = command.BidDate,
            DueDate = command.DueDate,
            Owner = command.Owner,
            Description = command.Description,
            CreatedAt = DateTime.UtcNow
        };

        _db.Set<Bid>().Add(bid);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(bid));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create bid '{BidName}'", command.Name);
            return Result.Failure<BidDto>("Failed to create bid", "DATABASE_ERROR");
        }
    }

    public async Task<Result<BidDto>> UpdateBidAsync(UpdateBidCommand command, CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<BidDto>(errors, "VALIDATION_ERROR");
        }

        var bid = await _db.Set<Bid>()
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == command.Id, cancellationToken);

        if (bid is null)
            return Result.Failure<BidDto>("Bid not found", "NOT_FOUND");

        bid.Name = command.Name;
        bid.Number = command.Number;
        bid.Status = command.Status;
        bid.EstimatedValue = command.EstimatedValue;
        bid.BidDate = command.BidDate;
        bid.DueDate = command.DueDate;
        bid.Owner = command.Owner;
        bid.Description = command.Description;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(bid));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<BidDto>("Bid was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update bid {BidId}", command.Id);
            return Result.Failure<BidDto>("Failed to update bid", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteBidAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var bid = await _db.Set<Bid>()
            .FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted, cancellationToken);

        if (bid is null)
            return Result.Failure("Bid not found", "NOT_FOUND");

        bid.IsDeleted = true;
        bid.DeletedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete bid {BidId}", id);
            return Result.Failure("Failed to delete bid", "DATABASE_ERROR");
        }
    }

    public async Task<Result<ConvertBidToProjectResult>> ConvertToProjectAsync(ConvertBidToProjectCommand command, CancellationToken cancellationToken = default)
    {
        var bid = await _db.Set<Bid>()
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == command.BidId, cancellationToken);

        if (bid is null)
            return Result.Failure<ConvertBidToProjectResult>("Bid not found", "NOT_FOUND");

        if (bid.Status != BidStatus.Won)
            return Result.Failure<ConvertBidToProjectResult>("Only won bids can be converted to projects", "INVALID_STATE");

        // Create project from bid data (simplified conversion logic)
        var project = new Projects.Domain.Project
        {
            Id = Guid.NewGuid(),
            Name = bid.Name,
            Number = command.ProjectNumber,
            Description = bid.Description,
            ContractAmount = bid.EstimatedValue,
            SourceBidId = bid.Id,
            Status = Projects.Domain.ProjectStatus.PreConstruction,
            Type = Projects.Domain.ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };

        _db.Set<Projects.Domain.Project>().Add(project);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);

            return Result.Success(new ConvertBidToProjectResult(
                project.Id,
                bid.Id,
                project.Name,
                project.Number
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert bid {BidId} to project", command.BidId);
            return Result.Failure<ConvertBidToProjectResult>("Failed to convert bid", "DATABASE_ERROR");
        }
    }

    private static BidDto MapToDto(Bid bid)
    {
        return new BidDto(
            bid.Id,
            bid.Name,
            bid.Number,
            bid.Status,
            bid.EstimatedValue,
            bid.BidDate,
            bid.DueDate,
            bid.Owner,
            bid.Description,
            bid.ProjectId,
            bid.Items?.Select(item => new BidItemDto(
                item.Id,
                item.Description,
                item.Category,
                item.Quantity,
                item.UnitCost,
                item.TotalCost
            )).ToArray() ?? Array.Empty<BidItemDto>(),
            bid.CreatedAt
        );
    }
}