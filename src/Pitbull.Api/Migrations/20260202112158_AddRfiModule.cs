using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations;

/// <inheritdoc />
public partial class AddRfiModule : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "rfis",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Number = table.Column<int>(type: "integer", nullable: false),
                Subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                Question = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                Answer = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                Priority = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                AnsweredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                BallInCourtUserId = table.Column<Guid>(type: "uuid", nullable: true),
                BallInCourtName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                AssignedToUserId = table.Column<Guid>(type: "uuid", nullable: true),
                AssignedToName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                CreatedByName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
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
                table.PrimaryKey("PK_rfis", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_rfis_AssignedToUserId",
            table: "rfis",
            column: "AssignedToUserId");

        migrationBuilder.CreateIndex(
            name: "IX_rfis_BallInCourtUserId",
            table: "rfis",
            column: "BallInCourtUserId");

        migrationBuilder.CreateIndex(
            name: "IX_rfis_ProjectId",
            table: "rfis",
            column: "ProjectId");

        migrationBuilder.CreateIndex(
            name: "IX_rfis_Status",
            table: "rfis",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_rfis_TenantId_ProjectId_Number",
            table: "rfis",
            columns: ["TenantId", "ProjectId", "Number"],
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "rfis");
    }
}
