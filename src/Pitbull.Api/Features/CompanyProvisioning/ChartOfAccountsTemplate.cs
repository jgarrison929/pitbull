using Pitbull.Core.Domain;

namespace Pitbull.Api.Features.CompanyProvisioning;

/// <summary>
/// Defines a chart of accounts template that can be applied when provisioning a new company.
/// Each template provides industry-specific GL accounts.
/// </summary>
public record ChartOfAccountsTemplate(
    string Key,
    string DisplayName,
    string Description,
    Func<List<ChartOfAccount>> CreateAccounts);

/// <summary>
/// Registry of available chart of accounts templates.
/// </summary>
public static class ChartOfAccountsTemplates
{
    public static readonly Dictionary<string, ChartOfAccountsTemplate> All = new()
    {
        ["construction-default"] = new ChartOfAccountsTemplate(
            Key: "construction-default",
            DisplayName: "Construction Default",
            Description: "Standard chart of accounts for general contractors with job costing, " +
                         "retention tracking, and WIP reporting.",
            CreateAccounts: CreateConstructionDefaultAccounts),

        ["real-estate-partnership"] = new ChartOfAccountsTemplate(
            Key: "real-estate-partnership",
            DisplayName: "Real Estate Development Partnership",
            Description: "Chart of accounts for real estate development partnerships with " +
                         "construction-in-progress tracking, partner capital accounts, " +
                         "developer fees, and project financing.",
            CreateAccounts: CreateRealEstatePartnershipAccounts),
    };

    /// <summary>
    /// Returns the available template keys and display names for UI dropdowns.
    /// </summary>
    public static List<TemplateInfo> GetTemplateList() =>
        All.Values.Select(t => new TemplateInfo(t.Key, t.DisplayName, t.Description)).ToList();

    // ── Construction Default (mirrors existing SeedDataService.CreateChartOfAccounts) ──

    private static List<ChartOfAccount> CreateConstructionDefaultAccounts() =>
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

    // ── Real Estate Development Partnership ──

    private static List<ChartOfAccount> CreateRealEstatePartnershipAccounts() =>
    [
        // ═══════════════════════════════════════════════════════════
        // ASSETS (1000s)
        // ═══════════════════════════════════════════════════════════
        new() { AccountNumber = "1000", AccountName = "Cash — Operating Account", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
        new() { AccountNumber = "1010", AccountName = "Cash — Escrow / Trust Account", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
        new() { AccountNumber = "1100", AccountName = "Accounts Receivable", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true, IsSubledgerControl = true },
        new() { AccountNumber = "1200", AccountName = "Construction in Progress", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Accumulated project costs capitalized during development" },
        new() { AccountNumber = "1210", AccountName = "Land & Land Improvements", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Land acquisition, site clearing, grading, and improvements" },
        new() { AccountNumber = "1220", AccountName = "Building & Improvements", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Completed building costs and tenant improvements" },
        new() { AccountNumber = "1230", AccountName = "Soft Costs (Architecture, Engineering, Permits)", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Capitalized design, engineering, permitting, and entitlement costs" },
        new() { AccountNumber = "1240", AccountName = "Financing Costs (Loan Fees, Interest During Construction)", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Capitalized loan origination fees and construction-period interest per ASC 835-20" },
        new() { AccountNumber = "1300", AccountName = "Prepaid Expenses", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true },
        new() { AccountNumber = "1400", AccountName = "Security Deposits", AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Utility deposits, performance deposits, and tenant security deposits held" },

        // ═══════════════════════════════════════════════════════════
        // LIABILITIES (2000s)
        // ═══════════════════════════════════════════════════════════
        new() { AccountNumber = "2000", AccountName = "Accounts Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true, IsSubledgerControl = true },
        new() { AccountNumber = "2010", AccountName = "Accrued Expenses", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },
        new() { AccountNumber = "2100", AccountName = "Construction Loan Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Draw-down construction financing facility" },
        new() { AccountNumber = "2110", AccountName = "Permanent Loan Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Long-term mortgage / permanent financing after construction completion" },
        new() { AccountNumber = "2200", AccountName = "Retention Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Amounts withheld from subcontractor payments pending completion" },
        new() { AccountNumber = "2300", AccountName = "Property Tax Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },
        new() { AccountNumber = "2400", AccountName = "Interest Payable", AccountType = AccountType.Liability, NormalBalance = NormalBalance.Credit, IsActive = true },

        // ═══════════════════════════════════════════════════════════
        // EQUITY (3000s) — Partnership-specific capital accounts
        // ═══════════════════════════════════════════════════════════
        new() { AccountNumber = "3000", AccountName = "Partner Capital — Partner A", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Capital contributions from Partner A (managing member / GP)" },
        new() { AccountNumber = "3010", AccountName = "Partner Capital — Partner B", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Capital contributions from Partner B (limited partner / LP)" },
        new() { AccountNumber = "3020", AccountName = "Partner Distributions — Partner A", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Distributions to Partner A (contra-equity)" },
        new() { AccountNumber = "3030", AccountName = "Partner Distributions — Partner B", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Distributions to Partner B (contra-equity)" },
        new() { AccountNumber = "3100", AccountName = "Retained Earnings", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Credit, IsActive = true },
        new() { AccountNumber = "3200", AccountName = "Current Year Earnings", AccountType = AccountType.Equity, NormalBalance = NormalBalance.Credit, IsActive = true },

        // ═══════════════════════════════════════════════════════════
        // REVENUE (4000s)
        // ═══════════════════════════════════════════════════════════
        new() { AccountNumber = "4000", AccountName = "Property Sales Revenue", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Revenue from sale of developed properties" },
        new() { AccountNumber = "4100", AccountName = "Rental Income", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Rental revenue from leased units or commercial space" },
        new() { AccountNumber = "4200", AccountName = "Interest Income", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true },
        new() { AccountNumber = "4300", AccountName = "Other Income", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true },
        new() { AccountNumber = "4400", AccountName = "Developer Fees", AccountType = AccountType.Revenue, NormalBalance = NormalBalance.Credit, IsActive = true,
                 Description = "Fees earned by the managing partner for development services" },

        // ═══════════════════════════════════════════════════════════
        // EXPENSES (5000s–7000s)
        // ═══════════════════════════════════════════════════════════

        // 5000s — Direct Construction Costs
        new() { AccountNumber = "5000", AccountName = "Construction Costs — Direct", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Direct construction labor performed by own forces" },
        new() { AccountNumber = "5100", AccountName = "Subcontractor Costs", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
        new() { AccountNumber = "5200", AccountName = "Materials & Supplies", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
        new() { AccountNumber = "5300", AccountName = "Equipment Rental", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },

        // 6000s — Professional & Operating Expenses
        new() { AccountNumber = "6000", AccountName = "Professional Fees (Legal, Accounting, Architecture)", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
        new() { AccountNumber = "6100", AccountName = "Insurance", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Builder's risk, general liability, and property insurance" },
        new() { AccountNumber = "6200", AccountName = "Permits & Fees", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Building permits, impact fees, and government fees" },
        new() { AccountNumber = "6300", AccountName = "Property Taxes", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },
        new() { AccountNumber = "6400", AccountName = "Marketing & Sales", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Real estate broker commissions, advertising, staging" },
        new() { AccountNumber = "6500", AccountName = "Utilities", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true },

        // 7000s — Financing & Administrative
        new() { AccountNumber = "7000", AccountName = "Interest Expense", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Interest on construction and permanent loans (expensed portion)" },
        new() { AccountNumber = "7100", AccountName = "Loan Origination Costs (Amortized)", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Amortized portion of loan origination fees" },
        new() { AccountNumber = "7200", AccountName = "Administrative & General", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Office expenses, travel, and general overhead" },
        new() { AccountNumber = "7300", AccountName = "Property Management Fees", AccountType = AccountType.Expense, NormalBalance = NormalBalance.Debit, IsActive = true,
                 Description = "Third-party property management fees for rental properties" },
    ];
}

/// <summary>
/// Lightweight DTO for returning template options to the frontend.
/// </summary>
public record TemplateInfo(string Key, string DisplayName, string Description);
