using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.Shared;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

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
            .FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted, cancellationToken);

        if (bid is null)
            return Result.Failure<BidDto>("Bid not found", "NOT_FOUND");

        return Result.Success(MapToDto(bid));
    }

    public async Task<Result<PagedResult<BidDto>>> GetBidsAsync(ListBidsQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Bid>()
            .Include(b => b.Items)
            .Where(b => !b.IsDeleted)
            .AsNoTracking();

        // Apply filters
        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(b => b.Status == query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchTerm = query.Search.ToLower();
            dbQuery = dbQuery.Where(b =>
                b.Name.ToLower().Contains(searchTerm.ToLower()) ||
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
            Status = command.Status,
            EstimatedValue = command.EstimatedValue,
            BidDate = command.BidDate,
            DueDate = command.DueDate,
            Owner = command.Owner,
            Description = !string.IsNullOrWhiteSpace(command.Description)
                ? command.Description
                : command.Notes,
            CreatedAt = DateTime.UtcNow
        };

        // Add bid items if provided
        if (command.Items is { Count: > 0 })
        {
            foreach (var item in command.Items)
            {
                bid.Items.Add(new BidItem
                {
                    Description = item.Description,
                    Category = item.Category,
                    Quantity = item.Quantity,
                    UnitCost = item.UnitCost,
                    TotalCost = item.Quantity * item.UnitCost
                });
            }
        }

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

        var oldStatus = bid.Status;
        var newStatus = command.Status;

        if (newStatus == BidStatus.Converted)
            return Result.Failure<BidDto>("Converted status is set automatically during bid-to-project conversion", "INVALID_STATUS");

        if (!BidStatusTransitions.IsValid(oldStatus, newStatus))
            return Result.Failure<BidDto>(
                $"Cannot transition bid from {oldStatus} to {newStatus}",
                "INVALID_STATUS_TRANSITION");

        bid.Name = command.Name;
        bid.Number = command.Number;
        bid.Status = newStatus;
        bid.EstimatedValue = command.EstimatedValue;
        bid.BidDate = command.BidDate;
        bid.DueDate = command.DueDate;
        bid.Owner = command.Owner;
        bid.Description = !string.IsNullOrWhiteSpace(command.Description)
            ? command.Description
            : command.Notes;

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

    public async Task<Result<BidConversionPreviewDto>> GetConversionPreviewAsync(Guid bidId, CancellationToken cancellationToken = default)
    {
        var bid = await _db.Set<Bid>()
            .Include(b => b.Items)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == bidId && !b.IsDeleted, cancellationToken);

        if (bid is null)
            return Result.Failure<BidConversionPreviewDto>("Bid not found", "NOT_FOUND");

        if (bid.Status != BidStatus.Won)
            return Result.Failure<BidConversionPreviewDto>("Only won bids can be converted to projects", "INVALID_STATUS");

        if (bid.ProjectId.HasValue)
            return Result.Failure<BidConversionPreviewDto>("Bid has already been converted to a project", "ALREADY_CONVERTED");

        var itemPreviews = bid.Items.Select(item => new BidItemPreviewDto(
            Id: item.Id,
            Description: item.Description,
            Category: item.Category.ToString(),
            Quantity: item.Quantity,
            UnitCost: item.UnitCost,
            TotalCost: item.TotalCost,
            SuggestedCostCode: SuggestCostCode(item.Category)
        )).ToArray();

        return Result.Success(new BidConversionPreviewDto(
            BidId: bid.Id,
            BidName: bid.Name,
            BidNumber: bid.Number,
            EstimatedValue: bid.EstimatedValue,
            Owner: bid.Owner,
            Description: bid.Description,
            Items: itemPreviews
        ));
    }

    public async Task<Result<ConvertBidToProjectResult>> ConvertToProjectAsync(ConvertBidToProjectCommand command, CancellationToken cancellationToken = default)
    {
        var bid = await _db.Set<Bid>()
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == command.BidId, cancellationToken);

        if (bid is null)
            return Result.Failure<ConvertBidToProjectResult>("Bid not found", "NOT_FOUND");

        if (bid.Status != BidStatus.Won)
            return Result.Failure<ConvertBidToProjectResult>("Only won bids can be converted to projects", "INVALID_STATUS");

        if (bid.ProjectId.HasValue)
            return Result.Failure<ConvertBidToProjectResult>("Bid has already been converted to a project", "ALREADY_CONVERTED");

        // Check for duplicate project number
        var existingProject = await _db.Set<Projects.Domain.Project>()
            .AsNoTracking()
            .AnyAsync(p => p.Number == command.ProjectNumber && !p.IsDeleted, cancellationToken);

        if (existingProject)
            return Result.Failure<ConvertBidToProjectResult>("A project with this number already exists", "DUPLICATE_NUMBER");

        // Create project from bid data
        var project = new Projects.Domain.Project
        {
            Id = Guid.NewGuid(),
            Name = command.ProjectName ?? bid.Name,
            Number = command.ProjectNumber,
            Description = command.Description ?? bid.Description,
            ContractAmount = bid.EstimatedValue,
            SourceBidId = bid.Id,
            Status = Projects.Domain.ProjectStatus.PreConstruction,
            Type = (Projects.Domain.ProjectType)command.ProjectType,
            Address = command.Address,
            City = command.City,
            State = command.State,
            ZipCode = command.ZipCode,
            ClientName = command.ClientName ?? bid.Owner,
            ClientContact = command.ClientContact,
            ClientEmail = command.ClientEmail,
            ClientPhone = command.ClientPhone,
            StartDate = command.StartDate,
            EstimatedCompletionDate = command.EstimatedCompletionDate,
            OriginalBudget = bid.EstimatedValue,
            CreatedAt = DateTime.UtcNow
        };

        _db.Set<Projects.Domain.Project>().Add(project);

        // Create budget if requested
        Guid? budgetId = null;
        if (command.CreateBudget && bid.Items.Count > 0)
        {
            var budget = new Projects.Domain.ProjectBudget
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                OriginalContractAmount = bid.EstimatedValue,
                TotalBudget = bid.EstimatedValue,
                CreatedAt = DateTime.UtcNow
            };
            _db.Set<Projects.Domain.ProjectBudget>().Add(budget);
            budgetId = budget.Id;
        }

        // Create subcontracts from subcontractor bid items if requested
        int subcontractsCreated = 0;
        if (command.CreateSubcontracts)
        {
            var subItems = bid.Items.Where(i => i.Category == BidItemCategory.Subcontractor).ToList();
            int scIndex = 1;
            foreach (var item in subItems)
            {
                var subcontract = new Contracts.Domain.Subcontract
                {
                    Id = Guid.NewGuid(),
                    ProjectId = project.Id,
                    SubcontractNumber = $"SC-{command.ProjectNumber}-{scIndex:D3}",
                    SubcontractorName = item.Description,
                    ScopeOfWork = item.Description,
                    OriginalValue = item.TotalCost,
                    CurrentValue = item.TotalCost,
                    Status = Contracts.Domain.SubcontractStatus.Draft,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Set<Contracts.Domain.Subcontract>().Add(subcontract);
                scIndex++;
                subcontractsCreated++;
            }
        }

        // Track cost code mappings count
        int costCodesMapped = command.CostCodeMappings?.Count ?? 0;

        // Link bid to project and mark as converted
        bid.ProjectId = project.Id;
        bid.Status = BidStatus.Converted;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Converted bid {BidId} to project {ProjectId} ({ProjectNumber}). Budget: {HasBudget}, Subcontracts: {SubCount}, CostCodes: {CostCodeCount}",
                bid.Id, project.Id, project.Number, budgetId.HasValue, subcontractsCreated, costCodesMapped);

            return Result.Success(new ConvertBidToProjectResult(
                ProjectId: project.Id,
                BidId: bid.Id,
                ProjectName: project.Name,
                ProjectNumber: project.Number,
                BudgetId: budgetId,
                SubcontractsCreated: subcontractsCreated,
                CostCodesMapped: costCodesMapped
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert bid {BidId} to project", command.BidId);
            return Result.Failure<ConvertBidToProjectResult>("Failed to convert bid to project", "DATABASE_ERROR");
        }
    }

    private static string? SuggestCostCode(BidItemCategory category) => category switch
    {
        BidItemCategory.Labor => "01-000",
        BidItemCategory.Material => "02-000",
        BidItemCategory.Equipment => "03-000",
        BidItemCategory.Subcontractor => "04-000",
        _ => null
    };

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
