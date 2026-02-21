using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class WipReportConfiguration : IEntityTypeConfiguration<WipReport>
{
    public void Configure(EntityTypeBuilder<WipReport> builder)
    {
        builder.ToTable("wip_reports");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.GeneratedById)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(r => r.PostedToGlBy)
            .HasMaxLength(100);

        builder.HasMany(r => r.Lines)
            .WithOne(l => l.WipReport)
            .HasForeignKey(l => l.WipReportId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => new { r.TenantId, r.CompanyId, r.FiscalYear, r.PeriodNumber })
            .HasDatabaseName("IX_wip_reports_tenant_company_period");

        builder.HasIndex(r => new { r.TenantId, r.CompanyId, r.ReportDate })
            .HasDatabaseName("IX_wip_reports_tenant_company_report_date");

        // Prevent double-posting: each journal entry can only be linked to one WIP report
        builder.HasIndex(r => r.GlJournalEntryId)
            .IsUnique()
            .HasFilter("\"GlJournalEntryId\" IS NOT NULL")
            .HasDatabaseName("IX_wip_reports_gl_journal_entry_unique");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class WipReportLineConfiguration : IEntityTypeConfiguration<WipReportLine>
{
    public void Configure(EntityTypeBuilder<WipReportLine> builder)
    {
        builder.ToTable("wip_report_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.ContractAmount).HasPrecision(18, 2);
        builder.Property(l => l.ApprovedChangeOrders).HasPrecision(18, 2);
        builder.Property(l => l.RevisedContractAmount).HasPrecision(18, 2);
        builder.Property(l => l.TotalCostToDate).HasPrecision(18, 2);
        builder.Property(l => l.EstimatedCostToComplete).HasPrecision(18, 2);
        builder.Property(l => l.EstimatedTotalCost).HasPrecision(18, 2);
        builder.Property(l => l.PercentComplete).HasPrecision(8, 6);
        builder.Property(l => l.EarnedRevenue).HasPrecision(18, 2);
        builder.Property(l => l.BilledToDate).HasPrecision(18, 2);
        builder.Property(l => l.OverUnderBilling).HasPrecision(18, 2);

        builder.HasIndex(l => new { l.TenantId, l.CompanyId, l.WipReportId })
            .HasDatabaseName("IX_wip_report_lines_tenant_company_report");

        builder.HasIndex(l => new { l.TenantId, l.CompanyId, l.ProjectId })
            .HasDatabaseName("IX_wip_report_lines_tenant_company_project");

        builder.HasIndex(l => new { l.TenantId, l.CompanyId, l.WipReportId, l.ProjectId })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_wip_report_lines_tenant_company_report_project");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
