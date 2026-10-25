using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSpatialPlanLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pm_spatial_plan_links",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    SpatialNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanSheetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_pm_spatial_plan_links", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_spatial_plan_links_pm_plan_sheets_PlanSheetId",
                        column: x => x.PlanSheetId,
                        principalTable: "pm_plan_sheets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pm_spatial_plan_links_pm_spatial_nodes_SpatialNodeId",
                        column: x => x.SpatialNodeId,
                        principalTable: "pm_spatial_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pm_spatial_plan_links_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_plan_links_CompanyId",
                table: "pm_spatial_plan_links",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_plan_links_PlanSheetId",
                table: "pm_spatial_plan_links",
                column: "PlanSheetId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_plan_links_ProjectId_PlanSheetId",
                table: "pm_spatial_plan_links",
                columns: new[] { "ProjectId", "PlanSheetId" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_plan_links_SpatialNodeId_PlanSheetId",
                table: "pm_spatial_plan_links",
                columns: new[] { "SpatialNodeId", "PlanSheetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_plan_links_TenantId",
                table: "pm_spatial_plan_links",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pm_spatial_plan_links");
        }
    }
}
