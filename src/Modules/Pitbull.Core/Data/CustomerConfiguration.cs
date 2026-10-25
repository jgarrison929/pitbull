using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(c => c.ContactName)
            .HasMaxLength(200);

        builder.Property(c => c.ContactEmail)
            .HasMaxLength(255);

        builder.Property(c => c.Phone)
            .HasMaxLength(50);

        builder.Property(c => c.Address)
            .HasMaxLength(500);

        builder.Property(c => c.City)
            .HasMaxLength(100);

        builder.Property(c => c.State)
            .HasMaxLength(50);

        builder.Property(c => c.Zip)
            .HasMaxLength(20);

        builder.Property(c => c.PaymentTerms)
            .HasMaxLength(50);

        builder.Property(c => c.CreditLimit)
            .HasPrecision(14, 2);

        builder.Property(c => c.IsActive)
            .HasDefaultValue(true);

        builder.HasIndex(c => new { c.TenantId, c.CompanyId, c.Code })
            .IsUnique()
            .HasDatabaseName("IX_customers_tenant_company_code");

        builder.HasIndex(c => new { c.TenantId, c.CompanyId, c.Name })
            .HasDatabaseName("IX_customers_tenant_company_name");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
