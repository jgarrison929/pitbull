using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Data;

public class WithholdingElectionConfiguration : IEntityTypeConfiguration<WithholdingElection>
{
    public void Configure(EntityTypeBuilder<WithholdingElection> builder)
    {
        builder.ToTable("withholding_elections", "hr");
        builder.HasKey(w => w.Id);

        builder.Property(w => w.TenantId).IsRequired();
        builder.Property(w => w.EmployeeId).IsRequired();
        builder.Property(w => w.TaxJurisdiction).IsRequired().HasMaxLength(10);
        builder.Property(w => w.FilingStatus).IsRequired().HasConversion<int>();
        builder.Property(w => w.AdditionalWithholding).HasPrecision(10, 2);
        builder.Property(w => w.DependentCredits).HasPrecision(10, 2);
        builder.Property(w => w.OtherIncome).HasPrecision(10, 2);
        builder.Property(w => w.Deductions).HasPrecision(10, 2);
        builder.Property(w => w.Notes).HasMaxLength(500);
        builder.Property(w => w.IsDeleted).HasDefaultValue(false);

        builder.Ignore(w => w.IsCurrent);

        builder.HasOne(w => w.Employee)
            .WithMany()
            .HasForeignKey(w => w.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(w => w.TenantId);
        builder.HasIndex(w => w.EmployeeId);
        builder.HasIndex(w => new { w.EmployeeId, w.TaxJurisdiction, w.EffectiveDate });
    }
}
