using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyIdToUniqueConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_subcontracts_TenantId_SubcontractNumber",
                table: "subcontracts");

            migrationBuilder.DropIndex(
                name: "IX_projects_TenantId_Number",
                table: "projects");

            migrationBuilder.DropIndex(
                name: "IX_pay_periods_unique_start",
                table: "pay_periods");

            migrationBuilder.DropIndex(
                name: "IX_bids_TenantId_Number",
                table: "bids");

            migrationBuilder.CreateIndex(
                name: "IX_subcontracts_TenantId_CompanyId_SubcontractNumber",
                table: "subcontracts",
                columns: new[] { "TenantId", "CompanyId", "SubcontractNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_projects_TenantId_CompanyId_Number",
                table: "projects",
                columns: new[] { "TenantId", "CompanyId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_unique_start",
                table: "pay_periods",
                columns: new[] { "TenantId", "CompanyId", "StartDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bids_TenantId_CompanyId_Number",
                table: "bids",
                columns: new[] { "TenantId", "CompanyId", "Number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_subcontracts_TenantId_CompanyId_SubcontractNumber",
                table: "subcontracts");

            migrationBuilder.DropIndex(
                name: "IX_projects_TenantId_CompanyId_Number",
                table: "projects");

            migrationBuilder.DropIndex(
                name: "IX_pay_periods_unique_start",
                table: "pay_periods");

            migrationBuilder.DropIndex(
                name: "IX_bids_TenantId_CompanyId_Number",
                table: "bids");

            migrationBuilder.CreateIndex(
                name: "IX_subcontracts_TenantId_SubcontractNumber",
                table: "subcontracts",
                columns: new[] { "TenantId", "SubcontractNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_projects_TenantId_Number",
                table: "projects",
                columns: new[] { "TenantId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_unique_start",
                table: "pay_periods",
                columns: new[] { "TenantId", "StartDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bids_TenantId_Number",
                table: "bids",
                columns: new[] { "TenantId", "Number" },
                unique: true);
        }
    }
}
