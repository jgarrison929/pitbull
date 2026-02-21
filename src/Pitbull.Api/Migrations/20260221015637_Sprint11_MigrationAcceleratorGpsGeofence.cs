using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class Sprint11_MigrationAcceleratorGpsGeofence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GpsAccuracy",
                table: "time_entries",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true,
                comment: "GPS accuracy in meters at time of capture");

            migrationBuilder.AddColumn<DateTime>(
                name: "GpsCapturedAt",
                table: "time_entries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Latitude",
                table: "time_entries",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true,
                comment: "Latitude (WGS 84) when time entry was created");

            migrationBuilder.AddColumn<decimal>(
                name: "Longitude",
                table: "time_entries",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true,
                comment: "Longitude (WGS 84) when time entry was created");

            migrationBuilder.AddColumn<decimal>(
                name: "GeofenceRadiusMeters",
                table: "projects",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Latitude",
                table: "projects",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Longitude",
                table: "projects",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "migration_projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SourceSystem = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SourceVersion = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    TotalRecords = table.Column<int>(type: "integer", nullable: false),
                    ImportedRecords = table.Column<int>(type: "integer", nullable: false),
                    FailedRecords = table.Column<int>(type: "integer", nullable: false),
                    ValidationReport = table.Column<string>(type: "jsonb", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
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
                    table.PrimaryKey("PK_migration_projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "field_mappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MigrationProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SourceColumn = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TargetField = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TransformRule = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_field_mappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_field_mappings_migration_projects_MigrationProjectId",
                        column: x => x.MigrationProjectId,
                        principalTable: "migration_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_field_mappings_project_sort",
                table: "field_mappings",
                columns: new[] { "MigrationProjectId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_field_mappings_TenantId",
                table: "field_mappings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_migration_projects_CompanyId",
                table: "migration_projects",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_migration_projects_tenant_company_status",
                table: "migration_projects",
                columns: new[] { "TenantId", "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_migration_projects_TenantId",
                table: "migration_projects",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "field_mappings");

            migrationBuilder.DropTable(
                name: "migration_projects");

            migrationBuilder.DropColumn(
                name: "GpsAccuracy",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "GpsCapturedAt",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "GeofenceRadiusMeters",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "projects");
        }
    }
}
