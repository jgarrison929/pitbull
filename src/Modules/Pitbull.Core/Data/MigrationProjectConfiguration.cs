using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class MigrationProjectConfiguration : IEntityTypeConfiguration<MigrationProject>
{
    public void Configure(EntityTypeBuilder<MigrationProject> builder)
    {
        builder.ToTable("migration_projects");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.SourceSystem)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(x => x.SourceVersion)
            .HasMaxLength(50);

        builder.Property(x => x.Status)
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(x => x.ValidationReport)
            .HasColumnType("jsonb");

        builder.Property(x => x.Notes)
            .HasMaxLength(2000);

        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Status })
            .HasDatabaseName("IX_migration_projects_tenant_company_status");

        builder.HasMany(x => x.FieldMappings)
            .WithOne(fm => fm.MigrationProject)
            .HasForeignKey(fm => fm.MigrationProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
