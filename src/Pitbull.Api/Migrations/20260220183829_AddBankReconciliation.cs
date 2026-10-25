using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBankReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bank_accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BankName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AccountNumberLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    RoutingNumber = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: true),
                    GlAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OpeningBalanceDate = table.Column<DateOnly>(type: "date", nullable: true),
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
                    table.PrimaryKey("PK_bank_accounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bank_reconciliations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    StatementDate = table.Column<DateOnly>(type: "date", nullable: false),
                    StatementEndingBalance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BeginningBalance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ClearedDeposits = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ClearedWithdrawals = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Difference = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CompletedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("PK_bank_reconciliations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bank_reconciliations_bank_accounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalTable: "bank_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bank_transactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CheckNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TransactionType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsCleared = table.Column<bool>(type: "boolean", nullable: false),
                    BankReconciliationId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedJournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClearedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("PK_bank_transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bank_transactions_bank_accounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalTable: "bank_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bank_transactions_bank_reconciliations_BankReconciliationId",
                        column: x => x.BankReconciliationId,
                        principalTable: "bank_reconciliations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bank_accounts_CompanyId",
                table: "bank_accounts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_accounts_gl_account_id",
                table: "bank_accounts",
                column: "GlAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_accounts_tenant_company_name",
                table: "bank_accounts",
                columns: new[] { "TenantId", "CompanyId", "AccountName" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bank_accounts_TenantId",
                table: "bank_accounts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_BankAccountId",
                table: "bank_reconciliations",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_CompanyId",
                table: "bank_reconciliations",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_tenant_company_account_date",
                table: "bank_reconciliations",
                columns: new[] { "TenantId", "CompanyId", "BankAccountId", "StatementDate" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_tenant_company_status",
                table: "bank_reconciliations",
                columns: new[] { "TenantId", "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_TenantId",
                table: "bank_reconciliations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_BankAccountId",
                table: "bank_transactions",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_BankReconciliationId",
                table: "bank_transactions",
                column: "BankReconciliationId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_CompanyId",
                table: "bank_transactions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_tenant_company_account_date",
                table: "bank_transactions",
                columns: new[] { "TenantId", "CompanyId", "BankAccountId", "TransactionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_tenant_company_cleared",
                table: "bank_transactions",
                columns: new[] { "TenantId", "CompanyId", "IsCleared" });

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_TenantId",
                table: "bank_transactions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bank_transactions");

            migrationBuilder.DropTable(
                name: "bank_reconciliations");

            migrationBuilder.DropTable(
                name: "bank_accounts");
        }
    }
}
