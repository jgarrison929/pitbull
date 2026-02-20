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

public class WageDeterminationConfiguration : IEntityTypeConfiguration<WageDetermination>
{
    public void Configure(EntityTypeBuilder<WageDetermination> builder)
    {
        builder.ToTable("wage_determinations");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.DeterminationNumber)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(x => x.SourceAgency)
            .HasMaxLength(200);

        builder.HasMany(x => x.Rates)
            .WithOne(x => x.WageDetermination)
            .HasForeignKey(x => x.WageDeterminationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.ProjectId, x.EffectiveDate })
            .HasDatabaseName("IX_wage_determinations_tenant_company_project_effective");

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.DeterminationNumber })
            .HasDatabaseName("IX_wage_determinations_tenant_company_number");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class WageDeterminationRateConfiguration : IEntityTypeConfiguration<WageDeterminationRate>
{
    public void Configure(EntityTypeBuilder<WageDeterminationRate> builder)
    {
        builder.ToTable("wage_determination_rates");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.BaseRate).HasPrecision(14, 2);
        builder.Property(x => x.FringeRate).HasPrecision(14, 2);
        builder.Property(x => x.TotalRate).HasPrecision(14, 2);

        builder.HasOne(x => x.WorkClassification)
            .WithMany()
            .HasForeignKey(x => x.WorkClassificationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.WageDeterminationId, x.WorkClassificationId })
            .HasDatabaseName("IX_wage_determination_rates_tenant_company_determination_class");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class WorkClassificationConfiguration : IEntityTypeConfiguration<WorkClassification>
{
    public void Configure(EntityTypeBuilder<WorkClassification> builder)
    {
        builder.ToTable("work_classifications");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(x => x.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.Description)
            .HasMaxLength(500);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Code })
            .HasDatabaseName("IX_work_classifications_tenant_company_code")
            .IsUnique();

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class PayrollRunReviewConfiguration : IEntityTypeConfiguration<PayrollRunReview>
{
    public void Configure(EntityTypeBuilder<PayrollRunReview> builder)
    {
        builder.ToTable("payroll_run_reviews");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.ReviewerUserId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.Comments)
            .HasMaxLength(2000);

        builder.HasOne(x => x.PayrollRun)
            .WithMany()
            .HasForeignKey(x => x.PayrollRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayrollRunId })
            .HasDatabaseName("IX_payroll_run_reviews_tenant_company_run");

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Status, x.SubmittedAt })
            .HasDatabaseName("IX_payroll_run_reviews_tenant_company_status_submitted");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class PayrollExportConfiguration : IEntityTypeConfiguration<PayrollExport>
{
    public void Configure(EntityTypeBuilder<PayrollExport> builder)
    {
        builder.ToTable("payroll_exports");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.FilePath)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(x => x.FileName)
            .IsRequired()
            .HasMaxLength(255);

        builder.HasOne(x => x.PayrollRun)
            .WithMany()
            .HasForeignKey(x => x.PayrollRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Lines)
            .WithOne(x => x.PayrollExport)
            .HasForeignKey(x => x.PayrollExportId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayrollRunId, x.ExportedAt })
            .HasDatabaseName("IX_payroll_exports_tenant_company_run_exported");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class PayrollExportLineConfiguration : IEntityTypeConfiguration<PayrollExportLine>
{
    public void Configure(EntityTypeBuilder<PayrollExportLine> builder)
    {
        builder.ToTable("payroll_export_lines");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.EmployeeName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.MaskedSsn)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(x => x.StraightTimeHours).HasPrecision(10, 2);
        builder.Property(x => x.OvertimeHours).HasPrecision(10, 2);
        builder.Property(x => x.DoubletimeHours).HasPrecision(10, 2);
        builder.Property(x => x.HourlyRate).HasPrecision(14, 2);
        builder.Property(x => x.GrossPay).HasPrecision(14, 2);
        builder.Property(x => x.Deductions).HasPrecision(14, 2);
        builder.Property(x => x.NetPay).HasPrecision(14, 2);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayrollExportId })
            .HasDatabaseName("IX_payroll_export_lines_tenant_company_export");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class FringeBenefitAllocationConfiguration : IEntityTypeConfiguration<FringeBenefitAllocation>
{
    public void Configure(EntityTypeBuilder<FringeBenefitAllocation> builder)
    {
        builder.ToTable("fringe_benefit_allocations");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.RequiredFringeRate).HasPrecision(14, 2);
        builder.Property(x => x.CashFringeAmount).HasPrecision(14, 2);
        builder.Property(x => x.BenefitFringeAmount).HasPrecision(14, 2);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.EmployeeId, x.ProjectId })
            .HasDatabaseName("IX_fringe_benefit_allocations_tenant_company_employee_project");

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayrollRunLineId })
            .HasDatabaseName("IX_fringe_benefit_allocations_tenant_company_run_line");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
