using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddModuleSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BidDefaultOverheadPercent",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 10m);

            migrationBuilder.AddColumn<decimal>(
                name: "BidDefaultProfitPercent",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 10m);

            migrationBuilder.AddColumn<int>(
                name: "BidDefaultValidityPeriodDays",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<bool>(
                name: "BidRequireEstimatorSignOff",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ContractAiaArchitectName",
                table: "companies",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContractAiaOwnerName",
                table: "companies",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContractApprovalWorkflowType",
                table: "companies",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Sequential");

            migrationBuilder.AddColumn<decimal>(
                name: "ContractDefaultRetainagePercent",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 10m);

            migrationBuilder.AddColumn<bool>(
                name: "ContractRequireSignedSubcontract",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ProjAutoCreatePhases",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "ProjDefaultNumberingFormat",
                table: "companies",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "YYYY-####");

            migrationBuilder.AddColumn<decimal>(
                name: "ProjDefaultRetentionPercent",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 10m);

            migrationBuilder.AddColumn<bool>(
                name: "ProjRequireBudgetBeforeActivation",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ReportBrandingName",
                table: "companies",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ReportFiscalYearStartMonth",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "ReportLogoUrl",
                table: "companies",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReportOvertimeRules",
                table: "companies",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Federal");

            migrationBuilder.AddColumn<bool>(
                name: "RfiAutoAssignToPm",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "RfiDefaultResponseDeadlineDays",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 14);

            migrationBuilder.AddColumn<bool>(
                name: "RfiRequireCostImpact",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BidDefaultOverheadPercent",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "BidDefaultProfitPercent",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "BidDefaultValidityPeriodDays",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "BidRequireEstimatorSignOff",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ContractAiaArchitectName",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ContractAiaOwnerName",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ContractApprovalWorkflowType",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ContractDefaultRetainagePercent",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ContractRequireSignedSubcontract",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ProjAutoCreatePhases",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ProjDefaultNumberingFormat",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ProjDefaultRetentionPercent",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ProjRequireBudgetBeforeActivation",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportBrandingName",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportFiscalYearStartMonth",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportLogoUrl",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "ReportOvertimeRules",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "RfiAutoAssignToPm",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "RfiDefaultResponseDeadlineDays",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "RfiRequireCostImpact",
                table: "companies");
        }
    }
}
