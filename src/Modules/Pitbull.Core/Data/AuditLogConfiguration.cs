using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.TenantId)
            .IsRequired();

        builder.Property(a => a.UserEmail)
            .HasMaxLength(200);

        builder.Property(a => a.UserName)
            .HasMaxLength(200);

        builder.Property(a => a.Action)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(a => a.ResourceType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.ResourceId)
            .HasMaxLength(100);

        builder.Property(a => a.Description)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(a => a.Details); // JSON text, no max length

        builder.Property(a => a.IpAddress)
            .HasMaxLength(50);

        builder.Property(a => a.UserAgent)
            .HasMaxLength(500);

        builder.Property(a => a.ErrorMessage)
            .HasMaxLength(2000);

        // Indexes
        builder.HasIndex(a => a.TenantId)
            .HasDatabaseName("IX_AuditLogs_TenantId");

        builder.HasIndex(a => new { a.TenantId, a.Timestamp })
            .HasDatabaseName("IX_AuditLogs_TenantId_Timestamp");

        builder.HasIndex(a => new { a.TenantId, a.ResourceType, a.ResourceId })
            .HasDatabaseName("IX_AuditLogs_TenantId_ResourceType_ResourceId");
    }
}
