using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Data;

public class EmergencyContactConfiguration : IEntityTypeConfiguration<EmergencyContact>
{
    public void Configure(EntityTypeBuilder<EmergencyContact> builder)
    {
        builder.ToTable("emergency_contacts", "hr");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.TenantId)
            .IsRequired();

        builder.Property(c => c.EmployeeId)
            .IsRequired();

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(c => c.Relationship)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(c => c.PrimaryPhone)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(c => c.SecondaryPhone)
            .HasMaxLength(20);

        builder.Property(c => c.Email)
            .HasMaxLength(100);

        builder.Property(c => c.Priority)
            .IsRequired()
            .HasDefaultValue(1);

        builder.Property(c => c.Notes)
            .HasMaxLength(500);

        builder.Property(c => c.IsDeleted)
            .IsRequired()
            .HasDefaultValue(false);

        // Relationships
        builder.HasOne(c => c.Employee)
            .WithMany()
            .HasForeignKey(c => c.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        builder.HasIndex(c => c.TenantId);
        builder.HasIndex(c => c.EmployeeId);
        builder.HasIndex(c => new { c.EmployeeId, c.Priority });
    }
}
