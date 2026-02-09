using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Data;

public class PayrollEntryConfiguration : IEntityTypeConfiguration<PayrollEntry>
{
    public void Configure(EntityTypeBuilder<PayrollEntry> builder)
    {
        builder.ToTable("payroll_entries", "payroll");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.TenantId).IsRequired();
        builder.Property(e => e.PayrollBatchId).IsRequired();
        builder.Property(e => e.EmployeeId).IsRequired();
        
        // Hours
        builder.Property(e => e.RegularHours).HasPrecision(10, 2);
        builder.Property(e => e.OvertimeHours).HasPrecision(10, 2);
        builder.Property(e => e.DoubleTimeHours).HasPrecision(10, 2);
        builder.Property(e => e.PtoHours).HasPrecision(10, 2);
        builder.Property(e => e.HolidayHours).HasPrecision(10, 2);
        builder.Property(e => e.TotalHours).HasPrecision(10, 2);
        
        // Rates
        builder.Property(e => e.RegularRate).HasPrecision(10, 4);
        builder.Property(e => e.OvertimeRate).HasPrecision(10, 4);
        builder.Property(e => e.DoubleTimeRate).HasPrecision(10, 4);
        
        // Earnings
        builder.Property(e => e.RegularPay).HasPrecision(18, 2);
        builder.Property(e => e.OvertimePay).HasPrecision(18, 2);
        builder.Property(e => e.DoubleTimePay).HasPrecision(18, 2);
        builder.Property(e => e.PtoPay).HasPrecision(18, 2);
        builder.Property(e => e.HolidayPay).HasPrecision(18, 2);
        builder.Property(e => e.BonusPay).HasPrecision(18, 2);
        builder.Property(e => e.OtherEarnings).HasPrecision(18, 2);
        builder.Property(e => e.GrossPay).HasPrecision(18, 2);
        
        // Federal taxes
        builder.Property(e => e.FederalWithholding).HasPrecision(18, 2);
        builder.Property(e => e.SocialSecurity).HasPrecision(18, 2);
        builder.Property(e => e.Medicare).HasPrecision(18, 2);
        builder.Property(e => e.AdditionalMedicare).HasPrecision(18, 2);
        
        // State/local
        builder.Property(e => e.WorkState).HasMaxLength(2);
        builder.Property(e => e.StateWithholding).HasPrecision(18, 2);
        builder.Property(e => e.StateDisability).HasPrecision(18, 2);
        builder.Property(e => e.LocalWithholding).HasPrecision(18, 2);
        
        // Deductions
        builder.Property(e => e.TotalDeductions).HasPrecision(18, 2);
        builder.Property(e => e.PreTaxDeductions).HasPrecision(18, 2);
        builder.Property(e => e.PostTaxDeductions).HasPrecision(18, 2);
        builder.Property(e => e.NetPay).HasPrecision(18, 2);
        
        // Employer costs
        builder.Property(e => e.EmployerSocialSecurity).HasPrecision(18, 2);
        builder.Property(e => e.EmployerMedicare).HasPrecision(18, 2);
        builder.Property(e => e.EmployerFuta).HasPrecision(18, 2);
        builder.Property(e => e.EmployerSuta).HasPrecision(18, 2);
        builder.Property(e => e.WorkersCompPremium).HasPrecision(18, 2);
        
        // Union fringes
        builder.Property(e => e.UnionHealthWelfare).HasPrecision(18, 2);
        builder.Property(e => e.UnionPension).HasPrecision(18, 2);
        builder.Property(e => e.UnionTraining).HasPrecision(18, 2);
        builder.Property(e => e.UnionOther).HasPrecision(18, 2);
        builder.Property(e => e.TotalUnionFringes).HasPrecision(18, 2);
        builder.Property(e => e.TotalEmployerTaxes).HasPrecision(18, 2);
        builder.Property(e => e.TotalEmployerCost).HasPrecision(18, 2);
        
        // YTD
        builder.Property(e => e.YtdGross).HasPrecision(18, 2);
        builder.Property(e => e.YtdFederalWithholding).HasPrecision(18, 2);
        builder.Property(e => e.YtdSocialSecurity).HasPrecision(18, 2);
        builder.Property(e => e.YtdMedicare).HasPrecision(18, 2);
        builder.Property(e => e.YtdStateWithholding).HasPrecision(18, 2);
        builder.Property(e => e.YtdNet).HasPrecision(18, 2);
        
        builder.Property(e => e.Notes).HasMaxLength(500);
        builder.Property(e => e.IsDeleted).HasDefaultValue(false);

        builder.HasOne(e => e.PayrollBatch).WithMany(b => b.Entries)
            .HasForeignKey(e => e.PayrollBatchId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.TenantId);
        builder.HasIndex(e => e.PayrollBatchId);
        builder.HasIndex(e => e.EmployeeId);
        builder.HasIndex(e => new { e.PayrollBatchId, e.EmployeeId }).IsUnique();
    }
}
