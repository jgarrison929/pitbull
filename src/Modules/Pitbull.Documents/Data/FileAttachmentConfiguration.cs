using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Documents.Domain;

namespace Pitbull.Documents.Data;

public class FileAttachmentConfiguration : IEntityTypeConfiguration<FileAttachment>
{
    public void Configure(EntityTypeBuilder<FileAttachment> builder)
    {
        builder.ToTable("file_attachments");

        builder.Property(x => x.FileName).HasMaxLength(500).IsRequired();
        builder.Property(x => x.ContentType).HasMaxLength(200).IsRequired();
        builder.Property(x => x.StoragePath).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.RelatedEntityType).HasMaxLength(100);

        builder.HasIndex(x => x.TenantId);

        builder.HasIndex(x => new { x.RelatedEntityType, x.RelatedEntityId })
            .HasDatabaseName("IX_file_attachments_related_entity");

        builder.HasIndex(x => new { x.TenantId, x.UploadedById, x.CreatedAt })
            .HasDatabaseName("IX_file_attachments_tenant_user_created");
    }
}
