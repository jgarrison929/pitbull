using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Data;

public class PayPeriodConfiguration : IEntityTypeConfiguration<PayPeriod>
{
    public void Configure(EntityTypeBuilder<PayPeriod> builder)
    {
        builder.ToTable("pay_periods", "payroll");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.TenantId).IsRequired();
        builder.Property(p => p.StartDate).IsRequired();
        builder.Property(p => p.EndDate).IsRequired();
        builder.Property(p => p.PayDate).IsRequired();
        builder.Property(p => p.Frequency).IsRequired().HasConversion<int>();
        builder.Property(p => p.Status).IsRequired().HasConversion<int>();
        builder.Property(p => p.ProcessedBy).HasMaxLength(100);
        builder.Property(p => p.ApprovedBy).HasMaxLength(100);
        builder.Property(p => p.Notes).HasMaxLength(500);
        builder.Property(p => p.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(p => p.TenantId);
        builder.HasIndex(p => new { p.TenantId, p.StartDate, p.EndDate });
        builder.HasIndex(p => p.Status);
    }
}
