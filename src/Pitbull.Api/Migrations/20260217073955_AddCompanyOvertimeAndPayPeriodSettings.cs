using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyOvertimeAndPayPeriodSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CaliforniaOtRules",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "DailyDtThreshold",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 12m);

            migrationBuilder.AddColumn<decimal>(
                name: "DailyOtThreshold",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 8m);

            migrationBuilder.AddColumn<string>(
                name: "DefaultWorkWeekDays",
                table: "companies",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "Mon,Tue,Wed,Thu,Fri");

            migrationBuilder.AddColumn<bool>(
                name: "OtEnabled",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "PayPeriodType",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Weekly");

            migrationBuilder.AddColumn<decimal>(
                name: "WeeklyOtThreshold",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 40m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CaliforniaOtRules",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "DailyDtThreshold",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "DailyOtThreshold",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "DefaultWorkWeekDays",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OtEnabled",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayPeriodType",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "WeeklyOtThreshold",
                table: "companies");
        }
    }
}
