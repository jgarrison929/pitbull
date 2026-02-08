using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Contracts.Domain;

namespace Pitbull.Contracts.Data;

public class PaymentApplicationConfiguration : IEntityTypeConfiguration<PaymentApplication>
{
    public void Configure(EntityTypeBuilder<PaymentApplication> builder)
    {
        builder.ToTable("payment_applications");

        builder.HasKey(x => x.Id);

        // Unique constraint: one application number per subcontract
        builder.HasIndex(x => new { x.SubcontractId, x.ApplicationNumber }).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.PeriodEnd);

        builder.Property(x => x.ApplicationNumber).IsRequired();
        builder.Property(x => x.PeriodStart).IsRequired();
        builder.Property(x => x.PeriodEnd).IsRequired();

        // Money fields with precision
        builder.Property(x => x.ScheduledValue).HasPrecision(18, 2);
        builder.Property(x => x.WorkCompletedPrevious).HasPrecision(18, 2);
        builder.Property(x => x.WorkCompletedThisPeriod).HasPrecision(18, 2);
        builder.Property(x => x.WorkCompletedToDate).HasPrecision(18, 2);
        builder.Property(x => x.StoredMaterials).HasPrecision(18, 2);
        builder.Property(x => x.TotalCompletedAndStored).HasPrecision(18, 2);
        builder.Property(x => x.RetainagePercent).HasPrecision(5, 2);
        builder.Property(x => x.RetainageThisPeriod).HasPrecision(18, 2);
        builder.Property(x => x.RetainagePrevious).HasPrecision(18, 2);
        builder.Property(x => x.TotalRetainage).HasPrecision(18, 2);
        builder.Property(x => x.TotalEarnedLessRetainage).HasPrecision(18, 2);
        builder.Property(x => x.LessPreviousCertificates).HasPrecision(18, 2);
        builder.Property(x => x.CurrentPaymentDue).HasPrecision(18, 2);
        builder.Property(x => x.ApprovedAmount).HasPrecision(18, 2);

        builder.Property(x => x.Status)
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(x => x.ApprovedBy).HasMaxLength(200);
        builder.Property(x => x.Notes).HasMaxLength(4000);
        builder.Property(x => x.InvoiceNumber).HasMaxLength(100);
        builder.Property(x => x.CheckNumber).HasMaxLength(100);

        // Optimistic concurrency (PostgreSQL xmin)
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        // Note: Global tenant+soft-delete filter is applied in PitbullDbContext for all BaseEntity types
        // Do not add a local HasQueryFilter here as it would override the tenant isolation

        // Relationship
        builder.HasOne(x => x.Subcontract)
            .WithMany()
            .HasForeignKey(x => x.SubcontractId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class SubcontractConfiguration : IEntityTypeConfiguration<Subcontract>
{
    public void Configure(EntityTypeBuilder<Subcontract> builder)
    {
        builder.ToTable("subcontracts");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.SubcontractNumber).HasMaxLength(50).IsRequired();
        builder.Property(s => s.SubcontractorName).HasMaxLength(200).IsRequired();
        builder.Property(s => s.SubcontractorContact).HasMaxLength(200);
        builder.Property(s => s.SubcontractorEmail).HasMaxLength(200);
        builder.Property(s => s.SubcontractorPhone).HasMaxLength(50);
        builder.Property(s => s.SubcontractorAddress).HasMaxLength(500);
        builder.Property(s => s.ScopeOfWork).HasMaxLength(4000).IsRequired();
        builder.Property(s => s.TradeCode).HasMaxLength(100);
        builder.Property(s => s.LicenseNumber).HasMaxLength(100);
        builder.Property(s => s.Notes).HasMaxLength(4000);

        // Financial fields with precision
        builder.Property(s => s.OriginalValue).HasPrecision(18, 2);
        builder.Property(s => s.CurrentValue).HasPrecision(18, 2);
        builder.Property(s => s.BilledToDate).HasPrecision(18, 2);
        builder.Property(s => s.PaidToDate).HasPrecision(18, 2);
        builder.Property(s => s.RetainagePercent).HasPrecision(5, 2);
        builder.Property(s => s.RetainageHeld).HasPrecision(18, 2);

        // Status as string
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(50);

        // Indexes
        builder.HasIndex(s => new { s.TenantId, s.SubcontractNumber }).IsUnique();
        builder.HasIndex(s => s.ProjectId);
        builder.HasIndex(s => s.Status);
        builder.HasIndex(s => s.SubcontractorName);

        // Relationships
        builder.HasMany(s => s.ChangeOrders)
            .WithOne(co => co.Subcontract)
            .HasForeignKey(co => co.SubcontractId)
            .OnDelete(DeleteBehavior.Cascade);

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class ChangeOrderConfiguration : IEntityTypeConfiguration<ChangeOrder>
{
    public void Configure(EntityTypeBuilder<ChangeOrder> builder)
    {
        builder.ToTable("change_orders");
        builder.HasKey(co => co.Id);

        builder.Property(co => co.ChangeOrderNumber).HasMaxLength(50).IsRequired();
        builder.Property(co => co.Title).HasMaxLength(200).IsRequired();
        builder.Property(co => co.Description).HasMaxLength(4000).IsRequired();
        builder.Property(co => co.Reason).HasMaxLength(500);
        builder.Property(co => co.ReferenceNumber).HasMaxLength(100);
        builder.Property(co => co.ApprovedBy).HasMaxLength(200);
        builder.Property(co => co.RejectedBy).HasMaxLength(200);
        builder.Property(co => co.RejectionReason).HasMaxLength(1000);

        // Financial
        builder.Property(co => co.Amount).HasPrecision(18, 2);

        // Status as string
        builder.Property(co => co.Status).HasConversion<string>().HasMaxLength(50);

        // Indexes
        builder.HasIndex(co => new { co.SubcontractId, co.ChangeOrderNumber }).IsUnique();
        builder.HasIndex(co => co.Status);

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
