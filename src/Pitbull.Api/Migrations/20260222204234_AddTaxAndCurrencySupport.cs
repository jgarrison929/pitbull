using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxAndCurrencySupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "TotalAmount",
                table: "vendor_invoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(14,2)",
                oldPrecision: 14,
                oldScale: 2);

            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                table: "vendor_invoices",
                type: "character varying(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "USD");

            migrationBuilder.AddColumn<decimal>(
                name: "ExchangeRate",
                table: "vendor_invoices",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: false,
                defaultValue: 1.0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsTaxExempt",
                table: "vendor_invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "SubtotalAmount",
                table: "vendor_invoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                table: "vendor_invoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "TaxExemptReason",
                table: "vendor_invoices",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TaxJurisdictionId",
                table: "vendor_invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxRate",
                table: "vendor_invoices",
                type: "numeric(7,4)",
                precision: 7,
                scale: 4,
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalAmount",
                table: "purchase_orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(14,2)",
                oldPrecision: 14,
                oldScale: 2);

            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                table: "purchase_orders",
                type: "character varying(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "USD");

            migrationBuilder.AddColumn<decimal>(
                name: "ExchangeRate",
                table: "purchase_orders",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: false,
                defaultValue: 1.0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsTaxExempt",
                table: "purchase_orders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "SubtotalAmount",
                table: "purchase_orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                table: "purchase_orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "TaxExemptReason",
                table: "purchase_orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TaxJurisdictionId",
                table: "purchase_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "purchase_order_lines",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(14,2)",
                oldPrecision: 14,
                oldScale: 2);

            migrationBuilder.AddColumn<bool>(
                name: "IsTaxable",
                table: "purchase_order_lines",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                table: "purchase_order_lines",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxRate",
                table: "purchase_order_lines",
                type: "numeric(7,4)",
                precision: 7,
                scale: 4,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "currency_exchange_rates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FromCurrency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    ToCurrency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Rate = table.Column<decimal>(type: "numeric(18,8)", precision: 18, scale: 8, nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
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
                    table.PrimaryKey("PK_currency_exchange_rates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_exemptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Scope = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExemptionCertificateNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ExemptCategory = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_tax_exemptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_jurisdictions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    State = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    County = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CombinedRate = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    StateRate = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    CountyRate = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    CityRate = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
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
                    table.PrimaryKey("PK_tax_jurisdictions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_rates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    TaxJurisdictionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Rate = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
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
                    table.PrimaryKey("PK_tax_rates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tax_rates_tax_jurisdictions_TaxJurisdictionId",
                        column: x => x.TaxJurisdictionId,
                        principalTable: "tax_jurisdictions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_currency_exchange_rates_pair_date",
                table: "currency_exchange_rates",
                columns: new[] { "TenantId", "FromCurrency", "ToCurrency", "EffectiveDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_currency_exchange_rates_TenantId",
                table: "currency_exchange_rates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_exemptions_CompanyId",
                table: "tax_exemptions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_exemptions_tenant_company_scope_entity",
                table: "tax_exemptions",
                columns: new[] { "TenantId", "CompanyId", "Scope", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_tax_exemptions_TenantId",
                table: "tax_exemptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_jurisdictions_CompanyId",
                table: "tax_jurisdictions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_jurisdictions_tenant_company_code",
                table: "tax_jurisdictions",
                columns: new[] { "TenantId", "CompanyId", "Code" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_tax_jurisdictions_tenant_company_state",
                table: "tax_jurisdictions",
                columns: new[] { "TenantId", "CompanyId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_tax_jurisdictions_TenantId",
                table: "tax_jurisdictions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_CompanyId",
                table: "tax_rates",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_TaxJurisdictionId",
                table: "tax_rates",
                column: "TaxJurisdictionId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_tenant_company_jurisdiction_category",
                table: "tax_rates",
                columns: new[] { "TenantId", "CompanyId", "TaxJurisdictionId", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_TenantId",
                table: "tax_rates",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "currency_exchange_rates");

            migrationBuilder.DropTable(
                name: "tax_exemptions");

            migrationBuilder.DropTable(
                name: "tax_rates");

            migrationBuilder.DropTable(
                name: "tax_jurisdictions");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "ExchangeRate",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "IsTaxExempt",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "SubtotalAmount",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "TaxExemptReason",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "TaxJurisdictionId",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "TaxRate",
                table: "vendor_invoices");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "ExchangeRate",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "IsTaxExempt",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "SubtotalAmount",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "TaxExemptReason",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "TaxJurisdictionId",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "IsTaxable",
                table: "purchase_order_lines");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                table: "purchase_order_lines");

            migrationBuilder.DropColumn(
                name: "TaxRate",
                table: "purchase_order_lines");

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalAmount",
                table: "vendor_invoices",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2);

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalAmount",
                table: "purchase_orders",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2);

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "purchase_order_lines",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2);
        }
    }
}
