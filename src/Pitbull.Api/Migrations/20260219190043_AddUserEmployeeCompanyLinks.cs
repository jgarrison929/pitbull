using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserEmployeeCompanyLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EmployeeId",
                table: "users",
                type: "uuid",
                nullable: true);

            // Overtime Report columns already added in AddOvertimeDetailSettings migration
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "users");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "users");

            // Overtime Report columns dropped by AddOvertimeDetailSettings migration
        }
    }
}
