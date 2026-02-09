using MediatR;

namespace Pitbull.HR.Features.DeleteEmployee;

public record DeleteEmployeeCommand(Guid Id) : IRequest<bool>;
