using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class Sprint10_DashboardVendorPortalEncryption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankAccountNumber",
                table: "vendors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankRoutingNumber",
                table: "vendors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SsnLastFour",
                table: "employee_tax_compliance",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "cost_predictions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    PredictedFinalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ConfidenceLevel = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    PredictionMethod = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    VarianceToBudget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    VariancePercent = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    BudgetAtCompletion = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CostToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedCostToComplete = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BurnRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    DaysRemaining = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_cost_predictions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "dashboard_preferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Layout = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    WidgetConfiguration = table.Column<string>(type: "jsonb", nullable: true),
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
                    table.PrimaryKey("PK_dashboard_preferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "vendor_portal_tokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false),
                    LastAccessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AccessCount = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_vendor_portal_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vendor_portal_tokens_vendors_VendorId",
                        column: x => x.VendorId,
                        principalTable: "vendors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cost_predictions_CompanyId",
                table: "cost_predictions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_cost_predictions_tenant_project_created",
                table: "cost_predictions",
                columns: new[] { "TenantId", "ProjectId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_cost_predictions_TenantId",
                table: "cost_predictions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_dashboard_preferences_TenantId",
                table: "dashboard_preferences",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_dashboard_preferences_TenantId_UserId",
                table: "dashboard_preferences",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vendor_portal_tokens_CompanyId",
                table: "vendor_portal_tokens",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_portal_tokens_TenantId",
                table: "vendor_portal_tokens",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_portal_tokens_TenantId_VendorId_ProjectId",
                table: "vendor_portal_tokens",
                columns: new[] { "TenantId", "VendorId", "ProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_portal_tokens_Token",
                table: "vendor_portal_tokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vendor_portal_tokens_VendorId",
                table: "vendor_portal_tokens",
                column: "VendorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cost_predictions");

            migrationBuilder.DropTable(
                name: "dashboard_preferences");

            migrationBuilder.DropTable(
                name: "vendor_portal_tokens");

            migrationBuilder.DropColumn(
                name: "BankAccountNumber",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "BankRoutingNumber",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "SsnLastFour",
                table: "employee_tax_compliance");
        }
    }
}
