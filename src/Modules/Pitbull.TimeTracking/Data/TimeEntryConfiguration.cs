using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Data;

/// <summary>
/// Entity Framework configuration for TimeEntry
/// </summary>
public class TimeEntryConfiguration : IEntityTypeConfiguration<TimeEntry>
{
    public void Configure(EntityTypeBuilder<TimeEntry> builder)
    {
        builder.ToTable("time_entries");

        builder.HasKey(te => te.Id);

        // Columns
        builder.Property(te => te.Date)
            .IsRequired()
            .HasComment("Date of work performed");

        builder.Property(te => te.RegularHours)
            .HasPrecision(5, 2)
            .HasComment("Regular hours worked (max 99.99)");

        builder.Property(te => te.OvertimeHours)
            .HasPrecision(5, 2)
            .HasComment("Overtime hours worked (max 99.99)");

        builder.Property(te => te.DoubletimeHours)
            .HasPrecision(5, 2)
            .HasComment("Double-time hours worked (max 99.99)");

        builder.Property(te => te.Description)
            .HasMaxLength(500)
            .HasComment("Optional description of work performed");

        builder.Property(te => te.ApprovalComments)
            .HasMaxLength(500)
            .HasComment("Comments from approver");

        builder.Property(te => te.RejectionReason)
            .HasMaxLength(500)
            .HasComment("Reason for rejection if status is Rejected");

        // Indexes for common queries
        builder.HasIndex(te => new { te.Date, te.EmployeeId })
            .HasDatabaseName("IX_time_entries_date_employee");

        builder.HasIndex(te => new { te.ProjectId, te.Date })
            .HasDatabaseName("IX_time_entries_project_date");

        builder.HasIndex(te => te.Status)
            .HasDatabaseName("IX_time_entries_status");

        // Unique constraint to prevent duplicate time entries
        builder.HasIndex(te => new { te.Date, te.EmployeeId, te.ProjectId, te.CostCodeId })
            .IsUnique()
            .HasDatabaseName("IX_time_entries_unique_daily_entry");

        // Foreign key relationships
        builder.HasOne(te => te.Employee)
            .WithMany(e => e.TimeEntries)
            .HasForeignKey(te => te.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_time_entries_employees");

        // Cross-module relationships: Project and CostCode
        // These use the FK properties already defined on the entity
        builder.Property(te => te.ProjectId).IsRequired();
        builder.Property(te => te.CostCodeId).IsRequired();

        // Navigation to Project (from Projects module)
        builder.HasOne(te => te.Project)
            .WithMany()
            .HasForeignKey(te => te.ProjectId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_time_entries_projects");

        // Navigation to CostCode (from Core module)
        builder.HasOne(te => te.CostCode)
            .WithMany()
            .HasForeignKey(te => te.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_time_entries_cost_codes");

        builder.HasOne(te => te.ApprovedBy)
            .WithMany(e => e.ApprovedTimeEntries)
            .HasForeignKey(te => te.ApprovedById)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_time_entries_approved_by");

        // Optimistic concurrency using PostgreSQL xmin (prevents concurrent edit conflicts)
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
