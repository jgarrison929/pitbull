using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Contracts.Domain;

namespace Pitbull.Contracts.Data;

public class ScheduleOfValuesConfiguration : IEntityTypeConfiguration<ScheduleOfValues>
{
    public void Configure(EntityTypeBuilder<ScheduleOfValues> builder)
    {
        builder.ToTable("schedule_of_values");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name).IsRequired().HasMaxLength(200);
        builder.Property(s => s.TotalScheduledValue).HasPrecision(18, 2);
        builder.Property(s => s.RetainagePercent).HasPrecision(5, 2);
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(50);

        builder.HasOne(s => s.Subcontract)
            .WithMany()
            .HasForeignKey(s => s.SubcontractId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(s => s.LineItems)
            .WithOne(li => li.ScheduleOfValues)
            .HasForeignKey(li => li.ScheduleOfValuesId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.SubcontractId)
            .HasDatabaseName("IX_schedule_of_values_subcontract_id");

        builder.HasIndex(s => s.Status)
            .HasDatabaseName("IX_schedule_of_values_status");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class SOVLineItemConfiguration : IEntityTypeConfiguration<SOVLineItem>
{
    public void Configure(EntityTypeBuilder<SOVLineItem> builder)
    {
        builder.ToTable("sov_line_items");
        builder.HasKey(li => li.Id);

        builder.Property(li => li.ItemNumber).IsRequired().HasMaxLength(20);
        builder.Property(li => li.Description).IsRequired().HasMaxLength(500);
        builder.Property(li => li.ScheduledValue).HasPrecision(18, 2);
        builder.Property(li => li.PreviouslyBilled).HasPrecision(18, 2);
        builder.Property(li => li.CurrentBilled).HasPrecision(18, 2);
        builder.Property(li => li.StoredMaterials).HasPrecision(18, 2);
        builder.Property(li => li.Retainage).HasPrecision(18, 2);

        // Computed properties - ignore from DB mapping
        builder.Ignore(li => li.TotalCompletedToDate);
        builder.Ignore(li => li.PercentComplete);
        builder.Ignore(li => li.BalanceToFinish);

        builder.HasIndex(li => new { li.ScheduleOfValuesId, li.ItemNumber })
            .IsUnique()
            .HasDatabaseName("IX_sov_line_items_sov_item_number");

        builder.HasIndex(li => new { li.ScheduleOfValuesId, li.SortOrder })
            .HasDatabaseName("IX_sov_line_items_sov_sort_order");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
