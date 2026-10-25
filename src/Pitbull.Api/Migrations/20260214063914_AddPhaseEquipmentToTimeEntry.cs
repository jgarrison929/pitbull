using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPhaseEquipmentToTimeEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_time_entries_unique_daily_entry",
                table: "time_entries");

            migrationBuilder.AddColumn<decimal>(
                name: "EquipmentHours",
                table: "time_entries",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m,
                comment: "Equipment hours used (may differ from labor hours)");

            migrationBuilder.AddColumn<Guid>(
                name: "EquipmentId",
                table: "time_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PhaseId",
                table: "time_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "equipment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, comment: "Unique equipment code within tenant (e.g., EX-001)"),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false, comment: "Equipment name (e.g., CAT 320 Excavator)"),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true, comment: "Optional longer description"),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, comment: "Equipment category"),
                    HourlyRate = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false, comment: "Internal hourly charge rate for job costing"),
                    BillingRate = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true, comment: "Optional T&M billing rate (may differ from internal rate)"),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true, comment: "Whether equipment is available for use"),
                    SerialNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true, comment: "Equipment serial number"),
                    LicensePlate = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true, comment: "License plate for vehicles"),
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
                    table.PrimaryKey("PK_equipment", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_EquipmentId",
                table: "time_entries",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_PhaseId",
                table: "time_entries",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_unique_daily_entry",
                table: "time_entries",
                columns: new[] { "Date", "EmployeeId", "ProjectId", "CostCodeId", "PhaseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_equipment_tenant_active",
                table: "equipment",
                columns: new[] { "TenantId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_equipment_tenant_code",
                table: "equipment",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.AddForeignKey(
                name: "FK_time_entries_equipment",
                table: "time_entries",
                column: "EquipmentId",
                principalTable: "equipment",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_time_entries_phases",
                table: "time_entries",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_time_entries_equipment",
                table: "time_entries");

            migrationBuilder.DropForeignKey(
                name: "FK_time_entries_phases",
                table: "time_entries");

            migrationBuilder.DropTable(
                name: "equipment");

            migrationBuilder.DropIndex(
                name: "IX_time_entries_EquipmentId",
                table: "time_entries");

            migrationBuilder.DropIndex(
                name: "IX_time_entries_PhaseId",
                table: "time_entries");

            migrationBuilder.DropIndex(
                name: "IX_time_entries_unique_daily_entry",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "EquipmentHours",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "EquipmentId",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "PhaseId",
                table: "time_entries");

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_unique_daily_entry",
                table: "time_entries",
                columns: new[] { "Date", "EmployeeId", "ProjectId", "CostCodeId" },
                unique: true);
        }
    }
}
