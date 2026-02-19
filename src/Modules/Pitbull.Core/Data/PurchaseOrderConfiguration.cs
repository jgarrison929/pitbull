using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("purchase_orders");

        builder.HasKey(po => po.Id);

        builder.Property(po => po.PONumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(po => po.Description)
            .HasMaxLength(1000);

        builder.Property(po => po.TotalAmount)
            .HasPrecision(14, 2);

        builder.HasMany(po => po.Lines)
            .WithOne(line => line.PurchaseOrder)
            .HasForeignKey(line => line.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(po => new { po.TenantId, po.CompanyId, po.PONumber })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_purchase_orders_tenant_company_po_number");

        builder.HasIndex(po => new { po.TenantId, po.CompanyId, po.ProjectId })
            .HasDatabaseName("IX_purchase_orders_tenant_company_project");

        builder.HasIndex(po => new { po.TenantId, po.CompanyId, po.VendorId })
            .HasDatabaseName("IX_purchase_orders_tenant_company_vendor");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class PurchaseOrderLineConfiguration : IEntityTypeConfiguration<PurchaseOrderLine>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderLine> builder)
    {
        builder.ToTable("purchase_order_lines");

        builder.HasKey(line => line.Id);

        builder.Property(line => line.Description)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(line => line.Quantity)
            .HasPrecision(14, 4);

        builder.Property(line => line.UnitPrice)
            .HasPrecision(14, 4);

        builder.Property(line => line.Amount)
            .HasPrecision(14, 2);

        builder.Property(line => line.ReceivedQuantity)
            .HasPrecision(14, 4)
            .HasDefaultValue(0m);

        builder.HasIndex(line => new { line.TenantId, line.CompanyId, line.PurchaseOrderId })
            .HasDatabaseName("IX_purchase_order_lines_tenant_company_po");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
