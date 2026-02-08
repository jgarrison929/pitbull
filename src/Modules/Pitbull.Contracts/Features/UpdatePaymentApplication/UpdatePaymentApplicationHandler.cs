using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.UpdatePaymentApplication;

public sealed class UpdatePaymentApplicationHandler(PitbullDbContext db) 
    : IRequestHandler<UpdatePaymentApplicationCommand, Result<PaymentApplicationDto>>
{
    public async Task<Result<PaymentApplicationDto>> Handle(
        UpdatePaymentApplicationCommand request, 
        CancellationToken cancellationToken)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == request.Id, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDto>("Payment application not found", "NOT_FOUND");

        // Get subcontract for retainage calculation
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == payApp.SubcontractId, cancellationToken);

        if (subcontract is null)
            return Result.Failure<PaymentApplicationDto>("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

        // Track status transitions
        var oldStatus = payApp.Status;
        var newStatus = request.Status;

        // Recalculate amounts if work changed
        if (payApp.WorkCompletedThisPeriod != request.WorkCompletedThisPeriod || 
            payApp.StoredMaterials != request.StoredMaterials)
        {
            payApp.WorkCompletedThisPeriod = request.WorkCompletedThisPeriod;
            payApp.StoredMaterials = request.StoredMaterials;
            payApp.WorkCompletedToDate = payApp.WorkCompletedPrevious + request.WorkCompletedThisPeriod;
            payApp.TotalCompletedAndStored = payApp.WorkCompletedToDate + request.StoredMaterials;
            
            payApp.RetainageThisPeriod = request.WorkCompletedThisPeriod * (payApp.RetainagePercent / 100m);
            payApp.TotalRetainage = payApp.RetainagePrevious + payApp.RetainageThisPeriod;
            
            payApp.TotalEarnedLessRetainage = payApp.TotalCompletedAndStored - payApp.TotalRetainage;
            payApp.CurrentPaymentDue = payApp.TotalEarnedLessRetainage - payApp.LessPreviousCertificates;
        }

        // Track old amounts for delta calculation on Paid apps
        var oldApprovedAmount = payApp.ApprovedAmount ?? 0m;

        // Update fields
        payApp.Status = request.Status;
        payApp.ApprovedBy = request.ApprovedBy;
        payApp.ApprovedAmount = request.ApprovedAmount;
        payApp.InvoiceNumber = request.InvoiceNumber;
        payApp.CheckNumber = request.CheckNumber;
        payApp.Notes = request.Notes;
        var oldCurrentPaymentDue = payApp.CurrentPaymentDue;

        // Set dates on status transitions
        if (oldStatus != newStatus)
        {
            switch (newStatus)
            {
                case PaymentApplicationStatus.Submitted when !payApp.SubmittedDate.HasValue:
                    payApp.SubmittedDate = DateTime.UtcNow;
                    break;
                case PaymentApplicationStatus.UnderReview when !payApp.ReviewedDate.HasValue:
                    payApp.ReviewedDate = DateTime.UtcNow;
                    break;
                case PaymentApplicationStatus.Approved or PaymentApplicationStatus.PartiallyApproved 
                    when !payApp.ApprovedDate.HasValue:
                    payApp.ApprovedDate = DateTime.UtcNow;
                    break;
                case PaymentApplicationStatus.Paid when !payApp.PaidDate.HasValue:
                    payApp.PaidDate = DateTime.UtcNow;
                    // Update subcontract billing totals
                    subcontract.BilledToDate += payApp.CurrentPaymentDue;
                    subcontract.PaidToDate += request.ApprovedAmount ?? payApp.CurrentPaymentDue;
                    subcontract.RetainageHeld = payApp.TotalRetainage;
                    break;
            }
        }
        else if (newStatus == PaymentApplicationStatus.Paid)
        {
            // Already Paid - sync amount changes as deltas
            var newApprovedAmount = request.ApprovedAmount ?? payApp.CurrentPaymentDue;
            var billedDelta = payApp.CurrentPaymentDue - oldCurrentPaymentDue;
            var paidDelta = newApprovedAmount - oldApprovedAmount;
            
            if (billedDelta != 0)
                subcontract.BilledToDate += billedDelta;
            if (paidDelta != 0)
                subcontract.PaidToDate += paidDelta;
            subcontract.RetainageHeld = payApp.TotalRetainage;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(CreatePaymentApplicationHandler.MapToDto(payApp));
    }
}
