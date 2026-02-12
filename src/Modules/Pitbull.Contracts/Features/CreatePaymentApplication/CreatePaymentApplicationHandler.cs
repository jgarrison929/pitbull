using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.CreatePaymentApplication;

public sealed class CreatePaymentApplicationHandler(PitbullDbContext db)
    : IRequestHandler<CreatePaymentApplicationCommand, Result<PaymentApplicationDto>>
{
    public async Task<Result<PaymentApplicationDto>> Handle(
        CreatePaymentApplicationCommand request,
        CancellationToken cancellationToken)
    {
        // Get subcontract
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == request.SubcontractId, cancellationToken);

        if (subcontract is null)
            return Result.Failure<PaymentApplicationDto>("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

        // Get previous applications to calculate running totals
        var previousApps = await db.Set<PaymentApplication>()
            .Where(pa => pa.SubcontractId == request.SubcontractId)
            .OrderByDescending(pa => pa.ApplicationNumber)
            .ToListAsync(cancellationToken);

        var lastApp = previousApps.FirstOrDefault();
        var nextNumber = (lastApp?.ApplicationNumber ?? 0) + 1;

        // Calculate amounts
        var workCompletedPrevious = lastApp?.WorkCompletedToDate ?? 0m;
        var workCompletedToDate = workCompletedPrevious + request.WorkCompletedThisPeriod;
        var totalCompletedAndStored = workCompletedToDate + request.StoredMaterials;

        var retainagePercent = subcontract.RetainagePercent;
        var retainageThisPeriod = request.WorkCompletedThisPeriod * (retainagePercent / 100m);
        var retainagePrevious = lastApp?.TotalRetainage ?? 0m;
        var totalRetainage = retainagePrevious + retainageThisPeriod;

        var totalEarnedLessRetainage = totalCompletedAndStored - totalRetainage;
        var lessPreviousCertificates = lastApp?.TotalEarnedLessRetainage ?? 0m;
        var currentPaymentDue = totalEarnedLessRetainage - lessPreviousCertificates;

        var payApp = new PaymentApplication
        {
            SubcontractId = request.SubcontractId,
            ApplicationNumber = nextNumber,
            PeriodStart = request.PeriodStart,
            PeriodEnd = request.PeriodEnd,
            ScheduledValue = subcontract.CurrentValue,
            WorkCompletedPrevious = workCompletedPrevious,
            WorkCompletedThisPeriod = request.WorkCompletedThisPeriod,
            WorkCompletedToDate = workCompletedToDate,
            StoredMaterials = request.StoredMaterials,
            TotalCompletedAndStored = totalCompletedAndStored,
            RetainagePercent = retainagePercent,
            RetainageThisPeriod = retainageThisPeriod,
            RetainagePrevious = retainagePrevious,
            TotalRetainage = totalRetainage,
            TotalEarnedLessRetainage = totalEarnedLessRetainage,
            LessPreviousCertificates = lessPreviousCertificates,
            CurrentPaymentDue = currentPaymentDue,
            Status = PaymentApplicationStatus.Draft,
            InvoiceNumber = request.InvoiceNumber,
            Notes = request.Notes
        };

        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapToDto(payApp));
    }

    internal static PaymentApplicationDto MapToDto(PaymentApplication pa) => new(
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
