using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class BankReconciliationConfiguration : IEntityTypeConfiguration<BankReconciliation>
{
    public void Configure(EntityTypeBuilder<BankReconciliation> builder)
    {
        builder.ToTable("bank_reconciliations");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.StatementEndingBalance)
            .HasPrecision(18, 2);

        builder.Property(r => r.BeginningBalance)
            .HasPrecision(18, 2);

        builder.Property(r => r.ClearedDeposits)
            .HasPrecision(18, 2);

        builder.Property(r => r.ClearedWithdrawals)
            .HasPrecision(18, 2);

        builder.Property(r => r.Difference)
            .HasPrecision(18, 2);

        builder.Property(r => r.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasIndex(r => new { r.TenantId, r.CompanyId, r.BankAccountId, r.StatementDate })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_bank_reconciliations_tenant_company_account_date");

        builder.HasIndex(r => new { r.TenantId, r.CompanyId, r.Status })
            .HasDatabaseName("IX_bank_reconciliations_tenant_company_status");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
