using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Entities;

namespace Pitbull.Core.Data;

public class ImportBatchConfiguration : IEntityTypeConfiguration<ImportBatch>
{
    public void Configure(EntityTypeBuilder<ImportBatch> builder)
    {
        builder.ToTable("import_batches");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Type)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(x => x.Status)
            .IsRequired()
            .HasMaxLength(30)
            .HasDefaultValue(ImportBatchStatuses.Pending);

        builder.Property(x => x.ErrorDetails)
            .HasColumnType("jsonb")
            .HasDefaultValue("{}");

        builder.HasIndex(x => new { x.TenantId, x.Type, x.Status })
            .HasDatabaseName("IX_import_batches_tenant_type_status");

        builder.HasIndex(x => new { x.TenantId, x.CreatedAt })
            .HasDatabaseName("IX_import_batches_tenant_created");
    }
}
