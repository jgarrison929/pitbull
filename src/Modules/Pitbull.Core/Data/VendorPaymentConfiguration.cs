using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class VendorPaymentConfiguration : IEntityTypeConfiguration<VendorPayment>
{
    public void Configure(EntityTypeBuilder<VendorPayment> builder)
    {
        builder.ToTable("vendor_payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.PaymentNumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(p => p.TotalAmount)
            .HasPrecision(18, 2);

        builder.Property(p => p.PaymentMethod)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(p => p.ReferenceNumber)
            .HasMaxLength(100);

        builder.Property(p => p.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(p => p.Memo)
            .HasMaxLength(1000);

        builder.HasOne(p => p.Vendor)
            .WithMany()
            .HasForeignKey(p => p.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.BankAccount)
            .WithMany()
            .HasForeignKey(p => p.BankAccountId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(p => p.Applications)
            .WithOne(a => a.VendorPayment)
            .HasForeignKey(a => a.VendorPaymentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.PaymentNumber })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_vendor_payments_tenant_company_payment_number");

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.VendorId })
            .HasDatabaseName("IX_vendor_payments_tenant_company_vendor");

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.PaymentDate })
            .HasDatabaseName("IX_vendor_payments_tenant_company_date");

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.Status })
            .HasDatabaseName("IX_vendor_payments_tenant_company_status");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class VendorPaymentApplicationConfiguration : IEntityTypeConfiguration<VendorPaymentApplication>
{
    public void Configure(EntityTypeBuilder<VendorPaymentApplication> builder)
    {
        builder.ToTable("vendor_payment_applications");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.AppliedAmount)
            .HasPrecision(18, 2);

        builder.HasOne(a => a.VendorInvoice)
            .WithMany()
            .HasForeignKey(a => a.VendorInvoiceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.VendorPaymentId })
            .HasDatabaseName("IX_vendor_payment_applications_tenant_company_payment");

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.VendorInvoiceId })
            .HasDatabaseName("IX_vendor_payment_applications_tenant_company_invoice");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
