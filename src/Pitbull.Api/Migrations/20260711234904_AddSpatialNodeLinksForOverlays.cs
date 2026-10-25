using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSpatialNodeLinksForOverlays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SpatialNodeId",
                table: "rfis",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PrimarySpatialNodeId",
                table: "pm_schedule_activities",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SpatialNodeId",
                table: "pm_progress_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SpatialNodeId",
                table: "pm_activity_progress",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_rfis_SpatialNodeId",
                table: "rfis",
                column: "SpatialNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_PrimarySpatialNodeId",
                table: "pm_schedule_activities",
                column: "PrimarySpatialNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_entries_SpatialNodeId",
                table: "pm_progress_entries",
                column: "SpatialNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_activity_progress_SpatialNodeId",
                table: "pm_activity_progress",
                column: "SpatialNodeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_rfis_SpatialNodeId",
                table: "rfis");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_activities_PrimarySpatialNodeId",
                table: "pm_schedule_activities");

            migrationBuilder.DropIndex(
                name: "IX_pm_progress_entries_SpatialNodeId",
                table: "pm_progress_entries");

            migrationBuilder.DropIndex(
                name: "IX_pm_activity_progress_SpatialNodeId",
                table: "pm_activity_progress");

            migrationBuilder.DropColumn(
                name: "SpatialNodeId",
                table: "rfis");

            migrationBuilder.DropColumn(
                name: "PrimarySpatialNodeId",
                table: "pm_schedule_activities");

            migrationBuilder.DropColumn(
                name: "SpatialNodeId",
                table: "pm_progress_entries");

            migrationBuilder.DropColumn(
                name: "SpatialNodeId",
                table: "pm_activity_progress");
        }
    }
}
