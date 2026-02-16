using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.AI.Domain;

namespace Pitbull.AI.Data;

public class AiApiKeyConfiguration : IEntityTypeConfiguration<AiApiKey>
{
    public void Configure(EntityTypeBuilder<AiApiKey> builder)
    {
        builder.ToTable("ai_api_keys");
        builder.HasKey(x => x.Id);

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        builder.Property(x => x.Provider).HasMaxLength(50).IsRequired();
        builder.Property(x => x.EncryptedApiKey).HasMaxLength(2000).IsRequired();
        builder.Property(x => x.KeyFingerprint).HasMaxLength(20).IsRequired();

        builder.HasIndex(x => new { x.TenantId, x.Provider }).IsUnique();
        builder.HasIndex(x => new { x.TenantId, x.IsActive });
    }
}
