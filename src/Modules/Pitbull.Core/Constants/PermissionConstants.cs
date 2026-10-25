namespace Pitbull.Core.Constants;

/// <summary>
/// Single source of truth for all RBAC permission strings.
/// Referenced by: seed data, policy registration, authorization handler, controller attributes.
/// </summary>
public static class PermissionConstants
{
    // -- Projects (4) --
    public const string ProjectsView = "Projects.View";
    public const string ProjectsCreate = "Projects.Create";
    public const string ProjectsEdit = "Projects.Edit";
    public const string ProjectsDelete = "Projects.Delete";

    // -- Time Tracking (5) --
    public const string TimeTrackingView = "TimeTracking.View";
    public const string TimeTrackingCreate = "TimeTracking.Create";
    public const string TimeTrackingApprove = "TimeTracking.Approve";
    public const string TimeTrackingViewRates = "TimeTracking.ViewRates";
    public const string TimeTrackingDelete = "TimeTracking.Delete";

    // -- Bids (4) --
    public const string BidsView = "Bids.View";
    public const string BidsCreate = "Bids.Create";
    public const string BidsEdit = "Bids.Edit";
    public const string BidsConvertToProject = "Bids.ConvertToProject";

    // -- Contracts (4) --
    public const string ContractsView = "Contracts.View";
    public const string ContractsCreate = "Contracts.Create";
    public const string ContractsEdit = "Contracts.Edit";
    public const string ContractsApproveChangeOrders = "Contracts.ApproveChangeOrders";

    // -- Billing (5) --
    public const string BillingView = "Billing.View";
    public const string BillingCreate = "Billing.Create";
    public const string BillingApprove = "Billing.Approve";
    public const string BillingReleaseRetention = "Billing.ReleaseRetention";
    public const string BillingLienWaivers = "Billing.LienWaivers";

    // -- AP (5) --
    public const string APView = "AP.View";
    public const string APCreate = "AP.Create";
    public const string APApprove = "AP.Approve";
    public const string APManageVendors = "AP.ManageVendors";
    public const string APMatchInvoices = "AP.MatchInvoices";

    // -- AR (4) --
    public const string ARView = "AR.View";
    public const string ARCreate = "AR.Create";
    public const string ARManageCustomers = "AR.ManageCustomers";
    public const string ARApplyPayments = "AR.ApplyPayments";

    // -- Accounting (5) --
    public const string AccountingViewGL = "Accounting.ViewGL";
    public const string AccountingPostJournals = "Accounting.PostJournals";
    public const string AccountingManagePeriods = "Accounting.ManagePeriods";
    public const string AccountingViewWIP = "Accounting.ViewWIP";
    public const string AccountingManageBankAccounts = "Accounting.ManageBankAccounts";

    // -- Payroll (4) --
    public const string PayrollView = "Payroll.View";
    public const string PayrollProcess = "Payroll.Process";
    public const string PayrollCertifiedReport = "Payroll.CertifiedReport";
    public const string PayrollViewRates = "Payroll.ViewRates";

    // -- Project Management (8) --
    public const string PMRFIs = "PM.RFIs";
    public const string PMSubmittals = "PM.Submittals";
    public const string PMDailyReports = "PM.DailyReports";
    public const string PMSchedule = "PM.Schedule";
    public const string PMPunchList = "PM.PunchList";
    public const string PMMeetings = "PM.Meetings";
    public const string SpatialView = "Spatial.View";
    public const string SpatialManage = "Spatial.Manage";

    // -- Equipment (2) --
    public const string EquipmentView = "Equipment.View";
    public const string EquipmentManage = "Equipment.Manage";

    // -- Documents (3) --
    public const string DocumentsView = "Documents.View";
    public const string DocumentsUpload = "Documents.Upload";
    public const string DocumentsDelete = "Documents.Delete";

    // -- Employees (3) --
    public const string EmployeesView = "Employees.View";
    public const string EmployeesManage = "Employees.Manage";
    public const string EmployeesViewSensitive = "Employees.ViewSensitive";

    // -- Reports (3) --
    public const string ReportsView = "Reports.View";
    public const string ReportsExport = "Reports.Export";
    public const string ReportsCreate = "Reports.Create";

    // -- Admin (5) --
    public const string AdminUsers = "Admin.Users";
    public const string AdminRoles = "Admin.Roles";
    public const string AdminSettings = "Admin.Settings";
    public const string AdminCompanies = "Admin.Companies";
    public const string AdminDataImport = "Admin.DataImport";

    // -- System Admin (3) --
    public const string SystemAdminAPIKeys = "SystemAdmin.APIKeys";
    public const string SystemAdminAuditLogs = "SystemAdmin.AuditLogs";
    public const string SystemAdminHealth = "SystemAdmin.Health";

    // -- AI (2) --
    public const string AIChat = "AI.Chat";
    public const string AISettings = "AI.Settings";

    /// <summary>
    /// Wildcard permission — matches everything. Used for Admin role.
    /// </summary>
    public const string Wildcard = "*";

    /// <summary>
    /// All 64 permissions in the system (excludes wildcard).
    /// </summary>
    public static readonly IReadOnlyList<string> All = new[]
    {
        // Projects
        ProjectsView, ProjectsCreate, ProjectsEdit, ProjectsDelete,
        // Time Tracking
        TimeTrackingView, TimeTrackingCreate, TimeTrackingApprove, TimeTrackingViewRates, TimeTrackingDelete,
        // Bids
        BidsView, BidsCreate, BidsEdit, BidsConvertToProject,
        // Contracts
        ContractsView, ContractsCreate, ContractsEdit, ContractsApproveChangeOrders,
        // Billing
        BillingView, BillingCreate, BillingApprove, BillingReleaseRetention, BillingLienWaivers,
        // AP
        APView, APCreate, APApprove, APManageVendors, APMatchInvoices,
        // AR
        ARView, ARCreate, ARManageCustomers, ARApplyPayments,
        // Accounting
        AccountingViewGL, AccountingPostJournals, AccountingManagePeriods, AccountingViewWIP, AccountingManageBankAccounts,
        // Payroll
        PayrollView, PayrollProcess, PayrollCertifiedReport, PayrollViewRates,
        // PM
        PMRFIs, PMSubmittals, PMDailyReports, PMSchedule, PMPunchList, PMMeetings,
        SpatialView, SpatialManage,
        // Equipment
        EquipmentView, EquipmentManage,
        // Documents
        DocumentsView, DocumentsUpload, DocumentsDelete,
        // Employees
        EmployeesView, EmployeesManage, EmployeesViewSensitive,
        // Reports
        ReportsView, ReportsExport, ReportsCreate,
        // Admin
        AdminUsers, AdminRoles, AdminSettings, AdminCompanies, AdminDataImport,
        // System Admin
        SystemAdminAPIKeys, SystemAdminAuditLogs, SystemAdminHealth,
        // AI
        AIChat, AISettings,
    };

    /// <summary>
    /// Permissions organized by category for seed data and UI display.
    /// Key = category name, Value = (permission name, description).
    /// </summary>
    public static readonly IReadOnlyDictionary<string, (string Name, string Description)[]> ByCategory =
        new Dictionary<string, (string, string)[]>
        {
            ["Projects"] = new[]
            {
                (ProjectsView, "View projects"),
                (ProjectsCreate, "Create new projects"),
                (ProjectsEdit, "Edit existing projects"),
                (ProjectsDelete, "Delete projects"),
            },
            ["TimeTracking"] = new[]
            {
                (TimeTrackingView, "View time entries"),
                (TimeTrackingCreate, "Create time entries"),
                (TimeTrackingApprove, "Approve submitted time entries"),
                (TimeTrackingViewRates, "View labor rates and costs"),
                (TimeTrackingDelete, "Delete time entries"),
            },
            ["Bids"] = new[]
            {
                (BidsView, "View bids"),
                (BidsCreate, "Create bids"),
                (BidsEdit, "Edit bids"),
                (BidsConvertToProject, "Convert bid to project"),
            },
            ["Contracts"] = new[]
            {
                (ContractsView, "View contracts"),
                (ContractsCreate, "Create contracts"),
                (ContractsEdit, "Edit contracts"),
                (ContractsApproveChangeOrders, "Approve change orders"),
            },
            ["Billing"] = new[]
            {
                (BillingView, "View billing and payment applications"),
                (BillingCreate, "Create payment applications"),
                (BillingApprove, "Approve payment applications"),
                (BillingReleaseRetention, "Release retention payments"),
                (BillingLienWaivers, "Manage lien waivers"),
            },
            ["AP"] = new[]
            {
                (APView, "View accounts payable"),
                (APCreate, "Create AP invoices"),
                (APApprove, "Approve AP payments"),
                (APManageVendors, "Manage vendors"),
                (APMatchInvoices, "Match invoices to purchase orders"),
            },
            ["AR"] = new[]
            {
                (ARView, "View accounts receivable"),
                (ARCreate, "Create AR invoices"),
                (ARManageCustomers, "Manage customers"),
                (ARApplyPayments, "Apply customer payments"),
            },
            ["Accounting"] = new[]
            {
                (AccountingViewGL, "View general ledger"),
                (AccountingPostJournals, "Post journal entries"),
                (AccountingManagePeriods, "Manage accounting periods"),
                (AccountingViewWIP, "View WIP reports"),
                (AccountingManageBankAccounts, "Manage bank accounts and reconciliation"),
            },
            ["Payroll"] = new[]
            {
                (PayrollView, "View payroll data"),
                (PayrollProcess, "Process payroll runs"),
                (PayrollCertifiedReport, "Generate certified payroll reports"),
                (PayrollViewRates, "View pay rates"),
            },
            ["PM"] = new[]
            {
                (PMRFIs, "Manage RFIs"),
                (PMSubmittals, "Manage submittals"),
                (PMDailyReports, "Manage daily reports"),
                (PMSchedule, "Manage project schedule"),
                (PMPunchList, "Manage punch list items"),
                (PMMeetings, "Manage meetings"),
            },
            ["Spatial"] = new[]
            {
                (SpatialView, "View jobsitetwin spatial graph and overlays"),
                (SpatialManage, "Seed/manage spatial graph (publish zones tree)"),
            },
            ["Equipment"] = new[]
            {
                (EquipmentView, "View equipment"),
                (EquipmentManage, "Manage equipment"),
            },
            ["Documents"] = new[]
            {
                (DocumentsView, "View documents"),
                (DocumentsUpload, "Upload documents"),
                (DocumentsDelete, "Delete documents"),
            },
            ["Employees"] = new[]
            {
                (EmployeesView, "View employee information"),
                (EmployeesManage, "Manage employees"),
                (EmployeesViewSensitive, "View sensitive employee data (SSN, rates)"),
            },
            ["Reports"] = new[]
            {
                (ReportsView, "View reports"),
                (ReportsExport, "Export report data"),
                (ReportsCreate, "Create custom reports"),
            },
            ["Admin"] = new[]
            {
                (AdminUsers, "Manage users"),
                (AdminRoles, "Manage roles and permissions"),
                (AdminSettings, "Manage tenant settings"),
                (AdminCompanies, "Manage companies"),
                (AdminDataImport, "Import data"),
            },
            ["SystemAdmin"] = new[]
            {
                (SystemAdminAPIKeys, "Manage API keys"),
                (SystemAdminAuditLogs, "View audit logs"),
                (SystemAdminHealth, "View system health"),
            },
            ["AI"] = new[]
            {
                (AIChat, "Use AI chat"),
                (AISettings, "Manage AI settings"),
            },
        };

    /// <summary>
    /// Predefined role templates with their assigned permissions.
    /// </summary>
    public static class RoleTemplates
    {
        public const string Admin = "Admin";
        public const string Executive = "Executive";
        public const string Controller = "Controller";
        public const string ProjectManager = "ProjectManager";
        public const string Foreman = "Foreman";
        public const string Estimator = "Estimator";
        public const string PayrollSpecialist = "PayrollSpecialist";
        public const string Viewer = "Viewer";

        public static readonly IReadOnlyList<string> All = new[]
        {
            Admin, Executive, Controller, ProjectManager, Foreman, Estimator, PayrollSpecialist, Viewer
        };

        /// <summary>
        /// Role descriptions for seed data.
        /// </summary>
        public static readonly IReadOnlyDictionary<string, string> Descriptions = new Dictionary<string, string>
        {
            [Admin] = "Full system access",
            [Executive] = "Read-only access to all data including financials and reports",
            [Controller] = "Financial management: AP, AR, GL, WIP, payroll, billing",
            [ProjectManager] = "Project and field operations management",
            [Foreman] = "Field operations: time entry, daily reports, project viewing",
            [Estimator] = "Bid management and estimating",
            [PayrollSpecialist] = "HR and payroll processing",
            [Viewer] = "Read-only access to non-sensitive data",
        };

        /// <summary>
        /// Permission rules per role. Supports:
        /// - "*" = all permissions (Admin wildcard)
        /// - "Category." = all permissions in that category (prefix match)
        /// - ".Suffix" = all permissions ending with suffix (suffix match)
        /// - "Exact.Permission" = single specific permission
        /// </summary>
        public static readonly IReadOnlyDictionary<string, string[]> PermissionRules = new Dictionary<string, string[]>
        {
            [Admin] = new[] { "*" },

            [Executive] = new[]
            {
                ProjectsView, BidsView, ContractsView,
                BillingView, APView, ARView,
                AccountingViewGL, AccountingViewWIP,
                PayrollView,
                TimeTrackingView,
                EquipmentView, DocumentsView, EmployeesView,
                ReportsView, ReportsExport,
                PMRFIs, PMSubmittals, PMDailyReports, PMSchedule, PMPunchList, PMMeetings,
                SpatialView,
                AIChat,
            },

            [Controller] = new[]
            {
                // Full financial access
                "Billing.", "AP.", "AR.", "Accounting.",
                PayrollView, PayrollProcess, PayrollCertifiedReport, PayrollViewRates,
                // Read access to operational data
                ProjectsView, ContractsView, TimeTrackingView, TimeTrackingViewRates,
                EmployeesView, EmployeesViewSensitive,
                ReportsView, ReportsExport, ReportsCreate,
                DocumentsView,
                AIChat,
            },

            [ProjectManager] = new[]
            {
                // Full project access
                "Projects.",
                ContractsView, ContractsCreate, ContractsEdit, ContractsApproveChangeOrders,
                // Full PM access
                "PM.",
                SpatialView, SpatialManage,
                // Bids
                BidsView, BidsCreate, BidsEdit, BidsConvertToProject,
                // Time
                TimeTrackingView, TimeTrackingCreate, TimeTrackingApprove,
                // Supporting access
                BillingView, DocumentsView, DocumentsUpload,
                EquipmentView, EmployeesView,
                ReportsView, ReportsExport,
                AIChat,
            },

            [Foreman] = new[]
            {
                ProjectsView,
                TimeTrackingView, TimeTrackingCreate,
                PMDailyReports, PMPunchList,
                SpatialView,
                EquipmentView, DocumentsView,
            },

            [Estimator] = new[]
            {
                "Bids.",
                ProjectsView, ContractsView,
                DocumentsView, DocumentsUpload,
                ReportsView,
                AIChat,
            },

            [PayrollSpecialist] = new[]
            {
                "Payroll.",
                "Employees.",
                TimeTrackingView, TimeTrackingApprove, TimeTrackingViewRates,
                ReportsView, ReportsExport,
            },

            [Viewer] = new[] { ".View" },
        };
    }
}
