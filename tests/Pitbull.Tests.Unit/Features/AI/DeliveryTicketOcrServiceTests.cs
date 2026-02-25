using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Pitbull.Api.Features.AI;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Features.AI;

public sealed class DeliveryTicketOcrServiceTests
{
    // ─────────────────────────────────────────────────
    // Parsing tests
    // ─────────────────────────────────────────────────

    [Fact]
    public void ParseAiResponse_ValidJson_ExtractsAllFields()
    {
        var json = """
            {
              "poNumber": "PO-2026-0150",
              "poNumberConfidence": 0.92,
              "vendorName": "Martin Marietta Materials",
              "vendorNameConfidence": 0.95,
              "ticketNumber": "DT-88421",
              "ticketNumberConfidence": 0.90,
              "deliveryDate": "2026-02-20",
              "deliveryDateConfidence": 0.88,
              "materials": [
                {
                  "description": "Ready-Mix Concrete 4000 PSI",
                  "quantity": 12.5,
                  "unit": "CY",
                  "costCode": "03-000"
                },
                {
                  "description": "#4 Rebar 20ft",
                  "quantity": 200,
                  "unit": "EA",
                  "costCode": "03-200"
                }
              ]
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.PoNumber.Should().Be("PO-2026-0150");
        result.PoNumberConfidence.Should().Be(0.92m);
        result.VendorName.Should().Be("Martin Marietta Materials");
        result.VendorNameConfidence.Should().Be(0.95m);
        result.TicketNumber.Should().Be("DT-88421");
        result.TicketNumberConfidence.Should().Be(0.90m);
        result.DeliveryDate.Should().Be("2026-02-20");
        result.DeliveryDateConfidence.Should().Be(0.88m);
        result.Materials.Should().HaveCount(2);
        result.Materials[0].Description.Should().Be("Ready-Mix Concrete 4000 PSI");
        result.Materials[0].Quantity.Should().Be(12.5m);
        result.Materials[0].Unit.Should().Be("CY");
        result.Materials[0].CostCode.Should().Be("03-000");
        result.Materials[1].Description.Should().Be("#4 Rebar 20ft");
        result.Materials[1].Quantity.Should().Be(200);
        result.Materials[1].Unit.Should().Be("EA");
        result.OverallConfidence.Should().BeGreaterThan(0);
    }

    [Fact]
    public void ParseAiResponse_WithMarkdownFences_StripsAndParses()
    {
        var json = """
            ```json
            {
              "poNumber": "PO-001",
              "poNumberConfidence": 0.8,
              "vendorName": "Acme Concrete",
              "vendorNameConfidence": 0.9,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": null,
              "deliveryDateConfidence": 0.0,
              "materials": []
            }
            ```
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.PoNumber.Should().Be("PO-001");
        result.VendorName.Should().Be("Acme Concrete");
        result.TicketNumber.Should().BeNull();
        result.DeliveryDate.Should().BeNull();
        result.Materials.Should().BeEmpty();
    }

    [Fact]
    public void ParseAiResponse_NullFields_HandlesGracefully()
    {
        var json = """
            {
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "vendorName": null,
              "vendorNameConfidence": 0.0,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": null,
              "deliveryDateConfidence": 0.0,
              "materials": []
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.PoNumber.Should().BeNull();
        result.VendorName.Should().BeNull();
        result.TicketNumber.Should().BeNull();
        result.DeliveryDate.Should().BeNull();
        result.OverallConfidence.Should().Be(0);
    }

    [Fact]
    public void ParseAiResponse_OverallConfidence_AveragesNonZeroFields()
    {
        var json = """
            {
              "poNumber": "PO-1",
              "poNumberConfidence": 0.8,
              "vendorName": "Test",
              "vendorNameConfidence": 0.6,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": "2026-01-01",
              "deliveryDateConfidence": 0.9,
              "materials": []
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        // Average of 0.8, 0.6, 0.9 (non-zero: poNumber, vendorName, deliveryDate)
        result.OverallConfidence.Should().BeApproximately(0.7667m, 0.001m);
    }

    [Fact]
    public void ParseAiResponse_MaterialsWithNullUnit_DefaultsToNull()
    {
        var json = """
            {
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "vendorName": null,
              "vendorNameConfidence": 0.0,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": null,
              "deliveryDateConfidence": 0.0,
              "materials": [
                {
                  "description": "Gravel Load",
                  "quantity": 15,
                  "unit": null,
                  "costCode": null
                }
              ]
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.Materials.Should().HaveCount(1);
        result.Materials[0].Description.Should().Be("Gravel Load");
        result.Materials[0].Quantity.Should().Be(15);
        result.Materials[0].Unit.Should().BeNull();
        result.Materials[0].CostCode.Should().BeNull();
    }

    [Fact]
    public void ParseAiResponse_ConstructionUnits_ExtractedCorrectly()
    {
        var json = """
            {
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "vendorName": null,
              "vendorNameConfidence": 0.0,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": null,
              "deliveryDateConfidence": 0.0,
              "materials": [
                { "description": "Concrete", "quantity": 8.5, "unit": "CY", "costCode": null },
                { "description": "Lumber 2x4", "quantity": 500, "unit": "LF", "costCode": null },
                { "description": "Crushed Stone", "quantity": 25, "unit": "TON", "costCode": null },
                { "description": "Drywall Sheets", "quantity": 100, "unit": "SHT", "costCode": null }
              ]
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.Materials.Should().HaveCount(4);
        result.Materials[0].Unit.Should().Be("CY");
        result.Materials[1].Unit.Should().Be("LF");
        result.Materials[2].Unit.Should().Be("TON");
        result.Materials[3].Unit.Should().Be("SHT");
    }

    // ─────────────────────────────────────────────────
    // Post-parse validation (Fix #4)
    // ─────────────────────────────────────────────────

    [Fact]
    public void ParseAiResponse_ConfidenceAboveOne_ClampedToOne()
    {
        var json = """
            {
              "poNumber": "PO-1",
              "poNumberConfidence": 1.5,
              "vendorName": null,
              "vendorNameConfidence": -0.3,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": null,
              "deliveryDateConfidence": 2.0,
              "materials": []
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.PoNumberConfidence.Should().Be(1.0m);
        result.VendorNameConfidence.Should().Be(0m);
        result.DeliveryDateConfidence.Should().Be(1.0m);
    }

    [Fact]
    public void ParseAiResponse_LongStrings_Truncated()
    {
        var longVendor = new string('A', 1000);
        var json = $$"""
            {
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "vendorName": "{{longVendor}}",
              "vendorNameConfidence": 0.9,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": null,
              "deliveryDateConfidence": 0.0,
              "materials": []
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.VendorName!.Length.Should().BeLessThanOrEqualTo(500);
    }

    [Fact]
    public void ParseAiResponse_NegativeQuantity_ClampedToZero()
    {
        var json = """
            {
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "vendorName": null,
              "vendorNameConfidence": 0.0,
              "ticketNumber": null,
              "ticketNumberConfidence": 0.0,
              "deliveryDate": null,
              "deliveryDateConfidence": 0.0,
              "materials": [
                { "description": "Bad Item", "quantity": -5, "unit": "EA", "costCode": null }
              ]
            }
            """;

        var result = DeliveryTicketOcrService.ParseAiResponse(json);

        result.Materials[0].Quantity.Should().Be(0);
    }

    [Fact]
    public void ParseAiResponse_MalformedJson_Throws()
    {
        var malformed = "this is not json at all";

        var act = () => DeliveryTicketOcrService.ParseAiResponse(malformed);

        act.Should().Throw<System.Text.Json.JsonException>();
    }

    // ─────────────────────────────────────────────────
    // Confidence clamping
    // ─────────────────────────────────────────────────

    [Theory]
    [InlineData(-0.5, 0)]
    [InlineData(0, 0)]
    [InlineData(0.5, 0.5)]
    [InlineData(1.0, 1.0)]
    [InlineData(1.5, 1.0)]
    [InlineData(99.9, 1.0)]
    public void ClampConfidence_ClampsToZeroOne(decimal input, decimal expected)
    {
        DeliveryTicketOcrService.ClampConfidence(input).Should().Be(expected);
    }

    // ─────────────────────────────────────────────────
    // ExtractDeliveryTicketAsync edge cases (Fix #6)
    // ─────────────────────────────────────────────────

    [Fact]
    public async Task ExtractDeliveryTicketAsync_EmptyFile_ReturnsWarning()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ExtractDeliveryTicketAsync(
            [], "image/jpeg", "empty.jpg", Guid.NewGuid(), CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain("File is empty.");
    }

    [Fact]
    public async Task ExtractDeliveryTicketAsync_UnsupportedMime_ReturnsWarning()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ExtractDeliveryTicketAsync(
            [1, 2, 3], "application/pdf", "ticket.pdf", Guid.NewGuid(), CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain(w => w.Contains("Unsupported file type"));
    }

    [Fact]
    public async Task ExtractDeliveryTicketAsync_ApiKeyMissing_ReturnsWarning()
    {
        using var db = TestDbContextFactory.Create();
        var aiKeyService = new Mock<Pitbull.AI.Services.IAiApiKeyService>();
        aiKeyService.Setup(s => s.GetDecryptedKeyAsync(It.IsAny<Guid>(), "openai", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<string>("No key", "NOT_CONFIGURED"));

        var service = CreateServiceWithMocks(db, aiKeyService: aiKeyService);

        var result = await service.ExtractDeliveryTicketAsync(
            [1, 2, 3], "image/jpeg", "ticket.jpg", Guid.NewGuid(), CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain(w => w.Contains("OpenAI API key not configured"));
    }

    [Fact]
    public async Task ExtractDeliveryTicketAsync_VisionApiThrows_ReturnsWarning()
    {
        using var db = TestDbContextFactory.Create();
        var aiKeyService = new Mock<Pitbull.AI.Services.IAiApiKeyService>();
        aiKeyService.Setup(s => s.GetDecryptedKeyAsync(It.IsAny<Guid>(), "openai", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success("test-key"));

        // HttpClientFactory returns a client whose handler throws
        var mockHandler = new MockHttpMessageHandler(
            new HttpResponseMessage(System.Net.HttpStatusCode.InternalServerError)
            { Content = new StringContent("Server error") });
        var httpClient = new HttpClient(mockHandler) { BaseAddress = new Uri("https://api.openai.com/") };
        var httpFactory = new Mock<IHttpClientFactory>();
        httpFactory.Setup(f => f.CreateClient("OpenAI")).Returns(httpClient);

        var service = CreateServiceWithMocks(db, aiKeyService: aiKeyService, httpFactory: httpFactory);

        var result = await service.ExtractDeliveryTicketAsync(
            [1, 2, 3], "image/jpeg", "ticket.jpg", Guid.NewGuid(), CancellationToken.None);

        result.OverallConfidence.Should().Be(0);
        result.Warnings.Should().Contain(w => w.Contains("AI extraction failed"));
    }

    // ─────────────────────────────────────────────────
    // PO matching tests (in-memory DB)
    // ─────────────────────────────────────────────────

    [Fact]
    public async Task EnrichWithPoMatchAsync_ExactMatch_InProject_ReturnsPo()
    {
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);

        var poId = Guid.NewGuid();
        db.Set<PurchaseOrder>().Add(new PurchaseOrder
        {
            Id = poId,
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = projectId,
            PONumber = "PO-2026-0150",
            VendorId = Guid.NewGuid(),
            TotalAmount = 5000m,
            Status = PurchaseOrderStatus.Approved,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { PoNumber = "PO-2026-0150" };

        var result = await service.EnrichWithPoMatchAsync(input, projectId, CancellationToken.None);

        result.MatchedPurchaseOrder.Should().NotBeNull();
        result.MatchedPurchaseOrder!.Id.Should().Be(poId);
        result.MatchedPurchaseOrder.PoNumber.Should().Be("PO-2026-0150");
        result.MatchedPurchaseOrder.TotalAmount.Should().Be(5000m);
    }

    [Fact]
    public async Task EnrichWithPoMatchAsync_CaseInsensitive_MatchesPo()
    {
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);

        db.Set<PurchaseOrder>().Add(new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = projectId,
            PONumber = "PO-ABC-123",
            VendorId = Guid.NewGuid(),
            TotalAmount = 1000m,
            Status = PurchaseOrderStatus.Approved,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { PoNumber = "po-abc-123" };

        var result = await service.EnrichWithPoMatchAsync(input, projectId, CancellationToken.None);

        result.MatchedPurchaseOrder.Should().NotBeNull();
        result.MatchedPurchaseOrder!.PoNumber.Should().Be("PO-ABC-123");
    }

    [Fact]
    public async Task EnrichWithPoMatchAsync_NoMatch_AddsWarning()
    {
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { PoNumber = "PO-NONEXISTENT" };

        var result = await service.EnrichWithPoMatchAsync(input, projectId, CancellationToken.None);

        result.MatchedPurchaseOrder.Should().BeNull();
        result.Warnings.Should().Contain(w => w.Contains("PO-NONEXISTENT"));
    }

    [Fact]
    public async Task EnrichWithPoMatchAsync_NullPoNumber_ReturnsUnchanged()
    {
        using var db = TestDbContextFactory.Create();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { PoNumber = null };

        var result = await service.EnrichWithPoMatchAsync(input, Guid.NewGuid(), CancellationToken.None);

        result.MatchedPurchaseOrder.Should().BeNull();
        result.Warnings.Should().BeEmpty();
    }

    [Fact]
    public async Task EnrichWithPoMatchAsync_FallsBackToSameCompanyOnly()
    {
        using var db = TestDbContextFactory.Create();
        var projectA = Guid.NewGuid();
        var projectB = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectA);
        await TestDbContextFactory.SeedProjectAsync(db, projectB);

        var poId = Guid.NewGuid();
        db.Set<PurchaseOrder>().Add(new PurchaseOrder
        {
            Id = poId,
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = projectB,
            PONumber = "PO-CROSS",
            VendorId = Guid.NewGuid(),
            TotalAmount = 3000m,
            Status = PurchaseOrderStatus.Approved,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { PoNumber = "PO-CROSS" };

        // PO belongs to projectB in same company — should match via fallback
        var result = await service.EnrichWithPoMatchAsync(input, projectA, CancellationToken.None);

        result.MatchedPurchaseOrder.Should().NotBeNull();
        result.MatchedPurchaseOrder!.Id.Should().Be(poId);
        result.MatchedPurchaseOrder.ProjectId.Should().Be(projectB);
    }

    [Fact]
    public async Task EnrichWithPoMatchAsync_DifferentCompany_DoesNotMatch()
    {
        var otherCompanyId = Guid.NewGuid();
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);

        // PO belongs to a different company
        db.Set<PurchaseOrder>().Add(new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = otherCompanyId,
            ProjectId = projectId,
            PONumber = "PO-OTHER-CO",
            VendorId = Guid.NewGuid(),
            TotalAmount = 2000m,
            Status = PurchaseOrderStatus.Approved,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { PoNumber = "PO-OTHER-CO" };

        var result = await service.EnrichWithPoMatchAsync(input, projectId, CancellationToken.None);

        result.MatchedPurchaseOrder.Should().BeNull();
        result.Warnings.Should().Contain(w => w.Contains("PO-OTHER-CO"));
    }

    // ─────────────────────────────────────────────────
    // Vendor matching tests (in-memory DB)
    // ─────────────────────────────────────────────────

    [Fact]
    public async Task EnrichWithVendorMatchesAsync_NoVendorName_AddsWarning()
    {
        using var db = TestDbContextFactory.Create();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { VendorName = null };

        var result = await service.EnrichWithVendorMatchesAsync(input, CancellationToken.None);

        result.Warnings.Should().Contain(w => w.Contains("No vendor name"));
    }

    [Fact]
    public async Task EnrichWithVendorMatchesAsync_ExactMatch_ReturnsHighScore()
    {
        using var db = TestDbContextFactory.Create();
        db.Set<Vendor>().Add(new Vendor
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "Martin Marietta Materials",
            Code = "MMM",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { VendorName = "Martin Marietta Materials" };

        var result = await service.EnrichWithVendorMatchesAsync(input, CancellationToken.None);

        result.VendorMatches.Should().HaveCount(1);
        result.VendorMatches[0].Confidence.Should().Be(1.0m);
    }

    [Fact]
    public async Task EnrichWithVendorMatchesAsync_NoMatches_AddsWarning()
    {
        using var db = TestDbContextFactory.Create();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { VendorName = "Nonexistent Vendor LLC" };

        var result = await service.EnrichWithVendorMatchesAsync(input, CancellationToken.None);

        result.VendorMatches.Should().BeEmpty();
        result.Warnings.Should().Contain(w => w.Contains("Nonexistent Vendor LLC"));
    }

    [Fact]
    public async Task EnrichWithVendorMatchesAsync_DifferentCompany_ExcludedFromResults()
    {
        using var db = TestDbContextFactory.Create();
        var otherCompanyId = Guid.NewGuid();
        db.Set<Vendor>().Add(new Vendor
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = otherCompanyId,
            Name = "Other Company Vendor",
            Code = "OCV",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var input = new DeliveryTicketExtractionResult { VendorName = "Other Company Vendor" };

        var result = await service.EnrichWithVendorMatchesAsync(input, CancellationToken.None);

        result.VendorMatches.Should().BeEmpty();
    }

    // ─────────────────────────────────────────────────
    // Prompt content tests
    // ─────────────────────────────────────────────────

    [Fact]
    public void ExtractionPrompt_ContainsConstructionUnits()
    {
        DeliveryTicketOcrService.ExtractionPrompt.Should().Contain("CY");
        DeliveryTicketOcrService.ExtractionPrompt.Should().Contain("LF");
        DeliveryTicketOcrService.ExtractionPrompt.Should().Contain("TON");
        DeliveryTicketOcrService.ExtractionPrompt.Should().Contain("EA");
    }

    [Fact]
    public void ExtractionPrompt_MentionsPoNumber()
    {
        DeliveryTicketOcrService.ExtractionPrompt.Should().Contain("PO");
        DeliveryTicketOcrService.ExtractionPrompt.Should().Contain("poNumber");
    }

    // ─────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────

    private static DeliveryTicketOcrService CreateService(Core.Data.PitbullDbContext db)
    {
        var aiKeyService = new Mock<Pitbull.AI.Services.IAiApiKeyService>();
        var httpClientFactory = new Mock<IHttpClientFactory>();
        var tenantContext = new Core.MultiTenancy.TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId
        };
        var companyContext = new Core.MultiTenancy.CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId
        };
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<DeliveryTicketOcrService>.Instance;

        return new DeliveryTicketOcrService(
            aiKeyService.Object,
            httpClientFactory.Object,
            db,
            tenantContext,
            companyContext,
            logger);
    }

    private static DeliveryTicketOcrService CreateServiceWithMocks(
        Core.Data.PitbullDbContext db,
        Mock<Pitbull.AI.Services.IAiApiKeyService>? aiKeyService = null,
        Mock<IHttpClientFactory>? httpFactory = null)
    {
        aiKeyService ??= new Mock<Pitbull.AI.Services.IAiApiKeyService>();
        httpFactory ??= new Mock<IHttpClientFactory>();
        var tenantContext = new Core.MultiTenancy.TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId
        };
        var companyContext = new Core.MultiTenancy.CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId
        };
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<DeliveryTicketOcrService>.Instance;

        return new DeliveryTicketOcrService(
            aiKeyService.Object,
            httpFactory.Object,
            db,
            tenantContext,
            companyContext,
            logger);
    }

    private sealed class MockHttpMessageHandler(HttpResponseMessage response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(response);
    }
}
