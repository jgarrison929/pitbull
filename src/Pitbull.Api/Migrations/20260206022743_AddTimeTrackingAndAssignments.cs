using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations;

/// <inheritdoc />
public partial class AddTimeTrackingAndAssignments : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "employees",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                EmployeeNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, comment: "Employee badge/clock number"),
                FirstName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                LastName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                Title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                Classification = table.Column<int>(type: "integer", nullable: false),
                BaseHourlyRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false, comment: "Base hourly rate in dollars"),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                HireDate = table.Column<DateOnly>(type: "date", nullable: true),
                TerminationDate = table.Column<DateOnly>(type: "date", nullable: true),
                SupervisorId = table.Column<Guid>(type: "uuid", nullable: true),
                Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                DeletedBy = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_employees", x => x.Id);
                table.ForeignKey(
                    name: "FK_employees_supervisor",
                    column: x => x.SupervisorId,
                    principalTable: "employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "project_assignments",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                Role = table.Column<int>(type: "integer", nullable: false, comment: "Employee role on this project (0=Worker, 1=Supervisor, 2=Manager)"),
                StartDate = table.Column<DateOnly>(type: "date", nullable: false, comment: "Date assignment becomes effective"),
                EndDate = table.Column<DateOnly>(type: "date", nullable: true, comment: "Date assignment ends (null = ongoing)"),
                IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true, comment: "Whether this assignment is currently active"),
                Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true, comment: "Optional notes about this assignment"),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                DeletedBy = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_project_assignments", x => x.Id);
                table.ForeignKey(
                    name: "FK_project_assignments_employees",
                    column: x => x.EmployeeId,
                    principalTable: "employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_project_assignments_projects",
                    column: x => x.ProjectId,
                    principalTable: "projects",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "time_entries",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Date = table.Column<DateOnly>(type: "date", nullable: false, comment: "Date of work performed"),
                EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                RegularHours = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, comment: "Regular hours worked (max 99.99)"),
                OvertimeHours = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, comment: "Overtime hours worked (max 99.99)"),
                DoubletimeHours = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, comment: "Double-time hours worked (max 99.99)"),
                Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true, comment: "Optional description of work performed"),
                Status = table.Column<int>(type: "integer", nullable: false),
                ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ApprovalComments = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true, comment: "Comments from approver"),
                RejectionReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true, comment: "Reason for rejection if status is Rejected"),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                DeletedBy = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_time_entries", x => x.Id);
                table.ForeignKey(
                    name: "FK_time_entries_approved_by",
                    column: x => x.ApprovedById,
                    principalTable: "employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_time_entries_cost_codes",
                    column: x => x.CostCodeId,
                    principalTable: "CostCodes",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_time_entries_employees",
                    column: x => x.EmployeeId,
                    principalTable: "employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_time_entries_projects",
                    column: x => x.ProjectId,
                    principalTable: "projects",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_employees_email",
            table: "employees",
            column: "Email");

        migrationBuilder.CreateIndex(
            name: "IX_employees_employee_number_unique",
            table: "employees",
            column: "EmployeeNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_employees_is_active",
            table: "employees",
            column: "IsActive");

        migrationBuilder.CreateIndex(
            name: "IX_employees_SupervisorId",
            table: "employees",
            column: "SupervisorId");

        migrationBuilder.CreateIndex(
            name: "IX_project_assignments_employee",
            table: "project_assignments",
            column: "EmployeeId");

        migrationBuilder.CreateIndex(
            name: "IX_project_assignments_employee_active",
            table: "project_assignments",
            columns: ["EmployeeId", "IsActive"]);

        migrationBuilder.CreateIndex(
            name: "IX_project_assignments_project",
            table: "project_assignments",
            column: "ProjectId");

        migrationBuilder.CreateIndex(
            name: "IX_project_assignments_project_active",
            table: "project_assignments",
            columns: ["ProjectId", "IsActive"]);

        migrationBuilder.CreateIndex(
            name: "IX_project_assignments_unique",
            table: "project_assignments",
            columns: ["EmployeeId", "ProjectId", "StartDate"],
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_time_entries_ApprovedById",
            table: "time_entries",
            column: "ApprovedById");

        migrationBuilder.CreateIndex(
            name: "IX_time_entries_CostCodeId",
            table: "time_entries",
            column: "CostCodeId");

        migrationBuilder.CreateIndex(
            name: "IX_time_entries_date_employee",
            table: "time_entries",
            columns: ["Date", "EmployeeId"]);

        migrationBuilder.CreateIndex(
            name: "IX_time_entries_EmployeeId",
            table: "time_entries",
            column: "EmployeeId");

        migrationBuilder.CreateIndex(
            name: "IX_time_entries_project_date",
            table: "time_entries",
            columns: ["ProjectId", "Date"]);

        migrationBuilder.CreateIndex(
            name: "IX_time_entries_status",
            table: "time_entries",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_time_entries_unique_daily_entry",
            table: "time_entries",
            columns: ["Date", "EmployeeId", "ProjectId", "CostCodeId"],
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "project_assignments");

        migrationBuilder.DropTable(
            name: "time_entries");

        migrationBuilder.DropTable(
            name: "employees");
    }
}
