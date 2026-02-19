using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class ChartOfAccountConfiguration : IEntityTypeConfiguration<ChartOfAccount>
{
    public void Configure(EntityTypeBuilder<ChartOfAccount> builder)
    {
        builder.ToTable("chart_of_accounts");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.AccountNumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(a => a.AccountName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(a => a.Description)
            .HasMaxLength(1000);

        builder.Property(a => a.IsActive)
            .HasDefaultValue(true);

        builder.Property(a => a.IsSubledgerControl)
            .HasDefaultValue(false);

        builder.HasOne(a => a.ParentAccount)
            .WithMany(a => a.ChildAccounts)
            .HasForeignKey(a => a.ParentAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.AccountNumber })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_chart_of_accounts_tenant_company_account_number");

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.AccountName })
            .HasDatabaseName("IX_chart_of_accounts_tenant_company_account_name");

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.ParentAccountId })
            .HasDatabaseName("IX_chart_of_accounts_tenant_company_parent_account");

        builder.HasIndex(a => new { a.TenantId, a.CompanyId, a.IsActive })
            .HasDatabaseName("IX_chart_of_accounts_tenant_company_is_active");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
