using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "payroll");

            migrationBuilder.CreateTable(
                name: "deductions",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeductionCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Method = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false),
                    MaxPerPeriod = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    AnnualMax = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    YtdAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    IsPreTax = table.Column<bool>(type: "boolean", nullable: false),
                    EmployerMatch = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    EmployerMatchMax = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CaseNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    GarnishmentPayee = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deductions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_deductions_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "emergency_contacts",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Relationship = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PrimaryPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SecondaryPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_emergency_contacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_emergency_contacts_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "i9_records",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Section1CompletedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CitizenshipStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AlienNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    I94Number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ForeignPassportNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ForeignPassportCountry = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    WorkAuthorizationExpires = table.Column<DateOnly>(type: "date", nullable: true),
                    Section2CompletedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Section2CompletedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ListADocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ListADocumentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ListAExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ListBDocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ListBDocumentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ListBExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ListCDocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ListCDocumentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ListCExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EmploymentStartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Section3Date = table.Column<DateOnly>(type: "date", nullable: true),
                    Section3NewDocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Section3NewDocumentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Section3NewDocumentExpiration = table.Column<DateOnly>(type: "date", nullable: true),
                    Section3RehireDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EVerifyCaseNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RetentionEndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_i9_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_i9_records_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pay_periods",
                schema: "payroll",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PayDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Frequency = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ProcessedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pay_periods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "union_memberships",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnionLocal = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MembershipNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Classification = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ApprenticeLevel = table.Column<int>(type: "integer", nullable: true),
                    JoinDate = table.Column<DateOnly>(type: "date", nullable: true),
                    DuesPaid = table.Column<bool>(type: "boolean", nullable: false),
                    DuesPaidThrough = table.Column<DateOnly>(type: "date", nullable: true),
                    DispatchNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DispatchDate = table.Column<DateOnly>(type: "date", nullable: true),
                    DispatchListPosition = table.Column<int>(type: "integer", nullable: true),
                    FringeRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    HealthWelfareRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    PensionRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    TrainingRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_union_memberships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_union_memberships_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "withholding_elections",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TaxJurisdiction = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FilingStatus = table.Column<int>(type: "integer", nullable: false),
                    Allowances = table.Column<int>(type: "integer", nullable: false),
                    AdditionalWithholding = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    IsExempt = table.Column<bool>(type: "boolean", nullable: false),
                    MultipleJobsOrSpouseWorks = table.Column<bool>(type: "boolean", nullable: false),
                    DependentCredits = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    OtherIncome = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    Deductions = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SignedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_withholding_elections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_withholding_elections_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "everify_cases",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    I9RecordId = table.Column<Guid>(type: "uuid", nullable: true),
                    CaseNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SubmittedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    LastStatusDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Result = table.Column<int>(type: "integer", nullable: true),
                    ClosedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TNCDeadline = table.Column<DateOnly>(type: "date", nullable: true),
                    TNCContested = table.Column<bool>(type: "boolean", nullable: true),
                    PhotoMatched = table.Column<bool>(type: "boolean", nullable: true),
                    SSAResult = table.Column<int>(type: "integer", nullable: true),
                    DHSResult = table.Column<int>(type: "integer", nullable: true),
                    SubmittedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_everify_cases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_everify_cases_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_everify_cases_i9_records_I9RecordId",
                        column: x => x.I9RecordId,
                        principalSchema: "hr",
                        principalTable: "i9_records",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "payroll_batches",
                schema: "payroll",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayPeriodId = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalRegularHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    TotalOvertimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    TotalDoubleTimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    TotalGrossPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalDeductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalNetPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalEmployerTaxes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalUnionFringes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalEmployerCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EmployeeCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CalculatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CalculatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PostedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PostedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_batches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_batches_pay_periods_PayPeriodId",
                        column: x => x.PayPeriodId,
                        principalSchema: "payroll",
                        principalTable: "pay_periods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payroll_entries",
                schema: "payroll",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollBatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegularHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    OvertimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    DoubleTimeHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    PtoHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    HolidayHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    TotalHours = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    RegularRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false),
                    OvertimeRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false),
                    DoubleTimeRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false),
                    RegularPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OvertimePay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DoubleTimePay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PtoPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    HolidayPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BonusPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OtherEarnings = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    GrossPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FederalWithholding = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SocialSecurity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Medicare = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AdditionalMedicare = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WorkState = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    StateWithholding = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    StateDisability = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LocalWithholding = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalDeductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PreTaxDeductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PostTaxDeductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EmployerSocialSecurity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EmployerMedicare = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EmployerFuta = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EmployerSuta = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WorkersCompPremium = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnionHealthWelfare = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnionPension = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnionTraining = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnionOther = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalUnionFringes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalEmployerTaxes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalEmployerCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdGross = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdFederalWithholding = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdSocialSecurity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdMedicare = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdStateWithholding = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdNet = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_entries_payroll_batches_PayrollBatchId",
                        column: x => x.PayrollBatchId,
                        principalSchema: "payroll",
                        principalTable: "payroll_batches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payroll_deduction_lines",
                schema: "payroll",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeductionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeductionCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsPreTax = table.Column<bool>(type: "boolean", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdBefore = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    YtdAfter = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    HitAnnualMax = table.Column<bool>(type: "boolean", nullable: false),
                    EmployerMatch = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_deduction_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_deduction_lines_payroll_entries_PayrollEntryId",
                        column: x => x.PayrollEntryId,
                        principalSchema: "payroll",
                        principalTable: "payroll_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_deductions_EmployeeId",
                schema: "hr",
                table: "deductions",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_deductions_EmployeeId_DeductionCode",
                schema: "hr",
                table: "deductions",
                columns: new[] { "EmployeeId", "DeductionCode" });

            migrationBuilder.CreateIndex(
                name: "IX_deductions_Priority",
                schema: "hr",
                table: "deductions",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_deductions_TenantId",
                schema: "hr",
                table: "deductions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_emergency_contacts_EmployeeId",
                schema: "hr",
                table: "emergency_contacts",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_emergency_contacts_EmployeeId_Priority",
                schema: "hr",
                table: "emergency_contacts",
                columns: new[] { "EmployeeId", "Priority" });

            migrationBuilder.CreateIndex(
                name: "IX_emergency_contacts_TenantId",
                schema: "hr",
                table: "emergency_contacts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_everify_cases_CaseNumber",
                schema: "hr",
                table: "everify_cases",
                column: "CaseNumber");

            migrationBuilder.CreateIndex(
                name: "IX_everify_cases_EmployeeId",
                schema: "hr",
                table: "everify_cases",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_everify_cases_I9RecordId",
                schema: "hr",
                table: "everify_cases",
                column: "I9RecordId");

            migrationBuilder.CreateIndex(
                name: "IX_everify_cases_Status",
                schema: "hr",
                table: "everify_cases",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_everify_cases_TenantId",
                schema: "hr",
                table: "everify_cases",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_everify_cases_TNCDeadline",
                schema: "hr",
                table: "everify_cases",
                column: "TNCDeadline");

            migrationBuilder.CreateIndex(
                name: "IX_i9_records_EmployeeId",
                schema: "hr",
                table: "i9_records",
                column: "EmployeeId",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_i9_records_Status",
                schema: "hr",
                table: "i9_records",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_i9_records_TenantId",
                schema: "hr",
                table: "i9_records",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_i9_records_WorkAuthorizationExpires",
                schema: "hr",
                table: "i9_records",
                column: "WorkAuthorizationExpires");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_Status",
                schema: "payroll",
                table: "pay_periods",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_TenantId",
                schema: "payroll",
                table: "pay_periods",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_TenantId_StartDate_EndDate",
                schema: "payroll",
                table: "pay_periods",
                columns: new[] { "TenantId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_batches_PayPeriodId",
                schema: "payroll",
                table: "payroll_batches",
                column: "PayPeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_batches_Status",
                schema: "payroll",
                table: "payroll_batches",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_batches_TenantId",
                schema: "payroll",
                table: "payroll_batches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_batches_TenantId_BatchNumber",
                schema: "payroll",
                table: "payroll_batches",
                columns: new[] { "TenantId", "BatchNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_deduction_lines_DeductionId",
                schema: "payroll",
                table: "payroll_deduction_lines",
                column: "DeductionId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_deduction_lines_PayrollEntryId",
                schema: "payroll",
                table: "payroll_deduction_lines",
                column: "PayrollEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_deduction_lines_TenantId",
                schema: "payroll",
                table: "payroll_deduction_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_entries_EmployeeId",
                schema: "payroll",
                table: "payroll_entries",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_entries_PayrollBatchId",
                schema: "payroll",
                table: "payroll_entries",
                column: "PayrollBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_entries_PayrollBatchId_EmployeeId",
                schema: "payroll",
                table: "payroll_entries",
                columns: new[] { "PayrollBatchId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_entries_TenantId",
                schema: "payroll",
                table: "payroll_entries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_union_memberships_EmployeeId",
                schema: "hr",
                table: "union_memberships",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_union_memberships_EmployeeId_UnionLocal",
                schema: "hr",
                table: "union_memberships",
                columns: new[] { "EmployeeId", "UnionLocal" });

            migrationBuilder.CreateIndex(
                name: "IX_union_memberships_TenantId",
                schema: "hr",
                table: "union_memberships",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_union_memberships_UnionLocal",
                schema: "hr",
                table: "union_memberships",
                column: "UnionLocal");

            migrationBuilder.CreateIndex(
                name: "IX_withholding_elections_EmployeeId",
                schema: "hr",
                table: "withholding_elections",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_withholding_elections_EmployeeId_TaxJurisdiction_EffectiveD~",
                schema: "hr",
                table: "withholding_elections",
                columns: new[] { "EmployeeId", "TaxJurisdiction", "EffectiveDate" });

            migrationBuilder.CreateIndex(
                name: "IX_withholding_elections_TenantId",
                schema: "hr",
                table: "withholding_elections",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deductions",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "emergency_contacts",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "everify_cases",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "payroll_deduction_lines",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "union_memberships",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "withholding_elections",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "i9_records",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "payroll_entries",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_batches",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "pay_periods",
                schema: "payroll");
        }
    }
}
