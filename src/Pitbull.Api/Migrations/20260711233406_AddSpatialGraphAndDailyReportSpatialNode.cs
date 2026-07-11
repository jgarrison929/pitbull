using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSpatialGraphAndDailyReportSpatialNode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SpatialNodeId",
                table: "pm_daily_reports",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "pm_spatial_graphs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LengthUnit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    OriginLatitude = table.Column<decimal>(type: "numeric(10,7)", precision: 10, scale: 7, nullable: true),
                    OriginLongitude = table.Column<decimal>(type: "numeric(10,7)", precision: 10, scale: 7, nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PublishedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
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
                    table.PrimaryKey("PK_pm_spatial_graphs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_spatial_graphs_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pm_spatial_nodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    GraphId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentNodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    NodeType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    LevelIndex = table.Column<int>(type: "integer", nullable: true),
                    ExternalKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CentroidX = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    CentroidY = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    CentroidZ = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    RetiredReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_pm_spatial_nodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_spatial_nodes_pm_spatial_graphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "pm_spatial_graphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pm_spatial_nodes_pm_spatial_nodes_ParentNodeId",
                        column: x => x.ParentNodeId,
                        principalTable: "pm_spatial_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_spatial_nodes_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_reports_SpatialNodeId",
                table: "pm_daily_reports",
                column: "SpatialNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_graphs_CompanyId",
                table: "pm_spatial_graphs",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_graphs_ProjectId_Version",
                table: "pm_spatial_graphs",
                columns: new[] { "ProjectId", "Version" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_graphs_TenantId",
                table: "pm_spatial_graphs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_graphs_TenantId_CompanyId_ProjectId_Status",
                table: "pm_spatial_graphs",
                columns: new[] { "TenantId", "CompanyId", "ProjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_nodes_CompanyId",
                table: "pm_spatial_nodes",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_nodes_GraphId_Code",
                table: "pm_spatial_nodes",
                columns: new[] { "GraphId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_nodes_ParentNodeId",
                table: "pm_spatial_nodes",
                column: "ParentNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_nodes_ProjectId_NodeType_IsActive",
                table: "pm_spatial_nodes",
                columns: new[] { "ProjectId", "NodeType", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_spatial_nodes_TenantId",
                table: "pm_spatial_nodes",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pm_spatial_nodes");

            migrationBuilder.DropTable(
                name: "pm_spatial_graphs");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_reports_SpatialNodeId",
                table: "pm_daily_reports");

            migrationBuilder.DropColumn(
                name: "SpatialNodeId",
                table: "pm_daily_reports");
        }
    }
}
