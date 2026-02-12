using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class CostCodeConfiguration : IEntityTypeConfiguration<CostCode>
{
    public void Configure(EntityTypeBuilder<CostCode> builder)
    {
        builder.ToTable("CostCodes");

        builder.HasKey(cc => cc.Id);

        builder.Property(cc => cc.Code)
            .IsRequired()
            .HasMaxLength(20); // e.g. "01-100-010"

        builder.Property(cc => cc.Description)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(cc => cc.Division)
            .HasMaxLength(50); // e.g. "01 - General Requirements"

        builder.Property(cc => cc.CostType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(cc => cc.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(cc => cc.IsCompanyStandard)
            .IsRequired()
            .HasDefaultValue(true);

        // Self-referencing relationship for parent/child cost codes
        builder.HasOne(cc => cc.ParentCostCode)
            .WithMany(cc => cc.ChildCostCodes)
            .HasForeignKey(cc => cc.ParentCostCodeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Multi-tenancy
        builder.Property(cc => cc.TenantId)
            .IsRequired();

        builder.HasIndex(cc => new { cc.TenantId, cc.Code })
            .IsUnique()
            .HasDatabaseName("IX_CostCodes_TenantId_Code");

        // Soft delete
        builder.HasQueryFilter(cc => !cc.IsDeleted);

        // Optimistic concurrency using PostgreSQL xmin (prevents concurrent edit conflicts)
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}