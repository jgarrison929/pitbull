using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class FieldMappingConfiguration : IEntityTypeConfiguration<FieldMapping>
{
    public void Configure(EntityTypeBuilder<FieldMapping> builder)
    {
        builder.ToTable("field_mappings");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.EntityType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(x => x.SourceColumn)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.TargetField)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.TransformRule)
            .HasMaxLength(1000);

        builder.HasIndex(x => new { x.MigrationProjectId, x.SortOrder })
            .HasDatabaseName("IX_field_mappings_project_sort");
    }
}
