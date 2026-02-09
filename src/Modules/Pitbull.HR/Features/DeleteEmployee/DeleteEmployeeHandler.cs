using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;

namespace Pitbull.HR.Features.DeleteEmployee;

public class DeleteEmployeeHandler : IRequestHandler<DeleteEmployeeCommand, bool>
{
    private readonly PitbullDbContext _context;

    public DeleteEmployeeHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteEmployeeCommand request, CancellationToken cancellationToken)
    {
        var employee = await _context.Set<Domain.Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);

        if (employee == null)
        {
            return false;
        }

        employee.IsDeleted = true;
        employee.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
