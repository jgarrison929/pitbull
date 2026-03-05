using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWipEarnedValueColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CostPerformanceIndex",
                table: "wip_report_lines",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EvPercentComplete",
                table: "wip_report_lines",
                type: "numeric(8,6)",
                precision: 8,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProjectedGainLoss",
                table: "wip_report_lines",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SchedulePerformanceIndex",
                table: "wip_report_lines",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CostPerformanceIndex",
                table: "wip_report_lines");

            migrationBuilder.DropColumn(
                name: "EvPercentComplete",
                table: "wip_report_lines");

            migrationBuilder.DropColumn(
                name: "ProjectedGainLoss",
                table: "wip_report_lines");

            migrationBuilder.DropColumn(
                name: "SchedulePerformanceIndex",
                table: "wip_report_lines");
        }
    }
}
