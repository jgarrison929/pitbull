using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class LienWaiverConfiguration : IEntityTypeConfiguration<LienWaiver>
{
    public void Configure(EntityTypeBuilder<LienWaiver> builder)
    {
        builder.ToTable("lien_waivers");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Amount)
            .HasPrecision(18, 2);

        builder.Property(w => w.WaiverType)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(w => w.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(w => w.DocumentPath)
            .HasMaxLength(1000);

        builder.Property(w => w.Description)
            .HasMaxLength(500);

        builder.Property(w => w.RejectionReason)
            .HasMaxLength(500);

        builder.HasIndex(w => new { w.TenantId, w.CompanyId, w.ProjectId, w.Status })
            .HasDatabaseName("IX_lien_waivers_tenant_company_project_status");

        builder.HasIndex(w => new { w.TenantId, w.CompanyId, w.VendorId })
            .HasDatabaseName("IX_lien_waivers_tenant_company_vendor");

        builder.HasIndex(w => w.TenantId)
            .HasDatabaseName("IX_lien_waivers_TenantId");

        builder.HasIndex(w => w.CompanyId)
            .HasDatabaseName("IX_lien_waivers_CompanyId");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
