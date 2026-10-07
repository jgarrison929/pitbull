using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollModuleP1TrueCertifiedPayroll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CertifiedPayroll",
                table: "projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ExceptionsRemarks",
                table: "certified_payroll_reports",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FringeBenefitStatement",
                table: "certified_payroll_reports",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignedAt",
                table: "certified_payroll_reports",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignedByUserId",
                table: "certified_payroll_reports",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerName",
                table: "certified_payroll_reports",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerTitle",
                table: "certified_payroll_reports",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "certified_payroll_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkClassificationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunLineId = table.Column<Guid>(type: "uuid", nullable: true),
                    RegularHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    OvertimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    DoubletimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    RegularRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    OvertimeRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    DoubletimeRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    GrossPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CashFringe = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BenefitFringe = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Deductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
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
                    table.PrimaryKey("PK_certified_payroll_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_certified_payroll_lines_certified_payroll_reports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "certified_payroll_reports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_lines_CompanyId",
                table: "certified_payroll_lines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_lines_ReportId",
                table: "certified_payroll_lines",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_lines_tenant_company_employee",
                table: "certified_payroll_lines",
                columns: new[] { "TenantId", "CompanyId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_lines_tenant_company_report",
                table: "certified_payroll_lines",
                columns: new[] { "TenantId", "CompanyId", "ReportId" });

            migrationBuilder.CreateIndex(
                name: "IX_certified_payroll_lines_TenantId",
                table: "certified_payroll_lines",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "certified_payroll_lines");

            migrationBuilder.DropColumn(
                name: "CertifiedPayroll",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "ExceptionsRemarks",
                table: "certified_payroll_reports");

            migrationBuilder.DropColumn(
                name: "FringeBenefitStatement",
                table: "certified_payroll_reports");

            migrationBuilder.DropColumn(
                name: "SignedAt",
                table: "certified_payroll_reports");

            migrationBuilder.DropColumn(
                name: "SignedByUserId",
                table: "certified_payroll_reports");

            migrationBuilder.DropColumn(
                name: "SignerName",
                table: "certified_payroll_reports");

            migrationBuilder.DropColumn(
                name: "SignerTitle",
                table: "certified_payroll_reports");
        }
    }
}
