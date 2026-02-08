using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.CreateSubcontract;

public sealed class CreateSubcontractHandler(PitbullDbContext db)
    : IRequestHandler<CreateSubcontractCommand, Result<SubcontractDto>>
{
    public async Task<Result<SubcontractDto>> Handle(
        CreateSubcontractCommand request, CancellationToken cancellationToken)
    {
        // Check for duplicate subcontract number within same project
        var exists = await db.Set<Subcontract>()
            .AnyAsync(s => s.ProjectId == request.ProjectId 
                && s.SubcontractNumber == request.SubcontractNumber, cancellationToken);
        
        if (exists)
        {
            return Result.Failure<SubcontractDto>(
                $"Subcontract number '{request.SubcontractNumber}' already exists for this project.",
                "DUPLICATE_NUMBER");
        }

        var subcontract = new Subcontract
        {
            ProjectId = request.ProjectId,
            SubcontractNumber = request.SubcontractNumber,
            SubcontractorName = request.SubcontractorName,
            SubcontractorContact = request.SubcontractorContact,
            SubcontractorEmail = request.SubcontractorEmail,
            SubcontractorPhone = request.SubcontractorPhone,
            SubcontractorAddress = request.SubcontractorAddress,
            ScopeOfWork = request.ScopeOfWork,
            TradeCode = request.TradeCode,
            OriginalValue = request.OriginalValue,
            CurrentValue = request.OriginalValue, // Initially same as original
            RetainagePercent = request.RetainagePercent,
            StartDate = request.StartDate,
            CompletionDate = request.CompletionDate,
            LicenseNumber = request.LicenseNumber,
            Notes = request.Notes,
            Status = SubcontractStatus.Draft
        };

        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapToDto(subcontract));
    }

    internal static SubcontractDto MapToDto(Subcontract s) => new(
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
}
