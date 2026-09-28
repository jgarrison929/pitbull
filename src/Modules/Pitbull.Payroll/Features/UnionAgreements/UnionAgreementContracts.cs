using Pitbull.Core.CQRS;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.UnionAgreements;

public record UnionAgreementDto(
    Guid Id,
    string UnionName,
    string LocalNumber,
    string? InternationalBody,
    string? AgreementNumber,
    string Name,
    string? Jurisdiction,
    string? State,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    UnionAgreementStatus Status,
    string StatusName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateUnionAgreementCommand(
    string UnionName,
    string LocalNumber,
    string Name,
    DateOnly EffectiveDate,
    string? InternationalBody = null,
    string? AgreementNumber = null,
    string? Jurisdiction = null,
    string? State = null,
    DateOnly? ExpirationDate = null,
    UnionAgreementStatus Status = UnionAgreementStatus.Active) : ICommand<UnionAgreementDto>;

public record UpdateUnionAgreementCommand(
    Guid Id,
    string? UnionName = null,
    string? LocalNumber = null,
    string? Name = null,
    string? InternationalBody = null,
    string? AgreementNumber = null,
    string? Jurisdiction = null,
    string? State = null,
    DateOnly? EffectiveDate = null,
    DateOnly? ExpirationDate = null,
    UnionAgreementStatus? Status = null) : ICommand<UnionAgreementDto>;

public record ListUnionAgreementsQuery(
    UnionAgreementStatus? Status = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25) : IQuery<ListUnionAgreementsResult>;

public record ListUnionAgreementsResult(
    IReadOnlyList<UnionAgreementDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);
