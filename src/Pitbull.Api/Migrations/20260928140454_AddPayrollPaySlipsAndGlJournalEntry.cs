using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollPaySlipsAndGlJournalEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GlJournalEntryId",
                table: "payroll_runs",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "pay_slips",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegularHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    OvertimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    DoubletimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Gross = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalDeductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalTaxes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Net = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EmployerCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RateSource = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
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
                    table.PrimaryKey("PK_pay_slips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pay_slips_payroll_runs_PayrollRunId",
                        column: x => x.PayrollRunId,
                        principalTable: "payroll_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pay_slip_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaySlipId = table.Column<Guid>(type: "uuid", nullable: false),
                    TimeEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkClassificationId = table.Column<Guid>(type: "uuid", nullable: true),
                    PayComponentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ComponentCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Kind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Hours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Rate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WagePackageId = table.Column<Guid>(type: "uuid", nullable: true),
                    WageDeterminationRateId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_pay_slip_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pay_slip_lines_pay_slips_PaySlipId",
                        column: x => x.PaySlipId,
                        principalTable: "pay_slips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_tenant_company_gl_journal",
                table: "payroll_runs",
                columns: new[] { "TenantId", "CompanyId", "GlJournalEntryId" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_slip_lines_CompanyId",
                table: "pay_slip_lines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_slip_lines_PaySlipId",
                table: "pay_slip_lines",
                column: "PaySlipId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_slip_lines_tenant_company_job",
                table: "pay_slip_lines",
                columns: new[] { "TenantId", "CompanyId", "ProjectId", "CostCodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_slip_lines_tenant_company_slip",
                table: "pay_slip_lines",
                columns: new[] { "TenantId", "CompanyId", "PaySlipId" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_slip_lines_tenant_company_time_entry",
                table: "pay_slip_lines",
                columns: new[] { "TenantId", "CompanyId", "TimeEntryId" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_slip_lines_TenantId",
                table: "pay_slip_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_slips_CompanyId",
                table: "pay_slips",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_slips_PayrollRunId",
                table: "pay_slips",
                column: "PayrollRunId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_slips_tenant_company_run_employee",
                table: "pay_slips",
                columns: new[] { "TenantId", "CompanyId", "PayrollRunId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_slips_TenantId",
                table: "pay_slips",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pay_slip_lines");

            migrationBuilder.DropTable(
                name: "pay_slips");

            migrationBuilder.DropIndex(
                name: "IX_payroll_runs_tenant_company_gl_journal",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "GlJournalEntryId",
                table: "payroll_runs");
        }
    }
}
