using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTimecardSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DefaultProjectId",
                table: "companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequireEquipment",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequirePhase",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "TimecardMode",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WeeklyEntryMode",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DefaultProjectId",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "RequireEquipment",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "RequirePhase",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "TimecardMode",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "WeeklyEntryMode",
                table: "companies");
        }
    }
}
