using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerChangeOrderAndVendorInvoiceAccrual : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "pm_daily_reports",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AccrualJournalEntryId",
                table: "vendor_invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "owner_change_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerContractId = table.Column<Guid>(type: "uuid", nullable: true),
                    ChangeOrderNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DaysExtension = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SubmittedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RejectedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    OriginatingRfiId = table.Column<Guid>(type: "uuid", nullable: true),
                    DelayDays = table.Column<int>(type: "integer", nullable: true),
                    DelayCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    DelayDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
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
                    table.PrimaryKey("PK_owner_change_orders", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_owner_change_orders_CompanyId",
                table: "owner_change_orders",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_owner_change_orders_OwnerContractId",
                table: "owner_change_orders",
                column: "OwnerContractId");

            migrationBuilder.CreateIndex(
                name: "IX_owner_change_orders_ProjectId_ChangeOrderNumber",
                table: "owner_change_orders",
                columns: new[] { "ProjectId", "ChangeOrderNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_owner_change_orders_Status",
                table: "owner_change_orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_owner_change_orders_TenantId",
                table: "owner_change_orders",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "owner_change_orders");

            migrationBuilder.DropColumn(
                name: "AccrualJournalEntryId",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "pm_daily_reports");
        }
    }
}
