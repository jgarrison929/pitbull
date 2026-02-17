using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Data;

public class EmployeeEmergencyContactConfiguration : IEntityTypeConfiguration<EmployeeEmergencyContact>
{
    public void Configure(EntityTypeBuilder<EmployeeEmergencyContact> builder)
    {
        builder.ToTable("employee_emergency_contacts");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Relationship).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Phone).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Email).HasMaxLength(255);
        builder.Property(x => x.Address).HasMaxLength(500);

        builder.HasIndex(x => x.EmployeeId);

        builder.HasOne(x => x.Employee)
            .WithMany(e => e.EmergencyContacts)
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class EmployeeTaxComplianceConfiguration : IEntityTypeConfiguration<EmployeeTaxCompliance>
{
    public void Configure(EntityTypeBuilder<EmployeeTaxCompliance> builder)
    {
        builder.ToTable("employee_tax_compliance");
        builder.HasKey(x => x.Id);

        // Unique: one tax record per employee
        builder.HasIndex(x => x.EmployeeId).IsUnique();

        builder.Property(x => x.W4FilingStatus).HasConversion<string>().HasMaxLength(30);
        builder.Property(x => x.W4AdditionalWithholding).HasPrecision(10, 2);
        builder.Property(x => x.I9Status).HasConversion<string>().HasMaxLength(30);
        builder.Property(x => x.I9VerifiedBy).HasMaxLength(200);
        builder.Property(x => x.PayrollNotes).HasMaxLength(2000);

        builder.HasOne(x => x.Employee)
            .WithOne(e => e.TaxCompliance)
            .HasForeignKey<EmployeeTaxCompliance>(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class EmployeeCertificationConfiguration : IEntityTypeConfiguration<EmployeeCertification>
{
    public void Configure(EntityTypeBuilder<EmployeeCertification> builder)
    {
        builder.ToTable("employee_certifications");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.CertificationType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.CertificationName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.CertificationNumber).HasMaxLength(100);
        builder.Property(x => x.IssuingAuthority).HasMaxLength(200);
        builder.Property(x => x.VerificationStatus).HasConversion<string>().HasMaxLength(30);

        builder.HasIndex(x => x.EmployeeId);
        builder.HasIndex(x => x.ExpiresDate);

        builder.HasOne(x => x.Employee)
            .WithMany(e => e.Certifications)
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class EmployeeUnionAffiliationConfiguration : IEntityTypeConfiguration<EmployeeUnionAffiliation>
{
    public void Configure(EntityTypeBuilder<EmployeeUnionAffiliation> builder)
    {
        builder.ToTable("employee_union_affiliations");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.UnionName).HasMaxLength(200);
        builder.Property(x => x.LocalNumber).HasMaxLength(50);
        builder.Property(x => x.MemberId).HasMaxLength(100);
        builder.Property(x => x.Craft).HasMaxLength(100);
        builder.Property(x => x.ApprenticeLevel).HasMaxLength(50);
        builder.Property(x => x.ClassificationCode).HasMaxLength(50);
        builder.Property(x => x.ClassificationName).HasMaxLength(200);
        builder.Property(x => x.Jurisdiction).HasMaxLength(100);
        builder.Property(x => x.Notes).HasMaxLength(2000);

        builder.HasIndex(x => x.EmployeeId);

        builder.HasOne(x => x.Employee)
            .WithMany(e => e.UnionAffiliations)
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
