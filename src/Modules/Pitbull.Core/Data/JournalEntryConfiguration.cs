using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class JournalEntryConfiguration : IEntityTypeConfiguration<JournalEntry>
{
    public void Configure(EntityTypeBuilder<JournalEntry> builder)
    {
        builder.ToTable("journal_entries");

        builder.HasKey(j => j.Id);

        builder.Property(j => j.EntryNumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(j => j.Description)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(j => j.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(j => j.SourceModule)
            .HasMaxLength(100);

        builder.Property(j => j.SourceDocumentRef)
            .HasMaxLength(200);

        builder.Property(j => j.TotalDebits)
            .HasPrecision(18, 2);

        builder.Property(j => j.TotalCredits)
            .HasPrecision(18, 2);

        builder.HasMany(j => j.Lines)
            .WithOne(l => l.JournalEntry)
            .HasForeignKey(l => l.JournalEntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(j => new { j.TenantId, j.CompanyId, j.EntryNumber })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_journal_entries_tenant_company_entry_number");

        builder.HasIndex(j => new { j.TenantId, j.CompanyId, j.EntryDate })
            .HasDatabaseName("IX_journal_entries_tenant_company_entry_date");

        builder.HasIndex(j => new { j.TenantId, j.CompanyId, j.Status })
            .HasDatabaseName("IX_journal_entries_tenant_company_status");

        builder.HasIndex(j => j.TenantId)
            .HasDatabaseName("IX_journal_entries_TenantId");

        builder.HasIndex(j => j.CompanyId)
            .HasDatabaseName("IX_journal_entries_CompanyId");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
