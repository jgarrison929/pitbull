using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Data;

public class UnionAgreementConfiguration : IEntityTypeConfiguration<UnionAgreement>
{
    public void Configure(EntityTypeBuilder<UnionAgreement> builder)
    {
        builder.ToTable("union_agreements");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.UnionName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.LocalNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.InternationalBody).HasMaxLength(100);
        builder.Property(x => x.AgreementNumber).HasMaxLength(100);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Jurisdiction).HasMaxLength(200);
        builder.Property(x => x.State).HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
        builder.HasMany(x => x.Packages)
            .WithOne(x => x.UnionAgreement)
            .HasForeignKey(x => x.UnionAgreementId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.LocalNumber, x.AgreementNumber })
            .HasDatabaseName("IX_union_agreements_tenant_company_local_number");
        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class WagePackageConfiguration : IEntityTypeConfiguration<WagePackage>
{
    public void Configure(EntityTypeBuilder<WagePackage> builder)
    {
        builder.ToTable("wage_packages");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ScaleCode).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ZoneCode).HasMaxLength(50);
        builder.Property(x => x.ShiftCode).HasMaxLength(50);
        builder.HasOne(x => x.WorkClassification)
            .WithMany()
            .HasForeignKey(x => x.WorkClassificationId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Rates)
            .WithOne(x => x.WagePackage)
            .HasForeignKey(x => x.WagePackageId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.UnionAgreementId, x.WorkClassificationId, x.ScaleCode, x.EffectiveDate })
            .HasDatabaseName("IX_wage_packages_tenant_company_lookup");
        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class WagePackageRateConfiguration : IEntityTypeConfiguration<WagePackageRate>
{
    public void Configure(EntityTypeBuilder<WagePackageRate> builder)
    {
        builder.ToTable("wage_package_rates");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.HourlyRate).HasPrecision(18, 4);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.Unit).HasConversion<string>().HasMaxLength(40);
        builder.Property(x => x.FringeMethod).HasConversion<string>().HasMaxLength(40);
        builder.HasOne(x => x.PayComponent)
            .WithMany()
            .HasForeignKey(x => x.PayComponentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.WagePackageId, x.PayComponentId })
            .HasDatabaseName("IX_wage_package_rates_tenant_company_package_component");
        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class PayComponentConfiguration : IEntityTypeConfiguration<PayComponent>
{
    public void Configure(EntityTypeBuilder<PayComponent> builder)
    {
        builder.ToTable("pay_components");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Kind).HasConversion<string>().HasMaxLength(40);
        builder.Property(x => x.OverlayPack).IsRequired().HasMaxLength(40);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Code })
            .IsUnique()
            .HasDatabaseName("IX_pay_components_tenant_company_code");
        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class PayStructureConfiguration : IEntityTypeConfiguration<PayStructure>
{
    public void Configure(EntityTypeBuilder<PayStructure> builder)
    {
        builder.ToTable("pay_structures");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
        builder.Property(x => x.Source).HasConversion<string>().HasMaxLength(40);
        builder.Property(x => x.OvertimeMultiplier).HasPrecision(18, 4);
        builder.Property(x => x.DoubletimeMultiplier).HasPrecision(18, 4);
        builder.HasMany(x => x.Lines)
            .WithOne(x => x.PayStructure)
            .HasForeignKey(x => x.PayStructureId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Name, x.EffectiveDate })
            .HasDatabaseName("IX_pay_structures_tenant_company_name_effective");
        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class PayStructureLineConfiguration : IEntityTypeConfiguration<PayStructureLine>
{
    public void Configure(EntityTypeBuilder<PayStructureLine> builder)
    {
        builder.ToTable("pay_structure_lines");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Multiplier).HasPrecision(18, 4);
        builder.Property(x => x.FormulaKey).HasMaxLength(100);
        builder.HasOne(x => x.PayComponent)
            .WithMany()
            .HasForeignKey(x => x.PayComponentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.PayStructureId, x.Sequence })
            .HasDatabaseName("IX_pay_structure_lines_tenant_company_structure_seq");
        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}
