using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class BankTransactionConfiguration : IEntityTypeConfiguration<BankTransaction>
{
    public void Configure(EntityTypeBuilder<BankTransaction> builder)
    {
        builder.ToTable("bank_transactions");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Description)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(t => t.Amount)
            .HasPrecision(18, 2);

        builder.Property(t => t.CheckNumber)
            .HasMaxLength(50);

        builder.Property(t => t.ReferenceNumber)
            .HasMaxLength(100);

        builder.Property(t => t.TransactionType)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasOne(t => t.BankReconciliation)
            .WithMany(r => r.ClearedTransactions)
            .HasForeignKey(t => t.BankReconciliationId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(t => new { t.TenantId, t.CompanyId, t.BankAccountId, t.TransactionDate })
            .HasDatabaseName("IX_bank_transactions_tenant_company_account_date");

        builder.HasIndex(t => new { t.TenantId, t.CompanyId, t.IsCleared })
            .HasDatabaseName("IX_bank_transactions_tenant_company_cleared");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
