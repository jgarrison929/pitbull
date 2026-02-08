using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Data;

public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees", "hr");
        builder.HasKey(e => e.Id);

        // Identity fields
        builder.Property(e => e.EmployeeNumber).HasMaxLength(20).IsRequired();
        builder.Property(e => e.FirstName).HasMaxLength(50).IsRequired();
        builder.Property(e => e.MiddleName).HasMaxLength(50);
        builder.Property(e => e.LastName).HasMaxLength(50).IsRequired();
        builder.Property(e => e.PreferredName).HasMaxLength(50);
        builder.Property(e => e.Suffix).HasMaxLength(10);

        // Sensitive PII
        builder.Property(e => e.SSNEncrypted).HasMaxLength(256).IsRequired();
        builder.Property(e => e.SSNLast4).HasMaxLength(4).IsRequired();
        builder.Property(e => e.DateOfBirth).IsRequired();

        // Contact
        builder.Property(e => e.Email).HasMaxLength(255);
        builder.Property(e => e.PersonalEmail).HasMaxLength(255);
        builder.Property(e => e.Phone).HasMaxLength(20);
        builder.Property(e => e.SecondaryPhone).HasMaxLength(20);

        // Address
        builder.Property(e => e.AddressLine1).HasMaxLength(100);
        builder.Property(e => e.AddressLine2).HasMaxLength(100);
        builder.Property(e => e.City).HasMaxLength(50);
        builder.Property(e => e.State).HasMaxLength(2);
        builder.Property(e => e.ZipCode).HasMaxLength(10);
        builder.Property(e => e.Country).HasMaxLength(2).HasDefaultValue("US");

        // Employment status
        builder.Property(e => e.Status).HasConversion<int>().HasDefaultValue(EmploymentStatus.Active);
        builder.Property(e => e.OriginalHireDate).IsRequired();
        builder.Property(e => e.MostRecentHireDate).IsRequired();
        builder.Property(e => e.EligibleForRehire).HasDefaultValue(true);

        // Classification
        builder.Property(e => e.WorkerType).HasConversion<int>().HasDefaultValue(WorkerType.Field);
        builder.Property(e => e.FLSAStatus).HasConversion<int>().HasDefaultValue(FLSAStatus.NonExempt);
        builder.Property(e => e.EmploymentType).HasConversion<int>().HasDefaultValue(EmploymentType.FullTime);
        builder.Property(e => e.JobTitle).HasMaxLength(100);
        builder.Property(e => e.TradeCode).HasMaxLength(10);
        builder.Property(e => e.WorkersCompClassCode).HasMaxLength(10);

        // Tax
        builder.Property(e => e.HomeState).HasMaxLength(2);
        builder.Property(e => e.SUIState).HasMaxLength(2);

        // Payroll
        builder.Property(e => e.PayFrequency).HasConversion<int>().HasDefaultValue(PayFrequency.Weekly);
        builder.Property(e => e.DefaultPayType).HasConversion<int>().HasDefaultValue(PayType.Hourly);
        builder.Property(e => e.DefaultHourlyRate).HasPrecision(10, 4);
        builder.Property(e => e.PaymentMethod).HasConversion<int>().HasDefaultValue(PaymentMethod.DirectDeposit);

        // Union
        builder.Property(e => e.IsUnionMember).HasDefaultValue(false);

        // Compliance
        builder.Property(e => e.I9Status).HasConversion<int>().HasDefaultValue(I9Status.NotStarted);
        builder.Property(e => e.EVerifyStatus).HasConversion<int?>();
        builder.Property(e => e.BackgroundCheckStatus).HasConversion<int?>();
        builder.Property(e => e.DrugTestStatus).HasConversion<int?>();

        // Notes
        builder.Property(e => e.Notes).HasColumnType("text");

        // Computed - ignore for EF
        builder.Ignore(e => e.FullName);

        // Indexes
        builder.HasIndex(e => new { e.TenantId, e.EmployeeNumber }).IsUnique();
        builder.HasIndex(e => e.Email);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.TradeCode);
        builder.HasIndex(e => e.SupervisorId);

        // Self-referencing relationship for supervisor
        builder.HasOne(e => e.Supervisor)
            .WithMany(e => e.DirectReports)
            .HasForeignKey(e => e.SupervisorId)
            .OnDelete(DeleteBehavior.SetNull);

        // Child collections
        builder.HasMany(e => e.EmploymentEpisodes)
            .WithOne(ep => ep.Employee)
            .HasForeignKey(ep => ep.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.Certifications)
            .WithOne(c => c.Employee)
            .HasForeignKey(c => c.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.PayRates)
            .WithOne(pr => pr.Employee)
            .HasForeignKey(pr => pr.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        // Optimistic concurrency using PostgreSQL xmin
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class EmploymentEpisodeConfiguration : IEntityTypeConfiguration<EmploymentEpisode>
{
    public void Configure(EntityTypeBuilder<EmploymentEpisode> builder)
    {
        builder.ToTable("employment_episodes", "hr");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.EpisodeNumber).IsRequired();
        builder.Property(e => e.HireDate).IsRequired();
        builder.Property(e => e.SeparationReason).HasConversion<int?>();
        builder.Property(e => e.SeparationNotes).HasColumnType("text");
        builder.Property(e => e.UnionDispatchReference).HasMaxLength(50);
        builder.Property(e => e.JobClassificationAtHire).HasMaxLength(50);
        builder.Property(e => e.HourlyRateAtHire).HasPrecision(10, 4);
        builder.Property(e => e.PositionAtHire).HasMaxLength(100);
        builder.Property(e => e.PositionAtTermination).HasMaxLength(100);

        // Unique constraint: one episode number per employee
        builder.HasIndex(e => new { e.TenantId, e.EmployeeId, e.EpisodeNumber }).IsUnique();
        builder.HasIndex(e => e.EmployeeId);

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class CertificationConfiguration : IEntityTypeConfiguration<Certification>
{
    public void Configure(EntityTypeBuilder<Certification> builder)
    {
        builder.ToTable("certifications", "hr");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.CertificationTypeCode).HasMaxLength(20).IsRequired();
        builder.Property(c => c.CertificationName).HasMaxLength(100).IsRequired();
        builder.Property(c => c.CertificateNumber).HasMaxLength(50);
        builder.Property(c => c.IssuingAuthority).HasMaxLength(100);
        builder.Property(c => c.IssueDate).IsRequired();
        builder.Property(c => c.Status).HasConversion<int>().HasDefaultValue(CertificationStatus.Pending);
        builder.Property(c => c.VerifiedBy).HasMaxLength(100);
        builder.Property(c => c.VerificationNotes).HasColumnType("text");

        // Computed - ignore for EF
        builder.Ignore(c => c.IsExpired);
        builder.Ignore(c => c.DaysUntilExpiration);

        // Indexes
        builder.HasIndex(c => c.EmployeeId);
        builder.HasIndex(c => c.CertificationTypeCode);
        builder.HasIndex(c => c.ExpirationDate);
        builder.HasIndex(c => c.Status);

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class PayRateConfiguration : IEntityTypeConfiguration<PayRate>
{
    public void Configure(EntityTypeBuilder<PayRate> builder)
    {
        builder.ToTable("pay_rates", "hr");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Description).HasMaxLength(200);
        builder.Property(p => p.RateType).HasConversion<int>().HasDefaultValue(RateType.Hourly);
        builder.Property(p => p.Amount).HasPrecision(10, 4).IsRequired();
        builder.Property(p => p.Currency).HasMaxLength(3).HasDefaultValue("USD");
        builder.Property(p => p.EffectiveDate).IsRequired();
        builder.Property(p => p.ShiftCode).HasMaxLength(10);
        builder.Property(p => p.WorkState).HasMaxLength(2);
        builder.Property(p => p.Priority).HasDefaultValue(10);
        builder.Property(p => p.IncludesFringe).HasDefaultValue(false);
        builder.Property(p => p.FringeRate).HasPrecision(10, 4);
        builder.Property(p => p.HealthWelfareRate).HasPrecision(10, 4);
        builder.Property(p => p.PensionRate).HasPrecision(10, 4);
        builder.Property(p => p.TrainingRate).HasPrecision(10, 4);
        builder.Property(p => p.OtherFringeRate).HasPrecision(10, 4);
        builder.Property(p => p.Source).HasConversion<int>().HasDefaultValue(RateSource.Manual);
        builder.Property(p => p.Notes).HasColumnType("text");

        // Computed - ignore for EF
        builder.Ignore(p => p.TotalHourlyCost);

        // Indexes
        builder.HasIndex(p => p.EmployeeId);
        builder.HasIndex(p => p.EffectiveDate);
        builder.HasIndex(p => p.ExpirationDate);
        builder.HasIndex(p => p.ProjectId);
        builder.HasIndex(p => p.ShiftCode);
        builder.HasIndex(p => p.WorkState);

        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
