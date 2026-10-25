using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollPhase2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "fringe_benefit_allocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunLineId = table.Column<Guid>(type: "uuid", nullable: true),
                    AllocationMethod = table.Column<int>(type: "integer", nullable: false),
                    RequiredFringeRate = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    CashFringeAmount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    BenefitFringeAmount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
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
                    table.PrimaryKey("PK_fringe_benefit_allocations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "payroll_exports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    Format = table.Column<int>(type: "integer", nullable: false),
                    ExportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FilePath = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
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
                    table.PrimaryKey("PK_payroll_exports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_exports_payroll_runs_PayrollRunId",
                        column: x => x.PayrollRunId,
                        principalTable: "payroll_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payroll_run_reviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerUserId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Comments = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EscalatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("PK_payroll_run_reviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_run_reviews_payroll_runs_PayrollRunId",
                        column: x => x.PayrollRunId,
                        principalTable: "payroll_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "wage_determinations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    JurisdictionType = table.Column<int>(type: "integer", nullable: false),
                    DeterminationNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SourceAgency = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_wage_determinations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "work_classifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_work_classifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "payroll_export_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollExportId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MaskedSsn = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StraightTimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    OvertimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    DoubletimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    HourlyRate = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    GrossPay = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Deductions = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    NetPay = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkClassificationId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_payroll_export_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_export_lines_payroll_exports_PayrollExportId",
                        column: x => x.PayrollExportId,
                        principalTable: "payroll_exports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "wage_determination_rates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    WageDeterminationId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkClassificationId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaseRate = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    FringeRate = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    TotalRate = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
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
                    table.PrimaryKey("PK_wage_determination_rates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wage_determination_rates_wage_determinations_WageDeterminationId",
                        column: x => x.WageDeterminationId,
                        principalTable: "wage_determinations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_wage_determination_rates_work_classifications_WorkClassificatio~",
                        column: x => x.WorkClassificationId,
                        principalTable: "work_classifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fringe_benefit_allocations_tenant_company_employee_project",
                table: "fringe_benefit_allocations",
                columns: new[] { "TenantId", "CompanyId", "EmployeeId", "ProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_fringe_benefit_allocations_tenant_company_run_line",
                table: "fringe_benefit_allocations",
                columns: new[] { "TenantId", "CompanyId", "PayrollRunLineId" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_export_lines_PayrollExportId",
                table: "payroll_export_lines",
                column: "PayrollExportId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_export_lines_tenant_company_export",
                table: "payroll_export_lines",
                columns: new[] { "TenantId", "CompanyId", "PayrollExportId" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_exports_PayrollRunId",
                table: "payroll_exports",
                column: "PayrollRunId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_exports_tenant_company_run_exported",
                table: "payroll_exports",
                columns: new[] { "TenantId", "CompanyId", "PayrollRunId", "ExportedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_reviews_PayrollRunId",
                table: "payroll_run_reviews",
                column: "PayrollRunId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_reviews_tenant_company_run",
                table: "payroll_run_reviews",
                columns: new[] { "TenantId", "CompanyId", "PayrollRunId" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_reviews_tenant_company_status_submitted",
                table: "payroll_run_reviews",
                columns: new[] { "TenantId", "CompanyId", "Status", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_wage_determination_rates_tenant_company_determination_class",
                table: "wage_determination_rates",
                columns: new[] { "TenantId", "CompanyId", "WageDeterminationId", "WorkClassificationId" });

            migrationBuilder.CreateIndex(
                name: "IX_wage_determination_rates_WageDeterminationId",
                table: "wage_determination_rates",
                column: "WageDeterminationId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_determination_rates_WorkClassificationId",
                table: "wage_determination_rates",
                column: "WorkClassificationId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_determinations_tenant_company_number",
                table: "wage_determinations",
                columns: new[] { "TenantId", "CompanyId", "DeterminationNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_wage_determinations_tenant_company_project_effective",
                table: "wage_determinations",
                columns: new[] { "TenantId", "CompanyId", "ProjectId", "EffectiveDate" });

            migrationBuilder.CreateIndex(
                name: "IX_work_classifications_tenant_company_code",
                table: "work_classifications",
                columns: new[] { "TenantId", "CompanyId", "Code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "fringe_benefit_allocations");

            migrationBuilder.DropTable(
                name: "payroll_export_lines");

            migrationBuilder.DropTable(
                name: "payroll_run_reviews");

            migrationBuilder.DropTable(
                name: "wage_determination_rates");

            migrationBuilder.DropTable(
                name: "payroll_exports");

            migrationBuilder.DropTable(
                name: "wage_determinations");

            migrationBuilder.DropTable(
                name: "work_classifications");
        }
    }
}
