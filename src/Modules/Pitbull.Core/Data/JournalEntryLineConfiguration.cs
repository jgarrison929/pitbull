using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class JournalEntryLineConfiguration : IEntityTypeConfiguration<JournalEntryLine>
{
    public void Configure(EntityTypeBuilder<JournalEntryLine> builder)
    {
        builder.ToTable("journal_entry_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.DebitAmount)
            .HasPrecision(18, 2);

        builder.Property(l => l.CreditAmount)
            .HasPrecision(18, 2);

        builder.Property(l => l.Description)
            .HasMaxLength(500);

        builder.HasIndex(l => new { l.TenantId, l.JournalEntryId })
            .HasDatabaseName("IX_journal_entry_lines_tenant_journal_entry");

        builder.HasIndex(l => new { l.TenantId, l.GlAccountId })
            .HasDatabaseName("IX_journal_entry_lines_tenant_gl_account");

        builder.HasIndex(l => l.TenantId)
            .HasDatabaseName("IX_journal_entry_lines_TenantId");

        builder.HasIndex(l => l.CompanyId)
            .HasDatabaseName("IX_journal_entry_lines_CompanyId");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
