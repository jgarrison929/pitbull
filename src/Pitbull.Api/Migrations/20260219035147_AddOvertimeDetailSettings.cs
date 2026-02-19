using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOvertimeDetailSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ReportDailyDoubletimeThreshold",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 12m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReportDailyOvertimeThreshold",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 8m);

            migrationBuilder.AddColumn<string>(
                name: "ReportHolidayRule",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "doubletime");

            migrationBuilder.AddColumn<string>(
                name: "ReportHolidaysJson",
                table: "companies",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<bool>(
                name: "ReportOvertimeEnabled",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "ReportSaturdayRule",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "overtime");

            migrationBuilder.AddColumn<string>(
                name: "ReportSundayRule",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "doubletime");

            migrationBuilder.AddColumn<decimal>(
                name: "ReportWeeklyOvertimeThreshold",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 40m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReportDailyDoubletimeThreshold",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportDailyOvertimeThreshold",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportHolidayRule",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportHolidaysJson",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportOvertimeEnabled",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportSaturdayRule",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportSundayRule",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportWeeklyOvertimeThreshold",
                table: "companies");
        }
    }
}
