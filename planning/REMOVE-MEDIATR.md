# Remove MediatR Dependency - Architectural Simplification

## Background
MediatR v13+ introduced commercial licensing requirements, making it unsuitable for Pitbull. This presents an opportunity to simplify our architecture and remove unnecessary abstraction layers.

## Decision: Remove MediatR, Keep CQRS Benefits

### Current State
```csharp
// MediatR approach - complex
public async Task<Result<ProjectDto>> Handle(GetProjectQuery request, CancellationToken cancellationToken)

// Controller
var result = await _mediator.Send(new GetProjectQuery(id));
```

### Target State
```csharp
// Direct approach - simple
public async Task<Result<ProjectDto>> GetProjectAsync(int id, CancellationToken cancellationToken)

// Controller
var result = await _projectService.GetProjectAsync(id, cancellationToken);
```

## Implementation Plan

### Phase 1: Infrastructure Setup
- [ ] Create `IProjectService`, `IBidService`, etc. interfaces
- [ ] Create service implementations with direct CQRS methods
- [ ] Register services in DI container

### Phase 2: Replace Queries (Read Operations)
- [ ] `GetProjectQuery` → `IProjectService.GetProjectAsync()`
- [ ] `GetProjectsQuery` → `IProjectService.GetProjectsAsync()`
- [ ] `GetBidQuery` → `IBidService.GetBidAsync()`
- [ ] Update controllers to use services directly

### Phase 3: Replace Commands (Write Operations) 
- [ ] `CreateProjectCommand` → `IProjectService.CreateProjectAsync()`
- [ ] `UpdateProjectCommand` → `IProjectService.UpdateProjectAsync()`
- [ ] `CreateBidCommand` → `IBidService.CreateBidAsync()`
- [ ] Maintain validation and error handling patterns

### Phase 4: Remove MediatR
- [ ] Remove MediatR packages from all projects
- [ ] Delete handler classes
- [ ] Delete request/response DTOs (replace with method parameters)
- [ ] Update tests to use services directly

## Benefits

### ✅ Immediate Benefits
- **No licensing costs** - eliminates commercial dependency
- **Simpler debugging** - direct method calls, clear stack traces
- **Better performance** - no reflection/pipeline overhead
- **Easier onboarding** - standard C# patterns vs. MediatR magic

### ✅ Long-term Benefits
- **Reduced complexity** - fewer abstractions to maintain
- **Better IDE support** - direct references vs. magic strings
- **Clearer architecture** - obvious where business logic lives
- **Customer appeal** - "clean, understandable code with no hidden costs"

## Migration Strategy

### Backward Compatibility
- Keep existing API contracts unchanged
- Migrate one module at a time (Projects → Bids → Core)
- Run both patterns side-by-side during transition

### Testing
- Update unit tests to mock services instead of handlers
- Integration tests remain mostly unchanged (same HTTP contracts)
- Ensure all business logic validation is preserved

## Risk Mitigation

### Low Risk Approach
1. **Start with new features** - implement directly without MediatR
2. **Migrate stable modules** - Projects module first (well-tested)
3. **Leave complex areas** for last - authentication, authorization

### Validation
- All existing API contracts must work identically
- Performance should improve (less overhead)
- Error handling patterns must be preserved

## Timeline
- **Week 1:** Phase 1 - Infrastructure setup
- **Week 2:** Phase 2 - Query operations  
- **Week 3:** Phase 3 - Command operations
- **Week 4:** Phase 4 - Remove MediatR completely

## Example Service Pattern

```csharp
public interface IProjectService
{
    Task<Result<ProjectDto>> GetProjectAsync(int id, CancellationToken cancellationToken = default);
    Task<Result<ProjectDto[]>> GetProjectsAsync(GetProjectsFilter filter, CancellationToken cancellationToken = default);
    Task<Result<ProjectDto>> CreateProjectAsync(CreateProjectRequest request, CancellationToken cancellationToken = default);
    Task<Result<ProjectDto>> UpdateProjectAsync(int id, UpdateProjectRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteProjectAsync(int id, CancellationToken cancellationToken = default);
}

public class ProjectService : IProjectService
{
    private readonly IProjectRepository _repository;
    private readonly IValidator<CreateProjectRequest> _createValidator;
    private readonly ILogger<ProjectService> _logger;

    // Direct, clear, testable
    public async Task<Result<ProjectDto>> GetProjectAsync(int id, CancellationToken cancellationToken = default)
    {
        var project = await _repository.GetByIdAsync(id, cancellationToken);
        return project == null 
            ? Result<ProjectDto>.Failure("Project not found")
            : Result<ProjectDto>.Success(project.ToDto());
    }
}
```

---

**This architectural simplification aligns with Pitbull's core value: powerful construction software without unnecessary complexity.**