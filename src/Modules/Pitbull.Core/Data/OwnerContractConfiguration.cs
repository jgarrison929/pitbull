using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class OwnerContractConfiguration : IEntityTypeConfiguration<OwnerContract>
{
    public void Configure(EntityTypeBuilder<OwnerContract> builder)
    {
        builder.ToTable("owner_contracts");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ContractNumber).IsRequired().HasMaxLength(100);
        builder.Property(c => c.ProjectName).IsRequired().HasMaxLength(500);
        builder.Property(c => c.OwnerName).HasMaxLength(500);
        builder.Property(c => c.OwnerAddress).HasMaxLength(1000);
        builder.Property(c => c.ArchitectName).HasMaxLength(500);
        builder.Property(c => c.ArchitectProjectNumber).HasMaxLength(100);
        builder.Property(c => c.OriginalContractSum).HasPrecision(18, 2);
        builder.Property(c => c.ApprovedChangeOrderAmount).HasPrecision(18, 2);
        builder.Property(c => c.ContractSumToDate).HasPrecision(18, 2);
        builder.Property(c => c.DefaultRetainagePercent).HasPrecision(5, 2);
        builder.Property(c => c.RetainagePercentMaterials).HasPrecision(5, 2);
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(c => c.Notes).HasMaxLength(2000);

        builder.HasIndex(c => new { c.TenantId, c.CompanyId, c.ContractNumber })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_owner_contracts_tenant_company_number");

        builder.HasIndex(c => new { c.TenantId, c.CompanyId, c.ProjectId })
            .HasDatabaseName("IX_owner_contracts_tenant_company_project");

        builder.HasIndex(c => c.TenantId).HasDatabaseName("IX_owner_contracts_TenantId");
        builder.HasIndex(c => c.CompanyId).HasDatabaseName("IX_owner_contracts_CompanyId");

        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class OwnerScheduleOfValuesConfiguration : IEntityTypeConfiguration<OwnerScheduleOfValues>
{
    public void Configure(EntityTypeBuilder<OwnerScheduleOfValues> builder)
    {
        builder.ToTable("owner_schedules_of_values");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name).IsRequired().HasMaxLength(200);
        builder.Property(s => s.OriginalContractAmount).HasPrecision(18, 2);
        builder.Property(s => s.ApprovedChangeOrderAmount).HasPrecision(18, 2);
        builder.Property(s => s.RevisedContractAmount).HasPrecision(18, 2);
        builder.Property(s => s.TotalScheduledValue).HasPrecision(18, 2);
        builder.Property(s => s.DefaultRetainagePercent).HasPrecision(5, 2);
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.Notes).HasMaxLength(2000);

        builder.HasMany(s => s.LineItems)
            .WithOne()
            .HasForeignKey(l => l.OwnerScheduleOfValuesId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.TenantId, s.CompanyId, s.OwnerContractId })
            .HasDatabaseName("IX_owner_sov_tenant_company_contract");

        builder.HasIndex(s => new { s.TenantId, s.CompanyId, s.ProjectId })
            .HasDatabaseName("IX_owner_sov_tenant_company_project");

        builder.HasIndex(s => s.TenantId).HasDatabaseName("IX_owner_sov_TenantId");
        builder.HasIndex(s => s.CompanyId).HasDatabaseName("IX_owner_sov_CompanyId");

        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class OwnerSOVLineItemConfiguration : IEntityTypeConfiguration<OwnerSOVLineItem>
{
    public void Configure(EntityTypeBuilder<OwnerSOVLineItem> builder)
    {
        builder.ToTable("owner_sov_line_items");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.ItemNumber).IsRequired().HasMaxLength(50);
        builder.Property(l => l.Description).IsRequired().HasMaxLength(500);
        builder.Property(l => l.OriginalValue).HasPrecision(18, 2);
        builder.Property(l => l.ApprovedChangeOrderValue).HasPrecision(18, 2);
        builder.Property(l => l.ScheduledValue).HasPrecision(18, 2);
        builder.Property(l => l.RetainagePercent).HasPrecision(5, 2);
        builder.Property(l => l.Notes).HasMaxLength(1000);

        builder.HasIndex(l => new { l.TenantId, l.OwnerScheduleOfValuesId, l.SortOrder })
            .HasDatabaseName("IX_owner_sov_lines_tenant_sov_sort");

        builder.HasIndex(l => l.TenantId).HasDatabaseName("IX_owner_sov_lines_TenantId");
        builder.HasIndex(l => l.CompanyId).HasDatabaseName("IX_owner_sov_lines_CompanyId");

        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class BillingApplicationConfiguration : IEntityTypeConfiguration<BillingApplication>
{
    public void Configure(EntityTypeBuilder<BillingApplication> builder)
    {
        builder.ToTable("billing_applications");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.OriginalContractSum).HasPrecision(18, 2);
        builder.Property(a => a.NetChangeByChangeOrders).HasPrecision(18, 2);
        builder.Property(a => a.ContractSumToDate).HasPrecision(18, 2);
        builder.Property(a => a.TotalCompletedAndStoredToDate).HasPrecision(18, 2);
        builder.Property(a => a.RetainageOnCompletedWork).HasPrecision(18, 2);
        builder.Property(a => a.RetainageOnStoredMaterials).HasPrecision(18, 2);
        builder.Property(a => a.TotalRetainage).HasPrecision(18, 2);
        builder.Property(a => a.RetainagePercentWork).HasPrecision(5, 2);
        builder.Property(a => a.RetainagePercentMaterials).HasPrecision(5, 2);
        builder.Property(a => a.TotalEarnedLessRetainage).HasPrecision(18, 2);
        builder.Property(a => a.LessPreviousCertificates).HasPrecision(18, 2);
        builder.Property(a => a.CurrentPaymentDue).HasPrecision(18, 2);
        builder.Property(a => a.BalanceToFinishIncludingRetainage).HasPrecision(18, 2);
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(30);
        builder.Property(a => a.InternalNotes).HasMaxLength(4000);
        builder.Property(a => a.BillingNarrative).HasMaxLength(4000);

        builder.HasMany(a => a.LineItems)
            .WithOne()
            .HasForeignKey(l => l.BillingApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.OwnerContractId, a.ApplicationNumber })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_billing_apps_tenant_company_contract_number");

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.ProjectId })
            .HasDatabaseName("IX_billing_apps_tenant_company_project");

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.Status })
            .HasDatabaseName("IX_billing_apps_tenant_company_status");

        builder.HasIndex(a => a.TenantId).HasDatabaseName("IX_billing_apps_TenantId");
        builder.HasIndex(a => a.CompanyId).HasDatabaseName("IX_billing_apps_CompanyId");

        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class BillingApplicationLineItemConfiguration : IEntityTypeConfiguration<BillingApplicationLineItem>
{
    public void Configure(EntityTypeBuilder<BillingApplicationLineItem> builder)
    {
        builder.ToTable("billing_application_line_items");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.ItemNumber).IsRequired().HasMaxLength(50);
        builder.Property(l => l.Description).IsRequired().HasMaxLength(500);
        builder.Property(l => l.ScheduledValue).HasPrecision(18, 2);
        builder.Property(l => l.WorkCompletedPrevious).HasPrecision(18, 2);
        builder.Property(l => l.WorkCompletedThisPeriod).HasPrecision(18, 2);
        builder.Property(l => l.MaterialsStoredToDate).HasPrecision(18, 2);
        builder.Property(l => l.TotalCompletedAndStored).HasPrecision(18, 2);
        builder.Property(l => l.PercentComplete).HasPrecision(5, 2);
        builder.Property(l => l.BalanceToFinish).HasPrecision(18, 2);
        builder.Property(l => l.RetainagePercent).HasPrecision(5, 2);
        builder.Property(l => l.RetainageAmount).HasPrecision(18, 2);

        builder.HasIndex(l => new { l.TenantId, l.BillingApplicationId, l.SortOrder })
            .HasDatabaseName("IX_billing_app_lines_tenant_app_sort");

        builder.HasIndex(l => l.TenantId).HasDatabaseName("IX_billing_app_lines_TenantId");
        builder.HasIndex(l => l.CompanyId).HasDatabaseName("IX_billing_app_lines_CompanyId");

        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class BillingPeriodConfiguration : IEntityTypeConfiguration<BillingPeriod>
{
    public void Configure(EntityTypeBuilder<BillingPeriod> builder)
    {
        builder.ToTable("billing_periods");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.Notes).HasMaxLength(1000);

        builder.HasIndex(p => new { p.TenantId, p.CompanyId, p.PeriodStart })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_billing_periods_tenant_company_start");

        builder.HasIndex(p => p.TenantId).HasDatabaseName("IX_billing_periods_TenantId");
        builder.HasIndex(p => p.CompanyId).HasDatabaseName("IX_billing_periods_CompanyId");

        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}

public class BillingPackageDocumentConfiguration : IEntityTypeConfiguration<BillingPackageDocument>
{
    public void Configure(EntityTypeBuilder<BillingPackageDocument> builder)
    {
        builder.ToTable("billing_package_documents");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.DocumentType).IsRequired().HasMaxLength(100);
        builder.Property(d => d.FileName).IsRequired().HasMaxLength(500);
        builder.Property(d => d.FilePath).HasMaxLength(1000);
        builder.Property(d => d.Notes).HasMaxLength(1000);

        builder.HasIndex(d => new { d.TenantId, d.BillingApplicationId })
            .HasDatabaseName("IX_billing_pkg_docs_tenant_app");

        builder.HasIndex(d => d.TenantId).HasDatabaseName("IX_billing_pkg_docs_TenantId");
        builder.HasIndex(d => d.CompanyId).HasDatabaseName("IX_billing_pkg_docs_CompanyId");

        builder.Property<uint>("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
    }
}
