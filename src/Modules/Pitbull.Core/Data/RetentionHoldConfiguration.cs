using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class RetentionHoldConfiguration : IEntityTypeConfiguration<RetentionHold>
{
    public void Configure(EntityTypeBuilder<RetentionHold> builder)
    {
        builder.ToTable("retention_holds");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.OriginalAmount)
            .HasPrecision(18, 2);

        builder.Property(h => h.RetainedAmount)
            .HasPrecision(18, 2);

        builder.Property(h => h.ReleasedAmount)
            .HasPrecision(18, 2);

        builder.Property(h => h.RetainagePercent)
            .HasPrecision(5, 2);

        builder.Property(h => h.Status)
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(h => h.Description)
            .HasMaxLength(500);

        builder.HasIndex(h => new { h.TenantId, h.CompanyId, h.ProjectId })
            .HasDatabaseName("IX_retention_holds_tenant_company_project");

        builder.HasIndex(h => new { h.TenantId, h.CompanyId, h.Status })
            .HasDatabaseName("IX_retention_holds_tenant_company_status");

        builder.HasIndex(h => h.TenantId)
            .HasDatabaseName("IX_retention_holds_TenantId");

        builder.HasIndex(h => h.CompanyId)
            .HasDatabaseName("IX_retention_holds_CompanyId");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
