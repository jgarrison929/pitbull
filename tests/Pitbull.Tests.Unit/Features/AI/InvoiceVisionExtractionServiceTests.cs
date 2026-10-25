using FluentAssertions;
using Pitbull.Api.Features.AI;

namespace Pitbull.Tests.Unit.Features.AI;

public sealed class InvoiceVisionExtractionServiceTests
{
    // ─────────────────────────────────────────────────
    // Parsing tests
    // ─────────────────────────────────────────────────

    [Fact]
    public void ParseAiResponse_ValidJson_ExtractsAllFields()
    {
        var json = """
            {
              "vendorName": "ACME Supplies Inc.",
              "vendorNameConfidence": 0.95,
              "invoiceNumber": "INV-2026-0042",
              "invoiceNumberConfidence": 0.92,
              "invoiceDate": "2026-01-15",
              "invoiceDateConfidence": 0.90,
              "dueDate": "2026-02-15",
              "dueDateConfidence": 0.88,
              "poNumber": "PO-1234",
              "poNumberConfidence": 0.85,
              "lineItems": [
                {
                  "description": "Concrete Mix",
                  "quantity": 50,
                  "unitPrice": 12.50,
                  "amount": 625.00,
                  "costCode": "03-000"
                },
                {
                  "description": "Rebar #4",
                  "quantity": 100,
                  "unitPrice": 2.75,
                  "amount": 275.00,
                  "costCode": null
                }
              ],
              "subtotal": 900.00,
              "tax": 74.25,
              "total": 974.25,
              "totalConfidence": 0.98
            }
            """;

        var result = InvoiceVisionExtractionService.ParseAiResponse(json);

        result.VendorName.Should().Be("ACME Supplies Inc.");
        result.VendorNameConfidence.Should().Be(0.95m);
        result.InvoiceNumber.Should().Be("INV-2026-0042");
        result.InvoiceDate.Should().Be("2026-01-15");
        result.DueDate.Should().Be("2026-02-15");
        result.PoNumber.Should().Be("PO-1234");
        result.PoNumberConfidence.Should().Be(0.85m);
        result.LineItems.Should().HaveCount(2);
        result.LineItems[0].Description.Should().Be("Concrete Mix");
        result.LineItems[0].Quantity.Should().Be(50);
        result.LineItems[0].UnitPrice.Should().Be(12.50m);
        result.LineItems[0].Amount.Should().Be(625.00m);
        result.LineItems[0].CostCode.Should().Be("03-000");
        result.LineItems[1].CostCode.Should().BeNull();
        result.Subtotal.Should().Be(900.00m);
        result.Tax.Should().Be(74.25m);
        result.Total.Should().Be(974.25m);
        result.TotalConfidence.Should().Be(0.98m);
        result.OverallConfidence.Should().BeGreaterThan(0);
    }

    [Fact]
    public void ParseAiResponse_WithMarkdownFences_StripsAndParses()
    {
        var json = """
            ```json
            {
              "vendorName": "Test Vendor",
              "vendorNameConfidence": 0.9,
              "invoiceNumber": "INV-001",
              "invoiceNumberConfidence": 0.8,
              "invoiceDate": null,
              "invoiceDateConfidence": 0.0,
              "dueDate": null,
              "dueDateConfidence": 0.0,
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "lineItems": [],
              "subtotal": null,
              "tax": null,
              "total": 500.00,
              "totalConfidence": 0.7
            }
            ```
            """;

        var result = InvoiceVisionExtractionService.ParseAiResponse(json);

        result.VendorName.Should().Be("Test Vendor");
        result.InvoiceNumber.Should().Be("INV-001");
        result.Total.Should().Be(500.00m);
        result.LineItems.Should().BeEmpty();
    }

    [Fact]
    public void ParseAiResponse_NullFields_HandlesGracefully()
    {
        var json = """
            {
              "vendorName": null,
              "vendorNameConfidence": 0.0,
              "invoiceNumber": null,
              "invoiceNumberConfidence": 0.0,
              "invoiceDate": null,
              "invoiceDateConfidence": 0.0,
              "dueDate": null,
              "dueDateConfidence": 0.0,
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "lineItems": [],
              "subtotal": null,
              "tax": null,
              "total": null,
              "totalConfidence": 0.0
            }
            """;

        var result = InvoiceVisionExtractionService.ParseAiResponse(json);

        result.VendorName.Should().BeNull();
        result.InvoiceNumber.Should().BeNull();
        result.PoNumber.Should().BeNull();
        result.Total.Should().BeNull();
        result.OverallConfidence.Should().Be(0);
    }

    [Fact]
    public void ParseAiResponse_OverallConfidence_AveragesNonZeroFields()
    {
        var json = """
            {
              "vendorName": "Test",
              "vendorNameConfidence": 0.8,
              "invoiceNumber": "INV-1",
              "invoiceNumberConfidence": 0.6,
              "invoiceDate": null,
              "invoiceDateConfidence": 0.0,
              "dueDate": null,
              "dueDateConfidence": 0.0,
              "poNumber": null,
              "poNumberConfidence": 0.0,
              "lineItems": [],
              "subtotal": null,
              "tax": null,
              "total": 100,
              "totalConfidence": 0.9
            }
            """;

        var result = InvoiceVisionExtractionService.ParseAiResponse(json);

        // Average of 0.8, 0.6, 0.9 (non-zero fields: vendorName, invoiceNumber, total)
        // = 2.3 / 3 = 0.7667
        result.OverallConfidence.Should().BeApproximately(0.7667m, 0.001m);
    }

    // ─────────────────────────────────────────────────
    // Levenshtein distance tests
    // ─────────────────────────────────────────────────

    [Theory]
    [InlineData("", "", 0)]
    [InlineData("abc", "", 3)]
    [InlineData("", "abc", 3)]
    [InlineData("abc", "abc", 0)]
    [InlineData("abc", "abd", 1)]
    [InlineData("kitten", "sitting", 3)]
    [InlineData("sunday", "saturday", 3)]
    public void LevenshteinDistance_ReturnsCorrectDistance(string a, string b, int expected)
    {
        InvoiceVisionExtractionService.LevenshteinDistance(a, b).Should().Be(expected);
    }

    // ─────────────────────────────────────────────────
    // Vendor fuzzy matching score tests
    // ─────────────────────────────────────────────────

    [Fact]
    public void ComputeMatchScore_ExactMatch_Returns1()
    {
        var score = InvoiceVisionExtractionService.ComputeMatchScore("ACME Supplies", "ACME Supplies");
        score.Should().Be(1.0m);
    }

    [Fact]
    public void ComputeMatchScore_ExactMatchCaseInsensitive_Returns1()
    {
        var score = InvoiceVisionExtractionService.ComputeMatchScore("acme supplies", "ACME Supplies");
        score.Should().Be(1.0m);
    }

    [Fact]
    public void ComputeMatchScore_ContainsMatch_ReturnsHighScore()
    {
        var score = InvoiceVisionExtractionService.ComputeMatchScore("ACME", "ACME Supplies Inc.");
        score.Should().BeGreaterThan(0.7m);
    }

    [Fact]
    public void ComputeMatchScore_SimilarNames_ReturnsModerateScore()
    {
        var score = InvoiceVisionExtractionService.ComputeMatchScore("ACME Supples", "ACME Supplies");
        score.Should().BeGreaterThan(0.8m);
    }

    [Fact]
    public void ComputeMatchScore_CompletelyDifferent_ReturnsLowScore()
    {
        var score = InvoiceVisionExtractionService.ComputeMatchScore("ABC Corp", "XYZ Industries");
        score.Should().BeLessThan(0.3m);
    }

    [Fact]
    public void ComputeMatchScore_ReverseContains_ReturnsHighScore()
    {
        // Extracted name is longer than vendor name in DB
        var score = InvoiceVisionExtractionService.ComputeMatchScore("ACME Supplies Inc.", "ACME Supplies");
        score.Should().BeGreaterThan(0.7m);
    }
}
