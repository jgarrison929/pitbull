using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Data;

public class ApiKeyConfiguration : IEntityTypeConfiguration<ApiKey>
{
    public void Configure(EntityTypeBuilder<ApiKey> builder)
    {
        builder.ToTable("api_keys");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name).HasMaxLength(100).IsRequired();
        builder.Property(a => a.KeyHash).HasMaxLength(128).IsRequired();
        builder.Property(a => a.KeyPrefix).HasMaxLength(12).IsRequired();
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.Scopes).HasMaxLength(500);
        builder.Property(a => a.Description).HasMaxLength(500);
        builder.Property(a => a.CreatedByEmail).HasMaxLength(256);
        builder.Property(a => a.RevokedBy).HasMaxLength(256);

        // Index for key lookup
        builder.HasIndex(a => a.KeyHash).IsUnique();
        builder.HasIndex(a => new { a.TenantId, a.Status });

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
