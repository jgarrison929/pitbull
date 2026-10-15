using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Data;

public class TaxTableVersionConfiguration : IEntityTypeConfiguration<TaxTableVersion>
{
    public void Configure(EntityTypeBuilder<TaxTableVersion> builder)
    {
        builder.ToTable("tax_table_versions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Vendor).HasConversion<string>().HasMaxLength(40);
        builder.Property(x => x.Jurisdiction).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ContentHash).IsRequired().HasMaxLength(128);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Vendor, x.Jurisdiction, x.EffectiveDate })
            .HasDatabaseName("IX_tax_table_versions_tenant_company_vendor_jurisdiction_effective");
        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}
