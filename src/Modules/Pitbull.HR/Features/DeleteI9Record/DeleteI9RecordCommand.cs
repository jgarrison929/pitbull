using MediatR;

namespace Pitbull.HR.Features.DeleteI9Record;

public record DeleteI9RecordCommand(Guid Id) : IRequest<bool>;
