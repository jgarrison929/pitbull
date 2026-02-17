using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Notifications.Domain;

namespace Pitbull.Notifications.Data;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.UserId)
            .IsRequired();

        builder.Property(n => n.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(n => n.Message)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(n => n.Type)
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(n => n.RelatedEntityType)
            .HasMaxLength(100);

        // Indexes for common queries
        builder.HasIndex(n => new { n.TenantId, n.UserId, n.IsRead })
            .HasDatabaseName("IX_notifications_tenant_user_read");

        builder.HasIndex(n => new { n.TenantId, n.UserId, n.CreatedAt })
            .HasDatabaseName("IX_notifications_tenant_user_created");

        builder.HasIndex(n => new { n.RelatedEntityType, n.RelatedEntityId })
            .HasDatabaseName("IX_notifications_related_entity");
    }
}
