using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Data;

public class DeductionConfiguration : IEntityTypeConfiguration<Deduction>
{
    public void Configure(EntityTypeBuilder<Deduction> builder)
    {
        builder.ToTable("deductions", "hr");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.TenantId).IsRequired();
        builder.Property(d => d.EmployeeId).IsRequired();
        builder.Property(d => d.DeductionCode).IsRequired().HasMaxLength(20);
        builder.Property(d => d.Description).IsRequired().HasMaxLength(100);
        builder.Property(d => d.Method).IsRequired().HasConversion<int>();
        builder.Property(d => d.Amount).HasPrecision(10, 4);
        builder.Property(d => d.MaxPerPeriod).HasPrecision(10, 2);
        builder.Property(d => d.AnnualMax).HasPrecision(12, 2);
        builder.Property(d => d.YtdAmount).HasPrecision(12, 2);
        builder.Property(d => d.EmployerMatch).HasPrecision(10, 4);
        builder.Property(d => d.EmployerMatchMax).HasPrecision(10, 2);
        builder.Property(d => d.CaseNumber).HasMaxLength(50);
        builder.Property(d => d.GarnishmentPayee).HasMaxLength(200);
        builder.Property(d => d.Notes).HasMaxLength(500);
        builder.Property(d => d.IsDeleted).HasDefaultValue(false);

        builder.Ignore(d => d.IsActive);

        builder.HasOne(d => d.Employee).WithMany().HasForeignKey(d => d.EmployeeId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(d => d.TenantId);
        builder.HasIndex(d => d.EmployeeId);
        builder.HasIndex(d => new { d.EmployeeId, d.DeductionCode });
        builder.HasIndex(d => d.Priority);
    }
}
