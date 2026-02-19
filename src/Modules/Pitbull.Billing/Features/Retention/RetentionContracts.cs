using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.Retention;

// ── DTOs ──

public record RetentionPolicyDto(
    Guid Id,
    string Name,
    decimal PercentageRate,
    decimal? MaxAmount,
    decimal? ReleaseThreshold,
    RetentionAppliesTo AppliesTo,
    bool IsDefault,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record RetentionHoldDto(
    Guid Id,
    Guid ProjectId,
    Guid? ContractId,
    decimal OriginalAmount,
    decimal RetainedAmount,
    decimal ReleasedAmount,
    RetentionHoldStatus Status,
    Guid? RetentionPolicyId,
    decimal RetainagePercent,
    string? Description,
    DateOnly EffectiveDate,
    Guid? ReleasedByUserId,
    DateTime? ReleasedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

// ── Commands ──

public record CreateRetentionPolicyCommand(
    string Name,
    decimal PercentageRate,
    decimal? MaxAmount = null,
    decimal? ReleaseThreshold = null,
    RetentionAppliesTo AppliesTo = RetentionAppliesTo.Both,
    bool IsDefault = false
) : ICommand<RetentionPolicyDto>;

public record UpdateRetentionPolicyCommand(
    Guid PolicyId,
    string? Name = null,
    decimal? PercentageRate = null,
    decimal? MaxAmount = null,
    decimal? ReleaseThreshold = null,
    RetentionAppliesTo? AppliesTo = null,
    bool? IsDefault = null,
    bool? IsActive = null
) : ICommand<RetentionPolicyDto>;

public record CreateRetentionHoldCommand(
    Guid ProjectId,
    Guid? ContractId,
    decimal OriginalAmount,
    decimal RetainagePercent,
    string? Description = null,
    Guid? RetentionPolicyId = null,
    DateOnly? EffectiveDate = null
) : ICommand<RetentionHoldDto>;

public record ReleaseRetentionCommand(
    Guid HoldId,
    decimal ReleaseAmount,
    Guid ReleasedByUserId
) : ICommand<RetentionHoldDto>;

// ── Queries ──

public record ListRetentionPoliciesQuery(
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListRetentionPoliciesResult>;

public record ListRetentionPoliciesResult(
    IReadOnlyList<RetentionPolicyDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public record ListRetentionHoldsQuery(
    Guid? ProjectId = null,
    RetentionHoldStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListRetentionHoldsResult>;

public record ListRetentionHoldsResult(
    IReadOnlyList<RetentionHoldDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    decimal TotalRetained,
    decimal TotalReleased
);
