using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Data;

public class SecretVaultConfiguration : IEntityTypeConfiguration<SecretVault>
{
    public void Configure(EntityTypeBuilder<SecretVault> builder)
    {
        builder.ToTable("secret_vault");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Key).HasMaxLength(100).IsRequired();
        builder.Property(s => s.DisplayName).HasMaxLength(200).IsRequired();
        builder.Property(s => s.EncryptedValue).HasMaxLength(2000).IsRequired();
        builder.Property(s => s.KeyFingerprint).HasMaxLength(10).IsRequired();
        builder.Property(s => s.Category).HasConversion<string>().HasMaxLength(30);
        builder.Property(s => s.Description).HasMaxLength(500);

        // Unique key per tenant (not company-scoped)
        builder.HasIndex(s => new { s.TenantId, s.Key }).IsUnique();
        builder.HasIndex(s => new { s.TenantId, s.Category });

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
