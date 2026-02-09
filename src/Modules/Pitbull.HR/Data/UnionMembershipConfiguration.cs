using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Data;

public class UnionMembershipConfiguration : IEntityTypeConfiguration<UnionMembership>
{
    public void Configure(EntityTypeBuilder<UnionMembership> builder)
    {
        builder.ToTable("union_memberships", "hr");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.TenantId).IsRequired();
        builder.Property(u => u.EmployeeId).IsRequired();
        builder.Property(u => u.UnionLocal).IsRequired().HasMaxLength(100);
        builder.Property(u => u.MembershipNumber).IsRequired().HasMaxLength(50);
        builder.Property(u => u.Classification).IsRequired().HasMaxLength(50);
        builder.Property(u => u.DispatchNumber).HasMaxLength(50);
        builder.Property(u => u.FringeRate).HasPrecision(10, 4);
        builder.Property(u => u.HealthWelfareRate).HasPrecision(10, 4);
        builder.Property(u => u.PensionRate).HasPrecision(10, 4);
        builder.Property(u => u.TrainingRate).HasPrecision(10, 4);
        builder.Property(u => u.Notes).HasMaxLength(500);
        builder.Property(u => u.IsDeleted).HasDefaultValue(false);

        builder.Ignore(u => u.IsActive);

        builder.HasOne(u => u.Employee).WithMany().HasForeignKey(u => u.EmployeeId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(u => u.TenantId);
        builder.HasIndex(u => u.EmployeeId);
        builder.HasIndex(u => u.UnionLocal);
        builder.HasIndex(u => new { u.EmployeeId, u.UnionLocal });
    }
}
