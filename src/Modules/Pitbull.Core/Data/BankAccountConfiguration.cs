using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class BankAccountConfiguration : IEntityTypeConfiguration<BankAccount>
{
    public void Configure(EntityTypeBuilder<BankAccount> builder)
    {
        builder.ToTable("bank_accounts");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.AccountName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(b => b.BankName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(b => b.AccountNumberLast4)
            .IsRequired()
            .HasMaxLength(4);

        builder.Property(b => b.RoutingNumber)
            .HasMaxLength(9);

        builder.Property(b => b.AccountType)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(b => b.OpeningBalance)
            .HasPrecision(18, 2);

        builder.HasMany(b => b.Transactions)
            .WithOne(t => t.BankAccount)
            .HasForeignKey(t => t.BankAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.Reconciliations)
            .WithOne(r => r.BankAccount)
            .HasForeignKey(r => r.BankAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(b => new { b.TenantId, b.CompanyId, b.AccountName })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_bank_accounts_tenant_company_name");

        builder.HasIndex(b => b.GlAccountId)
            .HasDatabaseName("IX_bank_accounts_gl_account_id");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
