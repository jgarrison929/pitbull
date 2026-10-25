using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Billing.Domain;

namespace Pitbull.Billing.Data;

public class TaxJurisdictionConfiguration : IEntityTypeConfiguration<TaxJurisdiction>
{
    public void Configure(EntityTypeBuilder<TaxJurisdiction> builder)
    {
        builder.ToTable("tax_jurisdictions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Code).IsRequired().HasMaxLength(50);
        builder.Property(x => x.State).HasMaxLength(50);
        builder.Property(x => x.County).HasMaxLength(100);
        builder.Property(x => x.City).HasMaxLength(100);

        builder.Property(x => x.CombinedRate).HasPrecision(7, 4);
        builder.Property(x => x.StateRate).HasPrecision(7, 4);
        builder.Property(x => x.CountyRate).HasPrecision(7, 4);
        builder.Property(x => x.CityRate).HasPrecision(7, 4);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Code })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_tax_jurisdictions_tenant_company_code");

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.State })
            .HasDatabaseName("IX_tax_jurisdictions_tenant_company_state");

        builder.HasMany(x => x.Rates)
            .WithOne(r => r.TaxJurisdiction)
            .HasForeignKey(r => r.TaxJurisdictionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class TaxRateConfiguration : IEntityTypeConfiguration<TaxRate>
{
    public void Configure(EntityTypeBuilder<TaxRate> builder)
    {
        builder.ToTable("tax_rates");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Category).HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.Rate).HasPrecision(7, 4);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.TaxJurisdictionId, x.Category })
            .HasDatabaseName("IX_tax_rates_tenant_company_jurisdiction_category");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class TaxExemptionConfiguration : IEntityTypeConfiguration<TaxExemption>
{
    public void Configure(EntityTypeBuilder<TaxExemption> builder)
    {
        builder.ToTable("tax_exemptions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Scope).HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.ExemptCategory).HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.ExemptionCertificateNumber).HasMaxLength(100);
        builder.Property(x => x.Reason).HasMaxLength(500);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Scope, x.EntityId })
            .HasDatabaseName("IX_tax_exemptions_tenant_company_scope_entity");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class CurrencyExchangeRateConfiguration : IEntityTypeConfiguration<CurrencyExchangeRate>
{
    public void Configure(EntityTypeBuilder<CurrencyExchangeRate> builder)
    {
        builder.ToTable("currency_exchange_rates");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.FromCurrency).IsRequired().HasMaxLength(3);
        builder.Property(x => x.ToCurrency).IsRequired().HasMaxLength(3);
        builder.Property(x => x.Rate).HasPrecision(18, 8);
        builder.Property(x => x.Source).HasMaxLength(50);

        builder.HasIndex(x => new { x.TenantId, x.FromCurrency, x.ToCurrency, x.EffectiveDate })
            .IsUnique()
            .HasDatabaseName("IX_currency_exchange_rates_pair_date");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
