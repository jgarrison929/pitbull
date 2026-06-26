using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPmDailyReportTitle : Migration
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Title",
                table: "pm_daily_reports");
        }
    }
}