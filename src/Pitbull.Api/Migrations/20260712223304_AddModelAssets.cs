using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddModelAssets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pm_model_assets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SourceFormat = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SourceBlobKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RuntimeBlobKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ConversionStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ConversionError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    LicenseAttribution = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PublishedGraphId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActiveVersion = table.Column<bool>(type: "boolean", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_pm_model_assets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_model_assets_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pm_model_assets_CompanyId",
                table: "pm_model_assets",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_model_assets_ProjectId_IsActiveVersion",
                table: "pm_model_assets",
                columns: new[] { "ProjectId", "IsActiveVersion" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_model_assets_ProjectId_VersionNumber",
                table: "pm_model_assets",
                columns: new[] { "ProjectId", "VersionNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_model_assets_TenantId",
                table: "pm_model_assets",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pm_model_assets");
        }
    }
}
