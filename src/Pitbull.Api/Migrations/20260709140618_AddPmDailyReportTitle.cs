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
            // Title was added to PmDailyReport in code without a prior migration; production
            // seed fails with: column "Title" of relation "pm_daily_reports" does not exist.
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
