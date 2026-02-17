using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Entities;

namespace Pitbull.Core.Data;

public class ComplianceDocumentConfiguration : IEntityTypeConfiguration<ComplianceDocument>
{
    public void Configure(EntityTypeBuilder<ComplianceDocument> builder)
    {
        builder.ToTable("compliance_documents");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.EntityType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(x => x.DocumentType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(x => x.DocumentNumber)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(x => x.Status)
            .IsRequired()
            .HasMaxLength(30)
            .HasDefaultValue("Active");

        builder.Property(x => x.FileUrl)
            .HasMaxLength(500);

        builder.Property(x => x.Notes)
            .HasMaxLength(2000);

        builder.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId })
            .HasDatabaseName("IX_compliance_docs_tenant_entity");

        builder.HasIndex(x => new { x.TenantId, x.Status })
            .HasDatabaseName("IX_compliance_docs_tenant_status");

        builder.HasIndex(x => new { x.TenantId, x.DocumentType })
            .HasDatabaseName("IX_compliance_docs_tenant_doc_type");

        builder.HasIndex(x => new { x.TenantId, x.ExpirationDate })
            .HasDatabaseName("IX_compliance_docs_tenant_expiration");
    }
}
