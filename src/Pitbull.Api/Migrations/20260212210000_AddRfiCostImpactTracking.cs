using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// Adds RFI cost impact tracking fields and Change Order RFI linkage.
    /// Enables tracking the full financial impact from RFI → Change Order → Billing.
    /// </summary>
    public partial class AddRfiCostImpactTracking : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // RFI: Document references
            migrationBuilder.AddColumn<string>(
                name: "SpecSection",
                table: "rfis",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DrawingReferences",
                table: "rfis",
                type: "text",
                nullable: true,
                comment: "JSON array of drawing sheet references");

            // RFI: Cost impact tracking
            migrationBuilder.AddColumn<bool>(
                name: "HasCostImpact",
                table: "rfis",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "EstimatedCostImpact",
                table: "rfis",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EstimatedDelayDays",
                table: "rfis",
                type: "integer",
                nullable: true);

            // RFI: AI assistance
            migrationBuilder.AddColumn<string>(
                name: "AiSuggestedAnswer",
                table: "rfis",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AiAnalyzedAt",
                table: "rfis",
                type: "timestamp with time zone",
                nullable: true);

            // Change Order: RFI linkage
            migrationBuilder.AddColumn<Guid>(
                name: "OriginatingRfiId",
                table: "change_orders",
                type: "uuid",
                nullable: true);

            // Change Order: Delay cost tracking
            migrationBuilder.AddColumn<int>(
                name: "DelayDays",
                table: "change_orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DelayCost",
                table: "change_orders",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DelayDescription",
                table: "change_orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            // Index for looking up change orders by originating RFI
            migrationBuilder.CreateIndex(
                name: "IX_change_orders_OriginatingRfiId",
                table: "change_orders",
                column: "OriginatingRfiId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_change_orders_OriginatingRfiId",
                table: "change_orders");

            migrationBuilder.DropColumn(name: "SpecSection", table: "rfis");
            migrationBuilder.DropColumn(name: "DrawingReferences", table: "rfis");
            migrationBuilder.DropColumn(name: "HasCostImpact", table: "rfis");
            migrationBuilder.DropColumn(name: "EstimatedCostImpact", table: "rfis");
            migrationBuilder.DropColumn(name: "EstimatedDelayDays", table: "rfis");
            migrationBuilder.DropColumn(name: "AiSuggestedAnswer", table: "rfis");
            migrationBuilder.DropColumn(name: "AiAnalyzedAt", table: "rfis");

            migrationBuilder.DropColumn(name: "OriginatingRfiId", table: "change_orders");
            migrationBuilder.DropColumn(name: "DelayDays", table: "change_orders");
            migrationBuilder.DropColumn(name: "DelayCost", table: "change_orders");
            migrationBuilder.DropColumn(name: "DelayDescription", table: "change_orders");
        }
    }
}
