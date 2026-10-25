using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollCompliance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payroll_runs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PayPeriodId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalGross = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    TotalNet = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    EmployeeCount = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
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
                    table.PrimaryKey("PK_payroll_runs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "certified_payroll_reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeekEnding = table.Column<DateOnly>(type: "date", nullable: false),
                    WHDFormNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "WH-347"),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
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
                    table.PrimaryKey("PK_certified_payroll_reports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_certified_payroll_reports_payroll_runs_PayrollRunId",
                        column: x => x.PayrollRunId,
                        principalTable: "payroll_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payroll_run_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegularHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    OvertimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    DoubletimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    RegularPay = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    OvertimePay = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    DoubletimePay = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    GrossPay = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
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
                    table.PrimaryKey("PK_payroll_run_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_run_lines_payroll_runs_PayrollRunId",
                        column: x => x.PayrollRunId,
                        principalTable: "payroll_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_reports_CompanyId",
                table: "certified_payroll_reports",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_reports_PayrollRunId",
                table: "certified_payroll_reports",
                column: "PayrollRunId");

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_reports_tenant_company_run_project",
                table: "certified_payroll_reports",
                columns: new[] { "TenantId", "CompanyId", "PayrollRunId", "ProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_reports_tenant_company_week_ending",
                table: "certified_payroll_reports",
                columns: new[] { "TenantId", "CompanyId", "WeekEnding" });

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_reports_TenantId",
                table: "certified_payroll_reports",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_lines_CompanyId",
                table: "payroll_run_lines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_lines_PayrollRunId",
                table: "payroll_run_lines",
                column: "PayrollRunId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_lines_tenant_company_employee",
                table: "payroll_run_lines",
                columns: new[] { "TenantId", "CompanyId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_lines_tenant_company_run",
                table: "payroll_run_lines",
                columns: new[] { "TenantId", "CompanyId", "PayrollRunId" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_lines_TenantId",
                table: "payroll_run_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_CompanyId",
                table: "payroll_runs",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_tenant_company_period",
                table: "payroll_runs",
                columns: new[] { "TenantId", "CompanyId", "PayPeriodId" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_tenant_company_run_date",
                table: "payroll_runs",
                columns: new[] { "TenantId", "CompanyId", "RunDate" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_TenantId",
                table: "payroll_runs",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "certified_payroll_reports");

            migrationBuilder.DropTable(
                name: "payroll_run_lines");

            migrationBuilder.DropTable(
                name: "payroll_runs");
        }
    }
}
