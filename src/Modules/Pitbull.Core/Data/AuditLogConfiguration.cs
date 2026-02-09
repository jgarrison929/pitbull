using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");
        
        builder.HasKey(e => e.Id);
        
        builder.Property(e => e.Action)
            .HasConversion<string>()
            .HasMaxLength(50);
        
        builder.Property(e => e.ResourceType)
            .HasMaxLength(100);
        
        builder.Property(e => e.ResourceId)
            .HasMaxLength(100);
        
        builder.Property(e => e.Description)
            .HasMaxLength(1000);
        
        builder.Property(e => e.Details)
            .HasColumnType("jsonb");
        
        builder.Property(e => e.IpAddress)
            .HasMaxLength(45); // IPv6 max length
        
        builder.Property(e => e.UserAgent)
            .HasMaxLength(500);
        
        builder.Property(e => e.UserEmail)
            .HasMaxLength(256);
        
        builder.Property(e => e.UserName)
            .HasMaxLength(200);
        
        builder.Property(e => e.ErrorMessage)
            .HasMaxLength(2000);
        
        // Indexes for common queries
        builder.HasIndex(e => e.TenantId);
        builder.HasIndex(e => e.UserId);
        builder.HasIndex(e => e.Timestamp);
        builder.HasIndex(e => e.Action);
        builder.HasIndex(e => e.ResourceType);
        builder.HasIndex(e => new { e.TenantId, e.Timestamp });
    }
}
