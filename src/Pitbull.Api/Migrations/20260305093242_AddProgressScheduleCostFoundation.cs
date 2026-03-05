using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProgressScheduleCostFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pm_cost_code_activity_mappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeightFactor = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
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
                    table.PrimaryKey("PK_pm_cost_code_activity_mappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_cost_code_activity_mappings_CostCodes_CostCodeId",
                        column: x => x.CostCodeId,
                        principalTable: "CostCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_cost_code_activity_mappings_pm_schedule_activities_Sched~",
                        column: x => x.ScheduleActivityId,
                        principalTable: "pm_schedule_activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_cost_code_activity_mappings_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pm_cost_code_ev_snapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SnapshotDate = table.Column<DateOnly>(type: "date", nullable: false),
                    BCWS = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BCWP = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ACWP = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BAC = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SV = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CV = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SPI = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    CPI = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    EAC = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ETC = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TCPI = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
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
                    table.PrimaryKey("PK_pm_cost_code_ev_snapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_cost_code_ev_snapshots_CostCodes_CostCodeId",
                        column: x => x.CostCodeId,
                        principalTable: "CostCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_cost_code_ev_snapshots_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pm_field_progress_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleActivityId = table.Column<Guid>(type: "uuid", nullable: true),
                    QuantityInstalled = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitOfMeasure = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CumulativeQuantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    TotalBudgetedQuantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    PercentComplete = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    CrewSize = table.Column<int>(type: "integer", nullable: false),
                    HoursWorked = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    WeatherCondition = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ReportedById = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_pm_field_progress_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_field_progress_entries_CostCodes_CostCodeId",
                        column: x => x.CostCodeId,
                        principalTable: "CostCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_field_progress_entries_employees_ReportedById",
                        column: x => x.ReportedById,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_field_progress_entries_pm_schedule_activities_ScheduleAc~",
                        column: x => x.ScheduleActivityId,
                        principalTable: "pm_schedule_activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pm_field_progress_entries_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_activity_mappings_CompanyId",
                table: "pm_cost_code_activity_mappings",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_activity_mappings_CostCodeId",
                table: "pm_cost_code_activity_mappings",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_activity_mappings_ProjectId_CostCodeId",
                table: "pm_cost_code_activity_mappings",
                columns: new[] { "ProjectId", "CostCodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_activity_mappings_ScheduleActivityId",
                table: "pm_cost_code_activity_mappings",
                column: "ScheduleActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_activity_mappings_TenantId",
                table: "pm_cost_code_activity_mappings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_activity_mappings_TenantId_ProjectId_CostCodeI~",
                table: "pm_cost_code_activity_mappings",
                columns: new[] { "TenantId", "ProjectId", "CostCodeId", "ScheduleActivityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_ev_snapshots_CompanyId",
                table: "pm_cost_code_ev_snapshots",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_ev_snapshots_CostCodeId",
                table: "pm_cost_code_ev_snapshots",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_ev_snapshots_ProjectId_SnapshotDate",
                table: "pm_cost_code_ev_snapshots",
                columns: new[] { "ProjectId", "SnapshotDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_ev_snapshots_TenantId",
                table: "pm_cost_code_ev_snapshots",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_ev_snapshots_TenantId_ProjectId_CostCodeId_Sna~",
                table: "pm_cost_code_ev_snapshots",
                columns: new[] { "TenantId", "ProjectId", "CostCodeId", "SnapshotDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_field_progress_entries_CompanyId",
                table: "pm_field_progress_entries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_field_progress_entries_CostCodeId",
                table: "pm_field_progress_entries",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_field_progress_entries_ProjectId_CostCodeId_Date",
                table: "pm_field_progress_entries",
                columns: new[] { "ProjectId", "CostCodeId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_field_progress_entries_ProjectId_Date",
                table: "pm_field_progress_entries",
                columns: new[] { "ProjectId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_field_progress_entries_ReportedById",
                table: "pm_field_progress_entries",
                column: "ReportedById");

            migrationBuilder.CreateIndex(
                name: "IX_pm_field_progress_entries_ScheduleActivityId",
                table: "pm_field_progress_entries",
                column: "ScheduleActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_field_progress_entries_TenantId",
                table: "pm_field_progress_entries",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pm_cost_code_activity_mappings");

            migrationBuilder.DropTable(
                name: "pm_cost_code_ev_snapshots");

            migrationBuilder.DropTable(
                name: "pm_field_progress_entries");
        }
    }
}
