using Microsoft.EntityFrameworkCore;
using Pitbull.Billing.Domain;
using Pitbull.Bids.Domain;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;
using Pitbull.Core.MultiTenancy;
using Pitbull.Notifications.Domain;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using TaskStatus = Pitbull.ProjectManagement.Domain.TaskStatus;
using Pitbull.RFIs.Domain;
using Pitbull.SystemAdmin.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Api.Features.SeedData;

/// <summary>
/// Seeds realistic construction demo data.
///
/// This service is used by:
/// - The dev-only HTTP endpoint (SeedDataController)
/// - The public demo bootstrapper (when explicitly enabled via configuration)
/// </summary>
public class SeedDataService(PitbullDbContext db, IWebHostEnvironment env, IConfiguration configuration, CompanyContext companyContext)
    : ISeedDataService
{
    /// <summary>
    /// Bump this version whenever seed data content changes.
    /// On next startup, old seed data is cleared and re-seeded automatically.
    /// </summary>
    private const int SeedDataVersion = 7;

    public async Task<Result<SeedDataResult>> SeedAsync(CancellationToken cancellationToken = default, bool useExternalTransaction = false)
    {
        var allowNonDev = configuration.GetValue<bool>("SeedData:AllowInNonDevelopment")
                          || configuration.GetValue<bool>("Demo:Enabled");

        if (!env.IsDevelopment() && !allowNonDev)
            return Result.Failure<SeedDataResult>(
                "Seed data is only available in Development environment", "FORBIDDEN");

        // Check if seed data already exists and whether it's at the current version
        var demoProject = await db.Set<Project>()
            .IgnoreQueryFilters()
            .Where(p => p.Number.StartsWith("DEMO-PRJ") && !p.IsDeleted)
            .Select(p => new { p.TenantId })
            .FirstOrDefaultAsync(cancellationToken);

        if (demoProject is not null)
        {
            var settings = await db.Set<TenantSettings>()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.TenantId == demoProject.TenantId, cancellationToken);

            if (settings is not null && settings.SeedDataVersion >= SeedDataVersion)
                return Result.Failure<SeedDataResult>(
                    "Seed data already exists at current version.", "ALREADY_EXISTS");

            // Old version (or no version recorded) — clear and re-seed
            await ClearSeedDataAsync(demoProject.TenantId, cancellationToken);
        }

        // When called from DemoBootstrapper, it already has a transaction with RLS set_config.
        // Starting a nested transaction would throw InvalidOperationException in EF Core.
        if (useExternalTransaction)
            return await SeedCoreAsync(cancellationToken);

        // Standalone path (SeedDataController): wrap in our own transaction for atomicity.
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async (ct) =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            try
            {
                var result = await SeedCoreAsync(ct);
                await transaction.CommitAsync(ct);
                return result;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        }, cancellationToken);
    }

    /// <summary>
    /// Core seed logic extracted so it can run inside either its own transaction
    /// (SeedDataController) or a caller-provided transaction (DemoBootstrapper).
    /// </summary>
    private async Task<Result<SeedDataResult>> SeedCoreAsync(CancellationToken ct)
    {
        // Look up Company 01 (Summit Builders Group) so all ICompanyScoped seed
        // entities get the correct CompanyId.  Without this, the CompanyMiddleware
        // context isn't resolved during seeding and every entity stays Guid.Empty.
        var companyId = await db.Set<Company>()
            .IgnoreQueryFilters()
            .Where(c => c.Code == "01" && !c.IsDeleted)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);

        // Fallback: take any active company (dev environments without demo bootstrap)
        if (companyId == Guid.Empty)
        {
            companyId = await db.Set<Company>()
                .IgnoreQueryFilters()
                .Where(c => !c.IsDeleted)
                .Select(c => c.Id)
                .FirstOrDefaultAsync(ct);
        }

        var projects = CreateProjects();
        var additionalProjects = CreateAdditionalProjects();
        projects.AddRange(additionalProjects);

        var bids = CreateBids();
        var costCodes = CreateCostCodes();

        var employees = CreateEmployees();
        var additionalEmployees = CreateAdditionalEmployees();
        employees.AddRange(additionalEmployees);

        var customers = CreateCustomers();
        var additionalCustomers = CreateAdditionalCustomers();
        customers.AddRange(additionalCustomers);

        var vendors = CreateVendors();
        var additionalVendors = CreateAdditionalVendors();
        vendors.AddRange(additionalVendors);

        StampCompanyId(projects, companyId);
        foreach (var p in projects)
        {
            StampCompanyId(p.Phases, companyId);
            StampCompanyId(p.Projections, companyId);
        }
        StampCompanyId(bids, companyId);
        foreach (var b in bids)
            StampCompanyId(b.Items, companyId);
        StampCompanyId(customers, companyId);
        StampCompanyId(vendors, companyId);

        db.Set<CostCode>().AddRange(costCodes);
        db.Set<Project>().AddRange(projects);
        db.Set<Bid>().AddRange(bids);
        db.Set<Employee>().AddRange(employees);
        db.Set<Customer>().AddRange(customers);
        db.Set<Vendor>().AddRange(vendors);

        // Save first to get IDs for relationships
        await db.SaveChangesAsync(ct);

        // Now create project assignments linking employees to active projects
        var activeProjects = projects.Where(p => p.Status == ProjectStatus.Active).ToList();
        var allWorkableProjects = projects.Where(p =>
            p.Status is ProjectStatus.Active or ProjectStatus.Completed).ToList();
        var assignments = CreateProjectAssignments(employees, activeProjects);
        StampCompanyId(assignments, companyId);
        db.Set<ProjectAssignment>().AddRange(assignments);
        await db.SaveChangesAsync(ct);

        // Now create time entries for assigned employees (6 months)
        var timeEntries = CreateTimeEntries(employees, activeProjects, costCodes, assignments);
        StampCompanyId(timeEntries, companyId);
        db.Set<TimeEntry>().AddRange(timeEntries);
        await db.SaveChangesAsync(ct);

        // Create subcontracts with change orders and payment applications
        var subcontracts = CreateSubcontracts(projects);
        StampCompanyId(subcontracts, companyId);
        // Also stamp child ChangeOrders created inline
        foreach (var sub in subcontracts)
            StampCompanyId(sub.ChangeOrders, companyId);
        db.Set<Subcontract>().AddRange(subcontracts);
        await db.SaveChangesAsync(ct);

        // Create payment applications for executed subcontracts (AP side)
        var paymentApplications = CreatePaymentApplications(subcontracts);
        StampCompanyId(paymentApplications, companyId);
        foreach (var pa in paymentApplications)
            StampCompanyId(pa.LineItems, companyId);
        db.Set<PaymentApplication>().AddRange(paymentApplications);

        var vendorInvoices = CreateVendorInvoices(vendors, subcontracts);
        StampCompanyId(vendorInvoices, companyId);
        db.Set<VendorInvoice>().AddRange(vendorInvoices);
        await db.SaveChangesAsync(ct);

        // Owner contracts + billing applications (AR side — what owners owe us)
        var ownerContracts = CreateOwnerContracts(allWorkableProjects, customers);
        StampCompanyId(ownerContracts, companyId);
        db.Set<OwnerContract>().AddRange(ownerContracts);
        await db.SaveChangesAsync(ct);

        var ownerSovs = CreateOwnerScheduleOfValues(ownerContracts);
        StampCompanyId(ownerSovs, companyId);
        foreach (var sov in ownerSovs)
            StampCompanyId(sov.LineItems, companyId);
        db.Set<OwnerScheduleOfValues>().AddRange(ownerSovs);
        await db.SaveChangesAsync(ct);

        var billingApps = CreateBillingApplications(ownerContracts, ownerSovs);
        StampCompanyId(billingApps, companyId);
        foreach (var ba in billingApps)
            StampCompanyId(ba.LineItems, companyId);
        db.Set<BillingApplication>().AddRange(billingApps);
        await db.SaveChangesAsync(ct);

        // WIP reports for financial reporting
        var wipReports = CreateWipReports(allWorkableProjects);
        StampCompanyId(wipReports, companyId);
        foreach (var wr in wipReports)
            StampCompanyId(wr.Lines, companyId);
        db.Set<WipReport>().AddRange(wipReports);
        await db.SaveChangesAsync(ct);

        // Retention holds
        var retentionHolds = CreateRetentionHolds(allWorkableProjects, subcontracts);
        StampCompanyId(retentionHolds, companyId);
        db.Set<RetentionHold>().AddRange(retentionHolds);
        await db.SaveChangesAsync(ct);

        // Pay periods and payroll runs
        var payPeriods = CreatePayPeriods();
        StampCompanyId(payPeriods, companyId);
        db.Set<PayPeriod>().AddRange(payPeriods);
        await db.SaveChangesAsync(ct);

        var payrollRuns = CreatePayrollRuns(payPeriods, employees);
        StampCompanyId(payrollRuns, companyId);
        foreach (var pr in payrollRuns)
            StampCompanyId(pr.Lines, companyId);
        db.Set<PayrollRun>().AddRange(payrollRuns);
        await db.SaveChangesAsync(ct);

        // PM entities — submittals and punch list items
        var submittals = CreateSubmittals(allWorkableProjects);
        StampCompanyId(submittals, companyId);
        db.Set<PmSubmittal>().AddRange(submittals);

        // Look up an existing AppUser for punch list CreatedByUserId FK.
        // If no user exists yet, skip punch list seeding to avoid FK violation on Guid.Empty.
        var seedUserId = await db.Set<AppUser>()
            .IgnoreQueryFilters()
            .Where(u => u.Status == UserStatus.Active)
            .Select(u => u.Id)
            .FirstOrDefaultAsync(ct);

        var punchListItems = new List<PmPunchListItem>();
        if (seedUserId != Guid.Empty)
        {
            punchListItems = CreatePunchListItems(
                projects.Where(p => p.Status == ProjectStatus.Completed).ToList(),
                seedUserId);
            StampCompanyId(punchListItems, companyId);
            db.Set<PmPunchListItem>().AddRange(punchListItems);
        }
        await db.SaveChangesAsync(ct);

        // Schedules with activities and dependencies (PM tour)
        var (schedules, scheduleActivities, scheduleDeps) = CreateSchedules(activeProjects);
        StampCompanyId(schedules, companyId);
        StampCompanyId(scheduleActivities, companyId);
        StampCompanyId(scheduleDeps, companyId);
        db.Set<PmSchedule>().AddRange(schedules);
        db.Set<PmScheduleActivity>().AddRange(scheduleActivities);
        await db.SaveChangesAsync(ct);
        db.Set<PmScheduleDependency>().AddRange(scheduleDeps);
        await db.SaveChangesAsync(ct);

        // RFIs across active projects
        var rfis = CreateRfis(activeProjects, seedUserId);
        StampCompanyId(rfis, companyId);
        db.Set<Rfi>().AddRange(rfis);
        await db.SaveChangesAsync(ct);

        // Daily reports for field users
        var dailyReports = CreateDailyReports(activeProjects, seedUserId);
        StampCompanyId(dailyReports, companyId);
        db.Set<PmDailyReport>().AddRange(dailyReports);
        await db.SaveChangesAsync(ct);

        var dailyReportCrews = new List<PmDailyReportCrew>();
        var dailyReportEquipment = new List<PmDailyReportEquipment>();
        foreach (var dr in dailyReports)
        {
            dailyReportCrews.AddRange(CreateDailyReportCrews(dr));
            dailyReportEquipment.AddRange(CreateDailyReportEquipment(dr));
        }
        StampCompanyId(dailyReportCrews, companyId);
        StampCompanyId(dailyReportEquipment, companyId);
        db.Set<PmDailyReportCrew>().AddRange(dailyReportCrews);
        db.Set<PmDailyReportEquipment>().AddRange(dailyReportEquipment);
        await db.SaveChangesAsync(ct);

        // Chart of accounts + accounting periods + journal entries (CFO)
        var chartOfAccounts = CreateChartOfAccounts();
        StampCompanyId(chartOfAccounts, companyId);
        db.Set<ChartOfAccount>().AddRange(chartOfAccounts);
        await db.SaveChangesAsync(ct);

        var accountingPeriods = CreateAccountingPeriods();
        StampCompanyId(accountingPeriods, companyId);
        db.Set<AccountingPeriod>().AddRange(accountingPeriods);
        await db.SaveChangesAsync(ct);

        var journalEntries = CreateJournalEntries(chartOfAccounts, activeProjects, seedUserId);
        StampCompanyId(journalEntries, companyId);
        foreach (var je in journalEntries)
            StampCompanyId(je.Lines, companyId);
        db.Set<JournalEntry>().AddRange(journalEntries);
        await db.SaveChangesAsync(ct);

        // Lien waivers tied to subcontracts
        var lienWaivers = CreateLienWaivers(allWorkableProjects, subcontracts, vendors);
        StampCompanyId(lienWaivers, companyId);
        db.Set<LienWaiver>().AddRange(lienWaivers);
        await db.SaveChangesAsync(ct);

        // Purchase orders for purchasing manager
        var purchaseOrders = CreatePurchaseOrders(activeProjects, vendors);
        StampCompanyId(purchaseOrders, companyId);
        foreach (var po in purchaseOrders)
            StampCompanyId(po.Lines, companyId);
        db.Set<PurchaseOrder>().AddRange(purchaseOrders);
        await db.SaveChangesAsync(ct);

        // Notifications for various roles (not ICompanyScoped — no stamp needed)
        var notifications = new List<Notification>();
        if (seedUserId != Guid.Empty)
        {
            notifications = CreateNotifications(seedUserId, rfis, activeProjects);
            db.Set<Notification>().AddRange(notifications);
            await db.SaveChangesAsync(ct);
        }

        // ── V3/V4 Seed Data Expansion ─────────────────────────────────────

        // Equipment fleet (not ICompanyScoped — shared across companies)
        var equipment = CreateEquipment();
        db.Set<Equipment>().AddRange(equipment);
        await db.SaveChangesAsync(ct);

        // Bank accounts (need GL account IDs for FK)
        var bankAccounts = CreateBankAccounts(chartOfAccounts);
        StampCompanyId(bankAccounts, companyId);
        db.Set<BankAccount>().AddRange(bankAccounts);
        await db.SaveChangesAsync(ct);

        // Wage determinations with work classifications and rates
        var workClassifications = CreateWorkClassifications();
        StampCompanyId(workClassifications, companyId);
        db.Set<WorkClassification>().AddRange(workClassifications);
        await db.SaveChangesAsync(ct);

        var wageDeterminations = CreateWageDeterminations(activeProjects, workClassifications);
        StampCompanyId(wageDeterminations, companyId);
        foreach (var wd in wageDeterminations)
            StampCompanyId(wd.Rates, companyId);
        db.Set<WageDetermination>().AddRange(wageDeterminations);
        await db.SaveChangesAsync(ct);

        // Compliance documents (not ICompanyScoped — pass companyId for EntityId linkage)
        var complianceDocs = CreateComplianceDocuments(employees, subcontracts, companyId);
        db.Set<ComplianceDocument>().AddRange(complianceDocs);
        await db.SaveChangesAsync(ct);

        // Tax jurisdictions with rates
        var taxJurisdictions = CreateTaxJurisdictions();
        StampCompanyId(taxJurisdictions, companyId);
        foreach (var tj in taxJurisdictions)
            StampCompanyId(tj.Rates, companyId);
        db.Set<TaxJurisdiction>().AddRange(taxJurisdictions);
        await db.SaveChangesAsync(ct);

        // Project meetings with agenda items, minutes, and action items
        var (meetings, meetingAgendaItems, meetingMinutes, meetingActionItems) =
            CreateMeetings(activeProjects, seedUserId);
        StampCompanyId(meetings, companyId);
        StampCompanyId(meetingAgendaItems, companyId);
        StampCompanyId(meetingMinutes, companyId);
        StampCompanyId(meetingActionItems, companyId);
        db.Set<PmMeeting>().AddRange(meetings);
        await db.SaveChangesAsync(ct);
        db.Set<PmMeetingAgendaItem>().AddRange(meetingAgendaItems);
        db.Set<PmMeetingMinute>().AddRange(meetingMinutes);
        db.Set<PmMeetingActionItem>().AddRange(meetingActionItems);
        await db.SaveChangesAsync(ct);

        // Project tasks (guarded — FK requires valid AppUser)
        var tasks = new List<PmTask>();
        if (seedUserId != Guid.Empty)
        {
            tasks = CreateProjectTasks(activeProjects, seedUserId);
            StampCompanyId(tasks, companyId);
            db.Set<PmTask>().AddRange(tasks);
            await db.SaveChangesAsync(ct);
        }

        // ── End V3 ──────────────────────────────────────────────────────

        // ── Multi-company seed data (Companies 02, 03, 04) ───────────
        var company02Id = await db.Set<Company>()
            .IgnoreQueryFilters()
            .Where(c => c.Code == "02" && !c.IsDeleted)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);

        var company03Id = await db.Set<Company>()
            .IgnoreQueryFilters()
            .Where(c => c.Code == "03" && !c.IsDeleted)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);

        var company04Id = await db.Set<Company>()
            .IgnoreQueryFilters()
            .Where(c => c.Code == "04" && !c.IsDeleted)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);

        if (company02Id != Guid.Empty)
            await SeedCompanyAsync(company02Id, GetPwiProjects(), GetPwiVendors(),
                GetPwiCustomers(), GetPwiEmployees(), seedUserId, ct);

        if (company03Id != Guid.Empty)
            await SeedCompanyAsync(company03Id, GetVhdProjects(), GetVhdVendors(),
                GetVhdCustomers(), GetVhdEmployees(), seedUserId, ct);

        if (company04Id != Guid.Empty)
            await SeedCompanyAsync(company04Id, GetCveProjects(), GetCveVendors(),
                GetCveCustomers(), GetCveEmployees(), seedUserId, ct);

        // ── End multi-company ─────────────────────────────────────────

        // Stamp the seed data version so future startups can skip or refresh
        await StampSeedVersionAsync(ct);

        var totalPhases = projects.Sum(p => p.Phases.Count);
        var totalBidItems = bids.Sum(b => b.Items.Count);
        var totalChangeOrders = subcontracts.Sum(s => s.ChangeOrders.Count);
        var totalWipLines = wipReports.Sum(w => w.Lines.Count);
        var totalJeLines = journalEntries.Sum(j => j.Lines.Count);

        return Result.Success(new SeedDataResult(
            ProjectsCreated: projects.Count,
            BidsCreated: bids.Count,
            BidItemsCreated: totalBidItems,
            PhasesCreated: totalPhases,
            CostCodesCreated: costCodes.Count,
            EmployeesCreated: employees.Count,
            ProjectAssignmentsCreated: assignments.Count,
            TimeEntriesCreated: timeEntries.Count,
            SubcontractsCreated: subcontracts.Count,
            ChangeOrdersCreated: totalChangeOrders,
            PaymentApplicationsCreated: paymentApplications.Count,
            CustomersCreated: customers.Count,
            VendorsCreated: vendors.Count,
            VendorInvoicesCreated: vendorInvoices.Count,
            OwnerContractsCreated: ownerContracts.Count,
            BillingApplicationsCreated: billingApps.Count,
            WipReportsCreated: wipReports.Count,
            RetentionHoldsCreated: retentionHolds.Count,
            PayPeriodsCreated: payPeriods.Count,
            PayrollRunsCreated: payrollRuns.Count,
            SubmittalsCreated: submittals.Count,
            PunchListItemsCreated: punchListItems.Count,
            OwnerScheduleOfValuesCreated: ownerSovs.Count,
            SchedulesCreated: schedules.Count,
            ScheduleActivitiesCreated: scheduleActivities.Count,
            RfisCreated: rfis.Count,
            DailyReportsCreated: dailyReports.Count,
            ChartOfAccountsCreated: chartOfAccounts.Count,
            AccountingPeriodsCreated: accountingPeriods.Count,
            JournalEntriesCreated: journalEntries.Count,
            LienWaiversCreated: lienWaivers.Count,
            PurchaseOrdersCreated: purchaseOrders.Count,
            NotificationsCreated: notifications.Count,
            EquipmentCreated: equipment.Count,
            BankAccountsCreated: bankAccounts.Count,
            WageDeterminationsCreated: wageDeterminations.Count,
            ComplianceDocumentsCreated: complianceDocs.Count,
            TaxJurisdictionsCreated: taxJurisdictions.Count,
            MeetingsCreated: meetings.Count,
            TasksCreated: tasks.Count,
            Summary: $"Created {projects.Count} projects, {bids.Count} bids, " +
                     $"{totalBidItems} bid items, {totalPhases} phases, {costCodes.Count} cost codes, " +
                     $"{employees.Count} employees, {customers.Count} customers, {vendors.Count} vendors, " +
                     $"{assignments.Count} project assignments, {timeEntries.Count} time entries, " +
                     $"{subcontracts.Count} subcontracts, {totalChangeOrders} change orders, " +
                     $"{paymentApplications.Count} payment apps (AP), {billingApps.Count} billing apps (AR), " +
                     $"{ownerContracts.Count} owner contracts, {wipReports.Count} WIP reports ({totalWipLines} lines), " +
                     $"{retentionHolds.Count} retention holds, {payPeriods.Count} pay periods, " +
                     $"{payrollRuns.Count} payroll runs, {submittals.Count} submittals, " +
                     $"{punchListItems.Count} punch list items, {vendorInvoices.Count} vendor invoices, " +
                     $"{schedules.Count} schedules ({scheduleActivities.Count} activities), " +
                     $"{rfis.Count} RFIs, {dailyReports.Count} daily reports, " +
                     $"{chartOfAccounts.Count} GL accounts, {accountingPeriods.Count} accounting periods, " +
                     $"{journalEntries.Count} journal entries ({totalJeLines} lines), " +
                     $"{lienWaivers.Count} lien waivers, {purchaseOrders.Count} purchase orders, " +
                     $"{notifications.Count} notifications, " +
                     $"{equipment.Count} equipment, {bankAccounts.Count} bank accounts, " +
                     $"{wageDeterminations.Count} wage determinations, {complianceDocs.Count} compliance docs, " +
                     $"{taxJurisdictions.Count} tax jurisdictions, {meetings.Count} meetings, {tasks.Count} tasks"
        ));

    }

    /// <summary>
    /// Removes all seed-created domain data for the tenant so it can be re-seeded at a new version.
    /// Deletes in reverse FK order to avoid constraint violations.
    /// Does NOT touch AppUser, Company, or UserCompanyAccess — those are managed by DemoBootstrapper.
    /// </summary>
    private async Task ClearSeedDataAsync(Guid tenantId, CancellationToken ct)
    {
        // V3 entities
        await BulkDeleteAsync<PmTaskComment>(tenantId, ct);
        await BulkDeleteAsync<PmTask>(tenantId, ct);
        await BulkDeleteAsync<PmMeetingActionItem>(tenantId, ct);
        await BulkDeleteAsync<PmMeetingMinute>(tenantId, ct);
        await BulkDeleteAsync<PmMeetingAgendaItem>(tenantId, ct);
        await BulkDeleteAsync<PmMeeting>(tenantId, ct);
        await BulkDeleteAsync<TaxRate>(tenantId, ct);
        await BulkDeleteAsync<TaxJurisdiction>(tenantId, ct);
        await BulkDeleteAsync<ComplianceDocument>(tenantId, ct);
        await BulkDeleteAsync<WageDeterminationRate>(tenantId, ct);
        await BulkDeleteAsync<WageDetermination>(tenantId, ct);
        await BulkDeleteAsync<WorkClassification>(tenantId, ct);
        await BulkDeleteAsync<BankAccount>(tenantId, ct);
        await BulkDeleteAsync<Equipment>(tenantId, ct);

        // Leaf entities (no children reference them)
        await BulkDeleteAsync<Notification>(tenantId, ct);
        await BulkDeleteAsync<PmScheduleDependency>(tenantId, ct);
        await BulkDeleteAsync<PmDailyReportCrew>(tenantId, ct);
        await BulkDeleteAsync<PmDailyReportEquipment>(tenantId, ct);
        await BulkDeleteAsync<PmPunchListItem>(tenantId, ct);
        await BulkDeleteAsync<RetentionHold>(tenantId, ct);
        await BulkDeleteAsync<LienWaiver>(tenantId, ct);

        // Journal entries (lines → entries → accounts/periods)
        await BulkDeleteAsync<JournalEntryLine>(tenantId, ct);
        await BulkDeleteAsync<JournalEntry>(tenantId, ct);
        await BulkDeleteAsync<AccountingPeriod>(tenantId, ct);
        await BulkDeleteAsync<ChartOfAccount>(tenantId, ct);

        // Purchase orders (lines → POs)
        await BulkDeleteAsync<PurchaseOrderLine>(tenantId, ct);
        await BulkDeleteAsync<PurchaseOrder>(tenantId, ct);

        // PM entities
        await BulkDeleteAsync<PmScheduleActivity>(tenantId, ct);
        await BulkDeleteAsync<PmSchedule>(tenantId, ct);
        await BulkDeleteAsync<Rfi>(tenantId, ct);
        await BulkDeleteAsync<PmDailyReport>(tenantId, ct);
        await BulkDeleteAsync<PmSubmittal>(tenantId, ct);

        // Billing chain (lines → apps → SOV → contracts)
        await BulkDeleteAsync<BillingApplicationLineItem>(tenantId, ct);
        await BulkDeleteAsync<BillingApplication>(tenantId, ct);
        await BulkDeleteAsync<OwnerSOVLineItem>(tenantId, ct);
        await BulkDeleteAsync<OwnerScheduleOfValues>(tenantId, ct);
        await BulkDeleteAsync<OwnerContract>(tenantId, ct);

        // AP chain (WIP, payment apps, subcontracts)
        await BulkDeleteAsync<WipReportLine>(tenantId, ct);
        await BulkDeleteAsync<WipReport>(tenantId, ct);
        await BulkDeleteAsync<PaymentApplicationBookEntry>(tenantId, ct);
        await BulkDeleteAsync<PaymentApplicationLineItem>(tenantId, ct);
        await BulkDeleteAsync<PaymentApplication>(tenantId, ct);
        await BulkDeleteAsync<InvoiceMatchResult>(tenantId, ct);
        await BulkDeleteAsync<VendorInvoice>(tenantId, ct);
        await BulkDeleteAsync<ChangeOrder>(tenantId, ct);
        await BulkDeleteAsync<Subcontract>(tenantId, ct);

        // Payroll
        await BulkDeleteAsync<PayrollRun>(tenantId, ct);
        await BulkDeleteAsync<PayPeriod>(tenantId, ct);

        // Time & assignments
        await BulkDeleteAsync<TimeEntry>(tenantId, ct);
        await BulkDeleteAsync<ProjectAssignment>(tenantId, ct);

        // Root entities
        await BulkDeleteAsync<BidItem>(tenantId, ct);
        await BulkDeleteAsync<Bid>(tenantId, ct);
        await BulkDeleteAsync<Phase>(tenantId, ct);
        await BulkDeleteAsync<Projection>(tenantId, ct);
        await BulkDeleteAsync<Employee>(tenantId, ct);
        await BulkDeleteAsync<Customer>(tenantId, ct);
        await BulkDeleteAsync<Vendor>(tenantId, ct);
        await BulkDeleteAsync<CostCode>(tenantId, ct);
        await BulkDeleteAsync<Project>(tenantId, ct);
    }

    /// <summary>
    /// Bulk-deletes all non-soft-deleted records for a tenant from a given entity type.
    /// Uses EF Core 7+ ExecuteDeleteAsync for efficient server-side deletion.
    /// Silently skips if the table doesn't exist (missing migration in production).
    /// </summary>
    #pragma warning disable EF1002 // Savepoint names are compile-time type names, not user input
    private async Task BulkDeleteAsync<T>(Guid tenantId, CancellationToken ct) where T : BaseEntity
    {
        // Use SAVEPOINT to isolate each delete within the parent transaction.
        // If a delete fails (missing table, FK conflict, etc.), we ROLLBACK TO SAVEPOINT
        // so the transaction stays valid for subsequent operations.
        var spName = $"sp_{typeof(T).Name}";
        try
        {
            await db.Database.ExecuteSqlRawAsync($"SAVEPOINT {spName}", ct);
            await db.Set<T>()
                .IgnoreQueryFilters()
                .Where(x => x.TenantId == tenantId)
                .ExecuteDeleteAsync(ct);
            await db.Database.ExecuteSqlRawAsync($"RELEASE SAVEPOINT {spName}", ct);
        }
        catch (Exception)
        {
            // Rollback to savepoint so the parent transaction stays valid
            try { await db.Database.ExecuteSqlRawAsync($"ROLLBACK TO SAVEPOINT {spName}", ct); }
            catch { /* best effort */ }
            db.ChangeTracker.Clear();
        }
    }
    #pragma warning restore EF1002

    /// <summary>
    /// Sets CompanyId on every ICompanyScoped entity in the list.
    /// Safe to call on non-ICompanyScoped types — they are silently skipped.
    /// </summary>
    private static void StampCompanyId<T>(IEnumerable<T> entities, Guid companyId) where T : class
    {
        if (companyId == Guid.Empty) return;
        foreach (var entity in entities)
        {
            if (entity is ICompanyScoped scoped && scoped.CompanyId == Guid.Empty)
                scoped.CompanyId = companyId;
        }
    }

    /// <summary>
    /// Upserts the seed data version into TenantSettings for the current tenant.
    /// </summary>
    private async Task StampSeedVersionAsync(CancellationToken ct)
    {
        // Find tenant ID from the projects we just created
        var tenantId = await db.Set<Project>()
            .Where(p => p.Number.StartsWith("DEMO-PRJ"))
            .Select(p => p.TenantId)
            .FirstOrDefaultAsync(ct);

        if (tenantId == Guid.Empty) return;

        var settings = await db.Set<TenantSettings>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);

        if (settings is not null)
        {
            settings.SeedDataVersion = SeedDataVersion;
        }
        else
        {
            db.Set<TenantSettings>().Add(new TenantSettings
            {
                TenantId = tenantId,
                CompanyName = "Summit Builders Group",
                SeedDataVersion = SeedDataVersion
            });
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Creates standard construction labor cost codes.
    /// These are used for time tracking entries.
    /// Includes default cost codes for crew timecard auto-assignment
    /// (LAB, EQP, MAT, SUB-*, OVH) plus detailed CSI division codes.
    /// </summary>
    private static List<CostCode> CreateCostCodes()
    {
        return
        [
            // === Default Cost Codes (used by crew timecard auto-assignment) ===
            new CostCode { Code = "LAB", Description = "Labor", CostType = CostType.Labor, IsActive = true, IsCompanyStandard = true },
            new CostCode { Code = "EQP", Description = "Equipment", CostType = CostType.Equipment, IsActive = true, IsCompanyStandard = true },
            new CostCode { Code = "MAT", Description = "Material", CostType = CostType.Material, IsActive = true, IsCompanyStandard = true },
            new CostCode { Code = "SUB-LAB", Description = "Subcontract Labor", CostType = CostType.Subcontract, IsActive = true, IsCompanyStandard = true },
            new CostCode { Code = "SUB-MAT", Description = "Subcontract Material", CostType = CostType.Subcontract, IsActive = true, IsCompanyStandard = true },
            new CostCode { Code = "SUB-EQP", Description = "Subcontract Equipment", CostType = CostType.Subcontract, IsActive = true, IsCompanyStandard = true },
            new CostCode { Code = "OVH", Description = "Overhead", CostType = CostType.Overhead, IsActive = true, IsCompanyStandard = true },

            // === Detailed CSI Division Cost Codes ===

            // General Conditions / Supervision
            new CostCode { Code = "01-100", Description = "Project Management", Division = "01", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "01-200", Description = "Supervision - General Foreman", Division = "01", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "01-300", Description = "Supervision - Trade Foreman", Division = "01", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "01-400", Description = "Safety & First Aid", Division = "01", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "01-500", Description = "Quality Control", Division = "01", CostType = CostType.Labor, IsCompanyStandard = true },

            // Site Work
            new CostCode { Code = "02-100", Description = "Excavation & Grading", Division = "02", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "02-200", Description = "Trenching & Utilities", Division = "02", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "02-300", Description = "Backfill & Compaction", Division = "02", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "02-400", Description = "Demolition", Division = "02", CostType = CostType.Labor, IsCompanyStandard = true },

            // Concrete
            new CostCode { Code = "03-100", Description = "Concrete Formwork", Division = "03", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "03-200", Description = "Rebar & Reinforcement", Division = "03", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "03-300", Description = "Concrete Placement", Division = "03", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "03-400", Description = "Concrete Finishing", Division = "03", CostType = CostType.Labor, IsCompanyStandard = true },

            // Masonry
            new CostCode { Code = "04-100", Description = "Block & Brick Masonry", Division = "04", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "04-200", Description = "Stone & Veneer", Division = "04", CostType = CostType.Labor, IsCompanyStandard = true },

            // Metals / Structural Steel
            new CostCode { Code = "05-100", Description = "Structural Steel Erection", Division = "05", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "05-200", Description = "Miscellaneous Metals", Division = "05", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "05-300", Description = "Metal Deck Installation", Division = "05", CostType = CostType.Labor, IsCompanyStandard = true },

            // Carpentry
            new CostCode { Code = "06-100", Description = "Rough Carpentry", Division = "06", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "06-200", Description = "Finish Carpentry", Division = "06", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "06-300", Description = "Framing", Division = "06", CostType = CostType.Labor, IsCompanyStandard = true },

            // Thermal & Moisture
            new CostCode { Code = "07-100", Description = "Waterproofing", Division = "07", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "07-200", Description = "Insulation", Division = "07", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "07-300", Description = "Roofing", Division = "07", CostType = CostType.Labor, IsCompanyStandard = true },

            // Doors & Windows
            new CostCode { Code = "08-100", Description = "Door Installation", Division = "08", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "08-200", Description = "Window Installation", Division = "08", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "08-300", Description = "Hardware Installation", Division = "08", CostType = CostType.Labor, IsCompanyStandard = true },

            // Finishes
            new CostCode { Code = "09-100", Description = "Drywall & Framing", Division = "09", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "09-200", Description = "Painting", Division = "09", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "09-300", Description = "Flooring", Division = "09", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "09-400", Description = "Tile Work", Division = "09", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "09-500", Description = "Ceiling Systems", Division = "09", CostType = CostType.Labor, IsCompanyStandard = true },

            // MEP (Mechanical, Electrical, Plumbing)
            new CostCode { Code = "15-100", Description = "Plumbing Rough-In", Division = "15", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "15-200", Description = "Plumbing Trim", Division = "15", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "15-300", Description = "HVAC Rough-In", Division = "15", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "15-400", Description = "HVAC Trim & Startup", Division = "15", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "16-100", Description = "Electrical Rough-In", Division = "16", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "16-200", Description = "Electrical Trim", Division = "16", CostType = CostType.Labor, IsCompanyStandard = true },
            new CostCode { Code = "16-300", Description = "Low Voltage & Data", Division = "16", CostType = CostType.Labor, IsCompanyStandard = true },

            // Equipment Cost Codes
            new CostCode { Code = "EQ-100", Description = "Crane Operation", Division = "EQ", CostType = CostType.Equipment, IsCompanyStandard = true },
            new CostCode { Code = "EQ-200", Description = "Excavator / Loader", Division = "EQ", CostType = CostType.Equipment, IsCompanyStandard = true },
            new CostCode { Code = "EQ-300", Description = "Aerial Lift / Scaffolding", Division = "EQ", CostType = CostType.Equipment, IsCompanyStandard = true },
            new CostCode { Code = "EQ-400", Description = "Concrete Equipment", Division = "EQ", CostType = CostType.Equipment, IsCompanyStandard = true },

            // Material Cost Codes
            new CostCode { Code = "MAT-100", Description = "Lumber & Sheathing", Division = "MAT", CostType = CostType.Material, IsCompanyStandard = true },
            new CostCode { Code = "MAT-200", Description = "Concrete Materials", Division = "MAT", CostType = CostType.Material, IsCompanyStandard = true },
            new CostCode { Code = "MAT-300", Description = "Steel & Metals", Division = "MAT", CostType = CostType.Material, IsCompanyStandard = true },
            new CostCode { Code = "MAT-400", Description = "MEP Materials", Division = "MAT", CostType = CostType.Material, IsCompanyStandard = true },
            new CostCode { Code = "MAT-500", Description = "Finish Materials", Division = "MAT", CostType = CostType.Material, IsCompanyStandard = true },

            // Subcontract Cost Codes
            new CostCode { Code = "SUB-100", Description = "Electrical Subcontract", Division = "SUB", CostType = CostType.Subcontract, IsCompanyStandard = true },
            new CostCode { Code = "SUB-200", Description = "Mechanical Subcontract", Division = "SUB", CostType = CostType.Subcontract, IsCompanyStandard = true },
            new CostCode { Code = "SUB-300", Description = "Plumbing Subcontract", Division = "SUB", CostType = CostType.Subcontract, IsCompanyStandard = true },
            new CostCode { Code = "SUB-400", Description = "Fire Protection Subcontract", Division = "SUB", CostType = CostType.Subcontract, IsCompanyStandard = true },
        ];
    }

    private static List<Project> CreateProjects()
    {
        var now = DateTime.UtcNow;

        var project1 = new Project
        {
            Name = "Riverside Medical Office Building",
            Number = "DEMO-PRJ-2026-001",
            Description = "3-story medical office building with underground parking. " +
                          "Includes tenant improvements for cardiology and orthopedic suites.",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            Address = "4500 River Park Drive",
            City = "Sacramento",
            State = "CA",
            ZipCode = "95833",
            ClientName = "Riverside Health Partners LLC",
            ClientContact = "Demo Contact 20",
            ClientEmail = "contact20@example.com",
            ClientPhone = "(555) 000-0142",
            StartDate = now.AddMonths(-3),
            EstimatedCompletionDate = now.AddMonths(14),
            ContractAmount = 12_500_000m,
            OriginalBudget = 11_800_000m,
            Phases =
            [
                new Phase
                {
                    Name = "Site Work & Excavation",
                    CostCode = "02-100",
                    Description = "Grading, excavation, underground utilities",
                    SortOrder = 1,
                    BudgetAmount = 1_200_000m,
                    ActualCost = 1_150_000m,
                    StartDate = now.AddMonths(-3),
                    EndDate = now.AddMonths(-1),
                    PercentComplete = 100m,
                    Status = PhaseStatus.Completed
                },
                new Phase
                {
                    Name = "Foundation & Structure",
                    CostCode = "03-100",
                    Description = "Concrete foundation, structural steel, framing",
                    SortOrder = 2,
                    BudgetAmount = 3_400_000m,
                    ActualCost = 1_800_000m,
                    StartDate = now.AddMonths(-1),
                    EndDate = now.AddMonths(3),
                    PercentComplete = 55m,
                    Status = PhaseStatus.InProgress
                },
                new Phase
                {
                    Name = "MEP Rough-In",
                    CostCode = "15-100",
                    Description = "Mechanical, electrical, plumbing rough-in",
                    SortOrder = 3,
                    BudgetAmount = 2_800_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(2),
                    EndDate = now.AddMonths(7),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "Interior Finish & Tenant Improvements",
                    CostCode = "09-100",
                    Description = "Drywall, flooring, paint, medical suite buildouts",
                    SortOrder = 4,
                    BudgetAmount = 3_200_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(6),
                    EndDate = now.AddMonths(12),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "Punchlist & Closeout",
                    CostCode = "01-700",
                    Description = "Final inspections, punchlist, commissioning",
                    SortOrder = 5,
                    BudgetAmount = 400_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(12),
                    EndDate = now.AddMonths(14),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                }
            ]
        };

        var project2 = new Project
        {
            Name = "Oakwood Estates - Phase II",
            Number = "DEMO-PRJ-2026-002",
            Description = "48-unit luxury townhome community. Phase II covers units 25-48 " +
                          "with clubhouse and pool amenities.",
            Status = ProjectStatus.PreConstruction,
            Type = ProjectType.Residential,
            Address = "2200 Oakwood Boulevard",
            City = "Folsom",
            State = "CA",
            ZipCode = "95630",
            ClientName = "Summit Development Group",
            ClientContact = "Demo Contact 21",
            ClientEmail = "contact21@example.com",
            ClientPhone = "(555) 000-0287",
            StartDate = now.AddMonths(1),
            EstimatedCompletionDate = now.AddMonths(18),
            ContractAmount = 22_750_000m,
            OriginalBudget = 21_500_000m,
            Phases =
            [
                new Phase
                {
                    Name = "Mass Grading & Infrastructure",
                    CostCode = "02-200",
                    Description = "Site grading, streets, utilities, storm drainage",
                    SortOrder = 1,
                    BudgetAmount = 3_800_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(1),
                    EndDate = now.AddMonths(4),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "Foundations & Flatwork",
                    CostCode = "03-200",
                    Description = "Slab-on-grade foundations for 24 townhome units",
                    SortOrder = 2,
                    BudgetAmount = 4_200_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(3),
                    EndDate = now.AddMonths(7),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "Framing & Roofing",
                    CostCode = "06-100",
                    Description = "Wood framing, trusses, roofing for all units",
                    SortOrder = 3,
                    BudgetAmount = 5_500_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(5),
                    EndDate = now.AddMonths(11),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "Amenities - Clubhouse & Pool",
                    CostCode = "13-100",
                    Description = "Community clubhouse, pool, landscaping",
                    SortOrder = 4,
                    BudgetAmount = 2_800_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(10),
                    EndDate = now.AddMonths(16),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                }
            ]
        };

        var project3 = new Project
        {
            Name = "Summit Distribution Center",
            Number = "DEMO-PRJ-2026-003",
            Description = "450,000 SF tilt-up warehouse and distribution facility " +
                          "with 36 loading docks and 5,000 SF office build-out.",
            Status = ProjectStatus.Active,
            Type = ProjectType.Industrial,
            Address = "8900 Industrial Parkway",
            City = "Stockton",
            State = "CA",
            ZipCode = "95206",
            ClientName = "Summit Logistics Inc.",
            ClientContact = "Demo Contact 22",
            ClientEmail = "contact22@example.com",
            ClientPhone = "(555) 000-0391",
            StartDate = now.AddMonths(-5),
            EstimatedCompletionDate = now.AddMonths(7),
            ContractAmount = 48_200_000m,
            OriginalBudget = 45_000_000m,
            Phases =
            [
                new Phase
                {
                    Name = "Site Prep & Foundations",
                    CostCode = "02-300",
                    Description = "Mass grading, foundations, underground utilities",
                    SortOrder = 1,
                    BudgetAmount = 8_500_000m,
                    ActualCost = 8_200_000m,
                    StartDate = now.AddMonths(-5),
                    EndDate = now.AddMonths(-2),
                    PercentComplete = 100m,
                    Status = PhaseStatus.Completed
                },
                new Phase
                {
                    Name = "Tilt-Up Panels & Steel",
                    CostCode = "03-400",
                    Description = "Concrete tilt-up wall panels, structural steel, roof deck",
                    SortOrder = 2,
                    BudgetAmount = 18_000_000m,
                    ActualCost = 12_500_000m,
                    StartDate = now.AddMonths(-2),
                    EndDate = now.AddMonths(2),
                    PercentComplete = 70m,
                    Status = PhaseStatus.InProgress
                },
                new Phase
                {
                    Name = "MEP & Fire Protection",
                    CostCode = "15-200",
                    Description = "HVAC, electrical distribution, fire sprinkler, plumbing",
                    SortOrder = 3,
                    BudgetAmount = 9_500_000m,
                    ActualCost = 2_100_000m,
                    StartDate = now.AddMonths(-1),
                    EndDate = now.AddMonths(4),
                    PercentComplete = 25m,
                    Status = PhaseStatus.InProgress
                },
                new Phase
                {
                    Name = "Office Build-Out & Dock Equipment",
                    CostCode = "09-200",
                    Description = "Office interiors, loading dock levelers, overhead doors",
                    SortOrder = 4,
                    BudgetAmount = 4_500_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(2),
                    EndDate = now.AddMonths(5),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "Site Paving & Landscaping",
                    CostCode = "02-500",
                    Description = "Truck court paving, parking, landscaping, site lighting",
                    SortOrder = 5,
                    BudgetAmount = 3_500_000m,
                    ActualCost = 0m,
                    StartDate = now.AddMonths(4),
                    EndDate = now.AddMonths(7),
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                }
            ]
        };

        var project4 = new Project
        {
            Name = "Highway 50 Bridge Rehabilitation",
            Number = "DEMO-PRJ-2025-004",
            Description = "Seismic retrofit and deck replacement for the Highway 50 " +
                          "overcrossing at Sunrise Boulevard. Caltrans project.",
            Status = ProjectStatus.Completed,
            Type = ProjectType.Infrastructure,
            Address = "Highway 50 at Sunrise Blvd",
            City = "Rancho Cordova",
            State = "CA",
            ZipCode = "95670",
            ClientName = "California Department of Transportation",
            ClientContact = "Demo Contact 23",
            ClientEmail = "contact23@example.com",
            ClientPhone = "(555) 000-0518",
            StartDate = now.AddMonths(-14),
            EstimatedCompletionDate = now.AddMonths(-1),
            ActualCompletionDate = now.AddMonths(-1),
            ContractAmount = 8_900_000m,
            OriginalBudget = 8_400_000m,
            Phases =
            [
                new Phase
                {
                    Name = "Traffic Control & Demo",
                    CostCode = "01-500",
                    Description = "Traffic management plan, partial demo, shoring",
                    SortOrder = 1,
                    BudgetAmount = 1_200_000m,
                    ActualCost = 1_280_000m,
                    StartDate = now.AddMonths(-14),
                    EndDate = now.AddMonths(-11),
                    PercentComplete = 100m,
                    Status = PhaseStatus.Completed
                },
                new Phase
                {
                    Name = "Seismic Retrofit",
                    CostCode = "03-500",
                    Description = "Column jacketing, abutment strengthening, new bearings",
                    SortOrder = 2,
                    BudgetAmount = 3_800_000m,
                    ActualCost = 3_650_000m,
                    StartDate = now.AddMonths(-11),
                    EndDate = now.AddMonths(-5),
                    PercentComplete = 100m,
                    Status = PhaseStatus.Completed
                },
                new Phase
                {
                    Name = "Deck Replacement",
                    CostCode = "03-600",
                    Description = "Remove existing deck, new reinforced concrete deck pour",
                    SortOrder = 3,
                    BudgetAmount = 2_400_000m,
                    ActualCost = 2_550_000m,
                    StartDate = now.AddMonths(-5),
                    EndDate = now.AddMonths(-2),
                    PercentComplete = 100m,
                    Status = PhaseStatus.Completed
                },
                new Phase
                {
                    Name = "Striping & Closeout",
                    CostCode = "01-800",
                    Description = "Pavement markings, barrier rail, final inspections",
                    SortOrder = 4,
                    BudgetAmount = 600_000m,
                    ActualCost = 580_000m,
                    StartDate = now.AddMonths(-2),
                    EndDate = now.AddMonths(-1),
                    PercentComplete = 100m,
                    Status = PhaseStatus.Completed
                }
            ]
        };

        var project5 = new Project
        {
            Name = "Lincoln High School Gymnasium Renovation",
            Number = "DEMO-PRJ-2026-005",
            Description = "Full renovation of existing gymnasium including new HVAC, " +
                          "bleachers, basketball court, locker rooms, and ADA upgrades.",
            Status = ProjectStatus.OnHold,
            Type = ProjectType.Renovation,
            Address = "6844 Alexandria Place",
            City = "Stockton",
            State = "CA",
            ZipCode = "95207",
            ClientName = "Lincoln Unified School District",
            ClientContact = "Demo Contact 24",
            ClientEmail = "smorales@example.edu",
            ClientPhone = "(555) 000-0674",
            StartDate = now.AddMonths(2),
            EstimatedCompletionDate = now.AddMonths(9),
            ContractAmount = 3_200_000m,
            OriginalBudget = 2_950_000m,
            Phases =
            [
                new Phase
                {
                    Name = "Selective Demolition",
                    CostCode = "02-400",
                    Description = "Remove existing bleachers, flooring, MEP systems",
                    SortOrder = 1,
                    BudgetAmount = 350_000m,
                    ActualCost = 0m,
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "Structural & ADA Upgrades",
                    CostCode = "03-700",
                    Description = "Structural reinforcement, ADA ramps, accessible restrooms",
                    SortOrder = 2,
                    BudgetAmount = 800_000m,
                    ActualCost = 0m,
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                },
                new Phase
                {
                    Name = "MEP Replacement",
                    CostCode = "15-300",
                    Description = "New HVAC, lighting, electrical, plumbing",
                    SortOrder = 3,
                    BudgetAmount = 1_100_000m,
                    ActualCost = 0m,
                    PercentComplete = 0m,
                    Status = PhaseStatus.NotStarted
                }
            ]
        };

        return [project1, project2, project3, project4, project5];
    }

    private static List<Bid> CreateBids()
    {
        var now = DateTime.UtcNow;

        return
        [
            // Won bid (already converted to project)
            new Bid
            {
                Name = "Riverside Medical Office Building",
                Number = "DEMO-BID-2025-001",
                Status = BidStatus.Won,
                EstimatedValue = 12_500_000m,
                BidDate = now.AddMonths(-6),
                DueDate = now.AddMonths(-5),
                Owner = "Mike Reynolds",
                Description = "3-story MOB with underground parking. Full GC scope.",
                Items = CreateMedicalOfficeBidItems()
            },

            // Won bid (residential)
            new Bid
            {
                Name = "Oakwood Estates Phase II",
                Number = "DEMO-BID-2025-002",
                Status = BidStatus.Won,
                EstimatedValue = 22_750_000m,
                BidDate = now.AddMonths(-4),
                DueDate = now.AddMonths(-3),
                Owner = "Lisa Tran",
                Description = "48-unit luxury townhome community. Phase II.",
                Items = CreateResidentialBidItems()
            },

            // Active bid in draft
            new Bid
            {
                Name = "Downtown Sacramento Parking Structure",
                Number = "DEMO-BID-2026-003",
                Status = BidStatus.Draft,
                EstimatedValue = 18_000_000m,
                DueDate = now.AddDays(21),
                Owner = "Mike Reynolds",
                Description = "6-level precast parking structure, 800 stalls. " +
                              "City of Sacramento RFP.",
                Items = CreateParkingStructureBidItems()
            },

            // Submitted bid awaiting response
            new Bid
            {
                Name = "Elk Grove Water Treatment Plant Expansion",
                Number = "DEMO-BID-2026-004",
                Status = BidStatus.Submitted,
                EstimatedValue = 35_500_000m,
                BidDate = now.AddDays(-10),
                DueDate = now.AddDays(-7),
                Owner = "Carlos Gutierrez",
                Description = "Expansion of existing WTP from 10 MGD to 20 MGD. " +
                              "Includes new clarifiers, filters, and chemical feed.",
                Items = CreateWaterTreatmentBidItems()
            },

            // Lost bid
            new Bid
            {
                Name = "Natomas Corporate Campus - Building A",
                Number = "DEMO-BID-2025-005",
                Status = BidStatus.Lost,
                EstimatedValue = 28_000_000m,
                BidDate = now.AddMonths(-3),
                DueDate = now.AddMonths(-3),
                Owner = "Lisa Tran",
                Description = "4-story Class A office building, 120,000 SF. " +
                              "Lost to competitor by $1.2M.",
                Items = CreateOfficeBidItems()
            },

            // Another draft
            new Bid
            {
                Name = "Roseville Fire Station #9",
                Number = "DEMO-BID-2026-006",
                Status = BidStatus.Draft,
                EstimatedValue = 6_800_000m,
                DueDate = now.AddDays(45),
                Owner = "Carlos Gutierrez",
                Description = "New 3-bay fire station with living quarters, " +
                              "training tower, and apparatus storage.",
                Items = CreateFireStationBidItems()
            },

            // Submitted
            new Bid
            {
                Name = "Delta College Science Building Renovation",
                Number = "DEMO-BID-2026-007",
                Status = BidStatus.Submitted,
                EstimatedValue = 14_200_000m,
                BidDate = now.AddDays(-3),
                DueDate = now.AddDays(-2),
                Owner = "Mike Reynolds",
                Description = "Complete renovation of 1970s science building. " +
                              "New labs, fume hoods, ADA compliance.",
                Items = CreateScienceBuildingBidItems()
            },

            // NoBid
            new Bid
            {
                Name = "Lodi Unified Elementary School",
                Number = "DEMO-BID-2026-008",
                Status = BidStatus.NoBid,
                EstimatedValue = 9_500_000m,
                DueDate = now.AddDays(-14),
                Owner = "Lisa Tran",
                Description = "New K-6 elementary school. No-bid due to schedule conflict " +
                              "with Oakwood project.",
            },

            // Active draft - industrial
            new Bid
            {
                Name = "Amazon Last-Mile Facility - Manteca",
                Number = "DEMO-BID-2026-009",
                Status = BidStatus.Draft,
                EstimatedValue = 42_000_000m,
                DueDate = now.AddDays(30),
                Owner = "Carlos Gutierrez",
                Description = "200,000 SF last-mile delivery station with " +
                              "van fleet parking and charging stations.",
                Items = CreateLastMileBidItems()
            },

            // Won bid for the completed bridge project
            new Bid
            {
                Name = "Highway 50 Bridge Rehabilitation",
                Number = "DEMO-BID-2024-010",
                Status = BidStatus.Won,
                EstimatedValue = 8_900_000m,
                BidDate = now.AddMonths(-18),
                DueDate = now.AddMonths(-17),
                Owner = "Mike Reynolds",
                Description = "Seismic retrofit and deck replacement. Caltrans project.",
                Items = CreateBridgeBidItems()
            }
        ];
    }

    private static List<BidItem> CreateMedicalOfficeBidItems() =>
    [
        new() { Description = "General Conditions & Supervision", Category = BidItemCategory.Labor, Quantity = 1, UnitCost = 875_000m, TotalCost = 875_000m },
        new() { Description = "Excavation & Grading", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 680_000m, TotalCost = 680_000m },
        new() { Description = "Concrete Foundations & Slabs", Category = BidItemCategory.Material, Quantity = 4200, UnitCost = 185m, TotalCost = 777_000m },
        new() { Description = "Structural Steel Package", Category = BidItemCategory.Material, Quantity = 380, UnitCost = 3_200m, TotalCost = 1_216_000m },
        new() { Description = "Mechanical (HVAC)", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 2_100_000m, TotalCost = 2_100_000m },
        new() { Description = "Electrical & Low Voltage", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_850_000m, TotalCost = 1_850_000m },
        new() { Description = "Plumbing & Medical Gas", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_200_000m, TotalCost = 1_200_000m },
        new() { Description = "Interior Finishes (drywall, paint, flooring)", Category = BidItemCategory.Material, Quantity = 45000, UnitCost = 28m, TotalCost = 1_260_000m },
        new() { Description = "Elevator Installation (2 hydraulic)", Category = BidItemCategory.Subcontractor, Quantity = 2, UnitCost = 185_000m, TotalCost = 370_000m },
        new() { Description = "Underground Parking Structure", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 1_400_000m, TotalCost = 1_400_000m },
        new() { Description = "Contingency & Escalation", Category = BidItemCategory.Other, Quantity = 1, UnitCost = 772_000m, TotalCost = 772_000m },
    ];

    private static List<BidItem> CreateResidentialBidItems() =>
    [
        new() { Description = "Mass Grading & Earthwork", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_800_000m, TotalCost = 1_800_000m },
        new() { Description = "Wet Utilities (sewer, water, storm)", Category = BidItemCategory.Subcontractor, Quantity = 4800, UnitCost = 225m, TotalCost = 1_080_000m },
        new() { Description = "Dry Utilities (electric, gas, telecom)", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 920_000m, TotalCost = 920_000m },
        new() { Description = "Concrete Foundations (24 units)", Category = BidItemCategory.Material, Quantity = 24, UnitCost = 65_000m, TotalCost = 1_560_000m },
        new() { Description = "Wood Framing & Trusses", Category = BidItemCategory.Material, Quantity = 24, UnitCost = 95_000m, TotalCost = 2_280_000m },
        new() { Description = "Roofing (tile)", Category = BidItemCategory.Subcontractor, Quantity = 24, UnitCost = 42_000m, TotalCost = 1_008_000m },
        new() { Description = "MEP Per Unit", Category = BidItemCategory.Subcontractor, Quantity = 24, UnitCost = 78_000m, TotalCost = 1_872_000m },
        new() { Description = "Interior Finishes Per Unit", Category = BidItemCategory.Material, Quantity = 24, UnitCost = 110_000m, TotalCost = 2_640_000m },
        new() { Description = "Clubhouse & Pool Complex", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 2_800_000m, TotalCost = 2_800_000m },
        new() { Description = "Landscaping & Hardscape", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_450_000m, TotalCost = 1_450_000m },
        new() { Description = "General Conditions (18 months)", Category = BidItemCategory.Labor, Quantity = 18, UnitCost = 85_000m, TotalCost = 1_530_000m },
        new() { Description = "Builder's Risk & Insurance", Category = BidItemCategory.Other, Quantity = 1, UnitCost = 680_000m, TotalCost = 680_000m },
    ];

    private static List<BidItem> CreateParkingStructureBidItems() =>
    [
        new() { Description = "Precast Concrete Panels & Erection", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 8_500_000m, TotalCost = 8_500_000m },
        new() { Description = "Foundation & Pile Driving", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 2_400_000m, TotalCost = 2_400_000m },
        new() { Description = "Post-Tension Deck Slabs", Category = BidItemCategory.Material, Quantity = 320000, UnitCost = 12m, TotalCost = 3_840_000m },
        new() { Description = "Electrical & Lighting", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_200_000m, TotalCost = 1_200_000m },
        new() { Description = "Elevator Installation (2)", Category = BidItemCategory.Equipment, Quantity = 2, UnitCost = 210_000m, TotalCost = 420_000m },
        new() { Description = "Stair Towers (precast)", Category = BidItemCategory.Material, Quantity = 4, UnitCost = 180_000m, TotalCost = 720_000m },
        new() { Description = "General Conditions", Category = BidItemCategory.Labor, Quantity = 1, UnitCost = 920_000m, TotalCost = 920_000m },
    ];

    private static List<BidItem> CreateWaterTreatmentBidItems() =>
    [
        new() { Description = "Earthwork & Dewatering", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 3_200_000m, TotalCost = 3_200_000m },
        new() { Description = "Concrete (clarifiers, basins, channels)", Category = BidItemCategory.Material, Quantity = 12000, UnitCost = 450m, TotalCost = 5_400_000m },
        new() { Description = "Process Piping (SS & HDPE)", Category = BidItemCategory.Material, Quantity = 8500, UnitCost = 285m, TotalCost = 2_422_500m },
        new() { Description = "Process Equipment (clarifiers, filters)", Category = BidItemCategory.Equipment, Quantity = 1, UnitCost = 8_500_000m, TotalCost = 8_500_000m },
        new() { Description = "Chemical Feed Systems", Category = BidItemCategory.Equipment, Quantity = 6, UnitCost = 420_000m, TotalCost = 2_520_000m },
        new() { Description = "Electrical & Instrumentation", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 5_200_000m, TotalCost = 5_200_000m },
        new() { Description = "HVAC & Ventilation", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_800_000m, TotalCost = 1_800_000m },
        new() { Description = "Structural Steel & Misc Metals", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 2_600_000m, TotalCost = 2_600_000m },
        new() { Description = "Startup & Commissioning", Category = BidItemCategory.Labor, Quantity = 1, UnitCost = 1_200_000m, TotalCost = 1_200_000m },
        new() { Description = "General Conditions (24 months)", Category = BidItemCategory.Labor, Quantity = 24, UnitCost = 110_000m, TotalCost = 2_640_000m },
    ];

    private static List<BidItem> CreateOfficeBidItems() =>
    [
        new() { Description = "Site Work & Utilities", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 2_800_000m, TotalCost = 2_800_000m },
        new() { Description = "Concrete & Foundations", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 3_400_000m, TotalCost = 3_400_000m },
        new() { Description = "Structural Steel", Category = BidItemCategory.Material, Quantity = 650, UnitCost = 3_400m, TotalCost = 2_210_000m },
        new() { Description = "Curtain Wall & Glazing", Category = BidItemCategory.Subcontractor, Quantity = 48000, UnitCost = 85m, TotalCost = 4_080_000m },
        new() { Description = "MEP Systems", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 6_200_000m, TotalCost = 6_200_000m },
        new() { Description = "Interior Build-Out", Category = BidItemCategory.Material, Quantity = 120000, UnitCost = 45m, TotalCost = 5_400_000m },
        new() { Description = "General Conditions & Fee", Category = BidItemCategory.Labor, Quantity = 1, UnitCost = 2_100_000m, TotalCost = 2_100_000m },
        new() { Description = "Contingency", Category = BidItemCategory.Other, Quantity = 1, UnitCost = 1_810_000m, TotalCost = 1_810_000m },
    ];

    private static List<BidItem> CreateFireStationBidItems() =>
    [
        new() { Description = "Site Work & Concrete Aprons", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 580_000m, TotalCost = 580_000m },
        new() { Description = "Concrete Masonry & Foundations", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 920_000m, TotalCost = 920_000m },
        new() { Description = "Structural Steel & Metal Deck", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 680_000m, TotalCost = 680_000m },
        new() { Description = "Apparatus Bay Doors (3)", Category = BidItemCategory.Equipment, Quantity = 3, UnitCost = 45_000m, TotalCost = 135_000m },
        new() { Description = "MEP Systems", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_400_000m, TotalCost = 1_400_000m },
        new() { Description = "Living Quarters Finish", Category = BidItemCategory.Material, Quantity = 3500, UnitCost = 125m, TotalCost = 437_500m },
        new() { Description = "Training Tower", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 380_000m, TotalCost = 380_000m },
        new() { Description = "Generator & Emergency Power", Category = BidItemCategory.Equipment, Quantity = 1, UnitCost = 185_000m, TotalCost = 185_000m },
        new() { Description = "General Conditions", Category = BidItemCategory.Labor, Quantity = 1, UnitCost = 520_000m, TotalCost = 520_000m },
    ];

    private static List<BidItem> CreateScienceBuildingBidItems() =>
    [
        new() { Description = "Selective Demolition & Abatement", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_800_000m, TotalCost = 1_800_000m },
        new() { Description = "Structural Reinforcement", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 1_400_000m, TotalCost = 1_400_000m },
        new() { Description = "Lab Casework & Fume Hoods", Category = BidItemCategory.Equipment, Quantity = 24, UnitCost = 85_000m, TotalCost = 2_040_000m },
        new() { Description = "HVAC (lab-grade air handling)", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 3_200_000m, TotalCost = 3_200_000m },
        new() { Description = "Electrical & Data", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 2_100_000m, TotalCost = 2_100_000m },
        new() { Description = "Plumbing (lab waste, DI water)", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 1_400_000m, TotalCost = 1_400_000m },
        new() { Description = "Interior Finishes", Category = BidItemCategory.Material, Quantity = 35000, UnitCost = 38m, TotalCost = 1_330_000m },
        new() { Description = "General Conditions", Category = BidItemCategory.Labor, Quantity = 1, UnitCost = 930_000m, TotalCost = 930_000m },
    ];

    private static List<BidItem> CreateLastMileBidItems() =>
    [
        new() { Description = "Mass Grading (45 acres)", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 3_500_000m, TotalCost = 3_500_000m },
        new() { Description = "Concrete Tilt-Up Warehouse", Category = BidItemCategory.Material, Quantity = 200000, UnitCost = 65m, TotalCost = 13_000_000m },
        new() { Description = "Structural Steel & Mezzanine", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 4_200_000m, TotalCost = 4_200_000m },
        new() { Description = "Conveyor & Sortation Systems", Category = BidItemCategory.Equipment, Quantity = 1, UnitCost = 6_800_000m, TotalCost = 6_800_000m },
        new() { Description = "Electrical (heavy power + EV charging)", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 4_500_000m, TotalCost = 4_500_000m },
        new() { Description = "HVAC & Fire Protection", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 3_200_000m, TotalCost = 3_200_000m },
        new() { Description = "Site Paving & Striping", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 2_800_000m, TotalCost = 2_800_000m },
        new() { Description = "General Conditions (14 months)", Category = BidItemCategory.Labor, Quantity = 14, UnitCost = 125_000m, TotalCost = 1_750_000m },
        new() { Description = "Contingency", Category = BidItemCategory.Other, Quantity = 1, UnitCost = 2_250_000m, TotalCost = 2_250_000m },
    ];

    private static List<BidItem> CreateBridgeBidItems() =>
    [
        new() { Description = "Traffic Control & MOT", Category = BidItemCategory.Labor, Quantity = 14, UnitCost = 65_000m, TotalCost = 910_000m },
        new() { Description = "Partial Demo & Shoring", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 820_000m, TotalCost = 820_000m },
        new() { Description = "Seismic Retrofit (column jackets, bearings)", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 3_200_000m, TotalCost = 3_200_000m },
        new() { Description = "Bridge Deck Concrete", Category = BidItemCategory.Material, Quantity = 2800, UnitCost = 380m, TotalCost = 1_064_000m },
        new() { Description = "Reinforcing Steel", Category = BidItemCategory.Material, Quantity = 185, UnitCost = 2_800m, TotalCost = 518_000m },
        new() { Description = "Barrier Rail & Approach Slabs", Category = BidItemCategory.Material, Quantity = 1, UnitCost = 680_000m, TotalCost = 680_000m },
        new() { Description = "Striping & Signage", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 145_000m, TotalCost = 145_000m },
        new() { Description = "General Conditions & Supervision", Category = BidItemCategory.Labor, Quantity = 14, UnitCost = 85_000m, TotalCost = 1_190_000m },
        new() { Description = "Contingency", Category = BidItemCategory.Other, Quantity = 1, UnitCost = 373_000m, TotalCost = 373_000m },
    ];

    /// <summary>
    /// Creates realistic construction employees with diverse roles and classifications.
    /// </summary>
    private static List<Employee> CreateEmployees()
    {
        return
        [
            // Management / Office Staff (Salaried)
            new Employee
            {
                EmployeeNumber = "DEMO-001",
                FirstName = "Michael",
                FirstName = "Demo",
                Email = "mrodriguez@demo.example",
                Phone = "(555) 000-1001",
                Title = "Project Manager",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 75.00m,
                HireDate = new DateOnly(2019, 3, 15),
                IsActive = true,
                Notes = "PMP certified. Manages MOB and Distribution Center projects."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-002",
                FirstName = "Jennifer",
                FirstName = "Demo",
                Email = "jthompson@demo.example",
                Phone = "(555) 000-1002",
                Title = "Project Engineer",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 55.00m,
                HireDate = new DateOnly(2021, 6, 1),
                IsActive = true,
                Notes = "Civil engineering background. Handles submittals and RFIs."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-003",
                FirstName = "David",
                FirstName = "Demo",
                Email = "dchen@demo.example",
                Phone = "(555) 000-1003",
                Title = "Estimator",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 58.00m,
                HireDate = new DateOnly(2020, 1, 10),
                IsActive = true,
                Notes = "Specializes in commercial and industrial estimates."
            },

            // Field Supervision (Supervisor classification)
            new Employee
            {
                EmployeeNumber = "DEMO-004",
                FirstName = "Robert",
                FirstName = "Demo",
                Email = "rmartinez@demo.example",
                Phone = "(555) 000-1004",
                Title = "General Superintendent",
                Classification = EmployeeClassification.Supervisor,
                BaseHourlyRate = 62.00m,
                HireDate = new DateOnly(2015, 8, 20),
                IsActive = true,
                Notes = "30+ years experience. Oversees all field operations."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-005",
                FirstName = "Sarah",
                FirstName = "Demo",
                Email = "sjohnson@demo.example",
                Phone = "(555) 000-1005",
                Title = "Site Superintendent",
                Classification = EmployeeClassification.Supervisor,
                BaseHourlyRate = 52.00m,
                HireDate = new DateOnly(2018, 4, 12),
                IsActive = true,
                Notes = "Assigned to Medical Office Building project."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-006",
                FirstName = "James",
                FirstName = "Demo",
                Email = "jwilson@demo.example",
                Phone = "(555) 000-1006",
                Title = "Concrete Foreman",
                Classification = EmployeeClassification.Supervisor,
                BaseHourlyRate = 48.00m,
                HireDate = new DateOnly(2017, 9, 5),
                IsActive = true,
                Notes = "Runs concrete crew. Expert in structural concrete."
            },

            // Skilled Trades (Hourly)
            new Employee
            {
                EmployeeNumber = "DEMO-007",
                FirstName = "Marcus",
                FirstName = "Demo",
                Email = "mbrown@demo.example",
                Phone = "(555) 000-1007",
                Title = "Journeyman Carpenter",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 42.00m,
                HireDate = new DateOnly(2019, 11, 18),
                IsActive = true,
                Notes = "Skilled in formwork and finish carpentry."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-008",
                FirstName = "Antonio",
                FirstName = "Demo",
                Email = "agarcia@demo.example",
                Phone = "(555) 000-1008",
                Title = "Ironworker",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 45.00m,
                HireDate = new DateOnly(2020, 3, 22),
                IsActive = true,
                Notes = "Structural steel and rebar. Certified welder."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-009",
                FirstName = "Kevin",
                FirstName = "Demo",
                Email = "knguyen@demo.example",
                Phone = "(555) 000-1009",
                Title = "Equipment Operator",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 38.00m,
                HireDate = new DateOnly(2021, 2, 8),
                IsActive = true,
                Notes = "Excavator, loader, and crane certified."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-010",
                FirstName = "Carlos",
                FirstName = "Demo",
                Email = "cramirez@demo.example",
                Phone = "(555) 000-1010",
                Title = "Concrete Finisher",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 36.00m,
                HireDate = new DateOnly(2020, 7, 14),
                IsActive = true,
                Notes = "Flatwork and tilt-up specialist."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-011",
                FirstName = "Thomas",
                FirstName = "Demo",
                Email = "tanderson@demo.example",
                Phone = "(555) 000-1011",
                Title = "Laborer",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 28.00m,
                HireDate = new DateOnly(2022, 5, 1),
                IsActive = true,
                Notes = "General labor. Working toward carpenter apprenticeship."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-012",
                FirstName = "Miguel",
                FirstName = "Demo",
                Email = "mhernandez@demo.example",
                Phone = "(555) 000-1012",
                Title = "Laborer",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 26.00m,
                HireDate = new DateOnly(2023, 1, 9),
                IsActive = true,
                Notes = "General labor and cleanup."
            },

            // Apprentices
            new Employee
            {
                EmployeeNumber = "DEMO-013",
                FirstName = "Tyler",
                FirstName = "Demo",
                Email = "tdavis@demo.example",
                Phone = "(555) 000-1013",
                Title = "Carpenter Apprentice",
                Classification = EmployeeClassification.Apprentice,
                BaseHourlyRate = 24.00m,
                HireDate = new DateOnly(2023, 6, 15),
                IsActive = true,
                Notes = "2nd year apprentice. Shows strong potential."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-014",
                FirstName = "Ashley",
                FirstName = "Demo",
                Email = "amiller@demo.example",
                Phone = "(555) 000-1014",
                Title = "Ironworker Apprentice",
                Classification = EmployeeClassification.Apprentice,
                BaseHourlyRate = 22.00m,
                HireDate = new DateOnly(2024, 1, 8),
                IsActive = true,
                Notes = "1st year apprentice. Learning rebar tying."
            },

            // Inactive employee for realism
            new Employee
            {
                EmployeeNumber = "DEMO-015",
                FirstName = "Brian",
                FirstName = "Demo",
                Email = "btaylor@demo.example",
                Phone = "(555) 000-1015",
                Title = "Journeyman Carpenter",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 40.00m,
                HireDate = new DateOnly(2018, 2, 1),
                TerminationDate = new DateOnly(2025, 11, 15),
                IsActive = false,
                Notes = "Resigned to start own business. Good rehire."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-016",
                FirstName = "Priya",
                FirstName = "Demo",
                Email = "ppatel@demo.example",
                Phone = "(555) 000-1016",
                Title = "Project Coordinator",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 41.00m,
                HireDate = new DateOnly(2022, 8, 1),
                IsActive = true,
                Notes = "Coordinates RFIs, logs, and closeout documentation."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-017",
                FirstName = "Ethan",
                FirstName = "Demo",
                Email = "ewalker@demo.example",
                Phone = "(555) 000-1017",
                Title = "Safety Manager",
                Classification = EmployeeClassification.Supervisor,
                BaseHourlyRate = 49.00m,
                HireDate = new DateOnly(2020, 9, 14),
                IsActive = true,
                Notes = "Site safety audits and OSHA compliance."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-018",
                FirstName = "Nina",
                FirstName = "Demo",
                Email = "nlopez@demo.example",
                Phone = "(555) 000-1018",
                Title = "Journeyman Electrician",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 44.50m,
                HireDate = new DateOnly(2021, 11, 2),
                IsActive = true,
                Notes = "Commercial/industrial electrical specialist."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-019",
                FirstName = "Omar",
                FirstName = "Demo",
                Email = "okhan@demo.example",
                Phone = "(555) 000-1019",
                Title = "Plumber",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 40.00m,
                HireDate = new DateOnly(2023, 3, 20),
                IsActive = true,
                Notes = "Rough-in and fixture installation."
            },
            new Employee
            {
                EmployeeNumber = "DEMO-020",
                FirstName = "Grace",
                FirstName = "Demo",
                Email = "glee@demo.example",
                Phone = "(555) 000-1020",
                Title = "Field Engineer",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 46.00m,
                HireDate = new DateOnly(2024, 2, 5),
                IsActive = true,
                Notes = "Field layout, QA/QC, and coordination support."
            }
        ];
    }

    /// <summary>
    /// Creates project assignments linking employees to active projects.
    /// </summary>
    private static List<ProjectAssignment> CreateProjectAssignments(
        List<Employee> employees,
        List<Project> activeProjects)
    {
        var assignments = new List<ProjectAssignment>();
        var now = DateOnly.FromDateTime(DateTime.UtcNow);

        // Find the active employees by role
        var pm = employees.First(e => e.EmployeeNumber == "DEMO-001");
        var pe = employees.First(e => e.EmployeeNumber == "DEMO-002");
        var genSuper = employees.First(e => e.EmployeeNumber == "DEMO-004");
        var siteSuper = employees.First(e => e.EmployeeNumber == "DEMO-005");
        var concreteForeman = employees.First(e => e.EmployeeNumber == "DEMO-006");
        var carpenter = employees.First(e => e.EmployeeNumber == "DEMO-007");
        var ironworker = employees.First(e => e.EmployeeNumber == "DEMO-008");
        var operator1 = employees.First(e => e.EmployeeNumber == "DEMO-009");
        var finisher = employees.First(e => e.EmployeeNumber == "DEMO-010");
        var laborer1 = employees.First(e => e.EmployeeNumber == "DEMO-011");
        var laborer2 = employees.First(e => e.EmployeeNumber == "DEMO-012");
        var apprentice1 = employees.First(e => e.EmployeeNumber == "DEMO-013");
        var apprentice2 = employees.First(e => e.EmployeeNumber == "DEMO-014");

        foreach (var project in activeProjects)
        {
            // PM and PE are assigned to all active projects as Manager role
            assignments.Add(new ProjectAssignment
            {
                EmployeeId = pm.Id,
                ProjectId = project.Id,
                Role = AssignmentRole.Manager,
                StartDate = DateOnly.FromDateTime(project.StartDate ?? DateTime.UtcNow.AddMonths(-3)),
                IsActive = true,
                Notes = "Project Manager"
            });

            assignments.Add(new ProjectAssignment
            {
                EmployeeId = pe.Id,
                ProjectId = project.Id,
                Role = AssignmentRole.Manager,
                StartDate = DateOnly.FromDateTime(project.StartDate ?? DateTime.UtcNow.AddMonths(-3)),
                IsActive = true,
                Notes = "Project Engineer"
            });

            // General Superintendent oversees all
            assignments.Add(new ProjectAssignment
            {
                EmployeeId = genSuper.Id,
                ProjectId = project.Id,
                Role = AssignmentRole.Supervisor,
                StartDate = DateOnly.FromDateTime(project.StartDate ?? DateTime.UtcNow.AddMonths(-3)),
                IsActive = true,
                Notes = "General Superintendent"
            });
        }

        // Site Superintendent assigned to Medical Office Building (first active project)
        var mobProject = activeProjects.FirstOrDefault(p => p.Number == "DEMO-PRJ-2026-001");
        if (mobProject != null)
        {
            assignments.Add(new ProjectAssignment
            {
                EmployeeId = siteSuper.Id,
                ProjectId = mobProject.Id,
                Role = AssignmentRole.Supervisor,
                StartDate = DateOnly.FromDateTime(mobProject.StartDate ?? DateTime.UtcNow.AddMonths(-3)),
                IsActive = true,
                Notes = "Site Superintendent - MOB"
            });

            // Concrete foreman
            assignments.Add(new ProjectAssignment
            {
                EmployeeId = concreteForeman.Id,
                ProjectId = mobProject.Id,
                Role = AssignmentRole.Supervisor,
                StartDate = now.AddDays(-30),
                IsActive = true,
                Notes = "Concrete Foreman"
            });

            // Workers on MOB
            foreach (var worker in new[] { carpenter, ironworker, finisher, laborer1, apprentice1 })
            {
                assignments.Add(new ProjectAssignment
                {
                    EmployeeId = worker.Id,
                    ProjectId = mobProject.Id,
                    Role = AssignmentRole.Worker,
                    StartDate = now.AddDays(-30),
                    IsActive = true
                });
            }
        }

        // Distribution Center project gets different crew
        var dcProject = activeProjects.FirstOrDefault(p => p.Number == "DEMO-PRJ-2026-003");
        if (dcProject != null)
        {
            assignments.Add(new ProjectAssignment
            {
                EmployeeId = concreteForeman.Id,
                ProjectId = dcProject.Id,
                Role = AssignmentRole.Supervisor,
                StartDate = DateOnly.FromDateTime(dcProject.StartDate ?? DateTime.UtcNow.AddMonths(-5)),
                IsActive = true,
                Notes = "Concrete Foreman - tilt-up"
            });

            foreach (var worker in new[] { operator1, finisher, laborer2, apprentice2 })
            {
                assignments.Add(new ProjectAssignment
                {
                    EmployeeId = worker.Id,
                    ProjectId = dcProject.Id,
                    Role = AssignmentRole.Worker,
                    StartDate = DateOnly.FromDateTime(dcProject.StartDate ?? DateTime.UtcNow.AddMonths(-5)),
                    IsActive = true
                });
            }
        }

        return assignments;
    }

    /// <summary>
    /// Creates project assignments for subsidiary company employees (index-based, no hardcoded employee numbers).
    /// Assigns all employees to all active projects with role-based assignments.
    /// </summary>
    private static List<ProjectAssignment> CreateCompanyProjectAssignments(
        List<Employee> employees,
        List<Project> activeProjects)
    {
        var assignments = new List<ProjectAssignment>();
        if (employees.Count == 0 || activeProjects.Count == 0) return assignments;

        var now = DateOnly.FromDateTime(DateTime.UtcNow);

        foreach (var project in activeProjects)
        {
            // Assign first employee as PM, rest as team members
            for (var i = 0; i < employees.Count && i < 8; i++)
            {
                var role = i switch
                {
                    0 => AssignmentRole.Manager,
                    1 => AssignmentRole.Supervisor,
                    2 => AssignmentRole.Supervisor,
                    _ => AssignmentRole.Worker
                };
                assignments.Add(new ProjectAssignment
                {
                    ProjectId = project.Id,
                    EmployeeId = employees[i].Id,
                    Role = role,
                    StartDate = now.AddMonths(-3),
                    IsActive = true
                });
            }
        }

        return assignments;
    }

    /// <summary>
    /// Creates time entries for subsidiary company employees (index-based, no hardcoded employee numbers).
    /// </summary>
    private static List<TimeEntry> CreateCompanyTimeEntries(
        List<Employee> employees,
        List<Project> activeProjects,
        List<CostCode> costCodes,
        List<ProjectAssignment> assignments)
    {
        var entries = new List<TimeEntry>();
        if (employees.Count == 0 || activeProjects.Count == 0 || costCodes.Count == 0)
            return entries;

        var random = new Random(42); // Deterministic for reproducibility
        var startDate = DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(-2);
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        // Create ~50 time entries spread across employees and projects
        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            // Skip weekends
            if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;

            // Each day, 3-5 employees log time
            var dailyCount = Math.Min(employees.Count, random.Next(3, 6));
            for (var i = 0; i < dailyCount; i++)
            {
                var employee = employees[i % employees.Count];
                var project = activeProjects[random.Next(activeProjects.Count)];
                var costCode = costCodes[random.Next(costCodes.Count)];
                var hours = random.Next(4, 11); // 4-10 hours

                entries.Add(new TimeEntry
                {
                    EmployeeId = employee.Id,
                    ProjectId = project.Id,
                    CostCodeId = costCode.Id,
                    Date = date,
                    RegularHours = hours,
                    OvertimeHours = random.NextDouble() > 0.8 ? random.Next(1, 4) : 0,
                    Description = $"Field work on {project.Name}",
                    Status = TimeEntryStatus.Approved
                });
            }
        }

        return entries;
    }

    /// <summary>
    /// Creates 3 months of realistic time entries across employees and projects.
    /// </summary>
    private static List<TimeEntry> CreateTimeEntries(
        List<Employee> employees,
        List<Project> activeProjects,
        List<CostCode> costCodes,
        List<ProjectAssignment> assignments)
    {
        var entries = new List<TimeEntry>();
        var random = new Random(42); // Fixed seed for reproducibility
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Get labor cost codes for time entries
        var laborCostCodes = costCodes
            .Where(c => c.CostType == CostType.Labor)
            .ToList();

        if (laborCostCodes.Count == 0) return entries;

        // Get supervisor for approvals
        var genSuper = employees.First(e => e.EmployeeNumber == "DEMO-004");

        // Create entries for the last 180 days / 6 months (skip weekends for most)
        for (int dayOffset = -180; dayOffset <= 0; dayOffset++)
        {
            var date = today.AddDays(dayOffset);
            var dayOfWeek = date.DayOfWeek;

            // Skip most weekends (occasional Saturday work)
            if (dayOfWeek == DayOfWeek.Sunday) continue;
            if (dayOfWeek == DayOfWeek.Saturday && random.Next(100) > 30) continue;

            foreach (var assignment in assignments.Where(a => a.IsActive && a.Role != AssignmentRole.Manager))
            {
                // Skip if assignment hasn't started yet
                if (date < assignment.StartDate) continue;

                var employee = employees.First(e => e.Id == assignment.EmployeeId);
                var project = activeProjects.First(p => p.Id == assignment.ProjectId);

                // Not everyone works every day (80% chance of working)
                if (random.Next(100) > 80) continue;

                // Pick appropriate cost codes based on role
                var applicableCostCodes = GetApplicableCostCodes(employee, laborCostCodes);
                if (applicableCostCodes.Count == 0) continue;

                var costCode = applicableCostCodes[random.Next(applicableCostCodes.Count)];

                // Generate hours - typically 8, sometimes more
                decimal regularHours = 8.0m;
                decimal overtimeHours = 0m;
                decimal doubletimeHours = 0m;

                // 30% chance of overtime on weekdays
                if (dayOfWeek != DayOfWeek.Saturday && random.Next(100) < 30)
                {
                    overtimeHours = random.Next(1, 4); // 1-3 hours OT
                }

                // Saturday work is all OT
                if (dayOfWeek == DayOfWeek.Saturday)
                {
                    regularHours = 0;
                    overtimeHours = random.Next(4, 9); // 4-8 hours Saturday OT
                }

                // Determine status based on date
                TimeEntryStatus status;
                Guid? approvedById = null;
                DateTime? approvedAt = null;

                if (dayOffset < -14)
                {
                    // Old entries are approved
                    status = TimeEntryStatus.Approved;
                    approvedById = genSuper.Id;
                    approvedAt = DateTime.UtcNow.AddDays(dayOffset + 2);
                }
                else if (dayOffset < -7)
                {
                    // Week before last - mostly approved, some pending
                    status = random.Next(100) < 85 ? TimeEntryStatus.Approved : TimeEntryStatus.Submitted;
                    if (status == TimeEntryStatus.Approved)
                    {
                        approvedById = genSuper.Id;
                        approvedAt = DateTime.UtcNow.AddDays(dayOffset + 3);
                    }
                }
                else if (dayOffset < -2)
                {
                    // Last week - mix of submitted and approved
                    status = random.Next(100) < 50 ? TimeEntryStatus.Approved : TimeEntryStatus.Submitted;
                    if (status == TimeEntryStatus.Approved)
                    {
                        approvedById = genSuper.Id;
                        approvedAt = DateTime.UtcNow.AddDays(1);
                    }
                }
                else
                {
                    // Recent entries - mostly drafts and submitted
                    status = random.Next(100) < 40 ? TimeEntryStatus.Draft : TimeEntryStatus.Submitted;
                }

                var entry = new TimeEntry
                {
                    Date = date,
                    EmployeeId = employee.Id,
                    ProjectId = project.Id,
                    CostCodeId = costCode.Id,
                    RegularHours = regularHours,
                    OvertimeHours = overtimeHours,
                    DoubletimeHours = doubletimeHours,
                    Description = GetWorkDescription(costCode, random),
                    Status = status,
                    ApprovedById = approvedById,
                    ApprovedAt = approvedAt
                };

                entries.Add(entry);
            }
        }

        return entries;
    }

    /// <summary>
    /// Gets applicable cost codes based on employee role/title.
    /// </summary>
    private static List<CostCode> GetApplicableCostCodes(Employee employee, List<CostCode> laborCostCodes)
    {
        var title = employee.Title?.ToLower() ?? "";

        if (title.Contains("superintendent") || title.Contains("foreman"))
        {
            return laborCostCodes.Where(c =>
                c.Code.StartsWith("01-") // General conditions/supervision
            ).ToList();
        }

        if (title.Contains("carpenter"))
        {
            return laborCostCodes.Where(c =>
                c.Code.StartsWith("06-") || // Carpentry
                c.Code.StartsWith("03-")    // Concrete formwork
            ).ToList();
        }

        if (title.Contains("ironworker"))
        {
            return laborCostCodes.Where(c =>
                c.Code.StartsWith("05-") || // Metals
                c.Code.StartsWith("03-2")   // Rebar
            ).ToList();
        }

        if (title.Contains("operator"))
        {
            return laborCostCodes.Where(c =>
                c.Code.StartsWith("02-") // Site work
            ).ToList();
        }

        if (title.Contains("finisher"))
        {
            return laborCostCodes.Where(c =>
                c.Code.StartsWith("03-") // Concrete
            ).ToList();
        }

        // Laborers and apprentices can do various work
        return laborCostCodes.Where(c =>
            c.Code.StartsWith("02-") || // Site work
            c.Code.StartsWith("03-") || // Concrete
            c.Code.StartsWith("06-")    // Carpentry
        ).ToList();
    }

    /// <summary>
    /// Generates realistic work descriptions based on cost code.
    /// </summary>
    private static string GetWorkDescription(CostCode costCode, Random random)
    {
        var descriptions = costCode.Code switch
        {
            "01-100" => new[] { "Project coordination and meetings", "Safety walk and documentation", "Subcontractor coordination" },
            "01-200" => new[] { "Crew supervision and layout", "Quality inspection", "Schedule coordination" },
            "01-300" => new[] { "Trade coordination", "Material staging", "Daily planning" },
            "02-100" => new[] { "Excavation for footings", "Grading and compaction", "Utility trench work" },
            "02-200" => new[] { "Utility trenching", "Pipe laying", "Backfill operations" },
            "02-300" => new[] { "Backfill and compaction", "Grade work", "Site cleanup" },
            "03-100" => new[] { "Formwork installation", "Form stripping", "Form preparation" },
            "03-200" => new[] { "Rebar installation", "Rebar tying", "Dowel installation" },
            "03-300" => new[] { "Concrete placement", "Pump setup and pour", "Vibrating and finishing" },
            "03-400" => new[] { "Slab finishing", "Trowel work", "Curing application" },
            "05-100" => new[] { "Steel erection", "Beam installation", "Connection work" },
            "05-200" => new[] { "Misc metals installation", "Handrail work", "Embed plates" },
            "06-100" => new[] { "Wall framing", "Blocking installation", "Sheathing work" },
            "06-200" => new[] { "Trim installation", "Door hanging", "Cabinet install" },
            "06-300" => new[] { "Floor framing", "Truss setting", "Deck installation" },
            _ => new[] { "General work", "Site activities", "Project support" }
        };

        return descriptions[random.Next(descriptions.Length)];
    }

    private static List<Customer> CreateCustomers()
    {
        return
        [
            new() { Name = "Riverside Health Partners LLC", Code = "CUST-001", ContactName = "Demo Contact 20", ContactEmail = "contact20@example.com", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Summit Development Group", Code = "CUST-002", ContactName = "Demo Contact 21", ContactEmail = "contact21@example.com", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Summit Logistics Inc.", Code = "CUST-003", ContactName = "Demo Contact 22", ContactEmail = "contact22@example.com", PaymentTerms = "Net 45", IsActive = true },
            new() { Name = "California Department of Transportation", Code = "CUST-004", ContactName = "Demo Contact 23", ContactEmail = "contact23@example.com", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Lincoln Unified School District", Code = "CUST-005", ContactName = "Demo Contact 24", ContactEmail = "smorales@example.edu", PaymentTerms = "Net 30", IsActive = true }
        ];
    }

    private static List<Vendor> CreateVendors()
    {
        return
        [
            new() { Name = "Summit Mechanical Systems Inc.", Code = "VEND-001", ContactName = "Demo Contact", ContactEmail = "trivera@summitmech.example", TradeClassification = "Mechanical", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "Summit Electric Company", Code = "VEND-002", ContactName = "Maria Lopez", ContactEmail = "mlopez@summitelec.example", TradeClassification = "Electrical", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "Capitol Plumbing & Medical Gas", Code = "VEND-003", ContactName = "Demo Contact", ContactEmail = "drichardson@summitplumb.example", TradeClassification = "Plumbing", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "Sierra Drywall & Acoustical", Code = "VEND-004", ContactName = "Demo Contact", ContactEmail = "kmorrison@summitdrywall.example", TradeClassification = "Drywall", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "Advanced Fire Protection Inc.", Code = "VEND-005", ContactName = "Demo Contact", ContactEmail = "rkim@advancedfire.com", TradeClassification = "Fire Protection", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "Summit Sitework & Paving", Code = "VEND-006", ContactName = "Demo Contact", ContactEmail = "jwalsh@summitsite.example", TradeClassification = "Sitework", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "Delta Steel Erectors", Code = "VEND-007", ContactName = "Demo Contact", ContactEmail = "mhuang@deltasteel.com", TradeClassification = "Structural Steel", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "Golden State Bridge Works", Code = "VEND-008", ContactName = "Demo Contact", ContactEmail = "fdeluca@gsbridgeworks.com", TradeClassification = "Concrete", PaymentTerms = "Net 30", W9OnFile = true, IsActive = true },
            new() { Name = "NorCal Ready Mix", Code = "VEND-009", ContactName = "Amanda Price", ContactEmail = "aprice@ncrmix.com", TradeClassification = "Concrete Supply", PaymentTerms = "Net 20", W9OnFile = true, IsActive = true },
            new() { Name = "Capital Rentals & Equipment", Code = "VEND-010", ContactName = "Steven Clark", ContactEmail = "sclark@capitalrentals.example", TradeClassification = "Equipment Rental", PaymentTerms = "Net 15", W9OnFile = true, IsActive = true }
        ];
    }

    private static List<VendorInvoice> CreateVendorInvoices(List<Vendor> vendors, List<Subcontract> subcontracts)
    {
        var invoices = new List<VendorInvoice>();
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var random = new Random(77);
        var invoiceNumber = 1000;

        foreach (var subcontract in subcontracts.Where(x => x.Status is SubcontractStatus.InProgress or SubcontractStatus.Complete or SubcontractStatus.ClosedOut))
        {
            var vendor = vendors.FirstOrDefault(v => subcontract.SubcontractorName.Contains(v.Name.Split(' ')[0], StringComparison.OrdinalIgnoreCase))
                         ?? vendors[random.Next(vendors.Count)];

            var baseAmount = subcontract.CurrentValue / 10m;
            for (var i = 0; i < 2; i++)
            {
                var invoiceDate = now.AddDays(-(45 - (i * 15)));
                var dueDate = invoiceDate.AddDays(30);
                var amount = Math.Round(baseAmount * (0.7m + (decimal)random.NextDouble() * 0.6m), 2);
                invoices.Add(new VendorInvoice
                {
                    VendorId = vendor.Id,
                    InvoiceNumber = $"INV-{invoiceNumber++}",
                    InvoiceDate = invoiceDate,
                    DueDate = dueDate,
                    TotalAmount = amount,
                    Status = dueDate < now ? VendorInvoiceStatus.Approved : VendorInvoiceStatus.Pending
                });
            }
        }

        return invoices;
    }

    /// <summary>
    /// Creates realistic subcontracts with change orders for the demo projects.
    /// </summary>
    private static List<Subcontract> CreateSubcontracts(List<Project> projects)
    {
        var now = DateTime.UtcNow;
        var subcontracts = new List<Subcontract>();

        // Medical Office Building project subcontracts
        var mobProject = projects.FirstOrDefault(p => p.Number == "DEMO-PRJ-2026-001");
        if (mobProject != null)
        {
            // HVAC Subcontract - In Progress with change orders
            var hvacSub = new Subcontract
            {
                ProjectId = mobProject.Id,
                SubcontractNumber = "SC-2026-001",
                SubcontractorName = "Summit Mechanical Systems Inc.",
                SubcontractorContact = "Demo Contact",
                SubcontractorEmail = "trivera@summitmech.example",
                SubcontractorPhone = "(555) 000-2100",
                SubcontractorAddress = "2847 Industrial Way, Sacramento, CA 95828",
                ScopeOfWork = "Complete HVAC system installation including rooftop units, VAV boxes, ductwork, controls, and balancing. Medical-grade air handling for surgical suites.",
                TradeCode = "15 - Mechanical",
                OriginalValue = 2_100_000m,
                CurrentValue = 2_245_000m, // After approved COs
                BilledToDate = 420_000m,
                PaidToDate = 378_000m,
                RetainagePercent = 10m,
                RetainageHeld = 42_000m,
                ExecutionDate = now.AddMonths(-3),
                StartDate = now.AddMonths(-2),
                CompletionDate = now.AddMonths(5),
                Status = SubcontractStatus.InProgress,
                InsuranceExpirationDate = now.AddMonths(10),
                InsuranceCurrent = true,
                LicenseNumber = "CA-MECH-847291",
                Notes = "Strong performance. On schedule.",
                ChangeOrders =
                [
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-001",
                        Title = "UV-C Air Purification Addition",
                        Description = "Add UV-C air purification system to surgical suite AHUs per owner request. Value engineering offset with duct insulation material change.",
                        Reason = "Owner requested enhancement",
                        Amount = 85_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-1),
                        ApprovedDate = now.AddDays(-20),
                        ApprovedBy = "Demo Contact",
                        DaysExtension = 0
                    },
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-002",
                        Title = "MRI Suite Exhaust Relocation",
                        Description = "Additional exhaust for relocated MRI suite. Negotiated from $72K to $60K. Minor schedule impact acceptable.",
                        Reason = "Design change",
                        Amount = 60_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddDays(-15),
                        ApprovedDate = now.AddDays(-5),
                        ApprovedBy = "Demo Contact",
                        DaysExtension = 3
                    },
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-003",
                        Title = "Suite 220 Ductwork Extension",
                        Description = "Extend ductwork to new tenant improvement area (Suite 220). Awaiting owner approval for TI scope.",
                        Reason = "Scope addition",
                        Amount = 45_000m,
                        Status = ChangeOrderStatus.Pending,
                        SubmittedDate = now.AddDays(-3),
                        DaysExtension = 5
                    }
                ]
            };
            subcontracts.Add(hvacSub);

            // Electrical Subcontract - In Progress
            var elecSub = new Subcontract
            {
                ProjectId = mobProject.Id,
                SubcontractNumber = "SC-2026-002",
                SubcontractorName = "Summit Electric Company",
                SubcontractorContact = "Maria Lopez",
                SubcontractorEmail = "mlopez@summitelec.example",
                SubcontractorPhone = "(555) 000-2200",
                SubcontractorAddress = "4521 Power Line Rd, West Sacramento, CA 95691",
                ScopeOfWork = "Complete electrical installation including main switchgear, distribution, lighting, fire alarm, low voltage, and medical equipment connections.",
                TradeCode = "16 - Electrical",
                OriginalValue = 1_850_000m,
                CurrentValue = 1_920_000m,
                BilledToDate = 370_000m,
                PaidToDate = 333_000m,
                RetainagePercent = 10m,
                RetainageHeld = 37_000m,
                ExecutionDate = now.AddMonths(-3),
                StartDate = now.AddMonths(-2),
                CompletionDate = now.AddMonths(6),
                Status = SubcontractStatus.InProgress,
                InsuranceExpirationDate = now.AddMonths(8),
                InsuranceCurrent = true,
                LicenseNumber = "CA-ELEC-C10-582914",
                Notes = "Excellent quality work. Proactive on coordination.",
                ChangeOrders =
                [
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-001",
                        Title = "Generator Upsizing",
                        Description = "Generator upsizing from 500kW to 750kW per code review. Required for new emergency power calculations.",
                        Reason = "Code requirement",
                        Amount = 70_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-2),
                        ApprovedDate = now.AddDays(-45),
                        ApprovedBy = "Demo Contact",
                        DaysExtension = 0
                    }
                ]
            };
            subcontracts.Add(elecSub);

            // Plumbing - In Progress
            var plumbSub = new Subcontract
            {
                ProjectId = mobProject.Id,
                SubcontractNumber = "SC-2026-003",
                SubcontractorName = "Capitol Plumbing & Medical Gas",
                SubcontractorContact = "Demo Contact",
                SubcontractorEmail = "drichardson@summitplumb.example",
                SubcontractorPhone = "(555) 000-2300",
                SubcontractorAddress = "1890 Commerce Circle, Sacramento, CA 95822",
                ScopeOfWork = "Complete plumbing installation including domestic water, sanitary, storm, medical gas (O2, N2O, vacuum, air), and natural gas.",
                TradeCode = "15 - Plumbing",
                OriginalValue = 1_200_000m,
                CurrentValue = 1_200_000m,
                BilledToDate = 180_000m,
                PaidToDate = 162_000m,
                RetainagePercent = 10m,
                RetainageHeld = 18_000m,
                ExecutionDate = now.AddMonths(-3),
                StartDate = now.AddMonths(-1),
                CompletionDate = now.AddMonths(7),
                Status = SubcontractStatus.InProgress,
                InsuranceExpirationDate = now.AddMonths(14),
                InsuranceCurrent = true,
                LicenseNumber = "CA-PLUMB-C36-471829",
                Notes = "Medical gas certified. Clean safety record."
            };
            subcontracts.Add(plumbSub);

            // Drywall - Draft (not yet issued)
            var drywallSub = new Subcontract
            {
                ProjectId = mobProject.Id,
                SubcontractNumber = "SC-2026-004",
                SubcontractorName = "Sierra Drywall & Acoustical",
                SubcontractorContact = "Demo Contact",
                SubcontractorEmail = "kmorrison@summitdrywall.example",
                SubcontractorPhone = "(555) 000-2400",
                ScopeOfWork = "Metal stud framing, drywall installation and finishing, acoustic ceiling installation.",
                TradeCode = "09 - Finishes",
                OriginalValue = 680_000m,
                CurrentValue = 680_000m,
                RetainagePercent = 10m,
                CompletionDate = now.AddMonths(10),
                Status = SubcontractStatus.Draft,
                Notes = "Final scope review pending. Targeting April start."
            };
            subcontracts.Add(drywallSub);
        }

        // Distribution Center project subcontracts
        var dcProject = projects.FirstOrDefault(p => p.Number == "DEMO-PRJ-2026-003");
        if (dcProject != null)
        {
            // Fire Protection - In Progress
            var fireSub = new Subcontract
            {
                ProjectId = dcProject.Id,
                SubcontractNumber = "SC-2026-005",
                SubcontractorName = "Advanced Fire Protection Inc.",
                SubcontractorContact = "Demo Contact",
                SubcontractorEmail = "rkim@advancedfire.com",
                SubcontractorPhone = "(555) 000-3100",
                SubcontractorAddress = "7842 Industrial Blvd, Stockton, CA 95206",
                ScopeOfWork = "ESFR sprinkler system for 450,000 SF warehouse. Includes fire pump, underground fire main, and NFPA 13 compliant system.",
                TradeCode = "15 - Fire Protection",
                OriginalValue = 1_800_000m,
                CurrentValue = 1_925_000m,
                BilledToDate = 960_000m,
                PaidToDate = 864_000m,
                RetainagePercent = 10m,
                RetainageHeld = 96_000m,
                ExecutionDate = now.AddMonths(-5),
                StartDate = now.AddMonths(-4),
                CompletionDate = now.AddMonths(2),
                Status = SubcontractStatus.InProgress,
                InsuranceExpirationDate = now.AddMonths(6),
                InsuranceCurrent = true,
                LicenseNumber = "CA-FIRE-C16-392847",
                Notes = "Ahead of schedule. Great coordination with steel.",
                ChangeOrders =
                [
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-001",
                        Title = "In-Rack Sprinkler Addition",
                        Description = "Add in-rack sprinklers for high-pile storage area. Owner-directed for Amazon storage requirements.",
                        Reason = "Owner requirement - increased storage height",
                        Amount = 125_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-2),
                        ApprovedDate = now.AddMonths(-1).AddDays(-15),
                        ApprovedBy = "Demo Contact",
                        DaysExtension = 0
                    }
                ]
            };
            subcontracts.Add(fireSub);

            // Concrete/Site - Executed, substantial work complete
            var siteSub = new Subcontract
            {
                ProjectId = dcProject.Id,
                SubcontractNumber = "SC-2026-006",
                SubcontractorName = "Summit Sitework & Paving",
                SubcontractorContact = "Demo Contact",
                SubcontractorEmail = "jwalsh@summitsite.example",
                SubcontractorPhone = "(555) 000-3200",
                SubcontractorAddress = "3920 Industrial Parkway, Tracy, CA 95376",
                ScopeOfWork = "Site grading, underground utilities, concrete paving (truck court, parking), striping, and landscaping.",
                TradeCode = "02 - Site Work",
                OriginalValue = 3_500_000m,
                CurrentValue = 3_650_000m,
                BilledToDate = 2_920_000m,
                PaidToDate = 2_628_000m,
                RetainagePercent = 10m,
                RetainageHeld = 292_000m,
                ExecutionDate = now.AddMonths(-5),
                StartDate = now.AddMonths(-5),
                CompletionDate = now.AddMonths(3),
                Status = SubcontractStatus.InProgress,
                InsuranceExpirationDate = now.AddMonths(7),
                InsuranceCurrent = true,
                LicenseNumber = "CA-GEN-A-847291",
                Notes = "80% complete. Paving in final phase.",
                ChangeOrders =
                [
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-001",
                        Title = "EV Charging Infrastructure",
                        Description = "Additional 40 EV charging station conduit runs. EV infrastructure for delivery vans.",
                        Reason = "Owner sustainability requirement",
                        Amount = 150_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-3),
                        ApprovedDate = now.AddMonths(-2).AddDays(-20),
                        ApprovedBy = "Demo Contact",
                        DaysExtension = 0
                    }
                ]
            };
            subcontracts.Add(siteSub);

            // Steel Erection - Complete
            var steelSub = new Subcontract
            {
                ProjectId = dcProject.Id,
                SubcontractNumber = "SC-2026-007",
                SubcontractorName = "Delta Steel Erectors",
                SubcontractorContact = "Demo Contact",
                SubcontractorEmail = "mhuang@deltasteel.com",
                SubcontractorPhone = "(555) 000-3300",
                SubcontractorAddress = "8100 Port Road, Stockton, CA 95206",
                ScopeOfWork = "Structural steel erection, metal deck installation, and miscellaneous iron.",
                TradeCode = "05 - Metals",
                OriginalValue = 4_200_000m,
                CurrentValue = 4_200_000m,
                BilledToDate = 4_200_000m,
                PaidToDate = 3_780_000m,
                RetainagePercent = 10m,
                RetainageHeld = 420_000m,
                ExecutionDate = now.AddMonths(-4),
                StartDate = now.AddMonths(-3),
                CompletionDate = now.AddDays(-30),
                ActualCompletionDate = now.AddDays(-35),
                Status = SubcontractStatus.Complete,
                InsuranceExpirationDate = now.AddMonths(5),
                InsuranceCurrent = true,
                LicenseNumber = "CA-STRUCT-C51-293847",
                Notes = "Completed 5 days early. Excellent safety record. Retainage pending final inspection."
            };
            subcontracts.Add(steelSub);
        }

        // Completed Bridge project - closed out subcontract
        var bridgeProject = projects.FirstOrDefault(p => p.Number == "DEMO-PRJ-2025-004");
        if (bridgeProject != null)
        {
            var bridgeSub = new Subcontract
            {
                ProjectId = bridgeProject.Id,
                SubcontractNumber = "SC-2025-001",
                SubcontractorName = "Golden State Bridge Works",
                SubcontractorContact = "Demo Contact",
                SubcontractorEmail = "fdeluca@gsbridgeworks.com",
                SubcontractorPhone = "(555) 000-4100",
                SubcontractorAddress = "1200 Bridge Way, West Sacramento, CA 95691",
                ScopeOfWork = "Seismic retrofit including column jacketing, bearing replacement, and deck demolition/replacement.",
                TradeCode = "03 - Concrete",
                OriginalValue = 5_200_000m,
                CurrentValue = 5_480_000m,
                BilledToDate = 5_480_000m,
                PaidToDate = 5_480_000m, // All paid including retainage
                RetainagePercent = 5m, // Caltrans standard
                RetainageHeld = 0m, // Released
                ExecutionDate = now.AddMonths(-14),
                StartDate = now.AddMonths(-13),
                CompletionDate = now.AddMonths(-2),
                ActualCompletionDate = now.AddMonths(-2),
                Status = SubcontractStatus.ClosedOut,
                InsuranceExpirationDate = now.AddMonths(10),
                InsuranceCurrent = true,
                LicenseNumber = "CA-BRIDGE-A-183729",
                Notes = "Project complete. Final lien release received. Excellent performance.",
                ChangeOrders =
                [
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-001",
                        Title = "Additional Column Jacketing",
                        Description = "Additional column jacketing due to unforeseen deterioration. Caltrans approved time extension.",
                        Reason = "Unforeseen condition",
                        Amount = 280_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-10),
                        ApprovedDate = now.AddMonths(-9),
                        ApprovedBy = "Demo Contact",
                        DaysExtension = 14
                    }
                ]
            };
            subcontracts.Add(bridgeSub);
        }

        return subcontracts;
    }

    /// <summary>
    /// Creates payment applications for subcontracts that are in progress or complete.
    /// </summary>
    private static List<PaymentApplication> CreatePaymentApplications(List<Subcontract> subcontracts)
    {
        var now = DateTime.UtcNow;
        var payApps = new List<PaymentApplication>();
        var appNumber = 1;

        foreach (var sub in subcontracts.Where(s =>
            s.Status is SubcontractStatus.InProgress or SubcontractStatus.Complete or SubcontractStatus.ClosedOut))
        {
            // Calculate number of pay apps based on billed amount
            var monthsActive = sub.BilledToDate > 0
                ? Math.Max(1, (int)Math.Ceiling((double)(sub.BilledToDate / sub.CurrentValue) * 6))
                : 0;

            if (monthsActive == 0) continue;

            var billedRemaining = sub.BilledToDate;
            var paidRemaining = sub.PaidToDate;

            for (int i = 1; i <= monthsActive; i++)
            {
                var isLast = i == monthsActive;
                var periodEnd = now.AddMonths(-monthsActive + i);

                // Distribute amounts across pay apps
                var scheduledValue = sub.CurrentValue / monthsActive;
                var completedWork = isLast ? billedRemaining : Math.Min(scheduledValue, billedRemaining);
                billedRemaining -= completedWork;

                var retainageAmount = completedWork * (sub.RetainagePercent / 100);
                var netPayable = completedWork - retainageAmount;

                var previouslyPaid = sub.PaidToDate - paidRemaining;
                var currentPayment = isLast ? paidRemaining : Math.Min(netPayable, paidRemaining);
                paidRemaining -= currentPayment;

                var status = currentPayment > 0
                    ? PaymentApplicationStatus.Paid
                    : (isLast ? PaymentApplicationStatus.Approved : PaymentApplicationStatus.Paid);

                var workCompletedToDate = sub.BilledToDate - billedRemaining;
                var totalRetainage = workCompletedToDate * (sub.RetainagePercent / 100);
                var totalEarnedLessRetainage = workCompletedToDate * (1 - sub.RetainagePercent / 100);

                payApps.Add(new PaymentApplication
                {
                    SubcontractId = sub.Id,
                    ApplicationNumber = i,
                    PeriodStart = periodEnd.AddMonths(-1).AddDays(1),
                    PeriodEnd = periodEnd,
                    SubmittedDate = periodEnd.AddDays(5),
                    Status = status,
                    ScheduledValue = scheduledValue,
                    WorkCompletedPrevious = workCompletedToDate - completedWork,
                    WorkCompletedThisPeriod = completedWork,
                    WorkCompletedToDate = workCompletedToDate,
                    StoredMaterials = 0,
                    TotalCompletedAndStored = workCompletedToDate,
                    RetainagePercent = sub.RetainagePercent,
                    RetainageThisPeriod = retainageAmount,
                    RetainagePrevious = totalRetainage - retainageAmount,
                    TotalRetainage = totalRetainage,
                    TotalEarnedLessRetainage = totalEarnedLessRetainage,
                    LessPreviousCertificates = previouslyPaid,
                    CurrentPaymentDue = currentPayment,
                    ApprovedAmount = completedWork,
                    ApprovedBy = status == PaymentApplicationStatus.Paid ? "Demo Contact" : null,
                    ApprovedDate = status == PaymentApplicationStatus.Paid ? periodEnd.AddDays(10) : null,
                    PaidDate = status == PaymentApplicationStatus.Paid ? periodEnd.AddDays(25) : null,
                    CheckNumber = status == PaymentApplicationStatus.Paid ? $"CHK-{10000 + appNumber}" : null,
                    Notes = $"Pay App #{i} for {sub.SubcontractorName}"
                });

                appNumber++;
            }
        }

        return payApps;
    }

    // ===========================================================================================
    // Additional data generators — bring totals to 18 projects, 200 employees, 50 vendors
    // ===========================================================================================

    private static List<Project> CreateAdditionalProjects()
    {
        var now = DateTime.UtcNow;
        var projects = new List<Project>();

        // Data-driven project definitions: (Name, Number, Description, Status, Type, Address, City, State, Zip, Client, Contact, Email, Phone, StartOffset, EndOffset, ContractAmt, Budget)
        var defs = new (string Name, string Number, string Desc, ProjectStatus Status, ProjectType Type,
            string Addr, string City, string St, string Zip,
            string Client, string Contact, string Email, string Phone,
            int StartMo, int EndMo, decimal Contract, decimal Budget)[]
        {
            ("Sacramento Airport Terminal B Expansion", "DEMO-PRJ-2026-006",
                "65,000 SF terminal expansion with 8 new gates, passenger bridge connections, and concession area.",
                ProjectStatus.Active, ProjectType.Commercial,
                "6900 Airport Blvd", "Sacramento", "CA", "95837",
                "Sacramento County Airport System", "Brian Whitfield", "bwhitfield@summitvendor.example", "(555) 000-0601",
                -6, 18, 3_200_000m, 3_000_000m),

            ("Folsom Town Center Mixed-Use", "DEMO-PRJ-2026-007",
                "4-story mixed-use: ground-floor retail, 3 floors residential (72 units), parking structure.",
                ProjectStatus.Active, ProjectType.Commercial,
                "800 Sutter Street", "Folsom", "CA", "95630",
                "Folsom Gateway Partners LLC", "Rachel Ito", "rito@folsomgateway.example", "(555) 000-0702",
                -4, 14, 2_800_000m, 2_600_000m),

            ("Elk Grove Fire Station #8", "DEMO-PRJ-2026-008",
                "New 3-bay fire station with living quarters, training tower, apparatus storage, and EV charging.",
                ProjectStatus.Active, ProjectType.Commercial,
                "9100 Bond Road", "Elk Grove", "CA", "95624",
                "City of Elk Grove", "Tom Nakamura", "tnakamura@elkgrovecity.example", "(555) 000-0803",
                -2, 10, 1_800_000m, 1_650_000m),

            ("Rancho Cordova Data Center", "DEMO-PRJ-2025-009",
                "Tier III data center, 40,000 SF whitespace, 10MW critical power, redundant cooling.",
                ProjectStatus.Completed, ProjectType.Industrial,
                "11200 White Rock Road", "Rancho Cordova", "CA", "95742",
                "Western Digital Realty Trust", "Samantha Cho", "scho@wdrt.example", "(555) 000-0904",
                -18, -2, 4_500_000m, 4_200_000m),

            ("West Sacramento Levee Improvements", "DEMO-PRJ-2025-010",
                "2.5 miles of levee rehabilitation including slurry walls, seepage berms, and erosion protection.",
                ProjectStatus.Completed, ProjectType.Infrastructure,
                "River Road at Industrial Blvd", "West Sacramento", "CA", "95691",
                "Central Valley Flood Protection Board", "Daniel Herrera", "dherrera@cvfpb.ca.gov", "(916) 555-1005",
                -16, -3, 2_200_000m, 2_050_000m),

            ("Natomas Corporate Campus Building B", "DEMO-PRJ-2026-011",
                "4-story Class A office, 120,000 SF, curtain wall, structured parking, LEED Gold target.",
                ProjectStatus.Active, ProjectType.Commercial,
                "2800 Natomas Park Drive", "Sacramento", "CA", "95834",
                "Natomas Park Investors", "Andrea Sims", "asims@natomaspark.example", "(555) 000-1101",
                -7, 10, 3_500_000m, 3_300_000m),

            ("Lodi Memorial Hospital Wing Addition", "DEMO-PRJ-2026-012",
                "35,000 SF 2-story addition: 24-bed patient wing, nurses stations, support spaces. Occupied hospital.",
                ProjectStatus.Active, ProjectType.Commercial,
                "975 S Fairmont Ave", "Lodi", "CA", "95240",
                "Summit Health Lodi Memorial", "Demo Contact", "pdunn@adventisthealth.org", "(209) 555-1202",
                -3, 12, 2_400_000m, 2_250_000m),

            ("Tracy Logistics Park - Building 2", "DEMO-PRJ-2026-013",
                "600,000 SF speculative warehouse, 40-ft clear height, ESFR sprinklers, 60 dock doors.",
                ProjectStatus.Active, ProjectType.Industrial,
                "4500 W Schulte Road", "Tracy", "CA", "95377",
                "Summit Logistics Western", "Demo Contact", "kpark@prologis.com", "(209) 555-1303",
                -5, 6, 5_200_000m, 4_900_000m),

            ("Roseville Galleria Renovation", "DEMO-PRJ-2026-014",
                "Interior renovation of 80,000 SF anchor tenant space. New MEP, storefront, finishes.",
                ProjectStatus.PreConstruction, ProjectType.Renovation,
                "1151 Galleria Blvd", "Roseville", "CA", "95678",
                "Westfield Roseville LLC", "Janet Collins", "jcollins@westfield.example", "(555) 000-1404",
                2, 8, 1_200_000m, 1_100_000m),

            ("Sacramento State Science Complex", "DEMO-PRJ-2026-015",
                "New 4-story science building: chemistry/biology labs, lecture halls, greenhouse, vivarium.",
                ProjectStatus.PreConstruction, ProjectType.Commercial,
                "6000 J Street", "Sacramento", "CA", "95819",
                "California State University Sacramento", "Mark Orozco", "morozco@csus.example", "(555) 000-1505",
                3, 24, 6_500_000m, 6_100_000m),

            ("I-80 / Madison Ave Interchange Improvements", "DEMO-PRJ-2025-016",
                "Interchange reconstruction: new bridge, ramp widening, signal upgrades, sound walls.",
                ProjectStatus.Completed, ProjectType.Infrastructure,
                "I-80 at Madison Avenue", "Sacramento", "CA", "95841",
                "California Department of Transportation", "Demo Contact 23", "contact23@example.com", "(916) 555-0518",
                -20, -4, 1_900_000m, 1_800_000m),

            ("Davis Senior Living Community", "DEMO-PRJ-2026-017",
                "128-unit senior living: independent, assisted, memory care. Common areas, dining, medical office.",
                ProjectStatus.Active, ProjectType.Residential,
                "3200 Covell Blvd", "Davis", "CA", "95616",
                "Summit Senior Communities", "Laura Chen", "lchen@sunrisesenior.example", "(555) 000-1702",
                -8, 12, 3_800_000m, 3_500_000m),

            ("Woodland Water Treatment Plant Upgrade", "DEMO-PRJ-2026-018",
                "Treatment plant upgrade from 8 MGD to 14 MGD. New clarifiers, filter gallery, chemical feed.",
                ProjectStatus.Active, ProjectType.Infrastructure,
                "1500 E Gibson Road", "Woodland", "CA", "95776",
                "City of Woodland", "Robert Huang", "rhuang@cityofwoodland.example", "(555) 000-1803",
                -9, 8, 2_100_000m, 1_950_000m),
        };

        foreach (var d in defs)
        {
            var project = new Project
            {
                Name = d.Name,
                Number = d.Number,
                Description = d.Desc,
                Status = d.Status,
                Type = d.Type,
                Address = d.Addr,
                City = d.City,
                State = d.St,
                ZipCode = d.Zip,
                ClientName = d.Client,
                ClientContact = d.Contact,
                ClientEmail = d.Email,
                ClientPhone = d.Phone,
                StartDate = now.AddMonths(d.StartMo),
                EstimatedCompletionDate = now.AddMonths(d.EndMo),
                ActualCompletionDate = d.Status == ProjectStatus.Completed ? now.AddMonths(d.EndMo) : null,
                ContractAmount = d.Contract,
                OriginalBudget = d.Budget,
                Phases = GeneratePhases(d.Type, d.StartMo, d.EndMo, d.Budget,
                    d.Status == ProjectStatus.Completed)
            };
            projects.Add(project);
        }

        return projects;
    }

    private static List<Phase> GeneratePhases(ProjectType type, int startMo, int endMo,
        decimal budget, bool completed)
    {
        var now = DateTime.UtcNow;
        var totalMonths = endMo - startMo;
        var random = new Random(startMo * 7 + (int)type); // Deterministic per project

        // Phase templates by project type
        var phaseTemplates = type switch
        {
            ProjectType.Industrial => new[]
            {
                ("Site Prep & Foundations", "02-100", 0.20m),
                ("Structure & Shell", "05-100", 0.35m),
                ("MEP & Fire Protection", "15-100", 0.20m),
                ("Interior & Equipment", "09-100", 0.15m),
                ("Paving & Closeout", "01-500", 0.10m),
            },
            ProjectType.Infrastructure => new[]
            {
                ("Mobilization & Traffic Control", "01-100", 0.10m),
                ("Earthwork & Utilities", "02-100", 0.25m),
                ("Structural Work", "03-100", 0.35m),
                ("Finishing & Restoration", "09-100", 0.20m),
                ("Closeout & Demobilization", "01-500", 0.10m),
            },
            ProjectType.Residential => new[]
            {
                ("Site & Infrastructure", "02-100", 0.15m),
                ("Foundations", "03-100", 0.15m),
                ("Framing & Roofing", "06-100", 0.25m),
                ("MEP Systems", "15-100", 0.20m),
                ("Finishes & Landscaping", "09-100", 0.25m),
            },
            ProjectType.Renovation => new[]
            {
                ("Selective Demolition", "02-400", 0.15m),
                ("Structural Modifications", "03-100", 0.20m),
                ("MEP Replacement", "15-100", 0.30m),
                ("Interior Finishes", "09-100", 0.25m),
                ("Closeout", "01-500", 0.10m),
            },
            _ => new[] // Commercial
            {
                ("Site Work & Excavation", "02-100", 0.15m),
                ("Foundation & Structure", "03-100", 0.25m),
                ("Building Envelope", "07-100", 0.15m),
                ("MEP Rough-In", "15-100", 0.20m),
                ("Interior Finish", "09-100", 0.15m),
                ("Punchlist & Closeout", "01-500", 0.10m),
            }
        };

        var phases = new List<Phase>();
        var phaseDuration = totalMonths / phaseTemplates.Length;
        var currentStart = startMo;

        for (int i = 0; i < phaseTemplates.Length; i++)
        {
            var (name, costCode, pct) = phaseTemplates[i];
            var phaseEnd = i == phaseTemplates.Length - 1 ? endMo : currentStart + phaseDuration;
            var phaseBudget = Math.Round(budget * pct, 2);

            // Determine phase status and progress based on timeline
            var monthsFromNow = currentStart; // negative = started
            PhaseStatus status;
            decimal percentComplete;
            decimal actualCost;

            if (completed)
            {
                status = PhaseStatus.Completed;
                percentComplete = 100m;
                actualCost = phaseBudget * (0.95m + (decimal)random.NextDouble() * 0.10m);
            }
            else if (phaseEnd < 0) // Phase should be done by now
            {
                status = PhaseStatus.Completed;
                percentComplete = 100m;
                actualCost = phaseBudget * (0.95m + (decimal)random.NextDouble() * 0.10m);
            }
            else if (monthsFromNow < 0 && phaseEnd >= 0) // In progress
            {
                status = PhaseStatus.InProgress;
                var elapsed = (decimal)(-monthsFromNow);
                var total = (decimal)(phaseEnd - monthsFromNow);
                percentComplete = Math.Round(Math.Min(95m, elapsed / total * 100m), 0);
                actualCost = phaseBudget * (percentComplete / 100m) *
                             (0.98m + (decimal)random.NextDouble() * 0.04m);
            }
            else // Future
            {
                status = PhaseStatus.NotStarted;
                percentComplete = 0m;
                actualCost = 0m;
            }

            phases.Add(new Phase
            {
                Name = name,
                CostCode = costCode,
                SortOrder = i + 1,
                BudgetAmount = phaseBudget,
                ActualCost = Math.Round(actualCost, 2),
                StartDate = now.AddMonths(currentStart),
                EndDate = now.AddMonths(phaseEnd),
                PercentComplete = percentComplete,
                Status = status
            });

            currentStart = phaseEnd;
        }

        return phases;
    }

    private static List<Employee> CreateAdditionalEmployees()
    {
        var employees = new List<Employee>();
        var random = new Random(99); // Fixed seed

        // First names pool (diverse)
        var firstNames = new[]
        {
            "Jose", "Maria", "Wei", "Fatima", "Andrei", "Yuki", "Raj", "Ana",
            "Mohammed", "Lisa", "Dmitri", "Sophia", "Jorge", "Mei", "Hassan",
            "Elena", "Marco", "Aisha", "Liam", "Rosa", "Ivan", "Carmen",
            "Jamal", "Sakura", "Diego", "Priya", "Viktor", "Lucia", "Andre",
            "Hana", "Gabriel", "Noemi", "Alexander", "Fatou", "Rafael", "Yuna",
            "Nikolai", "Isabella", "Kofi", "Amara", "Darius", "Chiara", "Tariq",
            "Valentina", "Kwame", "Ingrid", "Pedro", "Lina", "Santos", "Bianca",
            "Eduardo", "Julia", "Abdul", "Natalia", "Francisco", "Olga", "Emilio",
            "Teresa", "Raymond", "Christine", "Vincent", "Patricia", "Nathan",
            "Veronica", "Brandon", "Angela", "Adrian", "Denise", "Frank",
            "Monique", "Gerald", "Diane", "Howard", "Sandra", "Dennis",
            "Michelle", "Roger", "Janet", "Wayne", "Carol", "Keith",
            "Sharon", "Bruce", "Donna", "Philip", "Barbara", "Alan",
            "Cynthia", "Jesse", "Tamara", "Ruben", "Kelly", "Oscar",
            "Tiffany", "Sergio", "Rebecca", "Alfredo", "Heather", "Lorenzo",
            "Stephanie", "Ernesto", "Crystal", "Ricardo", "Amy", "Hector",
            "Deborah", "Alejandro", "Monica", "Enrique", "Brenda",
            "Gustavo", "Nicole", "Fernando", "Pamela", "Martin", "Diana",
            "Roberto", "Lauren", "Arturo", "Karen", "Manuel", "Megan",
            "Cesar", "Jacqueline", "Alberto", "Victoria", "Raul", "Samantha",
            "Luis", "Jennifer", "Armando", "Elizabeth", "Ignacio", "Tanya",
            "Gilberto", "Renee", "Julio", "Lorraine", "Salvador", "Bridget",
            "Javier", "Marie", "Pablo", "Lydia", "Orlando", "Christina",
            "Gerardo", "Catherine", "Ramiro", "Gloria", "Miguel", "Irene",
            "Isidro", "Colleen", "Freddy", "Pauline", "Trinidad", "Sonia",
            "Rogelio", "Theresa", "Esteban", "Yvonne"
        };

        var lastNames = new[]
        {
            "Gonzalez", "Kim", "Patel", "Nguyen", "Singh", "Liu", "Santos",
            "Morales", "Park", "Ahmed", "Reyes", "Chen", "Fernandez", "Ali",
            "Torres", "Yamamoto", "Cruz", "Nakamura", "Diaz", "Tanaka",
            "Rivera", "Wong", "Castro", "Huang", "Flores", "Gupta", "Mendoza",
            "Chang", "Gutierrez", "Sharma", "Ortiz", "Suzuki", "Ruiz", "Lee",
            "Vargas", "Zhao", "Herrera", "Sato", "Alvarez", "Takahashi",
            "Sanchez", "Watanabe", "Romero", "Kobayashi", "Perez", "Ito",
            "Delgado", "Wang", "Vasquez", "Zhang", "Aguilar", "Li",
            "Murphy", "Brown", "Wilson", "Taylor", "Moore", "Jackson",
            "White", "Harris", "Martin", "Robinson", "Clark", "Lewis",
            "Walker", "Young", "Allen", "King", "Wright", "Scott",
            "Green", "Baker", "Adams", "Nelson", "Hill", "Campbell",
            "Mitchell", "Roberts", "Carter", "Phillips", "Evans", "Turner",
            "Parker", "Collins", "Edwards", "Stewart", "Morris", "Reed",
            "Cook", "Morgan", "Bell", "Bailey", "Cooper", "Richardson"
        };

        // Role definitions: (Title, Classification, MinRate, MaxRate, Count)
        var roles = new (string Title, EmployeeClassification Class, decimal MinRate, decimal MaxRate, int Count)[]
        {
            // Management — 12 more
            ("Project Manager", EmployeeClassification.Salaried, 68m, 85m, 4),
            ("Project Engineer", EmployeeClassification.Salaried, 48m, 62m, 4),
            ("Estimator", EmployeeClassification.Salaried, 52m, 65m, 2),
            ("Project Coordinator", EmployeeClassification.Salaried, 38m, 48m, 2),

            // Supervision — 18 more
            ("Site Superintendent", EmployeeClassification.Supervisor, 50m, 65m, 6),
            ("Concrete Foreman", EmployeeClassification.Supervisor, 45m, 55m, 3),
            ("Carpentry Foreman", EmployeeClassification.Supervisor, 44m, 52m, 3),
            ("Steel Foreman", EmployeeClassification.Supervisor, 46m, 56m, 2),
            ("MEP Foreman", EmployeeClassification.Supervisor, 48m, 58m, 2),
            ("Safety Officer", EmployeeClassification.Supervisor, 45m, 55m, 2),

            // Skilled trades — 110
            ("Journeyman Carpenter", EmployeeClassification.Hourly, 38m, 48m, 18),
            ("Journeyman Electrician", EmployeeClassification.Hourly, 42m, 52m, 12),
            ("Journeyman Plumber", EmployeeClassification.Hourly, 38m, 48m, 8),
            ("Ironworker", EmployeeClassification.Hourly, 42m, 52m, 10),
            ("Equipment Operator", EmployeeClassification.Hourly, 36m, 46m, 14),
            ("Concrete Finisher", EmployeeClassification.Hourly, 34m, 42m, 12),
            ("Pipefitter", EmployeeClassification.Hourly, 40m, 50m, 6),
            ("Sheet Metal Worker", EmployeeClassification.Hourly, 40m, 48m, 6),
            ("Painter", EmployeeClassification.Hourly, 32m, 40m, 8),
            ("Tile Setter", EmployeeClassification.Hourly, 34m, 42m, 4),
            ("Welder", EmployeeClassification.Hourly, 42m, 52m, 6),
            ("Crane Operator", EmployeeClassification.Hourly, 48m, 62m, 6),

            // Laborers — 25
            ("Laborer", EmployeeClassification.Hourly, 24m, 32m, 25),

            // Apprentices — 15
            ("Carpenter Apprentice", EmployeeClassification.Apprentice, 20m, 28m, 5),
            ("Electrician Apprentice", EmployeeClassification.Apprentice, 22m, 30m, 4),
            ("Plumber Apprentice", EmployeeClassification.Apprentice, 20m, 28m, 3),
            ("Ironworker Apprentice", EmployeeClassification.Apprentice, 20m, 28m, 3),
        };

        int empNum = 21; // Start after DEMO-020
        int nameIdx = 0;

        foreach (var role in roles)
        {
            for (int i = 0; i < role.Count; i++)
            {
                var firstName = firstNames[nameIdx % firstNames.Length];
                var lastName = lastNames[nameIdx % lastNames.Length];
                // Avoid same first+last by offsetting
                if (nameIdx >= lastNames.Length)
                    // Structural sanitization: generic Demo names + fake phone

                var rate = Math.Round(role.MinRate + (decimal)random.NextDouble() * (role.MaxRate - role.MinRate), 2);
                var hireYear = 2018 + random.Next(0, 7); // 2018-2024
                var hireMonth = random.Next(1, 13);
                var hireDay = random.Next(1, 28);

                // ~5% inactive
                var isActive = random.Next(100) >= 5;

                employees.Add(new Employee
                {
                    EmployeeNumber = $"DEMO-{empNum:D3}",
                    FirstName = firstName,
                    LastName = lastName,
                    Email = $"{firstName[..1].ToLower()}{lastName.ToLower()}@demo.example",
                    Email = $"demo.employee{empNum}@demo.example",
                    Title = role.Title,
                    Classification = role.Class,
                    BaseHourlyRate = rate,
                    HireDate = new DateOnly(hireYear, hireMonth, hireDay),
                    IsActive = isActive,
                    TerminationDate = isActive ? null : new DateOnly(2025, random.Next(6, 13), random.Next(1, 28))
                });

                empNum++;
                nameIdx++;
            }
        }

        return employees;
    }

    private static List<Customer> CreateAdditionalCustomers()
    {
        return
        [
            new() { Name = "Sacramento County Airport System", Code = "CUST-006", ContactName = "Brian Whitfield", ContactEmail = "bwhitfield@sacairport.example", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Folsom Gateway Partners LLC", Code = "CUST-007", ContactName = "Rachel Ito", ContactEmail = "rito@folsomgateway.example", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "City of Elk Grove", Code = "CUST-008", ContactName = "Tom Nakamura", ContactEmail = "tnakamura@elkgrovecity.example", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Western Digital Realty Trust", Code = "CUST-009", ContactName = "Samantha Cho", ContactEmail = "scho@wdrt.example", PaymentTerms = "Net 45", IsActive = true },
            new() { Name = "Central Valley Flood Protection Board", Code = "CUST-010", ContactName = "Daniel Herrera", ContactEmail = "dherrera@cvfpb.ca.gov", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Summit County Airport System", Code = "CUST-006", ContactName = "Demo Contact 06", ContactEmail = "contact06@example.com", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Summit Health Lodi Memorial", Code = "CUST-012", ContactName = "Demo Contact", ContactEmail = "pdunn@adventisthealth.org", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Summit Logistics Western", Code = "CUST-013", ContactName = "Demo Contact", ContactEmail = "kpark@prologis.com", PaymentTerms = "Net 45", IsActive = true },
            new() { Name = "Westfield Roseville LLC", Code = "CUST-014", ContactName = "Janet Collins", ContactEmail = "jcollins@westfield.example", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "California State University Sacramento", Code = "CUST-015", ContactName = "Mark Orozco", ContactEmail = "morozco@csus.example", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "Summit Senior Communities", Code = "CUST-016", ContactName = "Laura Chen", ContactEmail = "lchen@sunrisesenior.example", PaymentTerms = "Net 30", IsActive = true },
            new() { Name = "City of Woodland", Code = "CUST-017", ContactName = "Robert Huang", ContactEmail = "rhuang@cityofwoodland.example", PaymentTerms = "Net 30", IsActive = true },
        ];
    }

    private static List<Vendor> CreateAdditionalVendors()
    {
        var vendors = new List<Vendor>();
        var trades = new (string Name, string Code, string Trade, string Contact, string Email)[]
        {
            ("Summit Steel Fabricators", "VEND-011", "Structural Steel", "Pete Romano", "promano@summitsteel.example"),
            ("Summit Concrete Pumping", "VEND-012", "Concrete", "Ed Lozano", "elozano@valleypump.com"),
            ("Acme Roofing Systems", "VEND-013", "Roofing", "Sam Whitley", "swhitley@acmeroofing.example"),
            ("Summit Glass & Glazing", "VEND-014", "Glazing", "Demo Contact V02", "npark@tricountyglass.example"),
            ("Summit Elevator Co.", "VEND-015", "Elevator", "Chris Romano", "cromano@goldeneagleelevator.example"),
            ("Summit Painting Contractors", "VEND-016", "Painting", "Linda Tran", "ltran@capitolpainting.example"),
            ("Summit Flooring Solutions", "VEND-017", "Flooring", "Mark Stein", "mstein@sierraflooring.example"),
            ("Summit Roofing Systems", "VEND-013", "Roofing", "Sam Whitley", "swhitley@summitroofing.example"),
            ("Summit Coast Landscaping", "VEND-019", "Landscaping", "Demo Contact", "rgutierrez@summitcoast.example"),
            ("Summit Door & Hardware", "VEND-020", "Doors & Hardware", "Tim O'Brien", "tobrien@premierdoor.example"),
            ("Summit Door & Hardware", "VEND-020", "Doors & Hardware", "Tim O'Brien", "tobrien@summitdoor.example"),
            ("Summit Valley Masonry", "VEND-022", "Masonry", "Frank Herrera", "fherrera@cvmasonry.com"),
            ("Advantage Waterproofing", "VEND-023", "Waterproofing", "Jill Sandoval", "jsandoval@advantagewp.example"),
            ("Delta Crane Services", "VEND-024", "Crane Rental", "Mike Petrov", "mpetrov@deltacrane.example"),
            ("ProTech Fire Alarm Systems", "VEND-025", "Fire Alarm", "Lisa Park", "lpark@protechfire.example"),
            ("Summit Waterproofing", "VEND-023", "Waterproofing", "Jill Sandoval", "jsandoval@summitwaterproof.example"),
            ("Summit Tile & Stone", "VEND-027", "Tile", "Anna Moreno", "amoreno@valleytile.com"),
            ("Summit Electric Supply", "VEND-028", "Electrical Supply", "Steve Hamilton", "shamilton@allphase.example"),
            ("Summit Plumbing Supply", "VEND-029", "Plumbing Supply", "Karen Fong", "kfong@westernplumbing.example"),
            ("Summit Electric Supply", "VEND-028", "Electrical Supply", "Steve Hamilton", "shamilton@summitelecsupply.example"),
            ("Summit Mechanical Services", "VEND-031", "Mechanical", "Demo Contact", "rvasquez@summitmech.com"),
            ("Summit Rebar", "VEND-032", "Rebar", "Tony Matsuda", "tmatsuda@summitrebar.example"),
            ("Pacific Precast Concrete", "VEND-033", "Precast", "Diane Foster", "dfoster@summitprecast.example"),
            ("Summit Sheet Metal Works", "VEND-034", "Sheet Metal", "Greg Larson", "glarson@summitsheet.example"),
            ("Valley Demolition Services", "VEND-035", "Demolition", "Juan Estrada", "jestrada@summitdemo.example"),
            ("Summit Testing & Inspection", "VEND-036", "Testing", "Demo Contact", "skim@apextesting.example"),
            ("Summit Electrical Contractors", "VEND-037", "Electrical", "Wayne Bell", "wbell@metroelectric.example"),
            ("Summit Plumbing Co.", "VEND-038", "Plumbing", "Carlos Pena", "cpena@sactownplumbing.example"),
            ("Summit Earthworks", "VEND-039", "Earthwork", "Demo Contact", "dwright@pioneerearth.example"),
            ("Summit HVAC Solutions", "VEND-040", "HVAC", "Demo Contact", "treeves@valleyhvac.example"),
            ("Summit Concrete Cutting", "VEND-041", "Concrete", "Bob Kowalski", "bkowalski@a1concrete.example"),
            ("Summit Testing & Inspection", "VEND-036", "Testing", "Demo Contact", "skim@summittesting.example"),
            ("Summit Paving & Striping", "VEND-043", "Paving", "Demo Contact V01", "psantos@summitpave.example"),
            ("Summit Structural Engineering", "VEND-044", "Engineering", "Nina Chandra", "nchandra@atlaseng.example"),
            ("Summit Hauling & Trucking", "VEND-045", "Trucking", "Dave Kozlov", "dkozlov@reliablehauling.example"),
            ("Summit Valley Drywall", "VEND-046", "Drywall", "Matt Yoon", "myoon@trivalleydrywall.example"),
            ("Summit Ceiling Systems", "VEND-047", "Ceilings", "Jean Mitchell", "jmitchell@capitolceiling.example"),
            ("Summit Millwork", "VEND-048", "Millwork", "Andrew Lim", "alim@precisionmill.example"),
            ("Summit Structural Engineering", "VEND-044", "Engineering", "Nina Chandra", "nchandra@summitstructeng.example"),
            ("Summit Coast Surveying", "VEND-050", "Surveying", "Tom Bradford", "tbradford@summitsurvey.example"),
        };

        foreach (var t in trades)
        {
            vendors.Add(new Vendor
            {
                Name = t.Name,
                Code = t.Code,
                ContactName = t.Contact,
                ContactEmail = t.Email,
                TradeClassification = t.Trade,
                PaymentTerms = "Net 30",
                W9OnFile = true,
                IsActive = true
            });
        }

        return vendors;
    }

    // ===========================================================================================
    // Financial entity generators — Owner Contracts, Billing, WIP, Retention, Payroll
    // ===========================================================================================

    private static List<OwnerContract> CreateOwnerContracts(
        List<Project> projects, List<Customer> customers)
    {
        var contracts = new List<OwnerContract>();

        foreach (var project in projects)
        {
            var customer = customers.FirstOrDefault(c =>
                c.Name.Equals(project.ClientName, StringComparison.OrdinalIgnoreCase))
                ?? customers[0];

            contracts.Add(new OwnerContract
            {
                ProjectId = project.Id,
                ContractNumber = $"OC-{project.Number}",
                ProjectName = project.Name,
                OwnerName = customer.Name,
                OriginalContractSum = project.ContractAmount,
                ApprovedChangeOrderAmount = project.ContractAmount * 0.02m, // ~2% CO
                ContractSumToDate = project.ContractAmount * 1.02m,
                DefaultRetainagePercent = 10m,
                RetainagePercentMaterials = 10m,
                PaymentTermsDays = 30,
                Status = project.Status == ProjectStatus.Completed
                    ? OwnerContractStatus.Closed
                    : OwnerContractStatus.Active,
                ContractDate = project.StartDate.HasValue
                    ? DateOnly.FromDateTime(project.StartDate.Value.AddDays(-30))
                    : DateOnly.FromDateTime(DateTime.UtcNow),
            });
        }

        return contracts;
    }

    private static List<OwnerScheduleOfValues> CreateOwnerScheduleOfValues(
        List<OwnerContract> contracts)
    {
        var sovs = new List<OwnerScheduleOfValues>();

        foreach (var contract in contracts)
        {
            sovs.Add(new OwnerScheduleOfValues
            {
                ProjectId = contract.ProjectId,
                OwnerContractId = contract.Id,
                Name = "Main SOV",
                OriginalContractAmount = contract.OriginalContractSum,
                ApprovedChangeOrderAmount = contract.ApprovedChangeOrderAmount,
                RevisedContractAmount = contract.ContractSumToDate,
                TotalScheduledValue = contract.ContractSumToDate,
                DefaultRetainagePercent = 10m,
                Status = contract.Status == OwnerContractStatus.Closed
                    ? OwnerSOVStatus.Closed
                    : OwnerSOVStatus.Active,
            });
        }

        return sovs;
    }

    private static List<BillingApplication> CreateBillingApplications(
        List<OwnerContract> contracts, List<OwnerScheduleOfValues> sovs)
    {
        var apps = new List<BillingApplication>();
        var random = new Random(55);

        foreach (var contract in contracts.Where(c => c.Status != OwnerContractStatus.Void))
        {
            var sov = sovs.FirstOrDefault(s => s.OwnerContractId == contract.Id);
            if (sov == null) continue;

            var contractSum = contract.ContractSumToDate;
            var retPct = contract.DefaultRetainagePercent;

            // Determine how many months of billing based on contract start
            var contractDate = contract.ContractDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-6));
            var now = DateOnly.FromDateTime(DateTime.UtcNow);
            var monthsElapsed = Math.Max(0,
                (now.Year - contractDate.Year) * 12 + now.Month - contractDate.Month - 1);

            if (monthsElapsed == 0) continue;

            var appCount = Math.Min(monthsElapsed, contract.Status == OwnerContractStatus.Closed ? monthsElapsed : monthsElapsed);
            var totalBilled = 0m;

            for (int i = 1; i <= appCount; i++)
            {
                var periodEnd = contractDate.AddMonths(i);
                var isLast = i == appCount;

                // Progressive billing — roughly even with some variation
                decimal progressThisPeriod;
                if (contract.Status == OwnerContractStatus.Closed)
                {
                    progressThisPeriod = contractSum / appCount;
                }
                else
                {
                    var baseProgress = contractSum / (appCount + 3); // Leave room for future billing
                    progressThisPeriod = baseProgress * (0.8m + (decimal)random.NextDouble() * 0.4m);
                }

                progressThisPeriod = Math.Round(progressThisPeriod, 2);
                totalBilled += progressThisPeriod;

                // Don't over-bill
                if (totalBilled > contractSum * 0.95m && contract.Status != OwnerContractStatus.Closed)
                {
                    totalBilled -= progressThisPeriod;
                    break;
                }

                var retOnWork = Math.Round(totalBilled * (retPct / 100m), 2);
                var earnedLessRet = Math.Round(totalBilled - retOnWork, 2);

                // Determine status — older ones are paid, recent ones are in various stages
                BillingApplicationStatus status;
                var monthsAgo = (now.Year - periodEnd.Year) * 12 + now.Month - periodEnd.Month;

                if (contract.Status == OwnerContractStatus.Closed)
                    status = BillingApplicationStatus.Paid;
                else if (monthsAgo > 3)
                    status = BillingApplicationStatus.Paid;
                else if (monthsAgo == 3)
                    status = BillingApplicationStatus.Paid;
                else if (monthsAgo == 2)
                    status = random.Next(100) < 80
                        ? BillingApplicationStatus.Paid
                        : BillingApplicationStatus.PaymentDue;
                else if (monthsAgo == 1)
                    status = random.Next(100) < 40
                        ? BillingApplicationStatus.PaymentDue
                        : BillingApplicationStatus.ArchitectCertified;
                else
                    status = random.Next(100) < 50
                        ? BillingApplicationStatus.SubmittedToOwner
                        : BillingApplicationStatus.PmReview;

                var currentPaymentDue = Math.Round(progressThisPeriod * (1 - retPct / 100m), 2);
                var previousCerts = Math.Round(Math.Max(0, earnedLessRet - currentPaymentDue), 2);
                var balanceToFinish = Math.Round(contractSum - totalBilled + retOnWork, 2);

                apps.Add(new BillingApplication
                {
                    ProjectId = contract.ProjectId,
                    OwnerContractId = contract.Id,
                    OwnerScheduleOfValuesId = sov.Id,
                    ApplicationNumber = i,
                    PeriodFrom = periodEnd.AddMonths(-1).AddDays(1),
                    PeriodThrough = periodEnd,
                    ApplicationDate = periodEnd.AddDays(5),
                    OriginalContractSum = Math.Round(contract.OriginalContractSum, 2),
                    NetChangeByChangeOrders = Math.Round(contract.ApprovedChangeOrderAmount, 2),
                    ContractSumToDate = Math.Round(contractSum, 2),
                    TotalCompletedAndStoredToDate = Math.Round(totalBilled, 2),
                    RetainageOnCompletedWork = retOnWork,
                    RetainageOnStoredMaterials = 0m,
                    TotalRetainage = retOnWork,
                    RetainagePercentWork = Math.Round(retPct, 2),
                    RetainagePercentMaterials = Math.Round(retPct, 2),
                    TotalEarnedLessRetainage = earnedLessRet,
                    LessPreviousCertificates = previousCerts,
                    CurrentPaymentDue = currentPaymentDue,
                    BalanceToFinishIncludingRetainage = balanceToFinish,
                    Status = status,
                });
            }
        }

        return apps;
    }

    private static List<WipReport> CreateWipReports(List<Project> projects)
    {
        var reports = new List<WipReport>();
        var now = DateOnly.FromDateTime(DateTime.UtcNow);

        // Generate 6 monthly WIP reports
        for (int monthOffset = -5; monthOffset <= 0; monthOffset++)
        {
            var reportDate = new DateOnly(now.Year, now.Month, 1).AddMonths(monthOffset);
            var report = new WipReport
            {
                ReportDate = reportDate,
                FiscalYear = reportDate.Year,
                PeriodNumber = reportDate.Month,
                Status = monthOffset < 0 ? WipReportStatus.Final : WipReportStatus.Draft,
                GeneratedById = "system-seed",
                Lines = []
            };

            var random = new Random(monthOffset + 100);

            foreach (var project in projects.Where(p =>
                p.Status is ProjectStatus.Active or ProjectStatus.Completed))
            {
                // Calculate WIP values based on project progress at that point in time
                var contractAmt = project.ContractAmount;
                var changeOrders = contractAmt * 0.02m;
                var revisedContract = contractAmt + changeOrders;

                // Simulate progressive completion
                var monthsFromProjectStart = project.StartDate.HasValue
                    ? (reportDate.Year - project.StartDate.Value.Year) * 12 +
                      reportDate.Month - project.StartDate.Value.Month
                    : 0;

                var totalProjectMonths = project.StartDate.HasValue && project.EstimatedCompletionDate.HasValue
                    ? Math.Max(1, (project.EstimatedCompletionDate.Value.Year - project.StartDate.Value.Year) * 12 +
                                  project.EstimatedCompletionDate.Value.Month - project.StartDate.Value.Month)
                    : 12;

                var pctComplete = Math.Clamp(
                    (decimal)monthsFromProjectStart / totalProjectMonths * 100m, 0m, 100m);

                if (project.Status == ProjectStatus.Completed)
                    pctComplete = 100m;

                var estimatedTotalCost = revisedContract * 0.92m; // Target ~8% margin
                var costToDate = estimatedTotalCost * (pctComplete / 100m);
                var earnedRevenue = revisedContract * (pctComplete / 100m);
                var billedToDate = earnedRevenue * (0.95m + (decimal)random.NextDouble() * 0.10m);

                // PercentComplete column is numeric(8,6) — max 99.999999.
                // Clamp to 99.999999 to prevent overflow for 100% complete projects.
                var clampedPct = Math.Min(pctComplete, 99.999999m);

                report.Lines.Add(new WipReportLine
                {
                    ProjectId = project.Id,
                    ContractAmount = Math.Round(contractAmt, 2),
                    ApprovedChangeOrders = Math.Round(changeOrders, 2),
                    RevisedContractAmount = Math.Round(revisedContract, 2),
                    TotalCostToDate = Math.Round(costToDate, 2),
                    EstimatedCostToComplete = Math.Round(Math.Max(0, estimatedTotalCost - costToDate), 2),
                    EstimatedTotalCost = Math.Round(estimatedTotalCost, 2),
                    PercentComplete = Math.Round(clampedPct, 6),
                    EarnedRevenue = Math.Round(earnedRevenue, 2),
                    BilledToDate = Math.Round(billedToDate, 2),
                    OverUnderBilling = Math.Round(earnedRevenue - billedToDate, 2),
                });
            }

            reports.Add(report);
        }

        return reports;
    }

    private static List<RetentionHold> CreateRetentionHolds(
        List<Project> projects, List<Subcontract> subcontracts)
    {
        var holds = new List<RetentionHold>();

        foreach (var sub in subcontracts.Where(s =>
            s.Status is SubcontractStatus.InProgress or SubcontractStatus.Complete or SubcontractStatus.ClosedOut))
        {
            var retPct = sub.RetainagePercent;
            var retainedAmt = sub.BilledToDate * (retPct / 100m);
            var releasedAmt = sub.Status == SubcontractStatus.ClosedOut ? retainedAmt : 0m;

            var status = sub.Status == SubcontractStatus.ClosedOut
                ? RetentionHoldStatus.Released
                : retainedAmt > 0
                    ? RetentionHoldStatus.Held
                    : RetentionHoldStatus.Held;

            holds.Add(new RetentionHold
            {
                ProjectId = sub.ProjectId,
                ContractId = sub.Id,
                OriginalAmount = sub.CurrentValue,
                RetainedAmount = Math.Round(retainedAmt, 2),
                ReleasedAmount = Math.Round(releasedAmt, 2),
                RetainagePercent = retPct,
                Status = status,
                EffectiveDate = sub.ExecutionDate.HasValue
                    ? DateOnly.FromDateTime(sub.ExecutionDate.Value)
                    : DateOnly.FromDateTime(DateTime.UtcNow),
                Description = $"Retention for {sub.SubcontractorName} - {sub.ScopeOfWork?[..Math.Min(50, sub.ScopeOfWork?.Length ?? 0)]}"
            });
        }

        return holds;
    }

    private static List<PayPeriod> CreatePayPeriods()
    {
        var periods = new List<PayPeriod>();
        var now = DateOnly.FromDateTime(DateTime.UtcNow);

        // Create 12 bi-weekly pay periods (6 months back)
        for (int i = 11; i >= 0; i--)
        {
            var endDate = now.AddDays(-(i * 14));
            var startDate = endDate.AddDays(-13);

            var status = i switch
            {
                0 => PayPeriodStatus.Open,
                1 => PayPeriodStatus.Locked,
                _ => PayPeriodStatus.Closed
            };

            periods.Add(new PayPeriod
            {
                StartDate = startDate,
                EndDate = endDate,
                Name = $"PP {startDate:MMM dd} - {endDate:MMM dd, yyyy}",
                Status = status,
                LockedAt = status != PayPeriodStatus.Open
                    ? DateTime.UtcNow.AddDays(-(i * 14) + 2)
                    : null,
            });
        }

        return periods;
    }

    private static List<PayrollRun> CreatePayrollRuns(
        List<PayPeriod> payPeriods, List<Employee> employees)
    {
        var runs = new List<PayrollRun>();
        var random = new Random(33);

        var activeHourly = employees.Where(e =>
            e.IsActive && e.Classification is EmployeeClassification.Hourly
                or EmployeeClassification.Apprentice
                or EmployeeClassification.Supervisor).ToList();

        foreach (var period in payPeriods.Where(p => p.Status == PayPeriodStatus.Closed))
        {
            var lines = new List<PayrollRunLine>();
            var totalGross = 0m;
            var totalNet = 0m;

            foreach (var emp in activeHourly)
            {
                // Not everyone works every period (85% chance)
                if (random.Next(100) > 85) continue;

                var regHours = 80m; // 2 weeks × 40 hrs
                var otHours = random.Next(100) < 40 ? random.Next(2, 16) : 0;
                var dtHours = random.Next(100) < 10 ? random.Next(2, 8) : 0;

                var regPay = regHours * emp.BaseHourlyRate;
                var otPay = otHours * emp.BaseHourlyRate * 1.5m;
                var dtPay = dtHours * emp.BaseHourlyRate * 2.0m;
                var gross = regPay + otPay + dtPay;

                lines.Add(new PayrollRunLine
                {
                    EmployeeId = emp.Id,
                    RegularHours = regHours,
                    OvertimeHours = otHours,
                    DoubletimeHours = dtHours,
                    RegularPay = Math.Round(regPay, 2),
                    OvertimePay = Math.Round(otPay, 2),
                    DoubletimePay = Math.Round(dtPay, 2),
                    GrossPay = Math.Round(gross, 2),
                });

                totalGross += gross;
                totalNet += gross * 0.72m; // ~28% deductions
            }

            runs.Add(new PayrollRun
            {
                RunDate = period.EndDate.AddDays(3),
                PayPeriodId = period.Id,
                Status = PayrollRunStatus.Approved,
                TotalGross = Math.Round(totalGross, 2),
                TotalNet = Math.Round(totalNet, 2),
                EmployeeCount = lines.Count,
                Lines = lines,
            });
        }

        return runs;
    }

    // ===========================================================================================
    // Project Management entities — Submittals and Punch List Items
    // ===========================================================================================

    private static List<PmSubmittal> CreateSubmittals(List<Project> projects)
    {
        var submittals = new List<PmSubmittal>();
        var random = new Random(44);

        var submittalTemplates = new (string Title, SubmittalType Type, string SpecSection)[]
        {
            ("Structural Steel Shop Drawings", SubmittalType.ShopDrawing, "05 12 00"),
            ("Concrete Mix Design", SubmittalType.ProductData, "03 30 00"),
            ("HVAC Equipment Submittals", SubmittalType.ProductData, "23 00 00"),
            ("Electrical Panel Schedules", SubmittalType.ShopDrawing, "26 24 00"),
            ("Plumbing Fixtures", SubmittalType.ProductData, "22 40 00"),
            ("Fire Sprinkler Shop Drawings", SubmittalType.ShopDrawing, "21 13 00"),
            ("Roofing System", SubmittalType.ProductData, "07 50 00"),
            ("Curtain Wall System", SubmittalType.ShopDrawing, "08 44 00"),
            ("Flooring Materials", SubmittalType.Sample, "09 65 00"),
            ("Paint Colors", SubmittalType.Sample, "09 91 00"),
            ("Door Hardware Schedule", SubmittalType.ProductData, "08 71 00"),
            ("Elevator Equipment", SubmittalType.ShopDrawing, "14 20 00"),
            ("Waterproofing System", SubmittalType.ProductData, "07 10 00"),
            ("Acoustic Ceiling Tiles", SubmittalType.Sample, "09 51 00"),
            ("Landscaping Plan", SubmittalType.ProductData, "32 90 00"),
        };

        foreach (var project in projects.Where(p =>
            p.Status is ProjectStatus.Active or ProjectStatus.Completed))
        {
            var count = random.Next(6, 12);
            for (int i = 0; i < count && i < submittalTemplates.Length; i++)
            {
                var template = submittalTemplates[i];

                // Status based on project progress
                SubmittalStatus status;
                if (project.Status == ProjectStatus.Completed)
                    status = SubmittalStatus.Approved;
                else if (i < count / 3)
                    status = random.Next(100) < 80 ? SubmittalStatus.Approved : SubmittalStatus.ApprovedAsNoted;
                else if (i < count * 2 / 3)
                    status = random.Next(3) switch
                    {
                        0 => SubmittalStatus.InReview,
                        1 => SubmittalStatus.Approved,
                        _ => SubmittalStatus.Submitted
                    };
                else
                    status = random.Next(100) < 60 ? SubmittalStatus.Draft : SubmittalStatus.Submitted;

                submittals.Add(new PmSubmittal
                {
                    ProjectId = project.Id,
                    SubmittalNumber = i + 1,
                    Title = template.Title,
                    SubmittalType = template.Type,
                    Status = status,
                    SpecSectionCode = template.SpecSection,
                    IsSubstitutionRequest = random.Next(100) < 10,
                    RevisionNumber = status == SubmittalStatus.ReviseAndResubmit ? 1 : 0,
                    SubmittedDate = status != SubmittalStatus.Draft
                        ? DateTime.UtcNow.AddDays(-random.Next(10, 90))
                        : null,
                    ReturnedDate = status is SubmittalStatus.Approved or SubmittalStatus.ApprovedAsNoted
                        ? DateTime.UtcNow.AddDays(-random.Next(5, 60))
                        : null,
                });
            }
        }

        return submittals;
    }

    private static List<PmPunchListItem> CreatePunchListItems(List<Project> completedProjects, Guid createdByUserId)
    {
        var items = new List<PmPunchListItem>();
        var random = new Random(66);

        var punchTemplates = new (string Desc, string Location, PunchListCategory Cat)[]
        {
            ("Touch-up paint on corridor walls", "Level 2 Corridor", PunchListCategory.Finishes),
            ("Adjust door closer - Suite 201", "Suite 201", PunchListCategory.Architectural),
            ("HVAC balancing incomplete - Zone 3", "Mechanical Room", PunchListCategory.Mechanical),
            ("Missing outlet cover plate", "Level 1 Lobby", PunchListCategory.Electrical),
            ("Cracked floor tile at entry", "Main Entry", PunchListCategory.Finishes),
            ("Fire damper access panel missing", "Level 3 Plenum", PunchListCategory.FireProtection),
            ("Parking lot striping touch-up", "Parking Level B1", PunchListCategory.Sitework),
            ("Emergency light not functioning", "Stairwell B", PunchListCategory.LifeSafety),
            ("Ceiling tile damaged from pipe leak", "Room 305", PunchListCategory.Finishes),
            ("Handrail loose at landing", "Stairwell A", PunchListCategory.Structural),
            ("Plumbing fixture dripping", "Restroom 2F", PunchListCategory.Plumbing),
            ("Thermostat not responding", "Conference Room A", PunchListCategory.Mechanical),
            ("Baseboard scuff marks", "Level 1 Break Room", PunchListCategory.Finishes),
            ("Exit sign not illuminated", "East Wing Exit", PunchListCategory.LifeSafety),
            ("Landscaping dead plant replacement", "North Entrance", PunchListCategory.Sitework),
        };

        foreach (var project in completedProjects)
        {
            var count = random.Next(8, 15);
            for (int i = 0; i < count && i < punchTemplates.Length; i++)
            {
                var template = punchTemplates[i];
                var isClosed = random.Next(100) < 70; // 70% closed on completed projects

                items.Add(new PmPunchListItem
                {
                    ProjectId = project.Id,
                    ItemNumber = i + 1,
                    Location = template.Location,
                    Category = template.Cat,
                    Description = template.Desc,
                    ResponsiblePartyType = random.Next(100) < 60
                        ? PunchListResponsiblePartyType.Subcontractor
                        : PunchListResponsiblePartyType.GeneralContractor,
                    Status = isClosed ? PunchListItemStatus.Closed : PunchListItemStatus.Open,
                    Priority = random.Next(4) switch
                    {
                        0 => TaskPriority.Low,
                        1 => TaskPriority.Normal,
                        2 => TaskPriority.High,
                        _ => TaskPriority.Urgent
                    },
                    CreatedByUserId = createdByUserId,
                    ClosedAt = isClosed ? DateTime.UtcNow.AddDays(-random.Next(5, 30)) : null,
                });
            }
        }

        return items;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 1. SCHEDULES / GANTT — 3 schedules with 15-20 activities each
    // ────────────────────────────────────────────────────────────────────────

    private static (List<PmSchedule>, List<PmScheduleActivity>, List<PmScheduleDependency>) CreateSchedules(
        List<Project> activeProjects)
    {
        var schedules = new List<PmSchedule>();
        var allActivities = new List<PmScheduleActivity>();
        var allDeps = new List<PmScheduleDependency>();
        var now = DateTime.UtcNow;

        foreach (var project in activeProjects.Take(3))
        {
            var schedule = new PmSchedule
            {
                ProjectId = project.Id,
                Name = $"{project.Name} — Master Schedule",
                Description = "Construction master schedule with critical path",
                Status = ScheduleStatus.Active,
                DataDate = now,
                CalendarType = ScheduleCalendarType.Standard5x8,
            };
            schedules.Add(schedule);

            var start = project.StartDate ?? now.AddMonths(-3);
            var activities = CreateScheduleActivities(schedule, project, start);
            allActivities.AddRange(activities);

            var deps = CreateScheduleDependencies(schedule, activities);
            allDeps.AddRange(deps);
        }

        return (schedules, allActivities, allDeps);
    }

    private static List<PmScheduleActivity> CreateScheduleActivities(
        PmSchedule schedule, Project project, DateTime projectStart)
    {
        var now = DateTime.UtcNow;
        var activities = new List<PmScheduleActivity>();
        var order = 1;

        // Phase activities for a typical commercial construction project
        var phases = new[]
        {
            ("1.0", "A1000", "Mobilization & Site Prep",      ScheduleActivityType.Wbs, 0, 21,  true),
            ("1.1", "A1010", "Site Survey & Layout",           ScheduleActivityType.Task, 0, 5,   true),
            ("1.2", "A1020", "Temporary Facilities Setup",     ScheduleActivityType.Task, 3, 8,   true),
            ("1.3", "A1030", "Erosion Control & Grading",      ScheduleActivityType.Task, 5, 15,  true),
            ("2.0", "A2000", "Foundation",                     ScheduleActivityType.Wbs, 21, 45,  true),
            ("2.1", "A2010", "Excavation & Footings",          ScheduleActivityType.Task, 21, 14, true),
            ("2.2", "A2020", "Foundation Walls & Slab",        ScheduleActivityType.Task, 35, 18, true),
            ("2.3", "A2030", "Foundation Waterproofing",       ScheduleActivityType.Task, 49, 7,  false),
            ("3.0", "A3000", "Structure",                      ScheduleActivityType.Wbs, 56, 60,  true),
            ("3.1", "A3010", "Structural Steel Erection",      ScheduleActivityType.Task, 56, 30, true),
            ("3.2", "A3020", "Metal Deck & Concrete Pours",    ScheduleActivityType.Task, 70, 25, true),
            ("3.3", "A3030", "Exterior Framing & Sheathing",   ScheduleActivityType.Task, 86, 20, false),
            ("4.0", "A4000", "MEP Rough-In",                   ScheduleActivityType.Wbs, 100, 50, false),
            ("4.1", "A4010", "Plumbing Rough-In",              ScheduleActivityType.Task, 100, 25, false),
            ("4.2", "A4020", "HVAC Ductwork & Piping",         ScheduleActivityType.Task, 105, 30, false),
            ("4.3", "A4030", "Electrical Rough-In",            ScheduleActivityType.Task, 110, 25, false),
            ("5.0", "A5000", "Interior Finishes",              ScheduleActivityType.Wbs, 150, 55, false),
            ("5.1", "A5010", "Drywall & Framing",              ScheduleActivityType.Task, 150, 20, false),
            ("5.2", "A5020", "Painting & Wall Coverings",      ScheduleActivityType.Task, 170, 15, false),
            ("5.3", "A5030", "Flooring & Tile",                ScheduleActivityType.Task, 175, 15, false),
            ("5.4", "A5040", "Ceiling Systems",                ScheduleActivityType.Task, 180, 10, false),
            ("6.0", "A6000", "Closeout",                       ScheduleActivityType.Wbs, 205, 30, false),
            ("6.1", "A6010", "MEP Trim & Startup",             ScheduleActivityType.Task, 205, 15, false),
            ("6.2", "A6020", "Final Inspections & Punch List", ScheduleActivityType.Task, 215, 10, false),
            ("6.3", "A6030", "Substantial Completion",         ScheduleActivityType.Milestone, 230, 0, false),
        };

        foreach (var (wbs, code, name, actType, dayOffset, duration, isCritical) in phases)
        {
            var plannedStart = projectStart.AddDays(dayOffset);
            var plannedFinish = projectStart.AddDays(dayOffset + duration);
            var daysFromStart = (now - plannedStart).TotalDays;

            ScheduleActivityStatus status;
            decimal pctComplete;
            DateTime? actualStart = null;
            DateTime? actualFinish = null;
            int remaining = duration;

            if (daysFromStart > duration + 5)
            {
                status = ScheduleActivityStatus.Completed;
                pctComplete = 100m;
                actualStart = plannedStart.AddDays(-1);
                actualFinish = plannedFinish.AddDays(2);
                remaining = 0;
            }
            else if (daysFromStart > 0)
            {
                status = ScheduleActivityStatus.InProgress;
                pctComplete = Math.Clamp((decimal)(daysFromStart / duration) * 100m, 5m, 95m);
                pctComplete = Math.Round(pctComplete, 0);
                actualStart = plannedStart;
                remaining = (int)Math.Max(1, duration - daysFromStart);
            }
            else
            {
                status = ScheduleActivityStatus.NotStarted;
                pctComplete = 0m;
            }

            activities.Add(new PmScheduleActivity
            {
                ScheduleId = schedule.Id,
                ProjectId = project.Id,
                WbsCode = wbs,
                ActivityCode = code,
                Name = name,
                ActivityType = actType,
                Status = status,
                OriginalDurationDays = duration,
                RemainingDurationDays = remaining,
                PlannedStart = plannedStart,
                PlannedFinish = plannedFinish,
                EarlyStart = plannedStart,
                EarlyFinish = plannedFinish,
                LateStart = plannedStart.AddDays(3),
                LateFinish = plannedFinish.AddDays(3),
                ActualStart = actualStart,
                ActualFinish = actualFinish,
                TotalFloatDays = isCritical ? 0 : 5,
                FreeFloatDays = isCritical ? 0 : 3,
                PercentComplete = pctComplete,
                IsCritical = isCritical,
                SortOrder = order++,
            });
        }

        return activities;
    }

    private static List<PmScheduleDependency> CreateScheduleDependencies(
        PmSchedule schedule, List<PmScheduleActivity> activities)
    {
        var deps = new List<PmScheduleDependency>();
        var tasks = activities.Where(a => a.ActivityType == ScheduleActivityType.Task).ToList();

        // Create finish-to-start dependencies between sequential tasks
        for (var i = 1; i < tasks.Count; i++)
        {
            // Link each task to the previous one within the same WBS group
            var prev = tasks[i - 1];
            var curr = tasks[i];
            if (prev.WbsCode[..1] == curr.WbsCode[..1]) // Same phase group
            {
                deps.Add(new PmScheduleDependency
                {
                    ScheduleId = schedule.Id,
                    PredecessorActivityId = prev.Id,
                    SuccessorActivityId = curr.Id,
                    DependencyType = ScheduleDependencyType.FS,
                    LagDays = 0,
                });
            }
        }

        // Cross-phase dependencies: Foundation → Structure, Structure → MEP, etc.
        var phaseFirstTasks = tasks
            .GroupBy(t => t.WbsCode[..1])
            .Select(g => (Phase: g.Key, First: g.First(), Last: g.Last()))
            .OrderBy(g => g.Phase)
            .ToList();

        for (var i = 1; i < phaseFirstTasks.Count; i++)
        {
            deps.Add(new PmScheduleDependency
            {
                ScheduleId = schedule.Id,
                PredecessorActivityId = phaseFirstTasks[i - 1].Last.Id,
                SuccessorActivityId = phaseFirstTasks[i].First.Id,
                DependencyType = ScheduleDependencyType.FS,
                LagDays = 2,
            });
        }

        return deps;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. RFIs — 12-15 across active projects
    // ────────────────────────────────────────────────────────────────────────

    private static List<Rfi> CreateRfis(List<Project> activeProjects, Guid seedUserId)
    {
        var now = DateTime.UtcNow;
        var rfis = new List<Rfi>();
        var rfiNumber = 1;

        var rfiTemplates = new[]
        {
            // (Subject, Question, SpecSection, HasCostImpact, Status, Priority, DaysAgo)
            ("Foundation Reinforcement Detail — Grid Line C",
             "Drawing S-102 shows #5 rebar @ 12\" OC for the grade beam at Grid Line C, but the geotechnical report recommends additional reinforcement for the expansive soil conditions. Please clarify the required reinforcement detail.",
             "03 30 00", true, RfiStatus.Open, RfiPriority.High, 3),

            ("HVAC Duct Routing Conflict — 2nd Floor Corridor",
             "The mechanical drawings show a 24\" supply duct running through the 2nd floor corridor at elevation 10'-6\", but the structural drawings show a beam at the same location. Please provide a revised routing or confirm coordination has been resolved.",
             "23 31 00", false, RfiStatus.Open, RfiPriority.Urgent, 1),

            ("Exterior Window Finish — Aluminum vs Bronze Anodized",
             "Spec Section 08 51 13 calls for 'bronze anodized aluminum', but the elevation drawings show 'clear anodized'. Please confirm the intended finish for all exterior windows.",
             "08 51 13", false, RfiStatus.Answered, RfiPriority.Normal, 14),

            ("Fire Sprinkler Head Placement — Server Room",
             "The fire protection drawings do not show pre-action sprinkler coverage for the server room per the owner's requirement. Should we add pre-action heads, or is the clean agent system on the electrical drawings the intended protection?",
             "21 13 13", true, RfiStatus.Open, RfiPriority.High, 7),

            ("Waterproofing Membrane — Below-Grade Walls",
             "Please confirm the waterproofing membrane spec for below-grade foundation walls. Detail 5/S-104 references Carlisle CCW 705, but the spec section 07 11 13 lists Tremco Paraseal. Which product should be used?",
             "07 11 13", false, RfiStatus.Answered, RfiPriority.Normal, 21),

            ("Electrical Panel Schedule Discrepancy — Panel 2A",
             "The panel schedule for Panel 2A on sheet E-301 shows a 200A main breaker, but the single line diagram on sheet E-001 shows 225A. Please clarify the correct rating.",
             "26 24 16", false, RfiStatus.Closed, RfiPriority.Normal, 30),

            ("Accessible Parking Signage Location",
             "Civil drawing C-102 shows ADA signage at the east parking lot entrance, but the architect's site plan A-001 shows it at the north entrance. Please confirm the required location per local code.",
             "10 14 53", false, RfiStatus.Closed, RfiPriority.Low, 28),

            ("Roof Drain Location — Area B",
             "Structural framing at Area B does not accommodate the roof drain location shown on sheet P-201. The drain falls directly on a beam. Please provide a revised drain location or structural modification.",
             "22 14 29", true, RfiStatus.Open, RfiPriority.High, 5),

            ("Lobby Floor Finish — Porcelain vs Natural Stone",
             "Interior finish schedule calls for 24x24 porcelain tile in the main lobby, but the rendering approved by the owner shows natural stone. Please confirm the intended material — there is a significant cost difference.",
             "09 30 00", true, RfiStatus.Answered, RfiPriority.Normal, 18),

            ("Structural Steel Connection Detail — Moment Frame",
             "Detail 3/S-401 shows a bolted moment connection, but the structural general notes require welded moment connections per AISC 358. Please clarify which connection type is intended.",
             "05 12 00", false, RfiStatus.Closed, RfiPriority.High, 35),

            ("MEP Coordination — Ceiling Plenum Height",
             "With all MEP systems routed per the coordination drawings, the available ceiling plenum height is 14\" instead of the specified 18\". Please advise if ceiling height can be lowered or if MEP routing needs to be revised.",
             "23 00 00", true, RfiStatus.Open, RfiPriority.Urgent, 2),

            ("Exterior Paint Color — South Elevation Accent Band",
             "Drawing A-201 notes 'accent color per owner selection' for the south elevation band. The owner has not yet selected a color. Please provide the color specification so we can order materials.",
             "09 91 00", false, RfiStatus.Open, RfiPriority.Normal, 10),

            ("Elevator Pit Depth Discrepancy",
             "The architectural plans show the elevator pit at 5'-0 deep, but the elevator manufacturer shop drawings require 5'-6 minimum. Please confirm if the structural design can accommodate the additional depth.",
             "14 20 00", true, RfiStatus.Answered, RfiPriority.High, 12),
        };

        var projectIndex = 0;
        foreach (var (subject, question, spec, hasCost, status, priority, daysAgo) in rfiTemplates)
        {
            var project = activeProjects[projectIndex % activeProjects.Count];
            projectIndex++;

            var rfi = new Rfi
            {
                ProjectId = project.Id,
                Number = rfiNumber++,
                Subject = subject,
                Question = question,
                SpecSection = spec,
                Status = status,
                Priority = priority,
                HasCostImpact = hasCost,
                EstimatedCostImpact = hasCost ? rfiNumber * 12_500m : null,
                EstimatedDelayDays = hasCost ? rfiNumber % 5 + 1 : null,
                CreatedByName = "Marcus Williams",
                AssignedToName = "Smith & Associates Architects",
                BallInCourtName = status == RfiStatus.Open ? "Smith & Associates Architects" : "Summit Commercial Construction",
                DueDate = now.AddDays(-daysAgo + 14), // 14-day response window
            };

            if (status is RfiStatus.Answered or RfiStatus.Closed)
            {
                rfi.Answer = "See attached sketch SK-" + rfiNumber + ". Proceed per revised detail.";
                rfi.AnsweredAt = now.AddDays(-daysAgo + 7);
            }

            if (status == RfiStatus.Closed)
            {
                rfi.ClosedAt = now.AddDays(-daysAgo + 10);
            }

            // Mark overdue: open RFIs past their due date
            rfis.Add(rfi);
        }

        return rfis;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. DAILY REPORTS — 10 over last 2 weeks
    // ────────────────────────────────────────────────────────────────────────

    private static List<PmDailyReport> CreateDailyReports(List<Project> activeProjects, Guid seedUserId)
    {
        var reports = new List<PmDailyReport>();
        if (seedUserId == Guid.Empty) return reports;

        var now = DateTime.UtcNow;
        var random = new Random(77); // Fixed seed for reproducibility

        var weatherOptions = new[]
        {
            ("Clear skies, sunny", "None", "Light breeze 5-10 mph"),
            ("Partly cloudy", "None", "Calm"),
            ("Overcast", "Light drizzle AM — cleared by 10am", "Gusty 15-20 mph"),
            ("Sunny, hot", "None", "Light 5 mph"),
            ("Fog AM, clearing by noon", "None", "Calm"),
            ("Clear, cool morning", "None", "Moderate 10-15 mph"),
            ("Partly cloudy, pleasant", "None", "Light 5 mph"),
            ("Overcast AM, sunny PM", "Brief sprinkle 8-9am", "Moderate 10 mph"),
            ("Clear, warm", "None", "Calm to light"),
            ("Mostly sunny", "None", "Breezy 15 mph"),
        };

        var workNarratives = new[]
        {
            "Continued structural steel erection on the north wing. Crane crew set 12 beams at the 2nd floor level. Ironworkers bolting connections on previously set steel at ground floor. Concrete crew stripped forms from grade beams poured yesterday.",
            "Completed excavation for the east utility trench. Plumbing sub installed 8\" sewer main from building to tie-in point. Backfill and compaction started on the west trench. Surveyors confirmed foundation layout for Building B.",
            "Poured 120 CY of concrete for the 2nd floor elevated deck. Pump truck on site from 6am-2pm. Finishing crew working the surface. MEP subs completed all embeds and sleeves prior to pour.",
            "Framing crew completed exterior wall framing on the south elevation. Sheathing and weather barrier installation started. Roofing sub began mobilization and material staging on the north wing.",
            "HVAC ductwork installation on 1st floor — main trunk lines and VAV boxes set. Electrical sub pulling wire on 2nd floor. Fire sprinkler rough-in 60% complete on the north wing.",
            "Drywall hanging started on 1st floor offices. Tape and mud crew following 1 day behind. Ceiling grid layout started in the main corridor. Painters prepping exterior metal panels.",
            "Site concrete crew poured sidewalks and curb ramps at the main entrance. Landscaping sub started irrigation rough-in. Paving sub scheduled for next Tuesday.",
            "MEP trim work in progress — plumbing fixtures being set on 1st floor. HVAC startup testing on RTU-1 and RTU-2. Electrician trimming out panels in the electrical room.",
            "Punch list walk with architect and owner rep. Documented 47 items (see punch list). Majority are minor finish items. Targeting completion of all items by end of next week.",
            "Continued structural steel erection — 3rd floor columns and beams. Metal deck installation following 1 floor behind. Concrete testing lab on site for compressive strength testing of recent pours.",
        };

        // Generate 10 daily reports across last 2 weeks (skip weekends)
        var reportDates = new List<DateTime>();
        var date = now.AddDays(-14);
        while (reportDates.Count < 10)
        {
            if (date.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday))
                reportDates.Add(date);
            date = date.AddDays(1);
        }

        for (var i = 0; i < reportDates.Count; i++)
        {
            var project = activeProjects[i % Math.Min(activeProjects.Count, 3)];
            var (weatherSummary, precip, wind) = weatherOptions[i];
            var tempLow = 42 + random.Next(20);
            var tempHigh = tempLow + 15 + random.Next(15);

            reports.Add(new PmDailyReport
            {
                ProjectId = project.Id,
                ReportDate = reportDates[i],
                ReportType = DailyReportType.Foreman,
                Status = i < 7 ? DailyReportStatus.Approved : DailyReportStatus.Submitted,
                WeatherSummary = weatherSummary,
                TemperatureLow = tempLow,
                TemperatureHigh = tempHigh,
                Precipitation = precip,
                Wind = wind,
                WorkNarrative = workNarratives[i],
                DelaysNarrative = i == 2 ? "Morning rain delay — 1 hour lost. Crane operations suspended until 10am per safety protocol." : null,
                SafetyNarrative = i == 8
                    ? "Near-miss incident: unsecured tool fell from 2nd floor scaffold. Area barricaded, toolbox talk conducted with all crews. No injuries."
                    : "No safety incidents. Daily stretch and flex completed. All PPE inspected and compliant.",
                PreparedByUserId = seedUserId,
            });
        }

        return reports;
    }

    private static List<PmDailyReportCrew> CreateDailyReportCrews(PmDailyReport report)
    {
        var random = new Random(report.ReportDate.GetHashCode());
        return
        [
            new() { DailyReportId = report.Id, CompanyName = "Summit Commercial Construction", Trade = "Carpentry", HeadCount = 4 + random.Next(3), HoursWorked = 8m },
            new() { DailyReportId = report.Id, CompanyName = "Summit Commercial Construction", Trade = "Laborers", HeadCount = 3 + random.Next(4), HoursWorked = 8m },
            new() { DailyReportId = report.Id, CompanyName = "Summit Mechanical Inc", Trade = "Plumbing", HeadCount = 2 + random.Next(2), HoursWorked = 8m },
            new() { DailyReportId = report.Id, CompanyName = "Delta Electrical Services", Trade = "Electrical", HeadCount = 3 + random.Next(2), HoursWorked = 8m },
            new() { DailyReportId = report.Id, CompanyName = "Summit Commercial Construction", Trade = "Iron Workers", HeadCount = random.Next(2, 5), HoursWorked = 8m },
        ];
    }

    private static List<PmDailyReportEquipment> CreateDailyReportEquipment(PmDailyReport report)
    {
        var random = new Random(report.ReportDate.GetHashCode() + 1);
        var equipment = new List<PmDailyReportEquipment>
        {
            new() { DailyReportId = report.Id, EquipmentName = "Tower Crane TC-1", HoursUsed = 6m + random.Next(3) },
            new() { DailyReportId = report.Id, EquipmentName = "Concrete Pump Truck", HoursUsed = random.Next(2) == 0 ? 0 : 4m + random.Next(4) },
            new() { DailyReportId = report.Id, EquipmentName = "Scissor Lift #3", HoursUsed = 4m + random.Next(4) },
        };
        return equipment;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. GL / CHART OF ACCOUNTS / JOURNAL ENTRIES (CFO)
    // ────────────────────────────────────────────────────────────────────────

    private static List<ChartOfAccount> CreateChartOfAccounts()
    {
        return
        [
            // Assets (1xxx)
            new() { AccountNumber = "1000", AccountName = "Cash — Operating", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1010", AccountName = "Cash — Payroll", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1020", AccountName = "Cash — Equipment Reserve", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1030", AccountName = "Cash — Trust / Retention", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1100", AccountName = "Accounts Receivable", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true, IsSubledgerControl = true },
            new() { AccountNumber = "1150", AccountName = "Retention Receivable", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1200", AccountName = "Costs in Excess of Billings (Underbilled)", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1300", AccountName = "Prepaid Insurance", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1400", AccountName = "Equipment — Net", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "1500", AccountName = "Vehicles — Net", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },

            // Liabilities (2xxx)
            new() { AccountNumber = "2000", AccountName = "Accounts Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true, IsSubledgerControl = true },
            new() { AccountNumber = "2050", AccountName = "Retention Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "2100", AccountName = "Accrued Payroll", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "2150", AccountName = "Payroll Taxes Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "2200", AccountName = "Billings in Excess of Costs (Overbilled)", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "2300", AccountName = "Current Portion — Line of Credit", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "2400", AccountName = "Notes Payable — Equipment", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },

            // Equity (3xxx)
            new() { AccountNumber = "3000", AccountName = "Retained Earnings", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "3100", AccountName = "Owner's Equity", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "3200", AccountName = "Current Year Earnings", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Credit, IsActive = true },

            // Revenue (4xxx)
            new() { AccountNumber = "4000", AccountName = "Contract Revenue", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "4100", AccountName = "Change Order Revenue", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true },
            new() { AccountNumber = "4200", AccountName = "T&M / Extra Work Revenue", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true },

            // Cost of Revenue (5xxx)
            new() { AccountNumber = "5000", AccountName = "Direct Labor", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "5100", AccountName = "Labor Burden & Benefits", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "5200", AccountName = "Materials", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "5300", AccountName = "Subcontract Costs", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "5400", AccountName = "Equipment Costs", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "5500", AccountName = "Other Direct Costs", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },

            // G&A Expenses (6xxx)
            new() { AccountNumber = "6000", AccountName = "Office Salaries", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6100", AccountName = "Office Rent", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6200", AccountName = "Insurance — General Liability", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6300", AccountName = "Insurance — Workers Comp", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6400", AccountName = "Professional Services", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6500", AccountName = "Vehicle Expense", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6600", AccountName = "Utilities & Telecom", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6700", AccountName = "Depreciation", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
            new() { AccountNumber = "6800", AccountName = "Interest Expense", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
        ];
    }

    private static List<AccountingPeriod> CreateAccountingPeriods()
    {
        var now = DateTime.UtcNow;
        var currentMonth = now.Month;
        var currentYear = now.Year;
        var periods = new List<AccountingPeriod>();

        // Create 3 periods: two closed, one open (current)
        for (var offset = -2; offset <= 0; offset++)
        {
            var periodDate = new DateTime(currentYear, currentMonth, 1).AddMonths(offset);
            var startDate = new DateOnly(periodDate.Year, periodDate.Month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);

            periods.Add(new AccountingPeriod
            {
                PeriodNumber = periodDate.Month,
                FiscalYear = periodDate.Year,
                PeriodName = periodDate.ToString("MMMM yyyy"),
                StartDate = startDate,
                EndDate = endDate,
                Status = offset < 0 ? PeriodStatus.HardClosed : PeriodStatus.Open,
                ClosedAt = offset < 0 ? DateTime.UtcNow.AddDays(offset * 15) : null,
            });
        }

        return periods;
    }

    private static List<JournalEntry> CreateJournalEntries(
        List<ChartOfAccount> accounts, List<Project> activeProjects, Guid seedUserId)
    {
        var now = DateTime.UtcNow;
        var entries = new List<JournalEntry>();
        var entryNumber = 1;

        // Helper to find GL account by number
        ChartOfAccount acct(string num) => accounts.First(a => a.AccountNumber == num);

        // Generate ~25 journal entries over the last 3 months
        var jeTemplates = new[]
        {
            // (Description, SourceModule, DebitAccount, CreditAccount, Amount, DaysAgo)
            ("AP payment — Summit Mechanical #INV-4521",     "Billing", "2000", "1000", 45_200.00m, 60),
            ("AP payment — Delta Electrical #INV-3308",      "Billing", "2000", "1000", 32_750.00m, 58),
            ("AP payment — Capitol Roofing #INV-1182",       "Billing", "2000", "1000", 28_400.00m, 55),
            ("AR receipt — Summit Health Partners App #2", "Billing", "1000", "1100", 325_000.00m, 52),
            ("Payroll — Week ending 12/20",                  "Payroll", "5000", "1010", 87_350.00m, 50),
            ("Payroll taxes — Week ending 12/20",            "Payroll", "5100", "2150", 22_311.25m, 50),
            ("Subcontract cost — Summit Fire Protection",   "Billing", "5300", "2000", 67_800.00m, 45),
            ("Material purchase — Lumber & sheathing",       "Billing", "5200", "2000", 18_925.00m, 42),
            ("AR receipt — Summit Tower Draw #3",             "Billing", "1000", "1100", 1_250_000.00m, 40),
            ("AP payment — Sacramento Ready Mix",            "Billing", "2000", "1000", 24_650.00m, 38),
            ("Payroll — Week ending 01/03",                  "Payroll", "5000", "1010", 91_200.00m, 35),
            ("Payroll taxes — Week ending 01/03",            "Payroll", "5100", "2150", 23_256.00m, 35),
            ("Equipment rental — Crane Services Inc",        "Billing", "5400", "2000", 15_800.00m, 32),
            ("Office rent — January",                        "Manual",  "6100", "1000", 8_500.00m, 30),
            ("Insurance — GL policy premium Q1",             "Manual",  "6200", "1000", 42_000.00m, 28),
            ("AR receipt — County Admin Bldg Draw #1",       "Billing", "1000", "1100", 485_000.00m, 25),
            ("AP payment — Summit Mechanical #INV-4703",     "Billing", "2000", "1000", 38_600.00m, 22),
            ("WIP adjustment — Summit Medical (overbilled)", "WIP",  "4000", "2200", 45_000.00m, 20),
            ("Payroll — Week ending 01/17",                  "Payroll", "5000", "1010", 89_750.00m, 18),
            ("Payroll taxes — Week ending 01/17",            "Payroll", "5100", "2150", 22_886.25m, 18),
            ("Workers comp insurance accrual — January",     "Manual",  "6300", "2100", 12_450.00m, 15),
            ("AP payment — Delta Electrical #INV-3452",      "Billing", "2000", "1000", 41_200.00m, 12),
            ("Retention release — Summit Tower sub payment",  "Billing", "2050", "1000", 22_500.00m, 10),
            ("Depreciation — January equipment",             "Manual",  "6700", "1400", 8_200.00m, 8),
            ("AR receipt — Summit Health Partners App #3", "Billing", "1000", "1100", 287_500.00m, 5),
        };

        foreach (var (desc, source, debitAcct, creditAcct, amount, daysAgo) in jeTemplates)
        {
            var entryDate = DateOnly.FromDateTime(now.AddDays(-daysAgo));
            var isPosted = daysAgo > 3;

            var je = new JournalEntry
            {
                EntryNumber = $"JE-{now.Year}-{entryNumber:D6}",
                EntryDate = entryDate,
                Description = desc,
                Status = isPosted ? JournalEntryStatus.Posted : JournalEntryStatus.Draft,
                SourceModule = source == "Manual" ? null : source,
                IsAutoGenerated = source != "Manual",
                TotalDebits = amount,
                TotalCredits = amount,
                PostedByUserId = isPosted && seedUserId != Guid.Empty ? seedUserId : null,
                PostedAt = isPosted ? now.AddDays(-daysAgo + 1) : null,
                Lines =
                [
                    new JournalEntryLine
                    {
                        LineNumber = 1,
                        GlAccountId = acct(debitAcct).Id,
                        DebitAmount = amount,
                        CreditAmount = 0m,
                        Description = desc,
                        ProjectId = activeProjects.Count > 0 ? activeProjects[entryNumber % activeProjects.Count].Id : null,
                    },
                    new JournalEntryLine
                    {
                        LineNumber = 2,
                        GlAccountId = acct(creditAcct).Id,
                        DebitAmount = 0m,
                        CreditAmount = amount,
                        Description = desc,
                        ProjectId = activeProjects.Count > 0 ? activeProjects[entryNumber % activeProjects.Count].Id : null,
                    }
                ]
            };

            entries.Add(je);
            entryNumber++;
        }

        return entries;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. LIEN WAIVERS — tied to existing subcontracts
    // ────────────────────────────────────────────────────────────────────────

    private static List<LienWaiver> CreateLienWaivers(
        List<Project> projects, List<Subcontract> subcontracts, List<Vendor> vendors)
    {
        var now = DateTime.UtcNow;
        var waivers = new List<LienWaiver>();

        // Create waivers for subcontracts that have been paid
        var activeOrCompleteSubs = subcontracts
            .Where(s => s.Status is SubcontractStatus.InProgress or SubcontractStatus.Complete or SubcontractStatus.ClosedOut)
            .Take(10)
            .ToList();

        var vendorList = vendors.ToList();
        var waiterTemplates = new[]
        {
            (LienWaiverType.Conditional, LienWaiverStatus.Received,  0.25m, 30),
            (LienWaiverType.Unconditional, LienWaiverStatus.Approved, 0.25m, 45),
            (LienWaiverType.Conditional, LienWaiverStatus.Received,  0.50m, 20),
            (LienWaiverType.Conditional, LienWaiverStatus.Requested, 0.75m, 5),
            (LienWaiverType.Unconditional, LienWaiverStatus.Approved, 0.50m, 35),
            (LienWaiverType.Final, LienWaiverStatus.Requested,       1.00m, 3),
            (LienWaiverType.Conditional, LienWaiverStatus.Approved,  0.60m, 25),
            (LienWaiverType.Progress, LienWaiverStatus.Received,     0.40m, 15),
            (LienWaiverType.Unconditional, LienWaiverStatus.Rejected, 0.50m, 10),
            (LienWaiverType.Conditional, LienWaiverStatus.Received,  0.80m, 8),
        };

        for (var i = 0; i < Math.Min(waiterTemplates.Length, activeOrCompleteSubs.Count); i++)
        {
            var sub = activeOrCompleteSubs[i];
            var (type, status, pctOfContract, daysAgo) = waiterTemplates[i];
            var amount = Math.Round(sub.CurrentValue * pctOfContract, 2);

            waivers.Add(new LienWaiver
            {
                ProjectId = sub.ProjectId,
                VendorId = vendorList.Count > i ? vendorList[i].Id : null,
                WaiverType = type,
                Amount = amount,
                ThroughDate = DateOnly.FromDateTime(now.AddDays(-daysAgo)),
                Status = status,
                Description = $"{type} lien waiver through {DateOnly.FromDateTime(now.AddDays(-daysAgo)):MMM dd, yyyy} — {sub.ScopeOfWork}",
                ReviewedAt = status is LienWaiverStatus.Approved or LienWaiverStatus.Rejected ? now.AddDays(-daysAgo + 2) : null,
                RejectionReason = status == LienWaiverStatus.Rejected ? "Amount on waiver does not match payment amount. Please resubmit with corrected amount." : null,
            });
        }

        return waivers;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 6. PURCHASE ORDERS — for purchasing manager
    // ────────────────────────────────────────────────────────────────────────

    private static List<PurchaseOrder> CreatePurchaseOrders(List<Project> activeProjects, List<Vendor> vendors)
    {
        var now = DateTime.UtcNow;
        var pos = new List<PurchaseOrder>();
        var vendorList = vendors.ToList();
        if (activeProjects.Count == 0 || vendorList.Count == 0) return pos;

        var poTemplates = new[]
        {
            // (Description, Lines[], Status, DaysAgo)
            ("Concrete — Foundation Pour Phase 2", new[] { ("Ready-mix concrete 4000 PSI", 180m, 145.00m), ("Rebar #5 Grade 60", 24000m, 0.85m), ("Form release agent", 50m, 32.00m) },
                PurchaseOrderStatus.Approved, 25),
            ("Structural steel — 2nd Floor", new[] { ("W14x30 beams", 45m, 1_250.00m), ("HSS 6x6x3/8 columns", 30m, 890.00m), ("Connection hardware", 1m, 4_200.00m) },
                PurchaseOrderStatus.PartiallyReceived, 20),
            ("Electrical panels & switchgear", new[] { ("200A main distribution panel", 3m, 4_500.00m), ("100A sub-panels", 8m, 1_200.00m), ("Conduit & fittings lot", 1m, 8_500.00m) },
                PurchaseOrderStatus.Approved, 18),
            ("Plumbing fixtures — Floors 1-2", new[] { ("Commercial toilets", 24m, 385.00m), ("Lavatory sinks", 18m, 275.00m), ("Urinals", 8m, 320.00m) },
                PurchaseOrderStatus.Draft, 5),
            ("Roofing materials", new[] { ("TPO membrane 60 mil", 15000m, 1.85m), ("ISO board insulation 3\"", 15000m, 1.20m), ("Roof drain assemblies", 12m, 450.00m) },
                PurchaseOrderStatus.Approved, 30),
            ("HVAC equipment — RTUs", new[] { ("15-ton rooftop unit RTU-1", 1m, 18_500.00m), ("10-ton rooftop unit RTU-2", 1m, 14_200.00m), ("VFDs and controls", 2m, 3_800.00m) },
                PurchaseOrderStatus.Received, 45),
            ("Interior doors & hardware", new[] { ("Solid core wood doors 3070", 48m, 425.00m), ("Commercial door hardware sets", 48m, 185.00m), ("Hollow metal frames", 48m, 195.00m) },
                PurchaseOrderStatus.Approved, 15),
            ("Drywall & framing materials", new[] { ("5/8\" Type X drywall", 800m, 14.50m), ("Metal studs 3-5/8\" 25ga", 2000m, 4.25m), ("Joint compound (5 gal)", 60m, 22.00m) },
                PurchaseOrderStatus.PartiallyReceived, 22),
            ("Elevator cab & components", new[] { ("Hydraulic passenger elevator", 1m, 65_000.00m), ("Cab interior finish package", 1m, 8_500.00m) },
                PurchaseOrderStatus.Approved, 35),
            ("Fire protection materials", new[] { ("Sprinkler heads — standard", 200m, 18.50m), ("Schedule 10 black pipe", 3000m, 3.25m), ("Fire alarm panel", 1m, 6_200.00m) },
                PurchaseOrderStatus.Approved, 28),
            ("Landscaping materials", new[] { ("Trees — 24\" box", 15m, 425.00m), ("Shrubs — 5 gallon", 80m, 35.00m), ("Irrigation controller", 2m, 1_200.00m) },
                PurchaseOrderStatus.Draft, 3),
            ("Finish flooring", new[] { ("LVT flooring — offices", 4500m, 4.75m), ("Porcelain tile — lobbies", 1200m, 8.50m), ("Carpet tile — conference rooms", 800m, 6.25m) },
                PurchaseOrderStatus.Approved, 12),
        };

        for (var i = 0; i < poTemplates.Length; i++)
        {
            var (desc, lineItems, status, daysAgo) = poTemplates[i];
            var project = activeProjects[i % activeProjects.Count];
            var vendor = vendorList[i % vendorList.Count];

            var lines = lineItems.Select((li, idx) =>
            {
                var amount = Math.Round(li.Item2 * li.Item3, 2);
                return new PurchaseOrderLine
                {
                    Description = li.Item1,
                    Quantity = li.Item2,
                    UnitPrice = li.Item3,
                    Amount = amount,
                    TaxAmount = Math.Round(amount * 0.0875m, 2),
                    TaxRate = 8.75m,
                    IsTaxable = true,
                    ReceivedQuantity = status switch
                    {
                        PurchaseOrderStatus.Received => li.Item2,
                        PurchaseOrderStatus.PartiallyReceived => Math.Round(li.Item2 * 0.6m, 0),
                        _ => 0m,
                    },
                };
            }).ToList();

            var subtotal = lines.Sum(l => l.Amount);
            var tax = lines.Sum(l => l.TaxAmount);

            pos.Add(new PurchaseOrder
            {
                PONumber = $"PO-{now.Year}-{(i + 1):D4}",
                ProjectId = project.Id,
                VendorId = vendor.Id,
                Description = desc,
                SubtotalAmount = subtotal,
                TaxAmount = tax,
                TotalAmount = subtotal + tax,
                Status = status,
                ApprovedAt = status != PurchaseOrderStatus.Draft ? now.AddDays(-daysAgo + 1) : null,
                Lines = lines,
            });
        }

        return pos;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 7. NOTIFICATIONS — for various roles
    // ────────────────────────────────────────────────────────────────────────

    private static List<Notification> CreateNotifications(
        Guid userId, List<Rfi> rfis, List<Project> activeProjects)
    {
        var now = DateTime.UtcNow;
        var notifications = new List<Notification>();

        // RFI-related notifications
        foreach (var rfi in rfis.Where(r => r.Status == RfiStatus.Answered).Take(2))
        {
            notifications.Add(new Notification
            {
                UserId = userId,
                Title = $"RFI #{rfi.Number} Responded",
                Message = $"Architect has responded to RFI #{rfi.Number}: \"{rfi.Subject}\". Review the response and close the RFI if resolved.",
                Type = NotificationType.RfiAnswered,
                IsRead = false,
                RelatedEntityType = "Rfi",
                RelatedEntityId = rfi.Id,
            });
        }

        // Overdue RFI warnings
        foreach (var rfi in rfis.Where(r => r.Status == RfiStatus.Open && r.DueDate < now).Take(2))
        {
            notifications.Add(new Notification
            {
                UserId = userId,
                Title = $"RFI #{rfi.Number} is Overdue",
                Message = $"RFI #{rfi.Number}: \"{rfi.Subject}\" is past its due date. Follow up with the architect for a response.",
                Type = NotificationType.OverdueRfi,
                IsRead = false,
                RelatedEntityType = "Rfi",
                RelatedEntityId = rfi.Id,
            });
        }

        // Approval request
        notifications.Add(new Notification
        {
            UserId = userId,
            Title = "Time Entries Pending Approval",
            Message = "5 time entries from last week are awaiting your approval. Review and approve to keep payroll on schedule.",
            Type = NotificationType.PendingApproval,
            IsRead = false,
        });

        // Deadline warning
        if (activeProjects.Count > 0)
        {
            notifications.Add(new Notification
            {
                UserId = userId,
                Title = "Billing Deadline Approaching",
                Message = $"Monthly billing application for {activeProjects[0].Name} is due in 3 days. Ensure all cost data is current before submission.",
                Type = NotificationType.Info,
                IsRead = false,
                RelatedEntityType = "Project",
                RelatedEntityId = activeProjects[0].Id,
            });
        }

        // Submittal stale notification
        notifications.Add(new Notification
        {
            UserId = userId,
            Title = "Submittal Review Overdue",
            Message = "Submittal #003 (HVAC Equipment Submittals) has been in review for 15 days. The architect was expected to respond within 10 business days.",
            Type = NotificationType.SubmittalReviewStale,
            IsRead = false,
        });

        // Change order notification
        notifications.Add(new Notification
        {
            UserId = userId,
            Title = "Change Order Requires Review",
            Message = "Change Order #CO-002 for structural modifications has been submitted for your review. Estimated cost impact: $45,000.",
            Type = NotificationType.ChangeOrder,
            IsRead = true,
            ReadAt = now.AddDays(-1),
        });

        // System update (read)
        notifications.Add(new Notification
        {
            UserId = userId,
            Title = "System Update: New Dashboard Layouts",
            Message = "Role-adaptive dashboard layouts are now available. Your dashboard has been automatically configured based on your role.",
            Type = NotificationType.SystemUpdate,
            IsRead = true,
            ReadAt = now.AddDays(-3),
        });

        return notifications;
    }

    // ── V3 Seed Methods ─────────────────────────────────────────────────

    private static List<Equipment> CreateEquipment()
    {
        return
        [
            // Heavy Equipment
            new() { Code = "EX-001", Name = "CAT 320 Excavator", Description = "30-ton hydraulic excavator with GPS grade control", Type = EquipmentType.HeavyEquipment, HourlyRate = 185.00m, BillingRate = 275.00m, IsActive = true, SerialNumber = "CAT320GC-48291" },
            new() { Code = "EX-002", Name = "Bobcat E35 Mini Excavator", Description = "3.5-ton compact excavator for tight-access work", Type = EquipmentType.HeavyEquipment, HourlyRate = 65.00m, BillingRate = 95.00m, IsActive = true, SerialNumber = "BOB-E35-77104" },
            new() { Code = "DZ-001", Name = "CAT D6 Dozer", Description = "Crawler dozer with 6-way blade and ripper", Type = EquipmentType.HeavyEquipment, HourlyRate = 195.00m, BillingRate = 295.00m, IsActive = true, SerialNumber = "CATD6T-92037" },
            new() { Code = "LD-001", Name = "John Deere 644K Loader", Description = "Wheel loader with 4.2 cu yd bucket", Type = EquipmentType.HeavyEquipment, HourlyRate = 155.00m, BillingRate = 235.00m, IsActive = true, SerialNumber = "JD644K-60182" },
            new() { Code = "CR-001", Name = "Liebherr LTM 1100 Crane", Description = "100-ton all-terrain mobile crane", Type = EquipmentType.HeavyEquipment, HourlyRate = 350.00m, BillingRate = 525.00m, IsActive = true, SerialNumber = "LTM1100-5.2-4419" },
            new() { Code = "CP-001", Name = "CAT CS56B Compactor", Description = "Vibratory soil compactor, 12-ton", Type = EquipmentType.HeavyEquipment, HourlyRate = 95.00m, BillingRate = 145.00m, IsActive = true, SerialNumber = "CATCS56B-33108" },

            // Light Equipment
            new() { Code = "CP-002", Name = "Schwing S42SX Concrete Pump", Description = "42-meter truck-mounted concrete boom pump", Type = EquipmentType.LightEquipment, HourlyRate = 225.00m, BillingRate = 340.00m, IsActive = true, SerialNumber = "SWG-S42-18820" },
            new() { Code = "GN-001", Name = "CAT XQ200 Generator", Description = "200 kW diesel generator for jobsite power", Type = EquipmentType.LightEquipment, HourlyRate = 55.00m, BillingRate = 85.00m, IsActive = true, SerialNumber = "CATXQ200-71543" },
            new() { Code = "GN-002", Name = "CAT XQ60 Generator", Description = "60 kW portable diesel generator", Type = EquipmentType.LightEquipment, HourlyRate = 35.00m, BillingRate = 55.00m, IsActive = true, SerialNumber = "CATXQ60-88214" },
            new() { Code = "WM-001", Name = "Lincoln Electric Ranger 330", Description = "Diesel welder/generator 330A", Type = EquipmentType.LightEquipment, HourlyRate = 45.00m, BillingRate = 70.00m, IsActive = true, SerialNumber = "LNC-R330-41009" },
            new() { Code = "AL-001", Name = "JLG 600S Aerial Lift", Description = "60-ft telescopic boom lift, 4WD", Type = EquipmentType.LightEquipment, HourlyRate = 85.00m, BillingRate = 130.00m, IsActive = true, SerialNumber = "JLG600S-22847" },
            new() { Code = "SC-001", Name = "Scaffolding Set — 10-Bay", Description = "Frame scaffold system, 10 bays, 60 ft max height", Type = EquipmentType.LightEquipment, HourlyRate = 25.00m, BillingRate = 40.00m, IsActive = true },

            // Vehicles
            new() { Code = "VH-001", Name = "Ford F-350 Crew Cab #1", Description = "2024 F-350 XLT crew cab, long bed", Type = EquipmentType.Vehicles, HourlyRate = 45.00m, BillingRate = 65.00m, IsActive = true, SerialNumber = "1FT8W3BT4REA10001", LicensePlate = "8ABC123" },
            new() { Code = "VH-002", Name = "Ford F-350 Crew Cab #2", Description = "2024 F-350 XLT crew cab, long bed", Type = EquipmentType.Vehicles, HourlyRate = 45.00m, BillingRate = 65.00m, IsActive = true, SerialNumber = "1FT8W3BT4REA10002", LicensePlate = "8ABC456" },
            new() { Code = "VH-003", Name = "Ford F-350 Crew Cab #3", Description = "2023 F-350 Lariat crew cab", Type = EquipmentType.Vehicles, HourlyRate = 45.00m, BillingRate = 65.00m, IsActive = true, SerialNumber = "1FT8W3BT4PEA30003", LicensePlate = "8ABC789" },
            new() { Code = "VH-004", Name = "Ford F-550 Flatbed", Description = "2023 F-550 regular cab with 12-ft flatbed", Type = EquipmentType.Vehicles, HourlyRate = 55.00m, BillingRate = 80.00m, IsActive = true, SerialNumber = "1FD0W5HT4PEA40004", LicensePlate = "8DEF001" },
            new() { Code = "VH-005", Name = "Kenworth T880 Water Truck", Description = "4,000 gallon water truck for dust control", Type = EquipmentType.Vehicles, HourlyRate = 75.00m, BillingRate = 115.00m, IsActive = true, SerialNumber = "KWT880-WTR-55910", LicensePlate = "8DEF002" },

            // Tools
            new() { Code = "TL-001", Name = "Hilti TE 70-ATC Rotary Hammer", Description = "SDS-max combihammer for heavy drilling", Type = EquipmentType.Tools, HourlyRate = 15.00m, BillingRate = 25.00m, IsActive = true, SerialNumber = "HILTI-TE70-92001" },
            new() { Code = "TL-002", Name = "Husqvarna K770 Concrete Saw", Description = "14-inch power cutter for concrete and masonry", Type = EquipmentType.Tools, HourlyRate = 20.00m, BillingRate = 35.00m, IsActive = true, SerialNumber = "HUSQ-K770-44218" },
        ];
    }

    private static List<BankAccount> CreateBankAccounts(List<ChartOfAccount> chartOfAccounts)
    {
        var glOperating = chartOfAccounts.First(a => a.AccountNumber == "1000");
        var glPayroll = chartOfAccounts.First(a => a.AccountNumber == "1010");
        var glEquipReserve = chartOfAccounts.First(a => a.AccountNumber == "1020");
        var glTrust = chartOfAccounts.First(a => a.AccountNumber == "1030");

        return
        [
            new()
            {
                AccountName = "Operating Account",
                BankName = "JPMorgan Chase",
                AccountNumberLast4 = "4821",
                RoutingNumber = "322271627",
                GlAccountId = glOperating.Id,
                AccountType = BankAccountType.Checking,
                IsActive = true,
                OpeningBalance = 1_250_000.00m,
                OpeningBalanceDate = new DateOnly(2025, 1, 1),
            },
            new()
            {
                AccountName = "Payroll Account",
                BankName = "JPMorgan Chase",
                AccountNumberLast4 = "7395",
                RoutingNumber = "322271627",
                GlAccountId = glPayroll.Id,
                AccountType = BankAccountType.Checking,
                IsActive = true,
                OpeningBalance = 450_000.00m,
                OpeningBalanceDate = new DateOnly(2025, 1, 1),
            },
            new()
            {
                AccountName = "Equipment Reserve",
                BankName = "Wells Fargo",
                AccountNumberLast4 = "2108",
                RoutingNumber = "121042882",
                GlAccountId = glEquipReserve.Id,
                AccountType = BankAccountType.Savings,
                IsActive = true,
                OpeningBalance = 325_000.00m,
                OpeningBalanceDate = new DateOnly(2025, 1, 1),
            },
            new()
            {
                AccountName = "Trust Account — Retention",
                BankName = "US Bank",
                AccountNumberLast4 = "6643",
                RoutingNumber = "122235821",
                GlAccountId = glTrust.Id,
                AccountType = BankAccountType.Checking,
                IsActive = true,
                OpeningBalance = 780_000.00m,
                OpeningBalanceDate = new DateOnly(2025, 1, 1),
            },
        ];
    }

    private static List<WorkClassification> CreateWorkClassifications()
    {
        return
        [
            new() { Code = "CARP", Name = "Carpenter", Description = "Journeyman carpenter — framing, formwork, finish", IsActive = true },
            new() { Code = "ELEC", Name = "Electrician", Description = "Journeyman electrician — inside wireman", IsActive = true },
            new() { Code = "IRON", Name = "Ironworker", Description = "Structural and reinforcing ironworker", IsActive = true },
            new() { Code = "LAB1", Name = "Laborer Group 1", Description = "General construction laborer — basic duties", IsActive = true },
            new() { Code = "OE1", Name = "Operating Engineer Group 1", Description = "Heavy equipment operator — cranes, excavators, dozers", IsActive = true },
            new() { Code = "PLUM", Name = "Plumber/Pipefitter", Description = "Journeyman plumber and pipefitter", IsActive = true },
            new() { Code = "CMNT", Name = "Cement Mason", Description = "Cement mason and concrete finisher", IsActive = true },
            new() { Code = "SHMT", Name = "Sheet Metal Worker", Description = "Sheet metal worker — HVAC ductwork, flashing", IsActive = true },
        ];
    }

    private static List<WageDetermination> CreateWageDeterminations(
        List<Project> activeProjects, List<WorkClassification> classifications)
    {
        var determinations = new List<WageDetermination>();

        // Rate data: (classificationCode, baseRate, fringeRate)
        (string code, decimal baseRate, decimal fringe)[] rateData =
        [
            ("CARP", 52.15m, 28.40m),
            ("ELEC", 58.60m, 31.20m),
            ("IRON", 55.80m, 29.85m),
            ("LAB1", 38.45m, 22.10m),
            ("OE1",  54.70m, 30.15m),
            ("PLUM", 56.90m, 30.60m),
            ("CMNT", 44.20m, 26.80m),
            ("SHMT", 53.40m, 28.90m),
        ];

        var classMap = classifications.ToDictionary(c => c.Code);
        var detNum = 1;

        foreach (var project in activeProjects.Take(3))
        {
            var determination = new WageDetermination
            {
                ProjectId = project.Id,
                JurisdictionType = WageJurisdictionType.State,
                DeterminationNumber = $"CA2026{detNum:D4}",
                SourceAgency = "California DIR — Division of Labor Standards Enforcement",
                EffectiveDate = new DateOnly(2025, 7, 1),
                ExpirationDate = new DateOnly(2026, 6, 30),
                Status = WageDeterminationStatus.Active,
                Rates = rateData.Select(r => new WageDeterminationRate
                {
                    WorkClassificationId = classMap[r.code].Id,
                    BaseRate = r.baseRate,
                    FringeRate = r.fringe,
                    TotalRate = r.baseRate + r.fringe,
                }).ToList(),
            };
            determinations.Add(determination);
            detNum++;
        }

        return determinations;
    }

    private static List<ComplianceDocument> CreateComplianceDocuments(
        List<Employee> employees, List<Subcontract> subcontracts, Guid companyId)
    {
        var docs = new List<ComplianceDocument>();
        var now = DateTime.UtcNow;

        // Company-level documents (linked to actual company record)
        (string docType, string docNum, DateTime issued, DateTime expires, string notes)[] companyDocs =
        [
            ("ContractorsLicense", "CA-1087452-A", now.AddYears(-2), now.AddYears(2),
                "Class A - General Engineering Contractor, State of California"),
            ("GeneralLiability", "GL-2025-PWI-4481", now.AddMonths(-6), now.AddMonths(6),
                "General liability - $2M per occurrence / $4M aggregate, Zurich Insurance"),
            ("WorkersComp", "WC-2025-PWI-7712", now.AddMonths(-6), now.AddMonths(6),
                "Workers compensation - statutory limits, Travelers Insurance"),
            ("AutoInsurance", "CA-2025-PWI-3390", now.AddMonths(-8), now.AddMonths(4),
                "Commercial auto - $1M CSL, 22 scheduled vehicles"),
            ("BusinessLicense", "BL-FRESNO-2025-8841", now.AddMonths(-10), now.AddMonths(2),
                "City of Fresno business license - General Contractor"),
            ("W9", "W9-PWI-2025", now.AddMonths(-11), now.AddYears(2),
                "W-9 on file - EIN 94-3281005"),
            ("COI", "COI-PWI-2025-ALL", now.AddMonths(-6), now.AddMonths(6),
                "Umbrella COI - $5M excess liability"),
        ];

        foreach (var (docType, docNum, issued, expires, notes) in companyDocs)
        {
            docs.Add(new ComplianceDocument
            {
                EntityType = "Company",
                EntityId = companyId != Guid.Empty ? companyId : Guid.NewGuid(),
                DocumentType = docType,
                DocumentNumber = docNum,
                IssuedDate = issued,
                ExpirationDate = expires,
                Status = expires > now ? "Active" : "Expired",
                Notes = notes,
            });
        }

        // Employee safety certifications (first 10 employees)
        var certEmployees = employees.Take(10).ToList();
        var rng = new Random(42);
        string[] employeeCerts = ["OSHA10", "OSHA30", "FirstAid", "CPR"];

        foreach (var emp in certEmployees)
        {
            // Each employee gets 2-3 random certs
            var certCount = rng.Next(2, 4);
            var selectedCerts = employeeCerts.OrderBy(_ => rng.Next()).Take(certCount);
            var certSeq = 1;

            foreach (var cert in selectedCerts)
            {
                var issued = now.AddMonths(-rng.Next(3, 18));
                var expiresDate = cert is "OSHA10" or "OSHA30"
                    ? (DateTime?)null // OSHA cards don't expire
                    : issued.AddYears(2);

                docs.Add(new ComplianceDocument
                {
                    EntityType = "Employee",
                    EntityId = emp.Id,
                    DocumentType = cert,
                    DocumentNumber = $"{cert}-{emp.EmployeeNumber}-{certSeq:D2}",
                    IssuedDate = issued,
                    ExpirationDate = expiresDate,
                    Status = expiresDate == null || expiresDate > now ? "Active" : "Expired",
                    Notes = cert switch
                    {
                        "OSHA10" => "10-hour OSHA construction safety course completed",
                        "OSHA30" => "30-hour OSHA construction safety course completed",
                        "FirstAid" => "First Aid / AED certification — American Red Cross",
                        "CPR" => "CPR certification — American Red Cross",
                        _ => null
                    },
                });
                certSeq++;
            }
        }

        // Subcontractor compliance (first 5 subcontracts — correct entity linkage)
        string[] subDocs = ["GeneralLiability", "WorkersComp", "AutoInsurance", "W9", "COI"];

        foreach (var sub in subcontracts.Take(5))
        {
            var seq = 1;
            foreach (var docType in subDocs)
            {
                var issued = now.AddMonths(-rng.Next(2, 12));
                var expires = issued.AddYears(1);
                docs.Add(new ComplianceDocument
                {
                    EntityType = "Subcontractor",
                    EntityId = sub.Id,
                    DocumentType = docType,
                    DocumentNumber = $"{docType}-SUB-{sub.SubcontractNumber}-{seq:D2}",
                    IssuedDate = issued,
                    ExpirationDate = expires,
                    Status = expires > now ? "Active" : "ExpiringSoon",
                    Notes = $"{docType} certificate for {sub.ScopeOfWork}",
                });
                seq++;
            }
        }

        return docs;
    }

    private static List<TaxJurisdiction> CreateTaxJurisdictions()
    {
        var effective = new DateOnly(2025, 4, 1);

        return
        [
            new()
            {
                Name = "Fresno County", Code = "CA-FRESNO", State = "CA", County = "Fresno",
                CombinedRate = 8.35m, StateRate = 7.25m, CountyRate = 1.10m, CityRate = 0.00m,
                IsActive = true, EffectiveDate = effective,
                Rates =
                [
                    new() { Category = TaxCategory.Materials, Rate = 8.35m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Equipment, Rate = 8.35m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Labor, Rate = 0.00m, IsActive = true, EffectiveDate = effective },
                ],
            },
            new()
            {
                Name = "Sacramento County", Code = "CA-SACRAMENTO", State = "CA", County = "Sacramento",
                CombinedRate = 8.75m, StateRate = 7.25m, CountyRate = 1.00m, CityRate = 0.50m,
                IsActive = true, EffectiveDate = effective,
                Rates =
                [
                    new() { Category = TaxCategory.Materials, Rate = 8.75m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Equipment, Rate = 8.75m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Labor, Rate = 0.00m, IsActive = true, EffectiveDate = effective },
                ],
            },
            new()
            {
                Name = "Los Angeles County", Code = "CA-LA", State = "CA", County = "Los Angeles",
                CombinedRate = 10.25m, StateRate = 7.25m, CountyRate = 2.25m, CityRate = 0.75m,
                IsActive = true, EffectiveDate = effective,
                Rates =
                [
                    new() { Category = TaxCategory.Materials, Rate = 10.25m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Equipment, Rate = 10.25m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Labor, Rate = 0.00m, IsActive = true, EffectiveDate = effective },
                ],
            },
            new()
            {
                Name = "San Francisco County", Code = "CA-SF", State = "CA", County = "San Francisco", City = "San Francisco",
                CombinedRate = 8.625m, StateRate = 7.25m, CountyRate = 1.25m, CityRate = 0.125m,
                IsActive = true, EffectiveDate = effective,
                Rates =
                [
                    new() { Category = TaxCategory.Materials, Rate = 8.625m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Equipment, Rate = 8.625m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Labor, Rate = 0.00m, IsActive = true, EffectiveDate = effective },
                ],
            },
            new()
            {
                Name = "Kern County", Code = "CA-KERN", State = "CA", County = "Kern",
                CombinedRate = 8.25m, StateRate = 7.25m, CountyRate = 1.00m, CityRate = 0.00m,
                IsActive = true, EffectiveDate = effective,
                Rates =
                [
                    new() { Category = TaxCategory.Materials, Rate = 8.25m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Equipment, Rate = 8.25m, IsActive = true, EffectiveDate = effective },
                    new() { Category = TaxCategory.Labor, Rate = 0.00m, IsActive = true, EffectiveDate = effective },
                ],
            },
        ];
    }

    private static (List<PmMeeting>, List<PmMeetingAgendaItem>, List<PmMeetingMinute>, List<PmMeetingActionItem>)
        CreateMeetings(List<Project> activeProjects, Guid seedUserId)
    {
        var meetings = new List<PmMeeting>();
        var agendaItems = new List<PmMeetingAgendaItem>();
        var minutes = new List<PmMeetingMinute>();
        var actionItems = new List<PmMeetingActionItem>();
        var now = DateTime.UtcNow;

        // Meeting templates: (type, titlePattern, location, agendaTopics[])
        var templates = new (MeetingType type, string titlePrefix, string location, string[] topics)[]
        {
            (MeetingType.Oac, "OAC Meeting", "Owner's Conference Room",
                ["Safety Report", "Schedule Update", "Budget Review", "RFI / Submittal Status", "Pending Change Orders", "Quality Control", "Next Steps"]),
            (MeetingType.Safety, "Weekly Safety Meeting", "Jobsite Trailer",
                ["Incident Review", "Near-Miss Reports", "Toolbox Talk Topic", "PPE Compliance", "Upcoming Hazards", "Emergency Procedures Review"]),
            (MeetingType.Subcontractor, "Subcontractor Coordination", "Jobsite Trailer",
                ["Two-Week Lookahead", "Material Deliveries", "Workspace Coordination", "MEP Conflicts", "Manpower Plan", "Open Issues"]),
            (MeetingType.Progress, "Progress Meeting", "PM Office",
                ["Percent Complete Update", "Critical Path Review", "Weather Delays", "Inspection Results", "Punch List Status"]),
        };

        foreach (var project in activeProjects.Take(3))
        {
            foreach (var (type, titlePrefix, location, topics) in templates)
            {
                // Create 5-6 meetings going back over 5 months
                var meetingCount = type == MeetingType.Oac ? 6 : 5;
                for (var i = 0; i < meetingCount; i++)
                {
                    var meetingDate = now.AddDays(-(meetingCount - 1 - i) * 7 * (type == MeetingType.Oac ? 2 : 1));
                    var isFuture = meetingDate > now;
                    var status = isFuture ? MeetingStatus.Scheduled
                        : i == meetingCount - 1 && !isFuture ? MeetingStatus.Completed
                        : MeetingStatus.Completed;

                    var meeting = new PmMeeting
                    {
                        ProjectId = project.Id,
                        MeetingType = type,
                        Title = $"{titlePrefix} #{i + 1}",
                        Location = location,
                        ScheduledStart = meetingDate.Date.AddHours(type == MeetingType.Safety ? 7 : 10),
                        ScheduledEnd = meetingDate.Date.AddHours(type == MeetingType.Safety ? 7.5 : 11),
                        ActualStart = status == MeetingStatus.Completed ? meetingDate.Date.AddHours(type == MeetingType.Safety ? 7 : 10).AddMinutes(2) : null,
                        ActualEnd = status == MeetingStatus.Completed ? meetingDate.Date.AddHours(type == MeetingType.Safety ? 7.5 : 11).AddMinutes(-5) : null,
                        Status = status,
                    };
                    meetings.Add(meeting);

                    // Agenda items for each meeting
                    for (var t = 0; t < topics.Length; t++)
                    {
                        agendaItems.Add(new PmMeetingAgendaItem
                        {
                            MeetingId = meeting.Id,
                            ItemNumber = t + 1,
                            Topic = topics[t],
                            PresenterUserId = seedUserId != Guid.Empty ? seedUserId : null,
                        });
                    }

                    // Minutes for completed meetings
                    if (status == MeetingStatus.Completed && seedUserId != Guid.Empty)
                    {
                        var minuteText = type switch
                        {
                            MeetingType.Oac =>
                                $"OAC #{i + 1} — Project is tracking {(i % 3 == 0 ? "on schedule" : "2 days behind")}. " +
                                $"Budget utilization at {55 + i * 5}%. {(i % 2 == 0 ? "No safety incidents this period." : "One near-miss reported — corrective action taken.")} " +
                                $"Owner approved {i + 1} pending RFIs. Next meeting in {(type == MeetingType.Oac ? 2 : 1)} weeks.",
                            MeetingType.Safety =>
                                $"Safety meeting #{i + 1} — Toolbox talk: {(i % 3 == 0 ? "Fall Protection" : i % 3 == 1 ? "Trenching & Excavation" : "Electrical Safety")}. " +
                                $"All workers verified to have current PPE. {(i % 4 == 0 ? "Near-miss: unsecured material on scaffold — resolved immediately." : "No incidents.")} " +
                                $"OSHA 300 log current.",
                            MeetingType.Subcontractor =>
                                $"Coordination #{i + 1} — {(i % 2 == 0 ? "Electrical" : "Mechanical")} sub confirmed delivery schedule. " +
                                $"MEP conflict at {(i % 2 == 0 ? "Level 2 corridor" : "mechanical room")} — routing revised. " +
                                $"Manpower adequate for two-week lookahead.",
                            _ =>
                                $"Progress #{i + 1} — Overall {50 + i * 8}% complete. Critical path: {(i % 2 == 0 ? "structural steel erection" : "MEP rough-in")}. " +
                                $"{(i % 3 == 0 ? "1 rain day lost this period." : "No weather delays.")} " +
                                $"Inspections: {i + 2} passed, 0 failed.",
                        };

                        minutes.Add(new PmMeetingMinute
                        {
                            MeetingId = meeting.Id,
                            MinuteText = minuteText,
                            RecordedByUserId = seedUserId,
                            VersionNumber = 1,
                        });
                    }

                    // Action items (2-3 per completed meeting)
                    if (status == MeetingStatus.Completed)
                    {
                        var actionData = type switch
                        {
                            MeetingType.Oac => new[]
                            {
                                ("Submit updated project schedule to owner", TaskPriority.High),
                                ("Resolve RFI #" + (i + 10) + " — structural beam connection detail", TaskPriority.Urgent),
                                ("Provide cost estimate for parking lot lighting upgrade", TaskPriority.Normal),
                            },
                            MeetingType.Safety => new[]
                            {
                                ("Update fall protection plan for Phase " + (i + 2), TaskPriority.High),
                                ("Schedule crane inspection for next week", TaskPriority.Normal),
                            },
                            MeetingType.Subcontractor => new[]
                            {
                                ("Confirm material delivery date for " + (i % 2 == 0 ? "switchgear" : "ductwork"), TaskPriority.High),
                                ("Coordinate MEP sleeve locations with structural", TaskPriority.Normal),
                                ("Submit revised shop drawings by Friday", TaskPriority.High),
                            },
                            _ => new[]
                            {
                                ("Update percent complete on all active phases", TaskPriority.Normal),
                                ("Schedule " + (i % 2 == 0 ? "concrete" : "framing") + " inspection", TaskPriority.High),
                            },
                        };

                        foreach (var (desc, priority) in actionData)
                        {
                            var isComplete = i < meetingCount - 2; // older ones are complete
                            actionItems.Add(new PmMeetingActionItem
                            {
                                MeetingId = meeting.Id,
                                Description = desc,
                                AssigneeName = i % 3 == 0 ? "Mike Torres" : i % 3 == 1 ? "Sarah Chen" : "James Park",
                                DueDate = meetingDate.AddDays(7),
                                Priority = priority,
                                Status = isComplete ? TaskStatus.Complete : TaskStatus.Open,
                                ClosedAt = isComplete ? meetingDate.AddDays(5) : null,
                            });
                        }
                    }
                }
            }
        }

        return (meetings, agendaItems, minutes, actionItems);
    }

    private static List<PmTask> CreateProjectTasks(List<Project> activeProjects, Guid seedUserId)
    {
        var tasks = new List<PmTask>();
        var now = DateTime.UtcNow;

        foreach (var project in activeProjects.Take(3))
        {
            T(tasks, project.Id, seedUserId, now, "Review structural steel shop drawings",
                "Review and approve steel fabricator shop drawings for Level 2 framing.",
                TaskType.Submittal, TaskPriority.High, -14, TaskStatus.Complete);
            T(tasks, project.Id, seedUserId, now, "Coordinate MEP rough-in sequence",
                "Work with mechanical, electrical, and plumbing subs to establish routing priority.",
                TaskType.General, TaskPriority.Urgent, -7, TaskStatus.Complete);
            T(tasks, project.Id, seedUserId, now, "Submit RFI for foundation drain detail",
                "Architect detail shows 4-inch perf pipe but soils report recommends 6-inch.",
                TaskType.Rfi, TaskPriority.High, -10, TaskStatus.Complete);
            T(tasks, project.Id, seedUserId, now, "Update two-week lookahead schedule",
                "Incorporate latest delivery dates and subcontractor manpower into the schedule.",
                TaskType.General, TaskPriority.Normal, 2, TaskStatus.InProgress);
            T(tasks, project.Id, seedUserId, now, "Process Change Order #003",
                "Owner-requested lobby finish upgrade. Get pricing from tile and millwork subs.",
                TaskType.General, TaskPriority.High, 5, TaskStatus.InProgress);
            T(tasks, project.Id, seedUserId, now, "Schedule concrete pour - Level 2 deck",
                "Coordinate with concrete sub, pump company, and testing lab. Need 3-day weather window.",
                TaskType.General, TaskPriority.Urgent, 3, TaskStatus.InProgress);
            T(tasks, project.Id, seedUserId, now, "Complete monthly billing application",
                "Prepare G702/G703 for current billing period. Update percent complete on all SOV line items.",
                TaskType.General, TaskPriority.High, 7, TaskStatus.Open);
            T(tasks, project.Id, seedUserId, now, "Order long-lead electrical equipment",
                "Switchgear and transfer switch have 16-week lead time. Place PO by end of week.",
                TaskType.General, TaskPriority.Urgent, 1, TaskStatus.Open);
            T(tasks, project.Id, seedUserId, now, "Prepare for owner progress meeting",
                "Compile schedule update, cost report, RFI log, and submittal log.",
                TaskType.MeetingAction, TaskPriority.Normal, 4, TaskStatus.Open);
            T(tasks, project.Id, seedUserId, now, "Review safety plan for crane operations",
                "Mobile crane arriving next week for steel erection. Review lift plan and swing radius.",
                TaskType.General, TaskPriority.High, 3, TaskStatus.Open);
            T(tasks, project.Id, seedUserId, now, "Close out punch list items - Phase 1",
                "Walk Phase 1 areas with architect, document deficiencies, assign corrections to subs.",
                TaskType.General, TaskPriority.Normal, 14, TaskStatus.Open);
            T(tasks, project.Id, seedUserId, now, "Update as-built drawings",
                "Mark up structural and MEP as-builts with field changes from the past month.",
                TaskType.General, TaskPriority.Low, 21, TaskStatus.Open);
            T(tasks, project.Id, seedUserId, now, "Submit prevailing wage certified payroll",
                "Compile WH-347 reports for all trades. Verify rates against current determination.",
                TaskType.General, TaskPriority.High, 1, TaskStatus.InProgress);
            T(tasks, project.Id, seedUserId, now, "Inspect waterproofing at foundation",
                "Below-grade waterproofing complete. Schedule third-party inspection before backfill.",
                TaskType.DailyReport, TaskPriority.High, 5, TaskStatus.Open);
            T(tasks, project.Id, seedUserId, now, "Request AHJ fire alarm inspection",
                "Fire alarm rough-in complete on Levels 1-2. Schedule AHJ inspection.",
                TaskType.General, TaskPriority.Normal, 10, TaskStatus.Open);
        }

        return tasks;

        // Local helper to keep task creation concise
        static void T(
            List<PmTask> list, Guid projectId, Guid userId, DateTime baseTime,
            string title, string desc,
            TaskType type, TaskPriority priority, int dueDays, TaskStatus status)
        {
            var dueDate = baseTime.AddDays(dueDays);
            list.Add(new PmTask
            {
                ProjectId = projectId,
                Title = title,
                Description = desc,
                TaskType = type,
                Priority = priority,
                Status = status,
                AssignedByUserId = userId,
                AssignedToName = priority == TaskPriority.Urgent ? "Mike Torres"
                    : priority == TaskPriority.High ? "Sarah Chen" : "James Park",
                DueDate = dueDate,
                StartedAt = status is TaskStatus.InProgress or TaskStatus.Complete
                    ? dueDate.AddDays(-3) : null,
                CompletedAt = status == TaskStatus.Complete ? dueDate.AddDays(-1) : null,
                ReferenceType = type switch
                {
                    TaskType.Rfi => TaskReferenceType.Rfi,
                    TaskType.Submittal => TaskReferenceType.Submittal,
                    TaskType.MeetingAction => TaskReferenceType.Meeting,
                    TaskType.DailyReport => TaskReferenceType.DailyReport,
                    _ => TaskReferenceType.None,
                },
            });
        }
    }

    // ===========================================================================================
    // Multi-company seed orchestration + factory methods
    // ===========================================================================================

    /// <summary>
    /// Seeds a full set of construction data for a single company.
    /// Mirrors the SeedCoreAsync orchestration but accepts parameterized definitions.
    /// CostCodes and Equipment are NOT company-scoped — they are shared (seeded by Company 01).
    /// </summary>
    private async Task SeedCompanyAsync(
        Guid companyId,
        CompanyProjectDef[] projectDefs,
        CompanyVendorDef[] vendorDefs,
        CompanyCustomerDef[] customerDefs,
        CompanyEmployeeDef[] employeeDefs,
        Guid seedUserId,
        CancellationToken ct)
    {
        // ── 0. Switch RLS + CompanyContext to target company ────────
        // Without this, SaveChangesAsync resets app.current_company to the
        // DI-scoped CompanyContext (Company 01), and Postgres RLS WITH CHECK
        // rejects inserts for any other CompanyId.
        var previousCompanyId = companyContext.CompanyId;
        companyContext.CompanyId = companyId;

        // ── 1. Root entities ────────────────────────────────────────
        var projects = CreateCompanyProjects(projectDefs);
        var vendors = CreateCompanyVendors(vendorDefs);
        var customers = CreateCompanyCustomers(customerDefs);
        var employees = CreateCompanyEmployees(employeeDefs, companyId);
        var bids = CreateCompanyBids(projects);

        StampCompanyId(projects, companyId);
        foreach (var p in projects)
        {
            StampCompanyId(p.Phases, companyId);
            StampCompanyId(p.Projections, companyId);
        }
        StampCompanyId(bids, companyId);
        foreach (var b in bids)
            StampCompanyId(b.Items, companyId);
        StampCompanyId(customers, companyId);
        StampCompanyId(vendors, companyId);

        db.Set<Project>().AddRange(projects);
        db.Set<Bid>().AddRange(bids);
        db.Set<Employee>().AddRange(employees);
        db.Set<Customer>().AddRange(customers);
        db.Set<Vendor>().AddRange(vendors);
        await db.SaveChangesAsync(ct);

        // ── 2. Project assignments ──────────────────────────────────
        var activeProjects = projects.Where(p => p.Status == ProjectStatus.Active).ToList();
        var allWorkableProjects = projects.Where(p =>
            p.Status is ProjectStatus.Active or ProjectStatus.Completed).ToList();

        // CostCodes are NOT company-scoped — query the shared set
        var costCodes = await db.Set<CostCode>()
            .IgnoreQueryFilters()
            .Where(c => !c.IsDeleted)
            .ToListAsync(ct);

        var assignments = CreateCompanyProjectAssignments(employees, activeProjects);
        StampCompanyId(assignments, companyId);
        db.Set<ProjectAssignment>().AddRange(assignments);
        await db.SaveChangesAsync(ct);

        // ── 3. Time entries ─────────────────────────────────────────
        var timeEntries = CreateCompanyTimeEntries(employees, activeProjects, costCodes, assignments);
        StampCompanyId(timeEntries, companyId);
        db.Set<TimeEntry>().AddRange(timeEntries);
        await db.SaveChangesAsync(ct);

        // ── 4. Subcontracts ─────────────────────────────────────────
        var subcontracts = CreateCompanySubcontracts(projects, vendors);
        StampCompanyId(subcontracts, companyId);
        foreach (var sub in subcontracts)
            StampCompanyId(sub.ChangeOrders, companyId);
        db.Set<Subcontract>().AddRange(subcontracts);
        await db.SaveChangesAsync(ct);

        // ── 5. Payment applications + vendor invoices ───────────────
        var paymentApplications = CreatePaymentApplications(subcontracts);
        StampCompanyId(paymentApplications, companyId);
        foreach (var pa in paymentApplications)
            StampCompanyId(pa.LineItems, companyId);
        db.Set<PaymentApplication>().AddRange(paymentApplications);

        var vendorInvoices = CreateVendorInvoices(vendors, subcontracts);
        StampCompanyId(vendorInvoices, companyId);
        db.Set<VendorInvoice>().AddRange(vendorInvoices);
        await db.SaveChangesAsync(ct);

        // ── 6. Owner contracts → SOV → billing apps ─────────────────
        var ownerContracts = CreateOwnerContracts(allWorkableProjects, customers);
        StampCompanyId(ownerContracts, companyId);
        db.Set<OwnerContract>().AddRange(ownerContracts);
        await db.SaveChangesAsync(ct);

        var ownerSovs = CreateOwnerScheduleOfValues(ownerContracts);
        StampCompanyId(ownerSovs, companyId);
        foreach (var sov in ownerSovs)
            StampCompanyId(sov.LineItems, companyId);
        db.Set<OwnerScheduleOfValues>().AddRange(ownerSovs);
        await db.SaveChangesAsync(ct);

        var billingApps = CreateBillingApplications(ownerContracts, ownerSovs);
        StampCompanyId(billingApps, companyId);
        foreach (var ba in billingApps)
            StampCompanyId(ba.LineItems, companyId);
        db.Set<BillingApplication>().AddRange(billingApps);
        await db.SaveChangesAsync(ct);

        // ── 7. WIP reports ──────────────────────────────────────────
        var wipReports = CreateWipReports(allWorkableProjects);
        StampCompanyId(wipReports, companyId);
        foreach (var wr in wipReports)
            StampCompanyId(wr.Lines, companyId);
        db.Set<WipReport>().AddRange(wipReports);
        await db.SaveChangesAsync(ct);

        // ── 8. Retention holds ──────────────────────────────────────
        var retentionHolds = CreateRetentionHolds(allWorkableProjects, subcontracts);
        StampCompanyId(retentionHolds, companyId);
        db.Set<RetentionHold>().AddRange(retentionHolds);
        await db.SaveChangesAsync(ct);

        // ── 9. Pay periods → payroll runs ───────────────────────────
        var payPeriods = CreatePayPeriods();
        StampCompanyId(payPeriods, companyId);
        db.Set<PayPeriod>().AddRange(payPeriods);
        await db.SaveChangesAsync(ct);

        var payrollRuns = CreatePayrollRuns(payPeriods, employees);
        StampCompanyId(payrollRuns, companyId);
        foreach (var pr in payrollRuns)
            StampCompanyId(pr.Lines, companyId);
        db.Set<PayrollRun>().AddRange(payrollRuns);
        await db.SaveChangesAsync(ct);

        // ── 10. Submittals + punch list ─────────────────────────────
        var submittals = CreateSubmittals(allWorkableProjects);
        StampCompanyId(submittals, companyId);
        db.Set<PmSubmittal>().AddRange(submittals);

        if (seedUserId != Guid.Empty)
        {
            var punchListItems = CreatePunchListItems(
                projects.Where(p => p.Status == ProjectStatus.Completed).ToList(),
                seedUserId);
            StampCompanyId(punchListItems, companyId);
            db.Set<PmPunchListItem>().AddRange(punchListItems);
        }
        await db.SaveChangesAsync(ct);

        // ── 11. Schedules → dependencies ────────────────────────────
        var (schedules, scheduleActivities, scheduleDeps) = CreateSchedules(activeProjects);
        StampCompanyId(schedules, companyId);
        StampCompanyId(scheduleActivities, companyId);
        StampCompanyId(scheduleDeps, companyId);
        db.Set<PmSchedule>().AddRange(schedules);
        db.Set<PmScheduleActivity>().AddRange(scheduleActivities);
        await db.SaveChangesAsync(ct);
        db.Set<PmScheduleDependency>().AddRange(scheduleDeps);
        await db.SaveChangesAsync(ct);

        // ── 12. RFIs ────────────────────────────────────────────────
        var rfis = CreateRfis(activeProjects, seedUserId);
        StampCompanyId(rfis, companyId);
        db.Set<Rfi>().AddRange(rfis);
        await db.SaveChangesAsync(ct);

        // ── 13. Daily reports → crews/equipment ─────────────────────
        var dailyReports = CreateDailyReports(activeProjects, seedUserId);
        StampCompanyId(dailyReports, companyId);
        db.Set<PmDailyReport>().AddRange(dailyReports);
        await db.SaveChangesAsync(ct);

        var dailyReportCrews = new List<PmDailyReportCrew>();
        var dailyReportEquipment = new List<PmDailyReportEquipment>();
        foreach (var dr in dailyReports)
        {
            dailyReportCrews.AddRange(CreateDailyReportCrews(dr));
            dailyReportEquipment.AddRange(CreateDailyReportEquipment(dr));
        }
        StampCompanyId(dailyReportCrews, companyId);
        StampCompanyId(dailyReportEquipment, companyId);
        db.Set<PmDailyReportCrew>().AddRange(dailyReportCrews);
        db.Set<PmDailyReportEquipment>().AddRange(dailyReportEquipment);
        await db.SaveChangesAsync(ct);

        // ── 14. Chart of accounts → periods → journal entries ───────
        var chartOfAccounts = CreateChartOfAccounts();
        StampCompanyId(chartOfAccounts, companyId);
        db.Set<ChartOfAccount>().AddRange(chartOfAccounts);
        await db.SaveChangesAsync(ct);

        var accountingPeriods = CreateAccountingPeriods();
        StampCompanyId(accountingPeriods, companyId);
        db.Set<AccountingPeriod>().AddRange(accountingPeriods);
        await db.SaveChangesAsync(ct);

        var journalEntries = CreateJournalEntries(chartOfAccounts, activeProjects, seedUserId);
        StampCompanyId(journalEntries, companyId);
        foreach (var je in journalEntries)
            StampCompanyId(je.Lines, companyId);
        db.Set<JournalEntry>().AddRange(journalEntries);
        await db.SaveChangesAsync(ct);

        // ── 15. Lien waivers ────────────────────────────────────────
        var lienWaivers = CreateLienWaivers(allWorkableProjects, subcontracts, vendors);
        StampCompanyId(lienWaivers, companyId);
        db.Set<LienWaiver>().AddRange(lienWaivers);
        await db.SaveChangesAsync(ct);

        // ── 16. Purchase orders ─────────────────────────────────────
        var purchaseOrders = CreatePurchaseOrders(activeProjects, vendors);
        StampCompanyId(purchaseOrders, companyId);
        foreach (var po in purchaseOrders)
            StampCompanyId(po.Lines, companyId);
        db.Set<PurchaseOrder>().AddRange(purchaseOrders);
        await db.SaveChangesAsync(ct);

        // ── 17. Bank accounts ───────────────────────────────────────
        var bankAccounts = CreateBankAccounts(chartOfAccounts);
        StampCompanyId(bankAccounts, companyId);
        db.Set<BankAccount>().AddRange(bankAccounts);
        await db.SaveChangesAsync(ct);

        // ── 18. Work classifications → wage determinations ──────────
        var workClassifications = CreateWorkClassifications();
        StampCompanyId(workClassifications, companyId);
        db.Set<WorkClassification>().AddRange(workClassifications);
        await db.SaveChangesAsync(ct);

        var wageDeterminations = CreateWageDeterminations(activeProjects, workClassifications);
        StampCompanyId(wageDeterminations, companyId);
        foreach (var wd in wageDeterminations)
            StampCompanyId(wd.Rates, companyId);
        db.Set<WageDetermination>().AddRange(wageDeterminations);
        await db.SaveChangesAsync(ct);

        // Restore previous company context
        companyContext.CompanyId = previousCompanyId;
    }

    // ===========================================================================================
    // Company-specific factory methods (parameterized from definition records)
    // ===========================================================================================

    private static List<Project> CreateCompanyProjects(CompanyProjectDef[] defs)
    {
        var now = DateTime.UtcNow;
        var projects = new List<Project>();

        foreach (var d in defs)
        {
            projects.Add(new Project
            {
                Name = d.Name,
                Number = d.Number,
                Description = d.Desc,
                Status = d.Status,
                Type = d.Type,
                Address = d.Addr,
                City = d.City,
                State = d.St,
                ZipCode = d.Zip,
                ClientName = d.Client,
                ClientContact = d.Contact,
                ClientEmail = d.Email,
                ClientPhone = d.Phone,
                StartDate = now.AddMonths(d.StartMo),
                EstimatedCompletionDate = now.AddMonths(d.EndMo),
                ActualCompletionDate = d.Status == ProjectStatus.Completed
                    ? now.AddMonths(d.EndMo) : null,
                ContractAmount = d.Contract,
                OriginalBudget = d.Budget,
                Phases = GeneratePhases(d.Type, d.StartMo, d.EndMo, d.Budget,
                    d.Status == ProjectStatus.Completed)
            });
        }

        return projects;
    }

    private static List<Vendor> CreateCompanyVendors(CompanyVendorDef[] defs)
    {
        return defs.Select(d => new Vendor
        {
            Name = d.Name,
            Code = d.Code,
            ContactName = d.Contact,
            ContactEmail = d.Email,
            TradeClassification = d.Trade,
            PaymentTerms = "Net 30",
            W9OnFile = true,
            IsActive = true
        }).ToList();
    }

    private static List<Customer> CreateCompanyCustomers(CompanyCustomerDef[] defs)
    {
        return defs.Select(d => new Customer
        {
            Name = d.Name,
            Code = d.Code,
            ContactName = d.Contact,
            ContactEmail = d.Email,
            PaymentTerms = d.Terms,
            IsActive = true
        }).ToList();
    }

    private static List<Employee> CreateCompanyEmployees(CompanyEmployeeDef[] defs, Guid companyId)
    {
        var random = new Random(companyId.GetHashCode()); // Deterministic per company
        return defs.Select(d => new Employee
        {
            EmployeeNumber = d.Number,
            FirstName = d.FirstName,
            LastName = d.LastName,
            Email = d.Email,
            Phone = d.Phone,
            Title = d.Title,
            Classification = d.Classification,
            BaseHourlyRate = d.BaseRate,
            HireDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-random.Next(1, 8))),
            IsActive = true,
            HomeCompanyId = companyId
        }).ToList();
    }

    private static List<Bid> CreateCompanyBids(List<Project> projects)
    {
        var now = DateTime.UtcNow;
        var bids = new List<Bid>();

        foreach (var project in projects.Take(3))
        {
            var bid = new Bid
            {
                Name = project.Name,
                Number = project.Number.Replace("-PRJ-", "-BID-"),
                Status = project.Status is ProjectStatus.Active or ProjectStatus.Completed
                    ? BidStatus.Won : BidStatus.Submitted,
                EstimatedValue = project.ContractAmount,
                BidDate = project.StartDate?.AddMonths(-2) ?? now.AddMonths(-1),
                DueDate = project.StartDate?.AddMonths(-2).AddDays(7) ?? now.AddMonths(-1),
                Owner = "Estimating Dept",
                Description = project.Description,
                Items =
                [
                    new BidItem { Description = "General conditions & supervision", Category = BidItemCategory.Labor, Quantity = 1, UnitCost = project.ContractAmount * 0.08m, TotalCost = project.ContractAmount * 0.08m },
                    new BidItem { Description = "Site work & earthwork", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = project.ContractAmount * 0.15m, TotalCost = project.ContractAmount * 0.15m },
                    new BidItem { Description = "Structural systems", Category = BidItemCategory.Material, Quantity = 1, UnitCost = project.ContractAmount * 0.28m, TotalCost = project.ContractAmount * 0.28m },
                    new BidItem { Description = "MEP systems", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = project.ContractAmount * 0.27m, TotalCost = project.ContractAmount * 0.27m },
                    new BidItem { Description = "Finishes & closeout", Category = BidItemCategory.Material, Quantity = 1, UnitCost = project.ContractAmount * 0.22m, TotalCost = project.ContractAmount * 0.22m },
                ]
            };
            bids.Add(bid);
        }

        return bids;
    }

    private static List<Subcontract> CreateCompanySubcontracts(List<Project> projects, List<Vendor> vendors)
    {
        var now = DateTime.UtcNow;
        var subcontracts = new List<Subcontract>();
        var scNumber = 1;
        var random = new Random(projects.Count * 31 + vendors.Count); // Deterministic

        foreach (var project in projects.Where(p =>
            p.Status is ProjectStatus.Active or ProjectStatus.Completed))
        {
            // Assign 2 vendors per project, cycling through the vendor pool
            var vendorStartIdx = (scNumber - 1) % vendors.Count;
            for (var v = 0; v < Math.Min(2, vendors.Count); v++)
            {
                var vendor = vendors[(vendorStartIdx + v) % vendors.Count];
                var baseValue = Math.Round(project.ContractAmount * (0.12m + (decimal)random.NextDouble() * 0.08m), 2);
                var isComplete = project.Status == ProjectStatus.Completed;
                var billedPct = isComplete ? 1.0m
                    : Math.Round(0.15m + (decimal)random.NextDouble() * 0.45m, 2);
                var billed = Math.Round(baseValue * billedPct, 2);
                var retPct = 10m;
                var retHeld = Math.Round(billed * (retPct / 100m), 2);
                var paid = Math.Round(billed - retHeld, 2);

                var prefix = project.Number.Split('-')[0]; // PWI, VHD, CVE
                var sub = new Subcontract
                {
                    ProjectId = project.Id,
                    SubcontractNumber = $"SC-{prefix}-{scNumber:D3}",
                    SubcontractorName = vendor.Name,
                    SubcontractorContact = vendor.ContactName,
                    SubcontractorEmail = vendor.ContactEmail,
                    ScopeOfWork = $"{vendor.TradeClassification} scope for {project.Name}",
                    TradeCode = vendor.TradeClassification,
                    OriginalValue = baseValue,
                    CurrentValue = baseValue,
                    BilledToDate = billed,
                    PaidToDate = paid,
                    RetainagePercent = retPct,
                    RetainageHeld = retHeld,
                    ExecutionDate = project.StartDate ?? now.AddMonths(-3),
                    StartDate = (project.StartDate ?? now.AddMonths(-3)).AddDays(14),
                    CompletionDate = project.EstimatedCompletionDate ?? now.AddMonths(6),
                    ActualCompletionDate = isComplete
                        ? project.EstimatedCompletionDate : null,
                    Status = isComplete ? SubcontractStatus.Complete : SubcontractStatus.InProgress,
                    InsuranceExpirationDate = now.AddMonths(8),
                    InsuranceCurrent = true,
                    Notes = $"{vendor.TradeClassification} work — {(isComplete ? "complete" : "in progress")}"
                };

                // Add a change order on every other subcontract
                if (scNumber % 2 == 0)
                {
                    var coAmount = Math.Round(baseValue * 0.06m, 2);
                    sub.CurrentValue += coAmount;
                    sub.ChangeOrders =
                    [
                        new ChangeOrder
                        {
                            ChangeOrderNumber = "CO-001",
                            Title = $"Additional {vendor.TradeClassification} scope",
                            Description = $"Additional scope for {vendor.TradeClassification} per field conditions on {project.Name}.",
                            Reason = "Field condition",
                            Amount = coAmount,
                            Status = ChangeOrderStatus.Approved,
                            SubmittedDate = now.AddMonths(-1),
                            ApprovedDate = now.AddDays(-15),
                            ApprovedBy = "Project Manager",
                            DaysExtension = 0
                        }
                    ];
                }

                subcontracts.Add(sub);
                scNumber++;
            }
        }

        return subcontracts;
    }

    // ===========================================================================================
    // Company data definitions (Companies 02, 03, 04)
    // ===========================================================================================

    // ── Company 02: Summit Water Infrastructure (PWI) ──────────────

    private static CompanyProjectDef[] GetPwiProjects() =>
    [
        new("PWI-PRJ-001", "Regional Water Treatment Plant Expansion",
            "Expand existing 12 MGD water treatment plant to 20 MGD. New clarifiers, filter gallery, chemical feed systems, and SCADA upgrades.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "8500 River Road", "West Sacramento", "CA", "95691",
            "Sacramento Regional Water Authority", "Demo Contact P01", "contactp01@example.com", "(555) 000-6100",
            -5, 14, 18_500_000m, 17_200_000m),

        new("PWI-PRJ-002", "Stormwater Detention Basin - North Natomas",
            "45-acre regional stormwater detention basin with outlet structure, riprap channels, and wetland mitigation.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "4200 Elkhorn Blvd", "Sacramento", "CA", "95835",
            "City of Sacramento Utilities", "Demo Contact P02", "contactp02@example.com", "(555) 000-6201",
            -3, 8, 8_200_000m, 7_600_000m),

        new("PWI-PRJ-003", "48-Inch Trunk Sewer Replacement",
            "2.8 miles of 48-inch RCP trunk sewer replacement via open-cut and microtunneling. Includes 12 manholes and bypass pumping.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "Freeport Blvd at Sutterville", "Sacramento", "CA", "95822",
            "Sacramento Area Sewer District", "Demo Contact P03", "contactp03@example.com", "(555) 000-6302",
            -7, 6, 14_800_000m, 13_900_000m),

        new("PWI-PRJ-004", "Recycled Water Distribution System Phase III",
            "12 miles of purple pipe distribution, 3 pump stations, and 2 storage tanks for recycled water delivery to commercial irrigators.",
            ProjectStatus.Completed, ProjectType.Infrastructure,
            "Industrial Blvd at Gerber Rd", "Sacramento", "CA", "95823",
            "Regional San", "Demo Contact", "contactp04@example.com", "(555) 000-6403",
            -18, -3, 11_200_000m, 10_500_000m),

        new("PWI-PRJ-005", "Groundwater Well Field - South County",
            "6 new production wells (1,500 GPM each), raw water transmission main, and well house structures with VFD pumping.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "Bond Road at Bradshaw", "Elk Grove", "CA", "95624",
            "Sacramento County Water Agency", "Demo Contact", "contactp05@example.com", "(555) 000-6504",
            -2, 10, 6_500_000m, 6_100_000m),
    ];

    private static CompanyVendorDef[] GetPwiVendors() =>
    [
        new("Summit Pipe & Supply Co.", "PWI-V-001", "Pipe Supply", "Demo Contact V01", "tbradley@valleypipe.com"),
        new("Central Coast Excavation Inc.", "PWI-V-002", "Excavation", "Demo Contact", "mgonzalez@ccexcavation.com"),
        new("Summit Dewatering Systems", "PWI-V-003", "Dewatering", "Demo Contact V03", "snorton@summitdewater.example"),
        new("Summit Chemical Feed Equipment", "PWI-V-004", "Chemical Systems", "Demo Contact V04", "lchang@sierrachem.example"),
        new("Summit Chemical Feed Equipment", "PWI-V-004", "Chemical Systems", "Demo Contact V04", "lchang@summitvendor.example"),
    ];

    private static CompanyCustomerDef[] GetPwiCustomers() =>
    [
        new("Sacramento Regional Water Authority", "PWI-C-001", "Demo Contact P01", "contactp01@example.com", "Net 30"),
        new("City of Sacramento Utilities", "PWI-C-002", "Demo Contact P02", "contactp02@example.com", "Net 30"),
        new("Sacramento Area Sewer District", "PWI-C-003", "Demo Contact P03", "contactp03@example.com", "Net 45"),
    ];

    private static CompanyEmployeeDef[] GetPwiEmployees() =>
    [
        new("PWI-001", "Daniel", "Herrera", "dherrera@demo.example", "(916) 555-6001", "Project Manager", EmployeeClassification.Salaried, 78.00m),
        new("PWI-002", "Karen", "Yoshida", "kyoshida@demo.example", "(916) 555-6002", "Project Engineer", EmployeeClassification.Salaried, 56.00m),
        new("PWI-003", "Miguel", "Reyes", "mreyes@demo.example", "(916) 555-6003", "Site Superintendent", EmployeeClassification.Supervisor, 58.00m),
        new("PWI-004", "Sandra", "Novak", "snovak@demo.example", "(916) 555-6004", "Pipeline Foreman", EmployeeClassification.Supervisor, 52.00m),
        new("PWI-005", "Carlos", "Mendoza", "cmendoza@demo.example", "(916) 555-6005", "Equipment Operator", EmployeeClassification.Hourly, 42.00m),
        new("PWI-006", "Lisa", "Tran", "ltran2@demo.example", "(916) 555-6006", "Journeyman Pipefitter", EmployeeClassification.Hourly, 46.00m),
        new("PWI-007", "Robert", "Okafor", "rokafor@demo.example", "(916) 555-6007", "Heavy Equipment Operator", EmployeeClassification.Hourly, 44.00m),
        new("PWI-001", "Demo", "Employee100", "demo.employee.101@demo.example", "(555) 000-6001", "Project Manager", EmployeeClassification.Salaried, 78.00m),
    ];

    // ── Company 03: Summit Highway Division (VHD) ───────────────────

    private static CompanyProjectDef[] GetVhdProjects() =>
    [
        new("VHD-PRJ-001", "SR-99 Bridge Widening - Elk Grove",
            "Widen existing 4-lane bridge to 6 lanes over Cosumnes River. New prestressed girders, widened abutments, and approach slabs.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "SR-99 at Cosumnes River", "Elk Grove", "CA", "95624",
            "California Department of Transportation", "Demo Contact 23", "contact23@example.com", "(555) 000-7100",
            -6, 12, 22_000_000m, 20_500_000m),

        new("VHD-PRJ-002", "I-5 / Pocket Road Interchange Improvement",
            "Interchange reconstruction: new diamond interchange, ramp widening, signal upgrades, sound walls, and utility relocations.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "I-5 at Pocket Road", "Sacramento", "CA", "95831",
            "California Department of Transportation", "Demo Contact 23", "contact23@example.com", "(555) 000-7201",
            -4, 16, 28_500_000m, 26_800_000m),

        new("VHD-PRJ-003", "Watt Avenue Resurfacing & Complete Streets",
            "4.2 miles of full-depth reclamation, new AC overlay, Class IV bike lanes, ADA curb ramps, and signal upgrades.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "Watt Ave - Arden to Elkhorn", "Sacramento", "CA", "95821",
            "Sacramento County DOT", "Demo Contact", "pliu@summitvendor.example", "(555) 000-7302",
            -2, 7, 9_800_000m, 9_200_000m),

        new("VHD-PRJ-004", "Highway 50 Sound Wall Project - Rancho Cordova",
            "3.6 miles of precast concrete sound walls (16-ft height), retaining walls, and landscaping along Highway 50.",
            ProjectStatus.Completed, ProjectType.Infrastructure,
            "US-50 at Sunrise Blvd", "Rancho Cordova", "CA", "95742",
            "California Department of Transportation", "Susan Chen", "susan.chen@dot.ca.gov", "(916) 555-7403",
            -16, -2, 12_400_000m, 11_800_000m),

        new("VHD-PRJ-005", "Hazel Avenue Grade Separation",
            "Railroad grade separation at Hazel Ave/UPRR crossing. New bridge structure, road realignment, utility relocation, and traffic management.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "Hazel Ave at UPRR", "Rancho Cordova", "CA", "95670",
            "City of Rancho Cordova", "Demo Contact P17", "mthompson@cityofrc.example", "(555) 000-7504",
            -8, 10, 35_000_000m, 33_000_000m),
    ];

    private static CompanyVendorDef[] GetVhdVendors() =>
    [
        new("Granite Asphalt & Paving Inc.", "VHD-V-001", "Asphalt/Paving", "Demo Contact V01", "rdonovan@graniteasphalt.example"),
        new("Summit Steel Fabricators LLC", "VHD-V-002", "Steel Fabrication", "Demo Contact V02", "jkim@highwaysteel.example"),
        new("Summit Guardrail & Barrier", "VHD-V-003", "Guardrail/Barrier", "Demo Contact V03", "trusso@pacguardrail.example"),
        new("Valley Traffic Control Services", "VHD-V-004", "Traffic Control", "Demo Contact", "rgutierrez@valleytcs.com"),
        new("NorCal Earthmovers Inc.", "VHD-V-005", "Earthwork/Grading", "Demo Contact", "dwright@summitvendor.example"),
    ];

    private static CompanyCustomerDef[] GetVhdCustomers() =>
    [
        new("California Department of Transportation", "VHD-C-001", "Demo Contact 23", "contact23@example.com", "Net 30"),
        new("Sacramento County DOT", "VHD-C-002", "Demo Contact", "pliu@summitvendor.example", "Net 30"),
        new("City of Rancho Cordova", "VHD-C-003", "Demo Contact P17", "mthompson@cityofrc.example", "Net 30"),
    ];

    private static CompanyEmployeeDef[] GetVhdEmployees() =>
    [
        new("VHD-001", "Patrick", "Sullivan", "psullivan@demo.example", "(916) 555-7001", "Project Manager", EmployeeClassification.Salaried, 82.00m),
        new("VHD-002", "Angela", "Tran", "atran@demo.example", "(916) 555-7002", "Project Engineer", EmployeeClassification.Salaried, 58.00m),
        new("VHD-003", "Victor", "Petrov", "vpetrov@demo.example", "(916) 555-7003", "General Superintendent", EmployeeClassification.Supervisor, 65.00m),
        new("VHD-004", "Maria", "Castillo", "mcastillo2@demo.example", "(916) 555-7004", "Paving Foreman", EmployeeClassification.Supervisor, 54.00m),
        new("VHD-005", "James", "Nakamura", "jnakamura@demo.example", "(916) 555-7005", "Heavy Equipment Operator", EmployeeClassification.Hourly, 46.00m),
        new("VHD-006", "Steve", "Morales", "smorales2@demo.example", "(916) 555-7006", "Ironworker", EmployeeClassification.Hourly, 48.00m),
        new("VHD-007", "Diane", "Chen", "dchen2@demo.example", "(916) 555-7007", "Traffic Control Specialist", EmployeeClassification.Hourly, 38.00m),
        new("VHD-001", "Demo", "Employee108", "demo.employee.109@demo.example", "(555) 000-7001", "Project Manager", EmployeeClassification.Salaried, 82.00m),
    ];

    // ── Company 04: Summit Electric Co. (CVE) ───────────────────

    private static CompanyProjectDef[] GetCveProjects() =>
    [
        new("CVE-PRJ-001", "Solar Farm Installation Phase II - Rancho Seco",
            "85 MW ground-mount solar array: 180,000 panels, inverter stations, BESS integration, and gen-tie line to PG&E substation.",
            ProjectStatus.Active, ProjectType.Industrial,
            "14440 Twin Cities Road", "Herald", "CA", "95638",
            "Summit Solar Development LLC", "Demo Contact C01", "arivera@sunpower.example", "(555) 000-8100",
            -4, 10, 32_000_000m, 30_000_000m),

        new("CVE-PRJ-002", "Hospital Emergency Power Upgrade - Mercy General",
            "Replace 2MW emergency generator system, new ATS gear, paralleling switchgear, and critical branch rewire for OSHPD compliance.",
            ProjectStatus.Active, ProjectType.Renovation,
            "4001 J Street", "Sacramento", "CA", "95819",
            "Summit Health Sacramento", "Demo Contact C02", "kngo@dignityhealth.example", "(555) 000-8201",
            -3, 8, 6_800_000m, 6_300_000m),

        new("CVE-PRJ-003", "PG&E Substation Upgrade - Folsom",
            "230kV/69kV substation modernization: new transformers, breakers, relay protection, SCADA, and control building.",
            ProjectStatus.Active, ProjectType.Infrastructure,
            "2000 Lake Natoma Blvd", "Folsom", "CA", "95630",
            "Pacific Gas & Electric", "Demo Contact C03", "dpark@pge.example", "(555) 000-8302",
            -6, 8, 15_500_000m, 14_500_000m),

        new("CVE-PRJ-004", "Data Center Power Distribution - Rancho Cordova",
            "20MW critical power infrastructure: medium-voltage switchgear, PDUs, UPS systems, and redundant bus duct for Tier III facility.",
            ProjectStatus.Completed, ProjectType.Industrial,
            "11200 White Rock Road", "Rancho Cordova", "CA", "95742",
            "Summit Data Centers", "Demo Contact C04", "madams@cyrusone.example", "(555) 000-8403",
            -14, -1, 18_000_000m, 16_800_000m),

        new("CVE-PRJ-005", "EV Charging Hub - Sacramento Railyards",
            "48-stall DC fast-charging hub with 2MW utility service, battery storage, and canopy-mounted solar. 350kW chargers.",
            ProjectStatus.Active, ProjectType.Commercial,
            "300 Railyards Blvd", "Sacramento", "CA", "95811",
            "Summit EV Charging", "Demo Contact", "skim@summitvendor.example", "(555) 000-8504",
            -1, 6, 4_200_000m, 3_900_000m),
    ];

    private static CompanyVendorDef[] GetCveVendors() =>
    [
        new("Summit Electrical Wholesale", "CVE-V-001", "Electrical Supply", "Demo Contact V01", "psantos@centralelec.example"),
        new("Valley Transformer Co.", "CVE-V-002", "Transformers", "Demo Contact V02", "npark@valleytransformer.example"),
        new("Summit Transformer Co.", "CVE-V-002", "Transformers", "Demo Contact V02", "npark@summittransformer.example"),
        new("Summit Solar Solutions Inc.", "CVE-V-004", "Solar Installation", "Demo Contact V03", "rgupta@solararraysolutions.example"),
        new("NorCal Switchgear & Controls", "CVE-V-005", "Switchgear", "Demo Contact", "treeves@summitvendor.example"),
    ];

    private static CompanyCustomerDef[] GetCveCustomers() =>
    [
        new("Summit Solar Development LLC", "CVE-C-001", "Demo Contact C01", "arivera@sunpower.example", "Net 30"),
        new("Summit Health Sacramento", "CVE-C-002", "Demo Contact C02", "kngo@dignityhealth.example", "Net 30"),
        new("Pacific Gas & Electric", "CVE-C-003", "Demo Contact C03", "dpark@pge.example", "Net 45"),
    ];

    private static CompanyEmployeeDef[] GetCveEmployees() =>
    [
        new("CVE-001", "Brian", "Whitfield", "bwhitfield2@demo.example", "(916) 555-8001", "Project Manager", EmployeeClassification.Salaried, 80.00m),
        new("CVE-002", "Jennifer", "Liu", "jliu@demo.example", "(916) 555-8002", "Project Engineer", EmployeeClassification.Salaried, 55.00m),
        new("CVE-003", "Marcus", "Watts", "mwatts@demo.example", "(916) 555-8003", "Electrical Superintendent", EmployeeClassification.Supervisor, 62.00m),
        new("CVE-004", "Rosa", "Delgado", "rdelgado@demo.example", "(916) 555-8004", "Electrical Foreman", EmployeeClassification.Supervisor, 54.00m),
        new("CVE-005", "Tony", "Nguyen", "tnguyen@demo.example", "(916) 555-8005", "Journeyman Electrician", EmployeeClassification.Hourly, 48.00m),
        new("CVE-006", "Andrea", "Sims", "asims2@demo.example", "(916) 555-8006", "Journeyman Electrician", EmployeeClassification.Hourly, 46.00m),
        new("CVE-007", "Kevin", "Yamamoto", "ksoto2@demo.example", "(916) 555-8007", "Low-Voltage Technician", EmployeeClassification.Hourly, 40.00m),
        new("CVE-001", "Demo", "Employee116", "demo.employee.117@demo.example", "(555) 000-8001", "Project Manager", EmployeeClassification.Salaried, 80.00m),
    ];

    // ── Definition record types ─────────────────────────────────────

    private record CompanyProjectDef(
        string Number, string Name, string Desc,
        ProjectStatus Status, ProjectType Type,
        string Addr, string City, string St, string Zip,
        string Client, string Contact, string Email, string Phone,
        int StartMo, int EndMo, decimal Contract, decimal Budget);

    private record CompanyVendorDef(
        string Name, string Code, string Trade, string Contact, string Email);

    private record CompanyCustomerDef(
        string Name, string Code, string Contact, string Email, string Terms);

    private record CompanyEmployeeDef(
        string Number, string FirstName, string LastName, string Email, string Phone,
        string Title, EmployeeClassification Classification, decimal BaseRate);
}
