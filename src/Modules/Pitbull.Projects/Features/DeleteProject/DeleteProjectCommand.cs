using Pitbull.Core.CQRS;

namespace Pitbull.Projects.Features.DeleteProject;

public record DeleteProjectCommand(Guid Id) : ICommand<bool>;
