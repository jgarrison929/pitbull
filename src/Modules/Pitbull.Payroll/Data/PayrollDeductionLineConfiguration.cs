using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Data;

public class PayrollDeductionLineConfiguration : IEntityTypeConfiguration<PayrollDeductionLine>
{
    public void Configure(EntityTypeBuilder<PayrollDeductionLine> builder)
    {
        builder.ToTable("payroll_deduction_lines", "payroll");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.TenantId).IsRequired();
        builder.Property(d => d.PayrollEntryId).IsRequired();
        builder.Property(d => d.DeductionId).IsRequired();
        builder.Property(d => d.DeductionCode).IsRequired().HasMaxLength(20);
        builder.Property(d => d.Description).IsRequired().HasMaxLength(100);
        builder.Property(d => d.Amount).HasPrecision(18, 2);
        builder.Property(d => d.YtdBefore).HasPrecision(18, 2);
        builder.Property(d => d.YtdAfter).HasPrecision(18, 2);
        builder.Property(d => d.EmployerMatch).HasPrecision(18, 2);
        builder.Property(d => d.IsDeleted).HasDefaultValue(false);

        builder.HasOne(d => d.PayrollEntry).WithMany(e => e.DeductionLines)
            .HasForeignKey(d => d.PayrollEntryId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.TenantId);
        builder.HasIndex(d => d.PayrollEntryId);
        builder.HasIndex(d => d.DeductionId);
    }
}
