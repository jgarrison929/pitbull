using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Data;

public class I9RecordConfiguration : IEntityTypeConfiguration<I9Record>
{
    public void Configure(EntityTypeBuilder<I9Record> builder)
    {
        builder.ToTable("i9_records", "hr");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.TenantId).IsRequired();
        builder.Property(i => i.EmployeeId).IsRequired();
        builder.Property(i => i.CitizenshipStatus).IsRequired().HasMaxLength(20);
        builder.Property(i => i.AlienNumber).HasMaxLength(20);
        builder.Property(i => i.I94Number).HasMaxLength(20);
        builder.Property(i => i.ForeignPassportNumber).HasMaxLength(30);
        builder.Property(i => i.ForeignPassportCountry).HasMaxLength(50);
        builder.Property(i => i.Section2CompletedBy).HasMaxLength(100);
        builder.Property(i => i.ListADocumentType).HasMaxLength(50);
        builder.Property(i => i.ListADocumentNumber).HasMaxLength(50);
        builder.Property(i => i.ListBDocumentType).HasMaxLength(50);
        builder.Property(i => i.ListBDocumentNumber).HasMaxLength(50);
        builder.Property(i => i.ListCDocumentType).HasMaxLength(50);
        builder.Property(i => i.ListCDocumentNumber).HasMaxLength(50);
        builder.Property(i => i.Section3NewDocumentType).HasMaxLength(50);
        builder.Property(i => i.Section3NewDocumentNumber).HasMaxLength(50);
        builder.Property(i => i.Status).IsRequired().HasConversion<int>();
        builder.Property(i => i.EVerifyCaseNumber).HasMaxLength(30);
        builder.Property(i => i.Notes).HasMaxLength(500);
        builder.Property(i => i.IsDeleted).HasDefaultValue(false);

        builder.HasOne(i => i.Employee).WithMany().HasForeignKey(i => i.EmployeeId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => i.TenantId);
        builder.HasIndex(i => i.EmployeeId).IsUnique().HasFilter("\"IsDeleted\" = false");
        builder.HasIndex(i => i.Status);
        builder.HasIndex(i => i.WorkAuthorizationExpires);
    }
}
