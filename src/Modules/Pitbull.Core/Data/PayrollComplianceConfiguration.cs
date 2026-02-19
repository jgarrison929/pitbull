using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class PayrollRunConfiguration : IEntityTypeConfiguration<PayrollRun>
{
    public void Configure(EntityTypeBuilder<PayrollRun> builder)
    {
        builder.ToTable("payroll_runs");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.TotalGross).HasPrecision(14, 2);
        builder.Property(x => x.TotalNet).HasPrecision(14, 2);

        builder.HasMany(x => x.Lines)
            .WithOne(x => x.PayrollRun)
            .HasForeignKey(x => x.PayrollRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayPeriodId })
            .HasDatabaseName("IX_payroll_runs_tenant_company_period");

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.RunDate })
            .HasDatabaseName("IX_payroll_runs_tenant_company_run_date");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class PayrollRunLineConfiguration : IEntityTypeConfiguration<PayrollRunLine>
{
    public void Configure(EntityTypeBuilder<PayrollRunLine> builder)
    {
        builder.ToTable("payroll_run_lines");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.RegularHours).HasPrecision(10, 2);
        builder.Property(x => x.OvertimeHours).HasPrecision(10, 2);
        builder.Property(x => x.DoubletimeHours).HasPrecision(10, 2);

        builder.Property(x => x.RegularPay).HasPrecision(14, 2);
        builder.Property(x => x.OvertimePay).HasPrecision(14, 2);
        builder.Property(x => x.DoubletimePay).HasPrecision(14, 2);
        builder.Property(x => x.GrossPay).HasPrecision(14, 2);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayrollRunId })
            .HasDatabaseName("IX_payroll_run_lines_tenant_company_run");

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.EmployeeId })
            .HasDatabaseName("IX_payroll_run_lines_tenant_company_employee");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class CertifiedPayrollReportConfiguration : IEntityTypeConfiguration<CertifiedPayrollReport>
{
    public void Configure(EntityTypeBuilder<CertifiedPayrollReport> builder)
    {
        builder.ToTable("certified_payroll_reports");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.WHDFormNumber)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("WH-347");

        builder.HasOne(x => x.PayrollRun)
            .WithMany()
            .HasForeignKey(x => x.PayrollRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayrollRunId, x.ProjectId })
            .HasDatabaseName("IX_certified_payroll_reports_tenant_company_run_project");

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.WeekEnding })
            .HasDatabaseName("IX_certified_payroll_reports_tenant_company_week_ending");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
