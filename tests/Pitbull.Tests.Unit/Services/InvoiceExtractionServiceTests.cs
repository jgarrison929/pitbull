using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class InvoiceExtractionServiceTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid TestCompanyId = TestDbContextFactory.TestCompanyId;

    // ─── Empty / malformed input ──────────────────────────────────────

    [Fact]
    public async Task ExtractAsync_EmptyText_ReturnsZeroConfidenceWithWarning()
    {
        var (service, _) = CreateService();

        var result = await service.ExtractAsync("", CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain(w => w.Contains("empty"));
    }

    [Fact]
    public async Task ExtractAsync_WhitespaceText_ReturnsZeroConfidenceWithWarning()
    {
        var (service, _) = CreateService();

        var result = await service.ExtractAsync("   ", CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain(w => w.Contains("empty"));
    }

    // ─── AI failure ───────────────────────────────────────────────────

    [Fact]
    public async Task ExtractAsync_AiServiceFailure_ReturnsErrorResult()
    {
        var (service, mockAi) = CreateService();

        mockAi.Setup(x => x.CompleteAsync(
                It.IsAny<Guid>(),
                It.IsAny<AiCompletionRequest>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<AiCompletionResult>("Service unavailable", "AI_ERROR"));

        var result = await service.ExtractAsync("Some invoice text", CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain(w => w.Contains("AI extraction failed"));
        result.RawText.Should().Be("Some invoice text");
    }

    // ─── Successful extraction ────────────────────────────────────────

    [Fact]
    public async Task ExtractAsync_ValidInvoice_ExtractsFields()
    {
        var (service, mockAi) = CreateService();

        SetupAiResponse(mockAi, """
            {
                "vendorName": "ACME Supplies",
                "vendorNameConfidence": 0.95,
                "invoiceNumber": "INV-001",
                "invoiceNumberConfidence": 0.90,
                "invoiceDate": "2026-01-15",
                "invoiceDateConfidence": 0.95,
                "dueDate": "2026-02-15",
                "dueDateConfidence": 0.90,
                "lineItems": [
                    {"description": "Concrete Mix", "quantity": 50, "unitPrice": 12.50, "amount": 625.00, "costCode": "03-000"}
                ],
                "subTotal": 625.00,
                "taxAmount": 51.56,
                "totalAmount": 676.56,
                "totalAmountConfidence": 0.98
            }
            """);

        var result = await service.ExtractAsync("Invoice text here", CancellationToken.None);

        result.VendorName.Should().Be("ACME Supplies");
        result.VendorNameConfidence.Should().Be(0.95m);
        result.InvoiceNumber.Should().Be("INV-001");
        result.InvoiceDate.Should().Be(new DateOnly(2026, 1, 15));
        result.DueDate.Should().Be(new DateOnly(2026, 2, 15));
        result.TotalAmount.Should().Be(676.56m);
        result.SubTotal.Should().Be(625.00m);
        result.TaxAmount.Should().Be(51.56m);
        result.LineItems.Should().HaveCount(1);
        result.LineItems[0].Description.Should().Be("Concrete Mix");
        result.LineItems[0].Quantity.Should().Be(50);
        result.LineItems[0].UnitPrice.Should().Be(12.50m);
        result.LineItems[0].Amount.Should().Be(625.00m);
        result.LineItems[0].CostCode.Should().Be("03-000");
        result.OverallConfidence.Should().BeGreaterThan(0);
    }

    // ─── Confidence calculation ───────────────────────────────────────

    [Fact]
    public async Task ExtractAsync_PartialExtraction_LowerConfidence()
    {
        var (service, mockAi) = CreateService();

        SetupAiResponse(mockAi, """
            {
                "vendorName": "Unknown Co",
                "vendorNameConfidence": 0.50,
                "invoiceNumber": null,
                "invoiceNumberConfidence": 0.0,
                "invoiceDate": null,
                "invoiceDateConfidence": 0.0,
                "dueDate": null,
                "dueDateConfidence": 0.0,
                "lineItems": [],
                "subTotal": null,
                "taxAmount": null,
                "totalAmount": 500.00,
                "totalAmountConfidence": 0.70
            }
            """);

        var result = await service.ExtractAsync("Blurry invoice scan", CancellationToken.None);

        result.VendorName.Should().Be("Unknown Co");
        result.InvoiceNumber.Should().BeNull();
        result.OverallConfidence.Should().BeLessThan(0.7m);
        result.OverallConfidence.Should().BeGreaterThan(0);
    }

    // ─── Vendor matching — exact ──────────────────────────────────────

    [Fact]
    public async Task ExtractAsync_ExactVendorMatch_SetsMatchedVendorId()
    {
        using var db = TestDbContextFactory.Create();
        var vendorId = Guid.NewGuid();
        SeedVendor(db, vendorId, "ACME Supplies", "V-001");

        var (service, mockAi) = CreateService(db);

        SetupAiResponse(mockAi, """
            {
                "vendorName": "ACME Supplies",
                "vendorNameConfidence": 0.95,
                "invoiceNumber": "INV-001",
                "invoiceNumberConfidence": 0.90,
                "invoiceDate": "2026-01-15",
                "invoiceDateConfidence": 0.90,
                "dueDate": null,
                "dueDateConfidence": 0.0,
                "lineItems": [],
                "subTotal": null,
                "taxAmount": null,
                "totalAmount": 100.00,
                "totalAmountConfidence": 0.95
            }
            """);

        var result = await service.ExtractAsync("ACME Supplies Invoice", CancellationToken.None);

        result.MatchedVendorId.Should().Be(vendorId);
        result.MatchedVendorName.Should().Be("ACME Supplies");
    }

    // ─── Vendor matching — partial ────────────────────────────────────

    [Fact]
    public async Task ExtractAsync_PartialVendorMatch_SetsMatchedVendorId()
    {
        using var db = TestDbContextFactory.Create();
        var vendorId = Guid.NewGuid();
        SeedVendor(db, vendorId, "ACME Supplies Inc.", "V-001");

        var (service, mockAi) = CreateService(db);

        SetupAiResponse(mockAi, """
            {
                "vendorName": "ACME Supplies",
                "vendorNameConfidence": 0.90,
                "invoiceNumber": "INV-002",
                "invoiceNumberConfidence": 0.85,
                "invoiceDate": null,
                "invoiceDateConfidence": 0.0,
                "dueDate": null,
                "dueDateConfidence": 0.0,
                "lineItems": [],
                "subTotal": null,
                "taxAmount": null,
                "totalAmount": 200.00,
                "totalAmountConfidence": 0.90
            }
            """);

        var result = await service.ExtractAsync("ACME Invoice text", CancellationToken.None);

        result.MatchedVendorId.Should().Be(vendorId);
        result.Warnings.Should().Contain(w => w.Contains("partial"));
    }

    // ─── Vendor matching — no match ───────────────────────────────────

    [Fact]
    public async Task ExtractAsync_NoVendorMatch_WarnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        SeedVendor(db, Guid.NewGuid(), "BuildCorp", "V-099");

        var (service, mockAi) = CreateService(db);

        SetupAiResponse(mockAi, """
            {
                "vendorName": "Totally Unknown Vendor",
                "vendorNameConfidence": 0.80,
                "invoiceNumber": "INV-003",
                "invoiceNumberConfidence": 0.80,
                "invoiceDate": null,
                "invoiceDateConfidence": 0.0,
                "dueDate": null,
                "dueDateConfidence": 0.0,
                "lineItems": [],
                "subTotal": null,
                "taxAmount": null,
                "totalAmount": 300.00,
                "totalAmountConfidence": 0.80
            }
            """);

        var result = await service.ExtractAsync("Unknown vendor invoice", CancellationToken.None);

        result.MatchedVendorId.Should().BeNull();
        result.Warnings.Should().Contain(w => w.Contains("not found"));
    }

    // ─── Vendor matching — multiple matches ───────────────────────────

    [Fact]
    public async Task ExtractAsync_MultipleVendorMatches_WarnsAmbiguous()
    {
        using var db = TestDbContextFactory.Create();
        SeedVendor(db, Guid.NewGuid(), "ACME Supplies East", "V-001");
        SeedVendor(db, Guid.NewGuid(), "ACME Supplies West", "V-002");

        var (service, mockAi) = CreateService(db);

        SetupAiResponse(mockAi, """
            {
                "vendorName": "ACME Supplies",
                "vendorNameConfidence": 0.85,
                "invoiceNumber": "INV-004",
                "invoiceNumberConfidence": 0.80,
                "invoiceDate": null,
                "invoiceDateConfidence": 0.0,
                "dueDate": null,
                "dueDateConfidence": 0.0,
                "lineItems": [],
                "subTotal": null,
                "taxAmount": null,
                "totalAmount": 400.00,
                "totalAmountConfidence": 0.85
            }
            """);

        var result = await service.ExtractAsync("ACME invoice", CancellationToken.None);

        result.MatchedVendorId.Should().BeNull();
        result.Warnings.Should().Contain(w => w.Contains("Multiple vendor matches"));
    }

    // ─── AI returns JSON with markdown fences ─────────────────────────

    [Fact]
    public async Task ExtractAsync_AiReturnsMarkdownFences_StillParses()
    {
        var (service, mockAi) = CreateService();

        SetupAiResponse(mockAi, """
            ```json
            {
                "vendorName": "Test Vendor",
                "vendorNameConfidence": 0.90,
                "invoiceNumber": "T-001",
                "invoiceNumberConfidence": 0.85,
                "invoiceDate": null,
                "invoiceDateConfidence": 0.0,
                "dueDate": null,
                "dueDateConfidence": 0.0,
                "lineItems": [],
                "subTotal": null,
                "taxAmount": null,
                "totalAmount": 100.00,
                "totalAmountConfidence": 0.90
            }
            ```
            """);

        var result = await service.ExtractAsync("Test invoice", CancellationToken.None);

        result.VendorName.Should().Be("Test Vendor");
        result.InvoiceNumber.Should().Be("T-001");
    }

    // ─── AI returns unparseable response ──────────────────────────────

    [Fact]
    public async Task ExtractAsync_UnparseableAiResponse_ReturnsZeroConfidence()
    {
        var (service, mockAi) = CreateService();

        SetupAiResponse(mockAi, "This is not valid JSON at all.");

        var result = await service.ExtractAsync("Some invoice", CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain(w => w.Contains("unparseable"));
    }

    // ─── No vendor name extracted ─────────────────────────────────────

    [Fact]
    public async Task ExtractAsync_NoVendorNameExtracted_WarnsCannotMatch()
    {
        var (service, mockAi) = CreateService();

        SetupAiResponse(mockAi, """
            {
                "vendorName": null,
                "vendorNameConfidence": 0.0,
                "invoiceNumber": "INV-005",
                "invoiceNumberConfidence": 0.80,
                "invoiceDate": null,
                "invoiceDateConfidence": 0.0,
                "dueDate": null,
                "dueDateConfidence": 0.0,
                "lineItems": [],
                "subTotal": null,
                "taxAmount": null,
                "totalAmount": 500.00,
                "totalAmountConfidence": 0.80
            }
            """);

        var result = await service.ExtractAsync("Some invoice with no vendor", CancellationToken.None);

        result.MatchedVendorId.Should().BeNull();
        result.Warnings.Should().Contain(w => w.Contains("No vendor name"));
    }

    // ─── Seed Helpers ─────────────────────────────────────────────────

    private static void SeedVendor(Core.Data.PitbullDbContext db, Guid vendorId, string name, string code)
    {
        db.Set<Vendor>().Add(new Vendor
        {
            Id = vendorId,
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Name = name,
            Code = code,
            IsActive = true
        });
        db.SaveChanges();
    }

    // ─── Service Factory ──────────────────────────────────────────────

    private static void SetupAiResponse(Mock<IAiService> mockAi, string jsonContent)
    {
        var completionResult = new AiCompletionResult(
            Content: jsonContent,
            InputTokens: 100,
            OutputTokens: 200,
            Model: "test-model",
            Provider: "test-provider",
            Latency: TimeSpan.FromMilliseconds(500),
            ConfidenceScore: 0.9m);

        mockAi.Setup(x => x.CompleteAsync(
                It.IsAny<Guid>(),
                It.IsAny<AiCompletionRequest>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(completionResult));
    }

    private static (InvoiceExtractionService service, Mock<IAiService> mockAi) CreateService(Core.Data.PitbullDbContext? db = null)
    {
        db ??= TestDbContextFactory.Create();
        var mockAi = new Mock<IAiService>();
        var mockUsage = new Mock<IAiUsageService>();
        var tenantContext = new TenantContext
        {
            TenantId = TestTenantId,
            TenantName = "Test Tenant"
        };
        var logger = NullLogger<InvoiceExtractionService>.Instance;

        var service = new InvoiceExtractionService(mockAi.Object, mockUsage.Object, db, tenantContext, logger);
        return (service, mockAi);
    }
}
