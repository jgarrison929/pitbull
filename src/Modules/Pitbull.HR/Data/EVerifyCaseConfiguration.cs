using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Data;

public class EVerifyCaseConfiguration : IEntityTypeConfiguration<EVerifyCase>
{
    public void Configure(EntityTypeBuilder<EVerifyCase> builder)
    {
        builder.ToTable("everify_cases", "hr");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.TenantId).IsRequired();
        builder.Property(e => e.EmployeeId).IsRequired();
        builder.Property(e => e.CaseNumber).IsRequired().HasMaxLength(30);
        builder.Property(e => e.Status).IsRequired().HasConversion<int>();
        builder.Property(e => e.Result).HasConversion<int>();
        builder.Property(e => e.SSAResult).HasConversion<int>();
        builder.Property(e => e.DHSResult).HasConversion<int>();
        builder.Property(e => e.SubmittedBy).IsRequired().HasMaxLength(100);
        builder.Property(e => e.Notes).HasMaxLength(500);
        builder.Property(e => e.IsDeleted).HasDefaultValue(false);

        builder.HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(e => e.I9Record).WithMany().HasForeignKey(e => e.I9RecordId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(e => e.TenantId);
        builder.HasIndex(e => e.EmployeeId);
        builder.HasIndex(e => e.CaseNumber);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.TNCDeadline);
    }
}
