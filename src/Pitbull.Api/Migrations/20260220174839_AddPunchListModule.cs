using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPunchListModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pm_punch_list_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemNumber = table.Column<int>(type: "integer", nullable: false),
                    Location = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ResponsiblePartyType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ResponsibleSubcontractorId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssignedToName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Priority = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CostImpact = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ScheduleImpactDays = table.Column<int>(type: "integer", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClosedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InspectedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    InspectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
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
                    table.PrimaryKey("PK_pm_punch_list_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_items_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_items_subcontracts_ResponsibleSubcontractorId",
                        column: x => x.ResponsibleSubcontractorId,
                        principalTable: "subcontracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_items_users_ClosedByUserId",
                        column: x => x.ClosedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_items_users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_items_users_InspectedByUserId",
                        column: x => x.InspectedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pm_punch_list_photos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PunchListItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Caption = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TakenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TakenByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Latitude = table.Column<decimal>(type: "numeric(10,7)", precision: 10, scale: 7, nullable: true),
                    Longitude = table.Column<decimal>(type: "numeric(10,7)", precision: 10, scale: 7, nullable: true),
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
                    table.PrimaryKey("PK_pm_punch_list_photos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_photos_pm_documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "pm_documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_photos_pm_punch_list_items_PunchListItemId",
                        column: x => x.PunchListItemId,
                        principalTable: "pm_punch_list_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pm_punch_list_photos_users_TakenByUserId",
                        column: x => x.TakenByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_ClosedByUserId",
                table: "pm_punch_list_items",
                column: "ClosedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_CompanyId",
                table: "pm_punch_list_items",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_CreatedByUserId",
                table: "pm_punch_list_items",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_InspectedByUserId",
                table: "pm_punch_list_items",
                column: "InspectedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_ProjectId_Status_DueDate",
                table: "pm_punch_list_items",
                columns: new[] { "ProjectId", "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_ResponsibleSubcontractorId",
                table: "pm_punch_list_items",
                column: "ResponsibleSubcontractorId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_TenantId",
                table: "pm_punch_list_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_items_TenantId_ProjectId_ItemNumber",
                table: "pm_punch_list_items",
                columns: new[] { "TenantId", "ProjectId", "ItemNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_photos_CompanyId",
                table: "pm_punch_list_photos",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_photos_DocumentId",
                table: "pm_punch_list_photos",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_photos_PunchListItemId_DocumentId",
                table: "pm_punch_list_photos",
                columns: new[] { "PunchListItemId", "DocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_photos_TakenByUserId",
                table: "pm_punch_list_photos",
                column: "TakenByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_punch_list_photos_TenantId",
                table: "pm_punch_list_photos",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pm_punch_list_photos");

            migrationBuilder.DropTable(
                name: "pm_punch_list_items");
        }
    }
}
