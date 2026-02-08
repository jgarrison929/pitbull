using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.GetSubcontract;

public record GetSubcontractQuery(Guid Id) : IQuery<SubcontractDto>;
