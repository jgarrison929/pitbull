using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Data;

/// <summary>
/// Entity Framework configuration for Employee
/// </summary>
public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees");

        builder.HasKey(e => e.Id);

        // Columns
        builder.Property(e => e.EmployeeNumber)
            .IsRequired()
            .HasMaxLength(20)
            .HasComment("Employee badge/clock number");

        builder.Property(e => e.FirstName)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(e => e.LastName)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(e => e.Email)
            .HasMaxLength(255);

        builder.Property(e => e.Phone)
            .HasMaxLength(20);

        builder.Property(e => e.Title)
            .HasMaxLength(100);

        builder.Property(e => e.BaseHourlyRate)
            .HasPrecision(10, 4)
            .HasComment("Base hourly rate in dollars");

        builder.Property(e => e.Notes)
            .HasMaxLength(1000);

        // Computed column
        builder.Ignore(e => e.FullName);

        // Indexes
        builder.HasIndex(e => e.EmployeeNumber)
            .IsUnique()
            .HasDatabaseName("IX_employees_employee_number_unique");

        builder.HasIndex(e => e.Email)
            .HasDatabaseName("IX_employees_email");

        builder.HasIndex(e => e.IsActive)
            .HasDatabaseName("IX_employees_is_active");

        // Self-referencing relationship for supervisor
        builder.HasOne(e => e.Supervisor)
            .WithMany(e => e.Subordinates)
            .HasForeignKey(e => e.SupervisorId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_employees_supervisor");

        // Time entry relationships
        builder.HasMany(e => e.TimeEntries)
            .WithOne(te => te.Employee)
            .HasForeignKey(te => te.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.ApprovedTimeEntries)
            .WithOne(te => te.ApprovedBy)
            .HasForeignKey(te => te.ApprovedById)
            .OnDelete(DeleteBehavior.Restrict);

        // Optimistic concurrency using PostgreSQL xmin (prevents concurrent edit conflicts)
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}