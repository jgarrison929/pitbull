using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.ListChangeOrders;
using Pitbull.Contracts.Features.ListPaymentApplications;
using Pitbull.Contracts.Features.ListSubcontracts;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Contracts.Features.UpdateSubcontract;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Services;

namespace Pitbull.Contracts.Services;

/// <summary>
/// Implementation of contracts service with direct database access.
/// </summary>
public class ContractsService(PitbullDbContext db, IWorkflowTransitionService? workflowTransitions = null) : IContractsService
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
        // Validate project exists (prevents FK constraint violation)
        var projectExists = await db.Database
            .SqlQueryRaw<int>("SELECT 1 AS \"Value\" FROM projects WHERE \"Id\" = {0} AND \"IsDeleted\" = false LIMIT 1", command.ProjectId)
            .AnyAsync(cancellationToken);
        if (!projectExists)
            return Result.Failure<SubcontractDto>("Project not found", "NOT_FOUND");

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

        // Filter by project (join through Subcontract since ChangeOrder has no direct ProjectId)
        if (query.ProjectId.HasValue)
        {
            var projectSubcontractIds = db.Set<Subcontract>()
                .Where(s => s.ProjectId == query.ProjectId.Value && !s.IsDeleted)
                .Select(s => s.Id);
            dbQuery = dbQuery.Where(co => projectSubcontractIds.Contains(co.SubcontractId));
        }

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
                         && co.ChangeOrderNumber == command.Number,
                     cancellationToken);

        if (duplicateExists)
            return Result.Failure<ChangeOrderDto>(
                "Change order number already exists for this subcontract",
                "DUPLICATE_CO_NUMBER");

        var initialStatus = command.Status;
        if (initialStatus is ChangeOrderStatus.Approved or ChangeOrderStatus.Void or ChangeOrderStatus.Rejected)
            return Result.Failure<ChangeOrderDto>(
                "Change orders must be created in Pending or UnderReview status",
                "INVALID_STATUS");

        var changeOrder = new ChangeOrder
        {
            SubcontractId = command.SubcontractId,
            ChangeOrderNumber = command.Number,
            Title = command.Title,
            Description = command.Description,
            Reason = command.RequestedBy ?? command.Reason,
            Amount = command.Amount,
            DaysExtension = command.ScheduleImpactDays ?? command.DaysExtension,
            DelayCost = command.CostImpact,
            ReferenceNumber = command.ReferenceNumber,
            OriginatingRfiId = command.OriginatingRfiId,
            Status = initialStatus,
            SubmittedDate = NormalizeToUtc(command.RequestDate) ?? DateTime.UtcNow,
            ApprovedDate = NormalizeToUtc(command.ApprovedDate)
        };

        if (changeOrder.Status == ChangeOrderStatus.Approved && !changeOrder.ApprovedDate.HasValue)
            changeOrder.ApprovedDate = DateTime.UtcNow;

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
        if (changeOrder.ChangeOrderNumber != command.Number)
        {
            var duplicateExists = await db.Set<ChangeOrder>()
                .AnyAsync(co => co.SubcontractId == changeOrder.SubcontractId
                             && co.ChangeOrderNumber == command.Number
                             && co.Id != command.Id,
                         cancellationToken);

            if (duplicateExists)
                return Result.Failure<ChangeOrderDto>(
                    "Change order number already exists for this subcontract",
                    "DUPLICATE_CO_NUMBER");
        }

        // Validate status transition
        var oldStatus = changeOrder.Status;
        var newStatus = command.Status;

        if (!ChangeOrderStatusTransitions.IsValid(oldStatus, newStatus))
            return Result.Failure<ChangeOrderDto>(
                $"Cannot transition from {oldStatus} to {newStatus}",
                "INVALID_STATUS_TRANSITION");

        // If transitioning to Approved, validate contract sum won't go negative
        if (oldStatus != ChangeOrderStatus.Approved && newStatus == ChangeOrderStatus.Approved)
        {
            var subcontract = await db.Set<Subcontract>()
                .FirstOrDefaultAsync(s => s.Id == changeOrder.SubcontractId, cancellationToken);

            if (subcontract is null)
                return Result.Failure<ChangeOrderDto>("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

            var newContractSum = subcontract.CurrentValue + command.Amount;
            if (newContractSum < 0)
                return Result.Failure<ChangeOrderDto>(
                    $"Change order would reduce contract sum below zero (current: {subcontract.CurrentValue:C}, CO amount: {command.Amount:C})",
                    "NEGATIVE_CONTRACT_SUM");

            // Update subcontract's revised contract sum
            subcontract.CurrentValue = newContractSum;
        }

        // If voiding a previously approved CO, reverse the contract sum impact
        if (oldStatus == ChangeOrderStatus.Approved && newStatus == ChangeOrderStatus.Void)
        {
            var subcontract = await db.Set<Subcontract>()
                .FirstOrDefaultAsync(s => s.Id == changeOrder.SubcontractId, cancellationToken);

            if (subcontract is not null)
                subcontract.CurrentValue -= changeOrder.Amount;
        }

        // If CO is already approved and amount is changing, sync the delta to subcontract
        if (oldStatus == ChangeOrderStatus.Approved && newStatus == ChangeOrderStatus.Approved
            && changeOrder.Amount != command.Amount)
        {
            var subcontract = await db.Set<Subcontract>()
                .FirstOrDefaultAsync(s => s.Id == changeOrder.SubcontractId, cancellationToken);

            if (subcontract is not null)
            {
                decimal delta = command.Amount - changeOrder.Amount;
                if (subcontract.CurrentValue + delta < 0)
                    return Result.Failure<ChangeOrderDto>(
                        $"Amount change would reduce contract sum below zero (current: {subcontract.CurrentValue:C}, delta: {delta:C})",
                        "NEGATIVE_CONTRACT_SUM");
                subcontract.CurrentValue += delta;
            }
        }

        // Update fields
        changeOrder.ChangeOrderNumber = command.Number;
        changeOrder.Title = command.Title;
        changeOrder.Description = command.Description;
        changeOrder.Reason = command.RequestedBy ?? command.Reason;
        changeOrder.Amount = command.Amount;
        changeOrder.DaysExtension = command.ScheduleImpactDays ?? command.DaysExtension;
        changeOrder.DelayCost = command.CostImpact;
        changeOrder.Status = command.Status;
        changeOrder.ReferenceNumber = command.ReferenceNumber;
        changeOrder.SubmittedDate = NormalizeToUtc(command.RequestDate) ?? changeOrder.SubmittedDate;
        changeOrder.ApprovedDate = NormalizeToUtc(command.ApprovedDate) ?? changeOrder.ApprovedDate;

        // Set approval/rejection dates on status change
        if (oldStatus != newStatus)
        {
            if (newStatus == ChangeOrderStatus.Approved && !changeOrder.ApprovedDate.HasValue)
                changeOrder.ApprovedDate = DateTime.UtcNow;
            else if (newStatus == ChangeOrderStatus.Rejected && !changeOrder.RejectedDate.HasValue)
                changeOrder.RejectedDate = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        if (oldStatus != newStatus && workflowTransitions is not null)
        {
            await workflowTransitions.RecordTransitionAsync(
                "ChangeOrder", changeOrder.Id,
                oldStatus.ToString(), newStatus.ToString(),
                Guid.Empty, null, null, cancellationToken);
        }

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
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDto>("Payment application not found", "NOT_FOUND");

        return Result.Success(MapPaymentApplicationToDto(payApp));
    }

    public async Task<Result<PagedResult<PaymentApplicationDto>>> ListPaymentApplicationsAsync(ListPaymentApplicationsQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = db.Set<PaymentApplication>().Where(pa => !pa.IsDeleted).AsQueryable();

        if (query.SubcontractId.HasValue)
            dbQuery = dbQuery.Where(pa => pa.SubcontractId == query.SubcontractId.Value);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(pa => pa.Status == query.Status.Value);

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var items = await dbQuery
            .OrderByDescending(pa => pa.ApplicationNumber)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapPaymentApplicationToDto).ToList();

        return Result.Success(
            new PagedResult<PaymentApplicationDto>(dtos, totalCount, query.Page, query.PageSize));
    }

    public async Task<Result<PaymentApplicationDto>> CreatePaymentApplicationAsync(CreatePaymentApplicationCommand command, CancellationToken cancellationToken = default)
    {
        // Get subcontract
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == command.SubcontractId, cancellationToken);

        if (subcontract is null)
            return Result.Failure<PaymentApplicationDto>("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

        // Validate retainage bounds (0-50%)
        if (subcontract.RetainagePercent < 0 || subcontract.RetainagePercent > 50)
            return Result.Failure<PaymentApplicationDto>(
                $"Retainage percentage must be between 0% and 50% (current: {subcontract.RetainagePercent}%)",
                "INVALID_RETAINAGE");

        // Validate overbilling: total billed cannot exceed contract value
        var existingBilled = await db.Set<PaymentApplication>()
            .Where(pa => pa.SubcontractId == command.SubcontractId && !pa.IsDeleted)
            .SumAsync(pa => pa.TotalCompletedAndStored, cancellationToken);

        var proposedTotal = existingBilled + command.WorkCompletedThisPeriod + command.StoredMaterials;
        if (proposedTotal > subcontract.CurrentValue)
            return Result.Failure<PaymentApplicationDto>(
                $"Total billed ({proposedTotal:C}) would exceed contract value ({subcontract.CurrentValue:C})",
                "OVERBILLING");

        // Get previous applications to calculate running totals
        var previousApps = await db.Set<PaymentApplication>()
            .Where(pa => pa.SubcontractId == command.SubcontractId)
            .OrderByDescending(pa => pa.ApplicationNumber)
            .ToListAsync(cancellationToken);

        var lastApp = previousApps.FirstOrDefault();
        var nextNumber = (lastApp?.ApplicationNumber ?? 0) + 1;

        // Calculate amounts
        var workCompletedPrevious = lastApp?.WorkCompletedToDate ?? 0m;
        var workCompletedToDate = workCompletedPrevious + command.WorkCompletedThisPeriod;
        var totalCompletedAndStored = workCompletedToDate + command.StoredMaterials;

        var retainagePercent = subcontract.RetainagePercent;
        var retainageThisPeriod = command.WorkCompletedThisPeriod * (retainagePercent / 100m);
        var retainagePrevious = lastApp?.TotalRetainage ?? 0m;
        var totalRetainage = retainagePrevious + retainageThisPeriod;

        var totalEarnedLessRetainage = totalCompletedAndStored - totalRetainage;
        var lessPreviousCertificates = lastApp?.TotalEarnedLessRetainage ?? 0m;
        var currentPaymentDue = totalEarnedLessRetainage - lessPreviousCertificates;

        var payApp = new PaymentApplication
        {
            SubcontractId = command.SubcontractId,
            ApplicationNumber = nextNumber,
            PeriodStart = command.PeriodStart,
            PeriodEnd = command.PeriodEnd,
            ScheduledValue = subcontract.CurrentValue,
            WorkCompletedPrevious = workCompletedPrevious,
            WorkCompletedThisPeriod = command.WorkCompletedThisPeriod,
            WorkCompletedToDate = workCompletedToDate,
            StoredMaterials = command.StoredMaterials,
            TotalCompletedAndStored = totalCompletedAndStored,
            RetainagePercent = retainagePercent,
            RetainageThisPeriod = retainageThisPeriod,
            RetainagePrevious = retainagePrevious,
            TotalRetainage = totalRetainage,
            TotalEarnedLessRetainage = totalEarnedLessRetainage,
            LessPreviousCertificates = lessPreviousCertificates,
            CurrentPaymentDue = currentPaymentDue,
            Status = PaymentApplicationStatus.Draft,
            InvoiceNumber = command.InvoiceNumber,
            Notes = command.Notes
        };

        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapPaymentApplicationToDto(payApp));
    }

    public async Task<Result<PaymentApplicationDto>> UpdatePaymentApplicationAsync(UpdatePaymentApplicationCommand command, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == command.Id, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDto>("Payment application not found", "NOT_FOUND");

        // Get subcontract for retainage calculation
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == payApp.SubcontractId, cancellationToken);

        if (subcontract is null)
            return Result.Failure<PaymentApplicationDto>("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

        // Track status transitions
        var oldStatus = payApp.Status;
        var newStatus = command.Status;

        // Capture old amounts BEFORE mutation for delta calculation on Paid apps
        var oldCurrentPaymentDue = payApp.CurrentPaymentDue;
        var oldApprovedAmount = payApp.ApprovedAmount ?? 0m;

        // Recalculate amounts if work changed
        if (payApp.WorkCompletedThisPeriod != command.WorkCompletedThisPeriod ||
            payApp.StoredMaterials != command.StoredMaterials)
        {
            payApp.WorkCompletedThisPeriod = command.WorkCompletedThisPeriod;
            payApp.StoredMaterials = command.StoredMaterials;
            payApp.WorkCompletedToDate = payApp.WorkCompletedPrevious + command.WorkCompletedThisPeriod;
            payApp.TotalCompletedAndStored = payApp.WorkCompletedToDate + command.StoredMaterials;

            payApp.RetainageThisPeriod = command.WorkCompletedThisPeriod * (payApp.RetainagePercent / 100m);
            payApp.TotalRetainage = payApp.RetainagePrevious + payApp.RetainageThisPeriod;

            payApp.TotalEarnedLessRetainage = payApp.TotalCompletedAndStored - payApp.TotalRetainage;
            payApp.CurrentPaymentDue = payApp.TotalEarnedLessRetainage - payApp.LessPreviousCertificates;
        }

        // Update fields
        payApp.Status = command.Status;
        payApp.ApprovedBy = command.ApprovedBy;
        payApp.ApprovedAmount = command.ApprovedAmount;
        payApp.InvoiceNumber = command.InvoiceNumber;
        payApp.CheckNumber = command.CheckNumber;
        payApp.Notes = command.Notes;

        // Set dates on status transitions
        if (oldStatus != newStatus)
        {
            switch (newStatus)
            {
                case PaymentApplicationStatus.Submitted when !payApp.SubmittedDate.HasValue:
                    payApp.SubmittedDate = DateTime.UtcNow;
                    break;
                case PaymentApplicationStatus.Reviewed when !payApp.ReviewedDate.HasValue:
                    payApp.ReviewedDate = DateTime.UtcNow;
                    break;
                case PaymentApplicationStatus.Approved
                    when !payApp.ApprovedDate.HasValue:
                    payApp.ApprovedDate = DateTime.UtcNow;
                    break;
                case PaymentApplicationStatus.Paid when !payApp.PaidDate.HasValue:
                    payApp.PaidDate = DateTime.UtcNow;
                    // Update subcontract billing totals
                    subcontract.BilledToDate += payApp.CurrentPaymentDue;
                    subcontract.PaidToDate += command.ApprovedAmount ?? payApp.CurrentPaymentDue;
                    subcontract.RetainageHeld = payApp.TotalRetainage;
                    break;
            }
        }
        else if (newStatus == PaymentApplicationStatus.Paid)
        {
            // Already Paid - sync amount changes as deltas
            var newApprovedAmount = command.ApprovedAmount ?? payApp.CurrentPaymentDue;
            var billedDelta = payApp.CurrentPaymentDue - oldCurrentPaymentDue;
            var paidDelta = newApprovedAmount - oldApprovedAmount;

            if (billedDelta != 0)
                subcontract.BilledToDate += billedDelta;
            if (paidDelta != 0)
                subcontract.PaidToDate += paidDelta;
            subcontract.RetainageHeld = payApp.TotalRetainage;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapPaymentApplicationToDto(payApp));
    }

    public async Task<Result> DeletePaymentApplicationAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id, cancellationToken);

        if (payApp is null)
            return Result.Failure("Payment application not found", "NOT_FOUND");

        // Only allow deleting draft applications
        if (payApp.Status != PaymentApplicationStatus.Draft)
            return Result.Failure("Only draft payment applications can be deleted", "INVALID_STATUS");

        // Hard delete for draft applications
        db.Set<PaymentApplication>().Remove(payApp);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
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
        co.ChangeOrderNumber,
        co.DaysExtension,
        co.DelayCost,
        co.Reason,
        co.SubmittedDate,
        co.CreatedAt
    );

    /// <summary>
    /// Normalize a DateTime to UTC to avoid Npgsql 9.x DateTimeKind.Unspecified errors.
    /// </summary>
    private static DateTime? NormalizeToUtc(DateTime? value)
    {
        if (value is null) return null;
        return value.Value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
            : value.Value.ToUniversalTime();
    }

    private static PaymentApplicationDto MapPaymentApplicationToDto(PaymentApplication pa) => new(
        pa.Id,
        pa.SubcontractId,
        pa.ApplicationNumber,
        pa.PeriodStart,
        pa.PeriodEnd,
        pa.ScheduledValue,
        pa.WorkCompletedPrevious,
        pa.WorkCompletedThisPeriod,
        pa.WorkCompletedToDate,
        pa.StoredMaterials,
        pa.TotalCompletedAndStored,
        pa.RetainagePercent,
        pa.RetainageThisPeriod,
        pa.RetainagePrevious,
        pa.TotalRetainage,
        pa.TotalEarnedLessRetainage,
        pa.LessPreviousCertificates,
        pa.CurrentPaymentDue,
        pa.Status,
        pa.SubmittedDate,
        pa.ReviewedDate,
        pa.ApprovedDate,
        pa.PaidDate,
        pa.ApprovedBy,
        pa.ApprovedAmount,
        pa.Notes,
        pa.InvoiceNumber,
        pa.CheckNumber,
        pa.CreatedAt
    );
}
