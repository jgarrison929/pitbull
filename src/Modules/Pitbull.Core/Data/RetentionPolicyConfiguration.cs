using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class RetentionPolicyConfiguration : IEntityTypeConfiguration<RetentionPolicy>
{
    public void Configure(EntityTypeBuilder<RetentionPolicy> builder)
    {
        builder.ToTable("retention_policies");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.PercentageRate)
            .HasPrecision(5, 2);

        builder.Property(p => p.MaxAmount)
            .HasPrecision(18, 2);

        builder.Property(p => p.ReleaseThreshold)
            .HasPrecision(18, 2);

        builder.Property(p => p.AppliesTo)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.Name })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_retention_policies_tenant_company_name");

        builder.HasIndex(p => p.TenantId)
            .HasDatabaseName("IX_retention_policies_TenantId");

        builder.HasIndex(p => p.CompanyId)
            .HasDatabaseName("IX_retention_policies_CompanyId");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
