using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerPaymentTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExpectedPaymentDate",
                table: "payment_applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "payment_applications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentNotes",
                table: "payment_applications",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentApplicationSettings_DefaultPaymentTermDays",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            // Backfill existing rows that may have received the old default of 0
            migrationBuilder.Sql(
                "UPDATE companies SET \"PaymentApplicationSettings_DefaultPaymentTermDays\" = 30 WHERE \"PaymentApplicationSettings_DefaultPaymentTermDays\" = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpectedPaymentDate",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "PaymentNotes",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "PaymentApplicationSettings_DefaultPaymentTermDays",
                table: "companies");
        }
    }
}
