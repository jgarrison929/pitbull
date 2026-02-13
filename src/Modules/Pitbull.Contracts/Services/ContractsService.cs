using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.DeletePaymentApplication;
using Pitbull.Contracts.Features.GetPaymentApplication;
using Pitbull.Contracts.Features.ListChangeOrders;
using Pitbull.Contracts.Features.ListPaymentApplications;
using Pitbull.Contracts.Features.ListSubcontracts;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Contracts.Features.UpdateSubcontract;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Services;

/// <summary>
/// Implementation of contracts service with direct database access.
/// </summary>
public class ContractsService(PitbullDbContext db) : IContractsService
{
    // Subcontracts
    public async Task<Result<SubcontractDto>> GetSubcontractAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var subcontract = await db.Set<Subcontract>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, cancellationToken);

        if (subcontract is null)
            return Result.Failure<SubcontractDto>("Subcontract not found", "NOT_FOUND");

        return Result.Success(MapSubcontractToDto(subcontract));
    }

    public async Task<Result<PagedResult<SubcontractDto>>> ListSubcontractsAsync(ListSubcontractsQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = db.Set<Subcontract>().AsNoTracking().Where(s => !s.IsDeleted);

        // Filter by project
        if (query.ProjectId.HasValue)
            dbQuery = dbQuery.Where(s => s.ProjectId == query.ProjectId.Value);

        // Filter by status
        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(s => s.Status == query.Status.Value);

        // Search by subcontractor name or number
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.ToLower();
            dbQuery = dbQuery.Where(s =>
                s.SubcontractorName.ToLower().Contains(search.ToLower()) ||
                s.SubcontractNumber.ToLower().Contains(search));
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var items = await dbQuery
            .OrderByDescending(s => s.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(s => MapSubcontractToDto(s))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<SubcontractDto>(
            items, totalCount, query.Page, query.PageSize));
    }

    public async Task<Result<SubcontractDto>> CreateSubcontractAsync(CreateSubcontractCommand command, CancellationToken cancellationToken = default)
    {
        // Check for duplicate subcontract number within same project
        var exists = await db.Set<Subcontract>()
            .AnyAsync(s => s.ProjectId == command.ProjectId 
                && s.SubcontractNumber == command.SubcontractNumber, cancellationToken);
        
        if (exists)
        {
            return Result.Failure<SubcontractDto>(
                $"Subcontract number '{command.SubcontractNumber}' already exists for this project.",
                "DUPLICATE_NUMBER");
        }

        var subcontract = new Subcontract
        {
            ProjectId = command.ProjectId,
            SubcontractNumber = command.SubcontractNumber,
            SubcontractorName = command.SubcontractorName,
            SubcontractorContact = command.SubcontractorContact,
            SubcontractorEmail = command.SubcontractorEmail,
            SubcontractorPhone = command.SubcontractorPhone,
            SubcontractorAddress = command.SubcontractorAddress,
            ScopeOfWork = command.ScopeOfWork,
            TradeCode = command.TradeCode,
            OriginalValue = command.OriginalValue,
            CurrentValue = command.OriginalValue, // Initially same as original
            RetainagePercent = command.RetainagePercent,
            StartDate = command.StartDate,
            CompletionDate = command.CompletionDate,
            LicenseNumber = command.LicenseNumber,
            Notes = command.Notes,
            Status = SubcontractStatus.Draft
        };

        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapSubcontractToDto(subcontract));
    }

    public async Task<Result<SubcontractDto>> UpdateSubcontractAsync(UpdateSubcontractCommand command, CancellationToken cancellationToken = default)
    {
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == command.Id, cancellationToken);

        if (subcontract is null)
            return Result.Failure<SubcontractDto>("Subcontract not found", "NOT_FOUND");

        subcontract.SubcontractNumber = command.SubcontractNumber;
        subcontract.SubcontractorName = command.SubcontractorName;
        subcontract.SubcontractorContact = command.SubcontractorContact;
        subcontract.SubcontractorEmail = command.SubcontractorEmail;
        subcontract.SubcontractorPhone = command.SubcontractorPhone;
        subcontract.SubcontractorAddress = command.SubcontractorAddress;
        subcontract.ScopeOfWork = command.ScopeOfWork;
        subcontract.TradeCode = command.TradeCode;
        subcontract.OriginalValue = command.OriginalValue;
        subcontract.RetainagePercent = command.RetainagePercent;
        subcontract.ExecutionDate = command.ExecutionDate;
        subcontract.StartDate = command.StartDate;
        subcontract.CompletionDate = command.CompletionDate;
        subcontract.Status = command.Status;
        subcontract.InsuranceExpirationDate = command.InsuranceExpirationDate;
        subcontract.InsuranceCurrent = command.InsuranceCurrent;
        subcontract.LicenseNumber = command.LicenseNumber;
        subcontract.Notes = command.Notes;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapSubcontractToDto(subcontract));
    }

    public async Task<Result> DeleteSubcontractAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (subcontract is null)
            return Result.Failure("Subcontract not found", "NOT_FOUND");

        // Can only delete Draft subcontracts
        if (subcontract.Status != SubcontractStatus.Draft)
            return Result.Failure("Cannot delete subcontract that is not in Draft status", "CANNOT_DELETE");

        // Hard delete for Draft status
        db.Set<Subcontract>().Remove(subcontract);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    // Change Orders
    public async Task<Result<ChangeOrderDto>> GetChangeOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var changeOrder = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == id && !co.IsDeleted, cancellationToken);

        if (changeOrder is null)
            return Result.Failure<ChangeOrderDto>("Change order not found", "NOT_FOUND");

        return Result.Success(MapChangeOrderToDto(changeOrder));
    }

    public async Task<Result<PagedResult<ChangeOrderDto>>> ListChangeOrdersAsync(ListChangeOrdersQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = db.Set<ChangeOrder>().Where(co => !co.IsDeleted).AsQueryable();

        // Filter by subcontract
        if (query.SubcontractId.HasValue)
            dbQuery = dbQuery.Where(co => co.SubcontractId == query.SubcontractId.Value);

        // Filter by status
        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(co => co.Status == query.Status.Value);

        // Search by title or CO number
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.ToLower();
            dbQuery = dbQuery.Where(co => 
                co.Title.ToLower().Contains(search.ToLower()) ||
                co.ChangeOrderNumber.ToLower().Contains(search.ToLower()));
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var items = await dbQuery
            .OrderByDescending(co => co.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(co => MapChangeOrderToDto(co))
            .ToListAsync(cancellationToken);

        return Result.Success(
            new PagedResult<ChangeOrderDto>(items, totalCount, query.Page, query.PageSize));
    }

    public async Task<Result<ChangeOrderDto>> CreateChangeOrderAsync(CreateChangeOrderCommand command, CancellationToken cancellationToken = default)
    {
        // Verify subcontract exists
        var subcontractExists = await db.Set<Subcontract>()
            .AnyAsync(s => s.Id == command.SubcontractId, cancellationToken);
        
        if (!subcontractExists)
            return Result.Failure<ChangeOrderDto>("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

        // Check for duplicate CO number on this subcontract
        var duplicateExists = await db.Set<ChangeOrder>()
            .AnyAsync(co => co.SubcontractId == command.SubcontractId 
                         && co.ChangeOrderNumber == command.ChangeOrderNumber, 
                     cancellationToken);
        
        if (duplicateExists)
            return Result.Failure<ChangeOrderDto>(
                "Change order number already exists for this subcontract", 
                "DUPLICATE_CO_NUMBER");

        var changeOrder = new ChangeOrder
        {
            SubcontractId = command.SubcontractId,
            ChangeOrderNumber = command.ChangeOrderNumber,
            Title = command.Title,
            Description = command.Description,
            Reason = command.Reason,
            Amount = command.Amount,
            DaysExtension = command.DaysExtension,
            ReferenceNumber = command.ReferenceNumber,
            Status = ChangeOrderStatus.Pending,
            SubmittedDate = DateTime.UtcNow
        };

        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapChangeOrderToDto(changeOrder));
    }

    public async Task<Result<ChangeOrderDto>> UpdateChangeOrderAsync(UpdateChangeOrderCommand command, CancellationToken cancellationToken = default)
    {
        var changeOrder = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == command.Id, cancellationToken);

        if (changeOrder is null)
            return Result.Failure<ChangeOrderDto>("Change order not found", "NOT_FOUND");

        // Check for duplicate CO number if changed
        if (changeOrder.ChangeOrderNumber != command.ChangeOrderNumber)
        {
            var duplicateExists = await db.Set<ChangeOrder>()
                .AnyAsync(co => co.SubcontractId == changeOrder.SubcontractId 
                             && co.ChangeOrderNumber == command.ChangeOrderNumber
                             && co.Id != command.Id, 
                         cancellationToken);
            
            if (duplicateExists)
                return Result.Failure<ChangeOrderDto>(
                    "Change order number already exists for this subcontract", 
                    "DUPLICATE_CO_NUMBER");
        }

        // Track status transitions for date tracking
        var oldStatus = changeOrder.Status;
        var newStatus = command.Status;

        // Update fields
        changeOrder.ChangeOrderNumber = command.ChangeOrderNumber;
        changeOrder.Title = command.Title;
        changeOrder.Description = command.Description;
        changeOrder.Reason = command.Reason;
        changeOrder.Amount = command.Amount;
        changeOrder.DaysExtension = command.DaysExtension;
        changeOrder.Status = command.Status;
        changeOrder.ReferenceNumber = command.ReferenceNumber;

        // Set approval/rejection dates on status change
        if (oldStatus != newStatus)
        {
            if (newStatus == ChangeOrderStatus.Approved && !changeOrder.ApprovedDate.HasValue)
                changeOrder.ApprovedDate = DateTime.UtcNow;
            else if (newStatus == ChangeOrderStatus.Rejected && !changeOrder.RejectedDate.HasValue)
                changeOrder.RejectedDate = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapChangeOrderToDto(changeOrder));
    }

    public async Task<Result> DeleteChangeOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var changeOrder = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == id, cancellationToken);

        if (changeOrder is null)
            return Result.Failure("Change order not found", "NOT_FOUND");

        // Can only delete Pending or Rejected change orders
        if (changeOrder.Status == ChangeOrderStatus.Approved)
            return Result.Failure("Cannot delete an approved change order", "CANNOT_DELETE");

        // Hard delete for non-approved
        db.Set<ChangeOrder>().Remove(changeOrder);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    // Payment Applications
    public async Task<Result<PaymentApplicationDto>> GetPaymentApplicationAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var handler = new GetPaymentApplicationHandler(db);
        return await handler.Handle(new GetPaymentApplicationQuery(id), cancellationToken);
    }

    public async Task<Result<PagedResult<PaymentApplicationDto>>> ListPaymentApplicationsAsync(ListPaymentApplicationsQuery query, CancellationToken cancellationToken = default)
    {
        var handler = new ListPaymentApplicationsHandler(db);
        return await handler.Handle(query, cancellationToken);
    }

    public async Task<Result<PaymentApplicationDto>> CreatePaymentApplicationAsync(CreatePaymentApplicationCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new CreatePaymentApplicationHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result<PaymentApplicationDto>> UpdatePaymentApplicationAsync(UpdatePaymentApplicationCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new UpdatePaymentApplicationHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result> DeletePaymentApplicationAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var handler = new DeletePaymentApplicationHandler(db);
        return await handler.Handle(new DeletePaymentApplicationCommand(id), cancellationToken);
    }

    // Private mapping methods
    private static SubcontractDto MapSubcontractToDto(Subcontract s) => new(
        s.Id,
        s.ProjectId,
        s.SubcontractNumber,
        s.SubcontractorName,
        s.SubcontractorContact,
        s.SubcontractorEmail,
        s.SubcontractorPhone,
        s.SubcontractorAddress,
        s.ScopeOfWork,
        s.TradeCode,
        s.OriginalValue,
        s.CurrentValue,
        s.BilledToDate,
        s.PaidToDate,
        s.RetainagePercent,
        s.RetainageHeld,
        s.ExecutionDate,
        s.StartDate,
        s.CompletionDate,
        s.ActualCompletionDate,
        s.Status,
        s.InsuranceExpirationDate,
        s.InsuranceCurrent,
        s.LicenseNumber,
        s.Notes,
        s.CreatedAt
    );

    private static ChangeOrderDto MapChangeOrderToDto(ChangeOrder co) => new(
        co.Id,
        co.SubcontractId,
        co.ChangeOrderNumber,
        co.Title,
        co.Description,
        co.Reason,
        co.Amount,
        co.DaysExtension,
        co.Status,
        co.SubmittedDate,
        co.ApprovedDate,
        co.RejectedDate,
        co.ApprovedBy,
        co.RejectedBy,
        co.RejectionReason,
        co.ReferenceNumber,
        co.CreatedAt
    );
}
