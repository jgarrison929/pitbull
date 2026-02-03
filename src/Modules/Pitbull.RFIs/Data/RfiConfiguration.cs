using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Data;

public class RfiConfiguration : IEntityTypeConfiguration<Rfi>
{
    public void Configure(EntityTypeBuilder<Rfi> builder)
    {
        builder.ToTable("rfis");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Number).IsRequired();
        builder.Property(r => r.Subject).HasMaxLength(500).IsRequired();
        builder.Property(r => r.Question).HasMaxLength(5000).IsRequired();
        builder.Property(r => r.Answer).HasMaxLength(5000);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(50);
        builder.Property(r => r.Priority).HasConversion<string>().HasMaxLength(50);
        builder.Property(r => r.BallInCourtName).HasMaxLength(200);
        builder.Property(r => r.AssignedToName).HasMaxLength(200);
        builder.Property(r => r.CreatedByName).HasMaxLength(200);

        // Unique RFI number per tenant+project
        builder.HasIndex(r => new { r.TenantId, r.ProjectId, r.Number }).IsUnique();
        builder.HasIndex(r => r.ProjectId);
        builder.HasIndex(r => r.Status);
        builder.HasIndex(r => r.BallInCourtUserId);
        builder.HasIndex(r => r.AssignedToUserId);
    }
}