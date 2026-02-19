using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> builder)
    {
        builder.ToTable("vendors");

        builder.HasKey(v => v.Id);

        builder.Property(v => v.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(v => v.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(v => v.TaxId)
            .HasMaxLength(50);

        builder.Property(v => v.ContactName)
            .HasMaxLength(200);

        builder.Property(v => v.ContactEmail)
            .HasMaxLength(255);

        builder.Property(v => v.Phone)
            .HasMaxLength(50);

        builder.Property(v => v.Address)
            .HasMaxLength(500);

        builder.Property(v => v.City)
            .HasMaxLength(100);

        builder.Property(v => v.State)
            .HasMaxLength(50);

        builder.Property(v => v.Zip)
            .HasMaxLength(20);

        builder.Property(v => v.MinorityWbeStatus)
            .HasMaxLength(100);

        builder.Property(v => v.TradeClassification)
            .HasMaxLength(200);

        builder.Property(v => v.PaymentTerms)
            .HasMaxLength(50);

        builder.Property(v => v.IsActive)
            .HasDefaultValue(true);

        builder.HasIndex(v => new { v.TenantId, v.CompanyId, v.Code })
            .IsUnique()
            .HasDatabaseName("IX_vendors_tenant_company_code");

        builder.HasIndex(v => new { v.TenantId, v.CompanyId, v.Name })
            .HasDatabaseName("IX_vendors_tenant_company_name");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
