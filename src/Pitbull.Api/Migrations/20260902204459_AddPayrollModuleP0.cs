using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollModuleP0 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Apprenticeable",
                table: "work_classifications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ClassName",
                table: "work_classifications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Craft",
                table: "work_classifications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShiftCode",
                table: "time_entries",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WorkClassificationId",
                table: "time_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RateSource",
                table: "payroll_run_lines",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "FallbackBaseRate");

            migrationBuilder.AddColumn<Guid>(
                name: "WorkClassificationId",
                table: "payroll_run_lines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScaleCode",
                table: "employee_union_affiliations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UnionAgreementId",
                table: "employee_union_affiliations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WorkClassificationId",
                table: "employee_union_affiliations",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "pay_components",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsTaxable = table.Column<bool>(type: "boolean", nullable: false),
                    IsReportableOnCertified = table.Column<bool>(type: "boolean", nullable: false),
                    IsFringe = table.Column<bool>(type: "boolean", nullable: false),
                    IsCash = table.Column<bool>(type: "boolean", nullable: false),
                    OverlayPack = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
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
                    table.PrimaryKey("PK_pay_components", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pay_structures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    UnionAgreementId = table.Column<Guid>(type: "uuid", nullable: true),
                    WageDeterminationId = table.Column<Guid>(type: "uuid", nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    OvertimeMultiplier = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    DoubletimeMultiplier = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
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
                    table.PrimaryKey("PK_pay_structures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "union_agreements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnionName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LocalNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InternationalBody = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AgreementNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Jurisdiction = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    State = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
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
                    table.PrimaryKey("PK_union_agreements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pay_structure_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayStructureId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayComponentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    Multiplier = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    FormulaKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
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
                    table.PrimaryKey("PK_pay_structure_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pay_structure_lines_pay_components_PayComponentId",
                        column: x => x.PayComponentId,
                        principalTable: "pay_components",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pay_structure_lines_pay_structures_PayStructureId",
                        column: x => x.PayStructureId,
                        principalTable: "pay_structures",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "wage_packages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnionAgreementId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkClassificationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScaleCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ZoneCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ShiftCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
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
                    table.PrimaryKey("PK_wage_packages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wage_packages_union_agreements_UnionAgreementId",
                        column: x => x.UnionAgreementId,
                        principalTable: "union_agreements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_wage_packages_work_classifications_WorkClassificationId",
                        column: x => x.WorkClassificationId,
                        principalTable: "work_classifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "wage_package_rates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    WagePackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayComponentId = table.Column<Guid>(type: "uuid", nullable: false),
                    HourlyRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Unit = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    FringeMethod = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
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
                    table.PrimaryKey("PK_wage_package_rates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wage_package_rates_pay_components_PayComponentId",
                        column: x => x.PayComponentId,
                        principalTable: "pay_components",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_wage_package_rates_wage_packages_WagePackageId",
                        column: x => x.WagePackageId,
                        principalTable: "wage_packages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_run_lines_tenant_company_class",
                table: "payroll_run_lines",
                columns: new[] { "TenantId", "CompanyId", "WorkClassificationId" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_components_CompanyId",
                table: "pay_components",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_components_tenant_company_code",
                table: "pay_components",
                columns: new[] { "TenantId", "CompanyId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pay_components_TenantId",
                table: "pay_components",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_structure_lines_CompanyId",
                table: "pay_structure_lines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_structure_lines_PayComponentId",
                table: "pay_structure_lines",
                column: "PayComponentId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_structure_lines_PayStructureId",
                table: "pay_structure_lines",
                column: "PayStructureId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_structure_lines_tenant_company_structure_seq",
                table: "pay_structure_lines",
                columns: new[] { "TenantId", "CompanyId", "PayStructureId", "Sequence" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_structure_lines_TenantId",
                table: "pay_structure_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_structures_CompanyId",
                table: "pay_structures",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_structures_tenant_company_name_effective",
                table: "pay_structures",
                columns: new[] { "TenantId", "CompanyId", "Name", "EffectiveDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_structures_TenantId",
                table: "pay_structures",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_union_agreements_CompanyId",
                table: "union_agreements",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_union_agreements_tenant_company_local_number",
                table: "union_agreements",
                columns: new[] { "TenantId", "CompanyId", "LocalNumber", "AgreementNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_union_agreements_TenantId",
                table: "union_agreements",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_package_rates_CompanyId",
                table: "wage_package_rates",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_package_rates_PayComponentId",
                table: "wage_package_rates",
                column: "PayComponentId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_package_rates_tenant_company_package_component",
                table: "wage_package_rates",
                columns: new[] { "TenantId", "CompanyId", "WagePackageId", "PayComponentId" });

            migrationBuilder.CreateIndex(
                name: "IX_wage_package_rates_TenantId",
                table: "wage_package_rates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_package_rates_WagePackageId",
                table: "wage_package_rates",
                column: "WagePackageId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_packages_CompanyId",
                table: "wage_packages",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_packages_tenant_company_lookup",
                table: "wage_packages",
                columns: new[] { "TenantId", "CompanyId", "UnionAgreementId", "WorkClassificationId", "ScaleCode", "EffectiveDate" });

            migrationBuilder.CreateIndex(
                name: "IX_wage_packages_TenantId",
                table: "wage_packages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_packages_UnionAgreementId",
                table: "wage_packages",
                column: "UnionAgreementId");

            migrationBuilder.CreateIndex(
                name: "IX_wage_packages_WorkClassificationId",
                table: "wage_packages",
                column: "WorkClassificationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pay_structure_lines");

            migrationBuilder.DropTable(
                name: "wage_package_rates");

            migrationBuilder.DropTable(
                name: "pay_structures");

            migrationBuilder.DropTable(
                name: "pay_components");

            migrationBuilder.DropTable(
                name: "wage_packages");

            migrationBuilder.DropTable(
                name: "union_agreements");

            migrationBuilder.DropIndex(
                name: "IX_payroll_run_lines_tenant_company_class",
                table: "payroll_run_lines");

            migrationBuilder.DropColumn(
                name: "Apprenticeable",
                table: "work_classifications");

            migrationBuilder.DropColumn(
                name: "ClassName",
                table: "work_classifications");

            migrationBuilder.DropColumn(
                name: "Craft",
                table: "work_classifications");

            migrationBuilder.DropColumn(
                name: "ShiftCode",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "WorkClassificationId",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "RateSource",
                table: "payroll_run_lines");

            migrationBuilder.DropColumn(
                name: "WorkClassificationId",
                table: "payroll_run_lines");

            migrationBuilder.DropColumn(
                name: "ScaleCode",
                table: "employee_union_affiliations");

            migrationBuilder.DropColumn(
                name: "UnionAgreementId",
                table: "employee_union_affiliations");

            migrationBuilder.DropColumn(
                name: "WorkClassificationId",
                table: "employee_union_affiliations");
        }
    }
}
