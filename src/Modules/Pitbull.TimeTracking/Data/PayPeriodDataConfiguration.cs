using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.TimeTracking.Data;

/// <summary>
/// EF Core configuration for PayPeriod entity
/// </summary>
public class PayPeriodConfiguration : IEntityTypeConfiguration<PayPeriod>
{
    public void Configure(EntityTypeBuilder<PayPeriod> builder)
    {
        builder.ToTable("pay_periods");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.StartDate)
            .IsRequired()
            .HasComment("Start date of the pay period (inclusive)");

        builder.Property(p => p.EndDate)
            .IsRequired()
            .HasComment("End date of the pay period (inclusive)");

        builder.Property(p => p.Status)
            .IsRequired()
            .HasComment("Status: 0=Open, 1=Locked, 2=Closed");

        builder.Property(p => p.Name)
            .HasMaxLength(100)
            .IsRequired()
            .HasComment("Auto-generated display name for the period");

        builder.Property(p => p.LockedAt)
            .HasComment("When the period was locked");

        builder.Property(p => p.LockedById)
            .HasComment("User who locked the period");

        builder.Property(p => p.PayrollExportMarkedAt)
            .HasComment("When payroll export was finalized on close");

        // Indexes
        builder.HasIndex(p => p.TenantId)
            .HasDatabaseName("IX_pay_periods_tenant");

        builder.HasIndex(p => new { p.TenantId, p.StartDate, p.EndDate })
            .HasDatabaseName("IX_pay_periods_date_range");

        builder.HasIndex(p => new { p.TenantId, p.Status })
            .HasDatabaseName("IX_pay_periods_status");

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.StartDate })
            .IsUnique()
            .HasDatabaseName("IX_pay_periods_unique_start");
    }
}

/// <summary>
/// EF Core configuration for PayPeriodConfiguration entity
/// </summary>
public class PayPeriodConfigurationDataConfiguration : IEntityTypeConfiguration<Domain.PayPeriodConfiguration>
{
    public void Configure(EntityTypeBuilder<Domain.PayPeriodConfiguration> builder)
    {
        builder.ToTable("pay_period_configurations");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Type)
            .IsRequired()
            .HasComment("Period type: 0=Weekly, 1=BiWeekly, 2=SemiMonthly, 3=Monthly");

        builder.Property(c => c.WeekStartDay)
            .IsRequired()
            .HasComment("Day of week that starts the period (0=Sunday)");

        builder.Property(c => c.SemiMonthlyFirstDay)
            .IsRequired()
            .HasComment("First day of month for semi-monthly (e.g., 1)");

        builder.Property(c => c.SemiMonthlySecondDay)
            .IsRequired()
            .HasComment("Second day of month for semi-monthly (e.g., 16)");

        builder.Property(c => c.AutoLockEnabled)
            .IsRequired()
            .HasDefaultValue(false)
            .HasComment("Whether to auto-lock periods after grace days");

        builder.Property(c => c.AutoLockDaysAfterEnd)
            .IsRequired()
            .HasDefaultValue(3)
            .HasComment("Days after period ends before auto-lock");

        builder.Property(c => c.PeriodsToGenerateAhead)
            .IsRequired()
            .HasDefaultValue(4)
            .HasComment("How many periods ahead to auto-generate");

        builder.Property(c => c.BiWeeklyReferenceDate)
            .HasComment("Reference date for bi-weekly calculation");

        builder.Property(c => c.EnforcementEnabled)
            .IsRequired()
            .HasDefaultValue(true)
            .HasComment("Whether pay period locking is enforced");

        // Indexes
        builder.HasIndex(c => c.TenantId)
            .IsUnique()
            .HasDatabaseName("IX_pay_period_configurations_tenant_unique");
    }
}
