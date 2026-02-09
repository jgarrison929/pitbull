using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateI9Record;

public class UpdateI9RecordHandler : IRequestHandler<UpdateI9RecordCommand, Result<I9RecordDto>>
{
    private readonly PitbullDbContext _context;
    public UpdateI9RecordHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<I9RecordDto>> Handle(UpdateI9RecordCommand request, CancellationToken cancellationToken)
    {
        var i9 = await _context.Set<I9Record>()
            .FirstOrDefaultAsync(i => i.Id == request.Id && !i.IsDeleted, cancellationToken);
        if (i9 == null)
            return Result.Failure<I9RecordDto>("I-9 record not found", "NOT_FOUND");

        // Section 2 fields
        if (request.Section2CompletedDate.HasValue)
        {
            i9.Section2CompletedDate = request.Section2CompletedDate;
            i9.Section2CompletedBy = request.Section2CompletedBy;
            i9.ListADocumentType = request.ListADocumentType;
            i9.ListADocumentNumber = request.ListADocumentNumber;
            i9.ListAExpirationDate = request.ListAExpirationDate;
            i9.ListBDocumentType = request.ListBDocumentType;
            i9.ListBDocumentNumber = request.ListBDocumentNumber;
            i9.ListBExpirationDate = request.ListBExpirationDate;
            i9.ListCDocumentType = request.ListCDocumentType;
            i9.ListCDocumentNumber = request.ListCDocumentNumber;
            i9.ListCExpirationDate = request.ListCExpirationDate;
            
            if (i9.Status == I9Status.Section1Complete)
                i9.Status = I9Status.Section2Complete;
        }

        // Section 3 fields
        if (request.Section3Date.HasValue)
        {
            i9.Section3Date = request.Section3Date;
            i9.Section3NewDocumentType = request.Section3NewDocumentType;
            i9.Section3NewDocumentNumber = request.Section3NewDocumentNumber;
            i9.Section3NewDocumentExpiration = request.Section3NewDocumentExpiration;
            i9.Section3RehireDate = request.Section3RehireDate;
        }

        if (request.Status.HasValue) i9.Status = request.Status.Value;
        if (request.EVerifyCaseNumber != null) i9.EVerifyCaseNumber = request.EVerifyCaseNumber;
        if (request.Notes != null) i9.Notes = request.Notes;
        i9.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success(I9RecordMapper.ToDto(i9));
    }
}
