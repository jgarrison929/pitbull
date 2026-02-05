using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTimeTrackingModule : Migration
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
                columns: new[] { "Date", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_EmployeeId",
                table: "time_entries",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_project_date",
                table: "time_entries",
                columns: new[] { "ProjectId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_status",
                table: "time_entries",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_unique_daily_entry",
                table: "time_entries",
                columns: new[] { "Date", "EmployeeId", "ProjectId", "CostCodeId" },
                unique: true);

            // Enable RLS on TimeTracking tables for tenant isolation
            var tables = new[] { "employees", "time_entries" };

            foreach (var table in tables)
            {
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop RLS policies first
            var tables = new[] { "employees", "time_entries" };

            foreach (var table in tables)
            {
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON {table};");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON {table};");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON {table};");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON {table};");
                migrationBuilder.Sql($"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;");
            }

            migrationBuilder.DropTable(
                name: "time_entries");

            migrationBuilder.DropTable(
                name: "employees");
        }
    }
}
