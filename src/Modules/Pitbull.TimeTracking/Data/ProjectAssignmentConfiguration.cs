using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Data;

/// <summary>
/// Entity Framework configuration for ProjectAssignment
/// </summary>
public class ProjectAssignmentConfiguration : IEntityTypeConfiguration<ProjectAssignment>
{
    public void Configure(EntityTypeBuilder<ProjectAssignment> builder)
    {
        builder.ToTable("project_assignments");

        builder.HasKey(pa => pa.Id);

        // Columns
        builder.Property(pa => pa.Role)
            .IsRequired()
            .HasComment("Employee role on this project (0=Worker, 1=Supervisor, 2=Manager)");

        builder.Property(pa => pa.StartDate)
            .IsRequired()
            .HasComment("Date assignment becomes effective");

        builder.Property(pa => pa.EndDate)
            .HasComment("Date assignment ends (null = ongoing)");

        builder.Property(pa => pa.IsActive)
            .IsRequired()
            .HasDefaultValue(true)
            .HasComment("Whether this assignment is currently active");

        builder.Property(pa => pa.Notes)
            .HasMaxLength(500)
            .HasComment("Optional notes about this assignment");

        // Unique constraint: an employee can only have one active assignment per project
        // (they can have multiple historical assignments if end dates are set)
        builder.HasIndex(pa => new { pa.EmployeeId, pa.ProjectId, pa.StartDate })
            .IsUnique()
            .HasDatabaseName("IX_project_assignments_unique");

        // Indexes for common queries
        builder.HasIndex(pa => pa.EmployeeId)
            .HasDatabaseName("IX_project_assignments_employee");

        builder.HasIndex(pa => pa.ProjectId)
            .HasDatabaseName("IX_project_assignments_project");

        builder.HasIndex(pa => new { pa.ProjectId, pa.IsActive })
            .HasDatabaseName("IX_project_assignments_project_active");

        builder.HasIndex(pa => new { pa.EmployeeId, pa.IsActive })
            .HasDatabaseName("IX_project_assignments_employee_active");

        // Foreign key relationships
        builder.HasOne(pa => pa.Employee)
            .WithMany(e => e.ProjectAssignments)
            .HasForeignKey(pa => pa.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_project_assignments_employees");

        builder.HasOne(pa => pa.Project)
            .WithMany()
            .HasForeignKey(pa => pa.ProjectId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_project_assignments_projects");
    }
}
