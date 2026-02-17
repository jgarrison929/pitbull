using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Data;

public class TenantSettingsConfiguration : IEntityTypeConfiguration<TenantSettings>
{
    public void Configure(EntityTypeBuilder<TenantSettings> builder)
    {
        builder.ToTable("tenant_settings");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.CompanyName).HasMaxLength(200).IsRequired();
        builder.Property(t => t.LogoUrl).HasMaxLength(500);
        builder.Property(t => t.PrimaryColor).HasMaxLength(20);
        builder.Property(t => t.Address).HasMaxLength(300);
        builder.Property(t => t.City).HasMaxLength(100);
        builder.Property(t => t.State).HasMaxLength(50);
        builder.Property(t => t.ZipCode).HasMaxLength(20);
        builder.Property(t => t.Phone).HasMaxLength(30);
        builder.Property(t => t.Website).HasMaxLength(200);
        builder.Property(t => t.TaxId).HasMaxLength(50);
        builder.Property(t => t.Timezone).HasMaxLength(50).HasDefaultValue("America/Los_Angeles");
        builder.Property(t => t.DateFormat).HasMaxLength(20).HasDefaultValue("MM/dd/yyyy");
        builder.Property(t => t.Currency).HasMaxLength(10).HasDefaultValue("USD");

        // One settings row per tenant
        builder.HasIndex(t => t.TenantId).IsUnique();

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
