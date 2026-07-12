using System.Text.Json;
using System.Text.Json.Serialization;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Tests.Unit.Modules.Projects;

/// <summary>
/// 2.13.1 — GET /api/projects?view=mobile slim DTO is smaller than full ProjectDto JSON.
/// </summary>
public class ProjectMobileListViewTests
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    [Fact]
    public void Mobile_list_item_json_is_smaller_than_full_ProjectDto()
    {
        var full = new ProjectDto(
            Id: Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            Name: "Demo Highway Job",
            Number: "PRJ-1001",
            Description: "Long description that phones do not need in a picker list.",
            Status: ProjectStatus.Active,
            Type: ProjectType.Commercial,
            Address: "123 Main St",
            City: "Austin",
            State: "TX",
            ZipCode: "78701",
            ClientName: "Acme Owner LLC",
            ClientContact: "Jane Doe",
            ClientEmail: "jane@acme.example",
            ClientPhone: "512-555-0100",
            StartDate: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            EstimatedCompletionDate: new DateTime(2027, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            ActualCompletionDate: null,
            ContractAmount: 12_500_000m,
            ProjectManagerId: Guid.Parse("11111111-1111-1111-1111-111111111111"),
            SuperintendentId: Guid.Parse("22222222-2222-2222-2222-222222222222"),
            SourceBidId: null,
            CreatedAt: new DateTime(2025, 12, 1, 0, 0, 0, DateTimeKind.Utc),
            BilledToDate: 1_000_000m,
            UnbilledAmount: 11_500_000m,
            LaborSpent: 250_000m,
            LaborPercentOfContract: 2m
        );

        var mobile = ProjectListViewMapper.ToMobileListItem(full);
        var fullJson = JsonSerializer.Serialize(full, JsonOpts);
        var mobileJson = JsonSerializer.Serialize(mobile, JsonOpts);

        Assert.True(
            mobileJson.Length < fullJson.Length,
            $"Expected mobile ({mobileJson.Length}) < full ({fullJson.Length}). mobile={mobileJson} full={fullJson}"
        );
        // Field count: mobile exposes 4 properties; full has many more.
        Assert.DoesNotContain("contractAmount", mobileJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("clientName", mobileJson, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("name", mobileJson, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("number", mobileJson, StringComparison.OrdinalIgnoreCase);
    }
}
