using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pitbull.Core.Domain;

/// <summary>
/// Tracks sent deadline notifications to avoid duplicate emails.
/// This is NOT a BaseEntity — it's a simple tracking table without tenant/soft-delete overhead.
/// </summary>
[Table("deadline_notifications")]
public class DeadlineNotification
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(50)]
    public string EntityType { get; set; } = string.Empty;

    public Guid EntityId { get; set; }

    [Required]
    [MaxLength(20)]
    public string NotificationType { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
