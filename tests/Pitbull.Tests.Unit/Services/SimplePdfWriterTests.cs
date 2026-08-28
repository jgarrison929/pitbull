using System.Text;
using FluentAssertions;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class SimplePdfWriterTests
{
    [Fact]
    public void WriteTable_EmptyRows_ReturnsPdfWithTitle()
    {
        var bytes = SimplePdfWriter.WriteTable(
            "Test Company",
            "Empty Table Report",
            new DateTime(2026, 8, 28, 0, 0, 0, DateTimeKind.Utc),
            ["Col A", "Col B"],
            Array.Empty<string[]>(),
            ["TOTAL", "$0.00"]);

        Encoding.ASCII.GetString(bytes.AsSpan(0, 4)).Should().Be("%PDF");
        var ascii = Encoding.ASCII.GetString(bytes);
        ascii.Should().Contain("Empty Table Report");
        ascii.Should().Contain("Test Company");
        ascii.Should().Contain("%%EOF");
        ascii.Should().Contain("xref");
    }

    [Fact]
    public void WriteTable_ManyRows_PaginatesAndKeepsPdfHeader()
    {
        var rows = Enumerable.Range(1, 80)
            .Select(i => new[] { $"Row {i}", $"${i}.00" })
            .ToList();

        var bytes = SimplePdfWriter.WriteTable(
            "Test Company",
            "Paged Report",
            new DateTime(2026, 8, 28, 0, 0, 0, DateTimeKind.Utc),
            ["Name", "Amount"],
            rows,
            ["TOTAL", "$0.00"]);

        Encoding.ASCII.GetString(bytes.AsSpan(0, 4)).Should().Be("%PDF");
        var ascii = Encoding.ASCII.GetString(bytes);
        ascii.Should().Contain("Paged Report");
        ascii.Should().Contain("Page 1 of ");
        ascii.Should().Contain("%%EOF");
        // More than one page of ~40 rows at 16pt on letter.
        ascii.Should().Contain("Page 2 of ");
    }

    [Fact]
    public void WriteWh347_IncludesFormTitleAndEmployee()
    {
        var model = new SimplePdfWriter.Wh347PdfModel(
            CompanyName: "Acme GC",
            CompanyAddress: "1 Main St",
            ProjectName: "School Rebuild",
            ProjectLocation: "Springfield",
            ContractNumber: "C-1",
            PayrollNumber: "abcd1234",
            WeekEnding: "02/15/2026",
            PeriodStart: new DateOnly(2026, 2, 9),
            PeriodEnd: new DateOnly(2026, 2, 15),
            Rows:
            [
                new SimplePdfWriter.Wh347PdfRow(
                    "Jane Worker", "EMP-001", "Carpenter",
                    40m, 8m, 40m, 1840m, 140.76m, 220.80m, 0m, 1478.44m,
                    8, 8, 8, 8, 8, 8, 0)
            ]);

        var bytes = SimplePdfWriter.WriteWh347(model);
        Encoding.ASCII.GetString(bytes.AsSpan(0, 4)).Should().Be("%PDF");
        var ascii = Encoding.ASCII.GetString(bytes);
        ascii.Should().Contain("WH-347");
        ascii.Should().Contain("Jane Worker");
        ascii.Should().Contain("STATEMENT OF COMPLIANCE");
        ascii.Should().Contain("%%EOF");
    }
}
