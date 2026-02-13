using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations;

/// <inheritdoc />
public partial class AddProjectAssignments : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
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
            name: "IX_project_assignments_TenantId",
            table: "project_assignments",
            column: "TenantId");

        // Enable RLS on project_assignments table for tenant isolation
        var table = "project_assignments";

        // Enable RLS
        migrationBuilder.Sql($"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;");

        // Force RLS even for table owners (defense-in-depth)
        migrationBuilder.Sql($"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;");

        // Create SELECT policy
        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_select ON {table} 
                FOR SELECT 
                USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");

        // Create INSERT policy  
        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_insert ON {table} 
                FOR INSERT 
                WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");

        // Create UPDATE policy
        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_update ON {table} 
                FOR UPDATE 
                USING (""TenantId""::text = current_setting('app.current_tenant', true))
                WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");

        // Create DELETE policy
        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_delete ON {table} 
                FOR DELETE 
                USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Drop RLS policies first
        var table = "project_assignments";

        migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON {table};");
        migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON {table};");
        migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON {table};");
        migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON {table};");
        migrationBuilder.Sql($"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;");

        migrationBuilder.DropTable(
            name: "project_assignments");
    }
}
