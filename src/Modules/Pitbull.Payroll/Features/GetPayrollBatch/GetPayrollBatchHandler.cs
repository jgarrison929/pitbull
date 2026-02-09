using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.GetPayrollBatch;

public class GetPayrollBatchHandler : IRequestHandler<GetPayrollBatchQuery, Result<PayrollBatchDto>>
{
    private readonly PitbullDbContext _context;
    public GetPayrollBatchHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PayrollBatchDto>> Handle(GetPayrollBatchQuery request, CancellationToken cancellationToken)
    {
        var batch = await _context.Set<PayrollBatch>()
            .FirstOrDefaultAsync(b => b.Id == request.Id && !b.IsDeleted, cancellationToken);
        if (batch == null)
            return Result.Failure<PayrollBatchDto>("Payroll batch not found", "NOT_FOUND");
        return Result.Success(PayrollBatchMapper.ToDto(batch));
    }
}
