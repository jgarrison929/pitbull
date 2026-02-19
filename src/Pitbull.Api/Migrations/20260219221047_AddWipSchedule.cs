using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWipSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "wip_reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportDate = table.Column<DateOnly>(type: "date", nullable: false),
                    FiscalYear = table.Column<int>(type: "integer", nullable: false),
                    PeriodNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    GeneratedById = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
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
                    table.PrimaryKey("PK_wip_reports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wip_report_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    WipReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContractAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedChangeOrders = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RevisedContractAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCostToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedCostToComplete = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedTotalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PercentComplete = table.Column<decimal>(type: "numeric(8,6)", precision: 8, scale: 6, nullable: false),
                    EarnedRevenue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BilledToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OverUnderBilling = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
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
                    table.PrimaryKey("PK_wip_report_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wip_report_lines_wip_reports_WipReportId",
                        column: x => x.WipReportId,
                        principalTable: "wip_reports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_wip_report_lines_CompanyId",
                table: "wip_report_lines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_wip_report_lines_tenant_company_project",
                table: "wip_report_lines",
                columns: new[] { "TenantId", "CompanyId", "ProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_wip_report_lines_tenant_company_report",
                table: "wip_report_lines",
                columns: new[] { "TenantId", "CompanyId", "WipReportId" });

            migrationBuilder.CreateIndex(
                name: "IX_wip_report_lines_tenant_company_report_project",
                table: "wip_report_lines",
                columns: new[] { "TenantId", "CompanyId", "WipReportId", "ProjectId" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_wip_report_lines_TenantId",
                table: "wip_report_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wip_report_lines_WipReportId",
                table: "wip_report_lines",
                column: "WipReportId");

            migrationBuilder.CreateIndex(
                name: "IX_wip_reports_CompanyId",
                table: "wip_reports",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_wip_reports_tenant_company_period",
                table: "wip_reports",
                columns: new[] { "TenantId", "CompanyId", "FiscalYear", "PeriodNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_wip_reports_tenant_company_report_date",
                table: "wip_reports",
                columns: new[] { "TenantId", "CompanyId", "ReportDate" });

            migrationBuilder.CreateIndex(
                name: "IX_wip_reports_TenantId",
                table: "wip_reports",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "wip_report_lines");

            migrationBuilder.DropTable(
                name: "wip_reports");
        }
    }
}
