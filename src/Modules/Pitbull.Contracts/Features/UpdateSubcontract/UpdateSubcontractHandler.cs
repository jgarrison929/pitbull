using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.UpdateSubcontract;

public sealed class UpdateSubcontractHandler(PitbullDbContext db)
    : IRequestHandler<UpdateSubcontractCommand, Result<SubcontractDto>>
{
    public async Task<Result<SubcontractDto>> Handle(
        UpdateSubcontractCommand request, CancellationToken cancellationToken)
    {
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        if (subcontract is null)
            return Result.Failure<SubcontractDto>("Subcontract not found", "NOT_FOUND");

        subcontract.SubcontractNumber = request.SubcontractNumber;
        subcontract.SubcontractorName = request.SubcontractorName;
        subcontract.SubcontractorContact = request.SubcontractorContact;
        subcontract.SubcontractorEmail = request.SubcontractorEmail;
        subcontract.SubcontractorPhone = request.SubcontractorPhone;
        subcontract.SubcontractorAddress = request.SubcontractorAddress;
        subcontract.ScopeOfWork = request.ScopeOfWork;
        subcontract.TradeCode = request.TradeCode;
        subcontract.OriginalValue = request.OriginalValue;
        subcontract.RetainagePercent = request.RetainagePercent;
        subcontract.ExecutionDate = request.ExecutionDate;
        subcontract.StartDate = request.StartDate;
        subcontract.CompletionDate = request.CompletionDate;
        subcontract.Status = request.Status;
        subcontract.InsuranceExpirationDate = request.InsuranceExpirationDate;
        subcontract.InsuranceCurrent = request.InsuranceCurrent;
        subcontract.LicenseNumber = request.LicenseNumber;
        subcontract.Notes = request.Notes;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(CreateSubcontractHandler.MapToDto(subcontract));
    }
}
