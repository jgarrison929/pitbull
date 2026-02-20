using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPunchListEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pm_punch_list_items_subcontracts_ResponsibleSubcontractorId",
                table: "pm_punch_list_items");

            migrationBuilder.AddColumn<decimal>(
                name: "Latitude",
                table: "pm_punch_list_photos",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Longitude",
                table: "pm_punch_list_photos",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "pm_punch_list_items",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_punch_list_items_subcontracts_ResponsibleSubcontractorId",
                table: "pm_punch_list_items",
                column: "ResponsibleSubcontractorId",
                principalTable: "subcontracts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pm_punch_list_items_subcontracts_ResponsibleSubcontractorId",
                table: "pm_punch_list_items");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "pm_punch_list_photos");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "pm_punch_list_photos");

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "pm_punch_list_items",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_punch_list_items_subcontracts_ResponsibleSubcontractorId",
                table: "pm_punch_list_items",
                column: "ResponsibleSubcontractorId",
                principalTable: "subcontracts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
