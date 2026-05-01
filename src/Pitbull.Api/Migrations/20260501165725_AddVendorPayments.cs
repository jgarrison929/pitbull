using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVendorPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "vendor_payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Memo = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    PostedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    PostedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("PK_vendor_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vendor_payments_bank_accounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalTable: "bank_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_vendor_payments_vendors_VendorId",
                        column: x => x.VendorId,
                        principalTable: "vendors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "vendor_payment_applications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorPaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorInvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppliedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
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
                    table.PrimaryKey("PK_vendor_payment_applications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vendor_payment_applications_vendor_invoices_VendorInvoiceId",
                        column: x => x.VendorInvoiceId,
                        principalTable: "vendor_invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_vendor_payment_applications_vendor_payments_VendorPaymentId",
                        column: x => x.VendorPaymentId,
                        principalTable: "vendor_payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payment_applications_CompanyId",
                table: "vendor_payment_applications",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payment_applications_tenant_company_invoice",
                table: "vendor_payment_applications",
                columns: new[] { "TenantId", "CompanyId", "VendorInvoiceId" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payment_applications_tenant_company_payment",
                table: "vendor_payment_applications",
                columns: new[] { "TenantId", "CompanyId", "VendorPaymentId" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payment_applications_TenantId",
                table: "vendor_payment_applications",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payment_applications_VendorInvoiceId",
                table: "vendor_payment_applications",
                column: "VendorInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payment_applications_VendorPaymentId",
                table: "vendor_payment_applications",
                column: "VendorPaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_BankAccountId",
                table: "vendor_payments",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_CompanyId",
                table: "vendor_payments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_tenant_company_date",
                table: "vendor_payments",
                columns: new[] { "TenantId", "CompanyId", "PaymentDate" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_tenant_company_payment_number",
                table: "vendor_payments",
                columns: new[] { "TenantId", "CompanyId", "PaymentNumber" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_tenant_company_status",
                table: "vendor_payments",
                columns: new[] { "TenantId", "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_tenant_company_vendor",
                table: "vendor_payments",
                columns: new[] { "TenantId", "CompanyId", "VendorId" });

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_TenantId",
                table: "vendor_payments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_vendor_payments_VendorId",
                table: "vendor_payments",
                column: "VendorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vendor_payment_applications");

            migrationBuilder.DropTable(
                name: "vendor_payments");
        }
    }
}
