using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollModuleP2TaxVendor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TaxTableVersionId",
                table: "payroll_runs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResidenceLocality",
                table: "employee_tax_compliance",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResidenceState",
                table: "employee_tax_compliance",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "tax_table_versions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Vendor = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Jurisdiction = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ContentHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
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
                    table.PrimaryKey("PK_tax_table_versions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_TaxTableVersionId",
                table: "payroll_runs",
                column: "TaxTableVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_tenant_company_tax_table_version",
                table: "payroll_runs",
                columns: new[] { "TenantId", "CompanyId", "TaxTableVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_tax_table_versions_CompanyId",
                table: "tax_table_versions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_table_versions_tenant_company_vendor_jurisdiction_effective",
                table: "tax_table_versions",
                columns: new[] { "TenantId", "CompanyId", "Vendor", "Jurisdiction", "EffectiveDate" });

            migrationBuilder.CreateIndex(
                name: "IX_tax_table_versions_TenantId",
                table: "tax_table_versions",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_runs_tax_table_versions_TaxTableVersionId",
                table: "payroll_runs",
                column: "TaxTableVersionId",
                principalTable: "tax_table_versions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_payroll_runs_tax_table_versions_TaxTableVersionId",
                table: "payroll_runs");

            migrationBuilder.DropTable(
                name: "tax_table_versions");

            migrationBuilder.DropIndex(
                name: "IX_payroll_runs_TaxTableVersionId",
                table: "payroll_runs");

            migrationBuilder.DropIndex(
                name: "IX_payroll_runs_tenant_company_tax_table_version",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "TaxTableVersionId",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "ResidenceLocality",
                table: "employee_tax_compliance");

            migrationBuilder.DropColumn(
                name: "ResidenceState",
                table: "employee_tax_compliance");
        }
    }
}
