using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

public static class UnionMembershipMapper
{
    public static UnionMembershipDto ToDto(UnionMembership u) => new(
        u.Id, u.EmployeeId, u.UnionLocal, u.MembershipNumber, u.Classification,
        u.ApprenticeLevel, u.JoinDate, u.DuesPaid, u.DuesPaidThrough,
        u.DispatchNumber, u.DispatchDate, u.DispatchListPosition,
        u.FringeRate, u.HealthWelfareRate, u.PensionRate, u.TrainingRate,
        u.EffectiveDate, u.ExpirationDate, u.Notes, u.IsActive, u.CreatedAt, u.UpdatedAt
    );

    public static UnionMembershipListDto ToListDto(UnionMembership u, string employeeName) => new(
        u.Id, u.EmployeeId, employeeName, u.UnionLocal, u.MembershipNumber,
        u.Classification, u.DuesPaid, u.DispatchNumber, u.IsActive
    );
}
