using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;

namespace Pitbull.Api.Features.SeedData;

/// <summary>
/// Seeds realistic construction demo data.
/// Development environment only.
/// </summary>
public class SeedDataHandler(PitbullDbContext db, IWebHostEnvironment env)
    : IRequestHandler<SeedDataCommand, Result<SeedDataResult>>
{
    public async Task<Result<SeedDataResult>> Handle(
        SeedDataCommand request, CancellationToken cancellationToken)
    {
        if (!env.IsDevelopment())
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

        db.Set<Project>().AddRange(projects);
        db.Set<Bid>().AddRange(bids);

        await db.SaveChangesAsync(cancellationToken);

        var totalPhases = projects.Sum(p => p.Phases.Count);
        var totalBidItems = bids.Sum(b => b.Items.Count);

        return Result.Success(new SeedDataResult(
            ProjectsCreated: projects.Count,
            BidsCreated: bids.Count,
            BidItemsCreated: totalBidItems,
            PhasesCreated: totalPhases,
            Summary: $"Created {projects.Count} projects, {bids.Count} bids, " +
                     $"{totalBidItems} bid items, {totalPhases} phases"
        ));
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
}
