using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

/// <summary>
/// Entity Framework configuration for Equipment
/// </summary>
public class EquipmentConfiguration : IEntityTypeConfiguration<Equipment>
{
    public void Configure(EntityTypeBuilder<Equipment> builder)
    {
        builder.ToTable("equipment");

        builder.HasKey(e => e.Id);

        // Code - unique within tenant (when not deleted)
        builder.Property(e => e.Code)
            .IsRequired()
            .HasMaxLength(50)
            .HasComment("Unique equipment code within tenant (e.g., EX-001)");

        builder.Property(e => e.Name)
            .IsRequired()
            .HasMaxLength(200)
            .HasComment("Equipment name (e.g., CAT 320 Excavator)");

        builder.Property(e => e.Description)
            .HasMaxLength(500)
            .HasComment("Optional longer description");

        builder.Property(e => e.Type)
            .HasConversion<string>()
            .HasMaxLength(50)
            .HasComment("Equipment category");

        builder.Property(e => e.HourlyRate)
            .HasPrecision(10, 2)
            .HasComment("Internal hourly charge rate for job costing");

        builder.Property(e => e.BillingRate)
            .HasPrecision(10, 2)
            .HasComment("Optional T&M billing rate (may differ from internal rate)");

        builder.Property(e => e.IsActive)
            .HasDefaultValue(true)
            .HasComment("Whether equipment is available for use");

        builder.Property(e => e.SerialNumber)
            .HasMaxLength(100)
            .HasComment("Equipment serial number");

        builder.Property(e => e.LicensePlate)
            .HasMaxLength(50)
            .HasComment("License plate for vehicles");

        // Indexes
        // Unique code per tenant (filtered index excludes deleted)
        builder.HasIndex(e => new { e.TenantId, e.Code })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_equipment_tenant_code");

        // For filtering active equipment
        builder.HasIndex(e => new { e.TenantId, e.IsActive })
            .HasDatabaseName("IX_equipment_tenant_active");

        // Optimistic concurrency using PostgreSQL xmin
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
