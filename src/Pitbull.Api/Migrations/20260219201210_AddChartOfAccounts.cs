using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddChartOfAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "chart_of_accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AccountName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AccountType = table.Column<int>(type: "integer", nullable: false),
                    ParentAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    NormalBalance = table.Column<int>(type: "integer", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsSubledgerControl = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
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
                    table.PrimaryKey("PK_chart_of_accounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_chart_of_accounts_chart_of_accounts_ParentAccountId",
                        column: x => x.ParentAccountId,
                        principalTable: "chart_of_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_chart_of_accounts_CompanyId",
                table: "chart_of_accounts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_chart_of_accounts_ParentAccountId",
                table: "chart_of_accounts",
                column: "ParentAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_chart_of_accounts_tenant_company_account_name",
                table: "chart_of_accounts",
                columns: new[] { "TenantId", "CompanyId", "AccountName" });

            migrationBuilder.CreateIndex(
                name: "IX_chart_of_accounts_tenant_company_account_number",
                table: "chart_of_accounts",
                columns: new[] { "TenantId", "CompanyId", "AccountNumber" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_chart_of_accounts_tenant_company_is_active",
                table: "chart_of_accounts",
                columns: new[] { "TenantId", "CompanyId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_chart_of_accounts_tenant_company_parent_account",
                table: "chart_of_accounts",
                columns: new[] { "TenantId", "CompanyId", "ParentAccountId" });

            migrationBuilder.CreateIndex(
                name: "IX_chart_of_accounts_TenantId",
                table: "chart_of_accounts",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "chart_of_accounts");
        }
    }
}
