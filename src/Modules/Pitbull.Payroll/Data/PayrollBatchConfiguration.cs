using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Data;

public class PayrollBatchConfiguration : IEntityTypeConfiguration<PayrollBatch>
{
    public void Configure(EntityTypeBuilder<PayrollBatch> builder)
    {
        builder.ToTable("payroll_batches", "payroll");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.TenantId).IsRequired();
        builder.Property(b => b.PayPeriodId).IsRequired();
        builder.Property(b => b.BatchNumber).IsRequired().HasMaxLength(20);
        builder.Property(b => b.Status).IsRequired().HasConversion<int>();
        
        builder.Property(b => b.TotalRegularHours).HasPrecision(10, 2);
        builder.Property(b => b.TotalOvertimeHours).HasPrecision(10, 2);
        builder.Property(b => b.TotalDoubleTimeHours).HasPrecision(10, 2);
        builder.Property(b => b.TotalGrossPay).HasPrecision(18, 2);
        builder.Property(b => b.TotalDeductions).HasPrecision(18, 2);
        builder.Property(b => b.TotalNetPay).HasPrecision(18, 2);
        builder.Property(b => b.TotalEmployerTaxes).HasPrecision(18, 2);
        builder.Property(b => b.TotalUnionFringes).HasPrecision(18, 2);
        builder.Property(b => b.TotalEmployerCost).HasPrecision(18, 2);
        
        builder.Property(b => b.CreatedBy).HasMaxLength(100);
        builder.Property(b => b.CalculatedBy).HasMaxLength(100);
        builder.Property(b => b.ApprovedBy).HasMaxLength(100);
        builder.Property(b => b.PostedBy).HasMaxLength(100);
        builder.Property(b => b.Notes).HasMaxLength(500);
        builder.Property(b => b.IsDeleted).HasDefaultValue(false);

        builder.HasOne(b => b.PayPeriod).WithMany(p => p.Batches)
            .HasForeignKey(b => b.PayPeriodId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(b => b.TenantId);
        builder.HasIndex(b => b.PayPeriodId);
        builder.HasIndex(b => b.Status);
        builder.HasIndex(b => new { b.TenantId, b.BatchNumber }).IsUnique();
    }
}
