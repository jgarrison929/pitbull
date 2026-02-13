using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Features.SeedData;

/// <summary>
/// Seeds realistic construction demo data.
///
/// This handler is used by:
/// - The dev-only HTTP endpoint (SeedDataController)
/// - The public demo bootstrapper (when explicitly enabled via configuration)
/// </summary>
public class SeedDataHandler(PitbullDbContext db, IWebHostEnvironment env, IConfiguration configuration)
    : IRequestHandler<SeedDataCommand, Result<SeedDataResult>>
{
    public async Task<Result<SeedDataResult>> Handle(
        SeedDataCommand request, CancellationToken cancellationToken)
    {
        var allowNonDev = configuration.GetValue<bool>("SeedData:AllowInNonDevelopment")
                          || configuration.GetValue<bool>("Demo:Enabled");

        if (!env.IsDevelopment() && !allowNonDev)
            return Result.Failure<SeedDataResult>(
                "Seed data is only available in Development environment", "FORBIDDEN");

        // Check if seed data already exists (idempotency)
        var existingProjects = await db.Set<Project>()
            .IgnoreQueryFilters()
            .AnyAsync(p => p.Number.StartsWith("DEMO-PRJ"), cancellationToken);

        if (existingProjects)
            return Result.Failure<SeedDataResult>(
                "Seed data already exists. Delete existing demo data first.", "ALREADY_EXISTS");

        var projects = CreateProjects();
        var bids = CreateBids();
        var costCodes = CreateCostCodes();
        var employees = CreateEmployees();

        db.Set<CostCode>().AddRange(costCodes);
        db.Set<Project>().AddRange(projects);
        db.Set<Bid>().AddRange(bids);
        db.Set<Employee>().AddRange(employees);

        // Save first to get IDs for relationships
        await db.SaveChangesAsync(cancellationToken);

        // Now create project assignments linking employees to active projects
        var activeProjects = projects.Where(p => p.Status == ProjectStatus.Active).ToList();
        var assignments = CreateProjectAssignments(employees, activeProjects);
        db.Set<ProjectAssignment>().AddRange(assignments);
        await db.SaveChangesAsync(cancellationToken);

        // Now create time entries for assigned employees
        var timeEntries = CreateTimeEntries(employees, activeProjects, costCodes, assignments);
        db.Set<TimeEntry>().AddRange(timeEntries);
        await db.SaveChangesAsync(cancellationToken);

        // Create subcontracts with change orders and payment applications
        var subcontracts = CreateSubcontracts(projects);
        db.Set<Subcontract>().AddRange(subcontracts);
        await db.SaveChangesAsync(cancellationToken);

        // Create payment applications for executed subcontracts
        var paymentApplications = CreatePaymentApplications(subcontracts);
        db.Set<PaymentApplication>().AddRange(paymentApplications);
        await db.SaveChangesAsync(cancellationToken);

        var totalPhases = projects.Sum(p => p.Phases.Count);
        var totalBidItems = bids.Sum(b => b.Items.Count);
        var totalChangeOrders = subcontracts.Sum(s => s.ChangeOrders.Count);

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
            Summary: $"Created {projects.Count} projects, {bids.Count} bids, " +
                     $"{totalBidItems} bid items, {totalPhases} phases, {costCodes.Count} cost codes, " +
                     $"{employees.Count} employees, {assignments.Count} project assignments, " +
                     $"{timeEntries.Count} time entries, {subcontracts.Count} subcontracts, " +
                     $"{totalChangeOrders} change orders, {paymentApplications.Count} payment applications"
        ));
    }

    /// <summary>
    /// Creates standard construction labor cost codes.
    /// These are used for time tracking entries.
    /// </summary>
    private static List<CostCode> CreateCostCodes()
    {
        return
        [
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
            ClientContact = "Dr. Patricia Reeves",
            ClientEmail = "preeves@riversidehealth.com",
            ClientPhone = "(916) 555-0142",
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
            ClientName = "Oakwood Development Group",
            ClientContact = "Marcus Chen",
            ClientEmail = "mchen@oakwooddev.com",
            ClientPhone = "(916) 555-0287",
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
            Name = "Central Valley Distribution Center",
            Number = "DEMO-PRJ-2026-003",
            Description = "450,000 SF tilt-up warehouse and distribution facility " +
                          "with 36 loading docks and 5,000 SF office build-out.",
            Status = ProjectStatus.Active,
            Type = ProjectType.Industrial,
            Address = "8900 Industrial Parkway",
            City = "Stockton",
            State = "CA",
            ZipCode = "95206",
            ClientName = "Pacific Logistics Inc.",
            ClientContact = "Karen Yamamoto",
            ClientEmail = "kyamamoto@paclog.com",
            ClientPhone = "(209) 555-0391",
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
            ClientContact = "James Okafor",
            ClientEmail = "james.okafor@dot.ca.gov",
            ClientPhone = "(916) 555-0518",
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
            ClientContact = "Sandra Morales",
            ClientEmail = "smorales@lusd.net",
            ClientPhone = "(209) 555-0674",
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
                LastName = "Rodriguez",
                Email = "mrodriguez@demo.pitbull.com",
                Phone = "(916) 555-1001",
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
                LastName = "Thompson",
                Email = "jthompson@demo.pitbull.com",
                Phone = "(916) 555-1002",
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
                LastName = "Chen",
                Email = "dchen@demo.pitbull.com",
                Phone = "(916) 555-1003",
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
                LastName = "Martinez",
                Email = "rmartinez@demo.pitbull.com",
                Phone = "(916) 555-1004",
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
                LastName = "Johnson",
                Email = "sjohnson@demo.pitbull.com",
                Phone = "(916) 555-1005",
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
                LastName = "Wilson",
                Email = "jwilson@demo.pitbull.com",
                Phone = "(916) 555-1006",
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
                LastName = "Brown",
                Email = "mbrown@demo.pitbull.com",
                Phone = "(916) 555-1007",
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
                LastName = "Garcia",
                Email = "agarcia@demo.pitbull.com",
                Phone = "(916) 555-1008",
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
                LastName = "Nguyen",
                Email = "knguyen@demo.pitbull.com",
                Phone = "(916) 555-1009",
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
                LastName = "Ramirez",
                Email = "cramirez@demo.pitbull.com",
                Phone = "(916) 555-1010",
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
                LastName = "Anderson",
                Email = "tanderson@demo.pitbull.com",
                Phone = "(916) 555-1011",
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
                LastName = "Hernandez",
                Email = "mhernandez@demo.pitbull.com",
                Phone = "(916) 555-1012",
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
                LastName = "Davis",
                Email = "tdavis@demo.pitbull.com",
                Phone = "(916) 555-1013",
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
                LastName = "Miller",
                Email = "amiller@demo.pitbull.com",
                Phone = "(916) 555-1014",
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
                LastName = "Taylor",
                Email = "btaylor@demo.pitbull.com",
                Phone = "(916) 555-1015",
                Title = "Journeyman Carpenter",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 40.00m,
                HireDate = new DateOnly(2018, 2, 1),
                TerminationDate = new DateOnly(2025, 11, 15),
                IsActive = false,
                Notes = "Resigned to start own business. Good rehire."
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
    /// Creates 30 days of realistic time entries across employees and projects.
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

        // Create entries for the last 30 days (skip weekends for most)
        for (int dayOffset = -30; dayOffset <= 0; dayOffset++)
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
            return [.. laborCostCodes.Where(c =>
                c.Code.StartsWith("01-") // General conditions/supervision
            )];
        }

        if (title.Contains("carpenter"))
        {
            return [.. laborCostCodes.Where(c =>
                c.Code.StartsWith("06-") || // Carpentry
                c.Code.StartsWith("03-")    // Concrete formwork
            )];
        }

        if (title.Contains("ironworker"))
        {
            return [.. laborCostCodes.Where(c =>
                c.Code.StartsWith("05-") || // Metals
                c.Code.StartsWith("03-2")   // Rebar
            )];
        }

        if (title.Contains("operator"))
        {
            return [.. laborCostCodes.Where(c =>
                c.Code.StartsWith("02-") // Site work
            )];
        }

        if (title.Contains("finisher"))
        {
            return [.. laborCostCodes.Where(c =>
                c.Code.StartsWith("03-") // Concrete
            )];
        }

        // Laborers and apprentices can do various work
        return [.. laborCostCodes.Where(c =>
            c.Code.StartsWith("02-") || // Site work
            c.Code.StartsWith("03-") || // Concrete
            c.Code.StartsWith("06-")    // Carpentry
        )];
    }

    /// <summary>
    /// Generates realistic work descriptions based on cost code.
    /// </summary>
    private static string GetWorkDescription(CostCode costCode, Random random)
    {
        var descriptions = costCode.Code switch
        {
            "01-100" => new[] { "Project coordination and meetings", "Safety walk and documentation", "Subcontractor coordination" },
            "01-200" => ["Crew supervision and layout", "Quality inspection", "Schedule coordination"],
            "01-300" => ["Trade coordination", "Material staging", "Daily planning"],
            "02-100" => ["Excavation for footings", "Grading and compaction", "Utility trench work"],
            "02-200" => ["Utility trenching", "Pipe laying", "Backfill operations"],
            "02-300" => ["Backfill and compaction", "Grade work", "Site cleanup"],
            "03-100" => ["Formwork installation", "Form stripping", "Form preparation"],
            "03-200" => ["Rebar installation", "Rebar tying", "Dowel installation"],
            "03-300" => ["Concrete placement", "Pump setup and pour", "Vibrating and finishing"],
            "03-400" => ["Slab finishing", "Trowel work", "Curing application"],
            "05-100" => ["Steel erection", "Beam installation", "Connection work"],
            "05-200" => ["Misc metals installation", "Handrail work", "Embed plates"],
            "06-100" => ["Wall framing", "Blocking installation", "Sheathing work"],
            "06-200" => ["Trim installation", "Door hanging", "Cabinet install"],
            "06-300" => ["Floor framing", "Truss setting", "Deck installation"],
            _ => ["General work", "Site activities", "Project support"]
        };

        return descriptions[random.Next(descriptions.Length)];
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
                SubcontractorName = "Valley Mechanical Systems Inc.",
                SubcontractorContact = "Tony Marchetti",
                SubcontractorEmail = "tmarchetti@valleymech.com",
                SubcontractorPhone = "(916) 555-2100",
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
                        SubcontractId = Guid.Empty, // Will be set by EF
                        Title = "UV-C Air Purification Addition",
                        Description = "Add UV-C air purification system to surgical suite AHUs per owner request. Value engineering offset with duct insulation material change.",
                        Reason = "Owner requested enhancement",
                        Amount = 85_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-1),
                        ApprovedDate = now.AddDays(-20),
                        ApprovedBy = "Mike Rodriguez",
                        DaysExtension = 0
                    },
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-002",
                        SubcontractId = Guid.Empty,
                        Title = "MRI Suite Exhaust Relocation",
                        Description = "Additional exhaust for relocated MRI suite. Negotiated from $72K to $60K. Minor schedule impact acceptable.",
                        Reason = "Design change",
                        Amount = 60_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddDays(-15),
                        ApprovedDate = now.AddDays(-5),
                        ApprovedBy = "Mike Rodriguez",
                        DaysExtension = 3
                    },
                    new ChangeOrder
                    {
                        ChangeOrderNumber = "CO-003",
                        SubcontractId = Guid.Empty,
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
                SubcontractorName = "Precision Electric Company",
                SubcontractorContact = "Maria Santos",
                SubcontractorEmail = "msantos@precisionelec.com",
                SubcontractorPhone = "(916) 555-2200",
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
                        SubcontractId = Guid.Empty,
                        Title = "Generator Upsizing",
                        Description = "Generator upsizing from 500kW to 750kW per code review. Required for new emergency power calculations.",
                        Reason = "Code requirement",
                        Amount = 70_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-2),
                        ApprovedDate = now.AddDays(-45),
                        ApprovedBy = "Mike Rodriguez",
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
                SubcontractorContact = "Dave Richardson",
                SubcontractorEmail = "drichardson@capitolplumb.com",
                SubcontractorPhone = "(916) 555-2300",
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
                SubcontractorContact = "Keith Morrison",
                SubcontractorEmail = "kmorrison@sierradrywall.com",
                SubcontractorPhone = "(916) 555-2400",
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
                SubcontractorContact = "Robert Kim",
                SubcontractorEmail = "rkim@advancedfire.com",
                SubcontractorPhone = "(209) 555-3100",
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
                        SubcontractId = Guid.Empty,
                        Title = "In-Rack Sprinkler Addition",
                        Description = "Add in-rack sprinklers for high-pile storage area. Owner-directed for Amazon storage requirements.",
                        Reason = "Owner requirement - increased storage height",
                        Amount = 125_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-2),
                        ApprovedDate = now.AddMonths(-1).AddDays(-15),
                        ApprovedBy = "Mike Rodriguez",
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
                SubcontractorName = "Pacific Sitework & Paving",
                SubcontractorContact = "Jennifer Walsh",
                SubcontractorEmail = "jwalsh@pacificsitework.com",
                SubcontractorPhone = "(209) 555-3200",
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
                        SubcontractId = Guid.Empty,
                        Title = "EV Charging Infrastructure",
                        Description = "Additional 40 EV charging station conduit runs. EV infrastructure for delivery vans.",
                        Reason = "Owner sustainability requirement",
                        Amount = 150_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-3),
                        ApprovedDate = now.AddMonths(-2).AddDays(-20),
                        ApprovedBy = "Mike Rodriguez",
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
                SubcontractorContact = "Mike Huang",
                SubcontractorEmail = "mhuang@deltasteel.com",
                SubcontractorPhone = "(209) 555-3300",
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
                SubcontractorContact = "Frank DeLuca",
                SubcontractorEmail = "fdeluca@gsbridgeworks.com",
                SubcontractorPhone = "(916) 555-4100",
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
                        SubcontractId = Guid.Empty,
                        Title = "Additional Column Jacketing",
                        Description = "Additional column jacketing due to unforeseen deterioration. Caltrans approved time extension.",
                        Reason = "Unforeseen condition",
                        Amount = 280_000m,
                        Status = ChangeOrderStatus.Approved,
                        SubmittedDate = now.AddMonths(-10),
                        ApprovedDate = now.AddMonths(-9),
                        ApprovedBy = "Mike Rodriguez",
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
                    ApprovedBy = status == PaymentApplicationStatus.Paid ? "Mike Rodriguez" : null,
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
}
