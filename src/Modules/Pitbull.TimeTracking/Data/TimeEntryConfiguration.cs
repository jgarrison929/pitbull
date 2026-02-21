using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
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

        builder.Property(te => te.EquipmentHours)
            .HasPrecision(5, 2)
            .HasDefaultValue(0m)
            .HasComment("Equipment hours used (may differ from labor hours)");

        builder.Property(te => te.Description)
            .HasMaxLength(500)
            .HasComment("Optional description of work performed");

        builder.Property(te => te.ApprovalComments)
            .HasMaxLength(500)
            .HasComment("Comments from approver");

        builder.Property(te => te.RejectionReason)
            .HasMaxLength(500)
            .HasComment("Reason for rejection if status is Rejected");

        // GPS location fields
        builder.Property(te => te.Latitude)
            .HasPrecision(10, 7)
            .HasComment("Latitude (WGS 84) when time entry was created");

        builder.Property(te => te.Longitude)
            .HasPrecision(10, 7)
            .HasComment("Longitude (WGS 84) when time entry was created");

        builder.Property(te => te.GpsAccuracy)
            .HasPrecision(8, 2)
            .HasComment("GPS accuracy in meters at time of capture");

        // Indexes for common queries
        builder.HasIndex(te => new { te.Date, te.EmployeeId })
            .HasDatabaseName("IX_time_entries_date_employee");

        builder.HasIndex(te => new { te.ProjectId, te.Date })
            .HasDatabaseName("IX_time_entries_project_date");

        builder.HasIndex(te => te.Status)
            .HasDatabaseName("IX_time_entries_status");

        // Unique constraint to prevent duplicate time entries.
        // Includes PhaseId so the same employee can log to different phases on the same day.
        //
        // KNOWN GAP: PostgreSQL treats NULL != NULL in B-tree unique indexes, so this
        // index does NOT prevent duplicates when PhaseId is NULL. The service layer
        // (TimeEntryService.CreateTimeEntryAsync / BatchCreateTimeEntriesAsync) enforces
        // the duplicate check correctly for NULL PhaseId via an explicit query. A future
        // migration should replace this with partial indexes for full DB-level enforcement.
        builder.HasIndex(te => new { te.Date, te.EmployeeId, te.ProjectId, te.CostCodeId, te.PhaseId })
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

        builder.Property(te => te.SubmittedAt)
            .HasComment("When this entry was submitted (from Draft to Submitted)");

        builder.HasOne(te => te.SubmittedBy)
            .WithMany()
            .HasForeignKey(te => te.SubmittedById)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_time_entries_submitted_by");

        // Navigation to Phase (from Projects module) - optional
        builder.HasOne(te => te.Phase)
            .WithMany()
            .HasForeignKey(te => te.PhaseId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_time_entries_phases");

        // Navigation to Equipment (from Core module) - optional
        builder.HasOne(te => te.Equipment)
            .WithMany()
            .HasForeignKey(te => te.EquipmentId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_time_entries_equipment");

        // Optimistic concurrency using PostgreSQL xmin (prevents concurrent edit conflicts)
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
