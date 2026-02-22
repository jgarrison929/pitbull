using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class VendorInvoiceConfiguration : IEntityTypeConfiguration<VendorInvoice>
{
    public void Configure(EntityTypeBuilder<VendorInvoice> builder)
    {
        builder.ToTable("vendor_invoices");

        builder.HasKey(invoice => invoice.Id);

        builder.Property(invoice => invoice.InvoiceNumber)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(invoice => invoice.SubtotalAmount)
            .HasPrecision(18, 2);

        builder.Property(invoice => invoice.TaxAmount)
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(invoice => invoice.TotalAmount)
            .HasPrecision(18, 2);

        builder.Property(invoice => invoice.TaxRate)
            .HasPrecision(7, 4);

        builder.Property(invoice => invoice.CurrencyCode)
            .HasMaxLength(3)
            .HasDefaultValue("USD");

        builder.Property(invoice => invoice.ExchangeRate)
            .HasPrecision(18, 8)
            .HasDefaultValue(1.0m);

        builder.Property(invoice => invoice.TaxExemptReason)
            .HasMaxLength(500);

        builder.HasOne(invoice => invoice.PurchaseOrder)
            .WithMany()
            .HasForeignKey(invoice => invoice.PurchaseOrderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(invoice => invoice.MatchResults)
            .WithOne(result => result.VendorInvoice)
            .HasForeignKey(result => result.VendorInvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(invoice => new { invoice.TenantId, invoice.CompanyId, invoice.VendorId, invoice.InvoiceNumber })
            .HasDatabaseName("IX_vendor_invoices_tenant_company_vendor_invoice");

        builder.HasIndex(invoice => new { invoice.TenantId, invoice.CompanyId, invoice.PurchaseOrderId })
            .HasDatabaseName("IX_vendor_invoices_tenant_company_po");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class InvoiceMatchResultConfiguration : IEntityTypeConfiguration<InvoiceMatchResult>
{
    public void Configure(EntityTypeBuilder<InvoiceMatchResult> builder)
    {
        builder.ToTable("invoice_match_results");

        builder.HasKey(result => result.Id);

        builder.Property(result => result.VarianceAmount)
            .HasPrecision(14, 2);

        builder.Property(result => result.VariancePercent)
            .HasPrecision(8, 4);

        builder.HasOne(result => result.PurchaseOrder)
            .WithMany()
            .HasForeignKey(result => result.PurchaseOrderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(result => new { result.TenantId, result.CompanyId, result.VendorInvoiceId })
            .HasDatabaseName("IX_invoice_match_results_tenant_company_invoice");

        builder.HasIndex(result => new { result.TenantId, result.CompanyId, result.PurchaseOrderId })
            .HasDatabaseName("IX_invoice_match_results_tenant_company_po");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
