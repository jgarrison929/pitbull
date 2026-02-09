using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetI9Record;

public record GetI9RecordQuery(Guid Id) : IRequest<Result<I9RecordDto>>;
