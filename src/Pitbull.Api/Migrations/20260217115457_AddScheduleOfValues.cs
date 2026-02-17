using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddScheduleOfValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // file_attachments table already created by AddFileAttachments migration (20260217071309)

            migrationBuilder.CreateTable(
                name: "schedule_of_values",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubcontractId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TotalScheduledValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RetainagePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
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
                    table.PrimaryKey("PK_schedule_of_values", x => x.Id);
                    table.ForeignKey(
                        name: "FK_schedule_of_values_subcontracts_SubcontractId",
                        column: x => x.SubcontractId,
                        principalTable: "subcontracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sov_line_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleOfValuesId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ScheduledValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PreviouslyBilled = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentBilled = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    StoredMaterials = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Retainage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_sov_line_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_sov_line_items_schedule_of_values_ScheduleOfValuesId",
                        column: x => x.ScheduleOfValuesId,
                        principalTable: "schedule_of_values",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // file_attachments indexes already created by AddFileAttachments migration (20260217071309)

            migrationBuilder.CreateIndex(
                name: "IX_schedule_of_values_status",
                table: "schedule_of_values",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_schedule_of_values_subcontract_id",
                table: "schedule_of_values",
                column: "SubcontractId");

            migrationBuilder.CreateIndex(
                name: "IX_schedule_of_values_TenantId",
                table: "schedule_of_values",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sov_line_items_sov_item_number",
                table: "sov_line_items",
                columns: new[] { "ScheduleOfValuesId", "ItemNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sov_line_items_sov_sort_order",
                table: "sov_line_items",
                columns: new[] { "ScheduleOfValuesId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_sov_line_items_TenantId",
                table: "sov_line_items",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // file_attachments managed by AddFileAttachments migration (20260217071309)

            migrationBuilder.DropTable(
                name: "sov_line_items");

            migrationBuilder.DropTable(
                name: "schedule_of_values");
        }
    }
}
