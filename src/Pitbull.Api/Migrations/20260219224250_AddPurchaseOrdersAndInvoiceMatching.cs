using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseOrdersAndInvoiceMatching : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "purchase_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PONumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TotalAmount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("PK_purchase_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "purchase_order_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReceivedQuantity = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false, defaultValue: 0m),
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
                    table.PrimaryKey("PK_purchase_order_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_order_lines_purchase_orders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "purchase_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vendor_invoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    InvoiceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PurchaseOrderId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_vendor_invoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vendor_invoices_purchase_orders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "purchase_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "invoice_match_results",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorInvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchType = table.Column<int>(type: "integer", nullable: false),
                    VarianceAmount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    VariancePercent = table.Column<decimal>(type: "numeric(8,4)", precision: 8, scale: 4, nullable: false),
                    AutoApproved = table.Column<bool>(type: "boolean", nullable: false),
                    MatchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
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
                    table.PrimaryKey("PK_invoice_match_results", x => x.Id);
                    table.ForeignKey(
                        name: "FK_invoice_match_results_purchase_orders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "purchase_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_invoice_match_results_vendor_invoices_VendorInvoiceId",
                        column: x => x.VendorInvoiceId,
                        principalTable: "vendor_invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_invoice_match_results_CompanyId",
                table: "invoice_match_results",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_invoice_match_results_PurchaseOrderId",
                table: "invoice_match_results",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_invoice_match_results_tenant_company_invoice",
                table: "invoice_match_results",
                columns: new[] { "TenantId", "CompanyId", "VendorInvoiceId" });

            migrationBuilder.CreateIndex(
                name: "IX_invoice_match_results_tenant_company_po",
                table: "invoice_match_results",
                columns: new[] { "TenantId", "CompanyId", "PurchaseOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_invoice_match_results_TenantId",
                table: "invoice_match_results",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_invoice_match_results_VendorInvoiceId",
                table: "invoice_match_results",
                column: "VendorInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_lines_CompanyId",
                table: "purchase_order_lines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_lines_PurchaseOrderId",
                table: "purchase_order_lines",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_lines_tenant_company_po",
                table: "purchase_order_lines",
                columns: new[] { "TenantId", "CompanyId", "PurchaseOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_lines_TenantId",
                table: "purchase_order_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_CompanyId",
                table: "purchase_orders",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_tenant_company_po_number",
                table: "purchase_orders",
                columns: new[] { "TenantId", "CompanyId", "PONumber" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_tenant_company_project",
                table: "purchase_orders",
                columns: new[] { "TenantId", "CompanyId", "ProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_tenant_company_vendor",
                table: "purchase_orders",
                columns: new[] { "TenantId", "CompanyId", "VendorId" });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_TenantId",
                table: "purchase_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_invoices_CompanyId",
                table: "vendor_invoices",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_invoices_PurchaseOrderId",
                table: "vendor_invoices",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_invoices_tenant_company_po",
                table: "vendor_invoices",
                columns: new[] { "TenantId", "CompanyId", "PurchaseOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_invoices_tenant_company_vendor_invoice",
                table: "vendor_invoices",
                columns: new[] { "TenantId", "CompanyId", "VendorId", "InvoiceNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_invoices_TenantId",
                table: "vendor_invoices",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "invoice_match_results");

            migrationBuilder.DropTable(
                name: "purchase_order_lines");

            migrationBuilder.DropTable(
                name: "vendor_invoices");

            migrationBuilder.DropTable(
                name: "purchase_orders");
        }
    }
}
