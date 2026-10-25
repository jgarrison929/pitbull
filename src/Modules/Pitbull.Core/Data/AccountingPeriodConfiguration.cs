using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class AccountingPeriodConfiguration : IEntityTypeConfiguration<AccountingPeriod>
{
    public void Configure(EntityTypeBuilder<AccountingPeriod> builder)
    {
        builder.ToTable("accounting_periods");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.PeriodName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(p => p.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(p => p.LastReopenReason)
            .HasMaxLength(500);

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.FiscalYear, p.PeriodNumber })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_accounting_periods_tenant_company_year_period");

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.Status })
            .HasDatabaseName("IX_accounting_periods_tenant_company_status");

        builder.HasIndex(p => p.TenantId)
            .HasDatabaseName("IX_accounting_periods_TenantId");

        builder.HasIndex(p => p.CompanyId)
            .HasDatabaseName("IX_accounting_periods_CompanyId");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
