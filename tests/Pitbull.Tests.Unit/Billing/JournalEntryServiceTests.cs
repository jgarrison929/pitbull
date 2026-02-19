using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.JournalEntries;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class JournalEntryServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly JournalEntryService _service;

    public JournalEntryServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new JournalEntryService(_db, NullLogger<JournalEntryService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private static List<CreateJournalEntryLineCommand> BalancedLines(decimal amount = 1000m) =>
    [
        new(Guid.NewGuid(), amount, 0, "Debit line"),
        new(Guid.NewGuid(), 0, amount, "Credit line"),
    ];

    private async Task<JournalEntryDto> CreateDraftEntry(decimal amount = 1000m)
    {
        CreateJournalEntryCommand command = new(
            EntryDate: new DateOnly(2026, 1, 15),
            Description: "Test entry",
            Lines: BalancedLines(amount));

        var result = await _service.CreateJournalEntryAsync(command);
        result.IsSuccess.Should().BeTrue();
        return result.Value!;
    }

    // ── Create ──

    [Fact]
    public async Task Create_ValidEntry_ReturnsSuccess()
    {
        var dto = await CreateDraftEntry();

        dto.EntryNumber.Should().StartWith("JE-2026-");
        dto.Status.Should().Be(JournalEntryStatus.Draft);
        dto.TotalDebits.Should().Be(1000m);
        dto.TotalCredits.Should().Be(1000m);
        dto.Lines.Should().HaveCount(2);
    }

    [Fact]
    public async Task Create_MissingDescription_ReturnsValidationError()
    {
        CreateJournalEntryCommand command = new(
            EntryDate: new DateOnly(2026, 1, 1),
            Description: "",
            Lines: BalancedLines());

        var result = await _service.CreateJournalEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_OneLine_ReturnsValidationError()
    {
        CreateJournalEntryCommand command = new(
            EntryDate: new DateOnly(2026, 1, 1),
            Description: "Bad entry",
            Lines: [new(Guid.NewGuid(), 100, 0, "Only one")]);

        var result = await _service.CreateJournalEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_Unbalanced_ReturnsUnbalancedError()
    {
        CreateJournalEntryCommand command = new(
            EntryDate: new DateOnly(2026, 1, 1),
            Description: "Unbalanced",
            Lines:
            [
                new(Guid.NewGuid(), 1000, 0, "Debit"),
                new(Guid.NewGuid(), 0, 500, "Credit"),
            ]);

        var result = await _service.CreateJournalEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("UNBALANCED");
    }

    [Fact]
    public async Task Create_ZeroAmounts_ReturnsValidationError()
    {
        CreateJournalEntryCommand command = new(
            EntryDate: new DateOnly(2026, 1, 1),
            Description: "Zero entry",
            Lines:
            [
                new(Guid.NewGuid(), 0, 0, "Zero debit"),
                new(Guid.NewGuid(), 0, 0, "Zero credit"),
            ]);

        var result = await _service.CreateJournalEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    // ── Get ──

    [Fact]
    public async Task GetById_Exists_ReturnsEntry()
    {
        var created = await CreateDraftEntry();

        var result = await _service.GetJournalEntryAsync(created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task GetById_NotFound_ReturnsNotFound()
    {
        var result = await _service.GetJournalEntryAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // ── List ──

    [Fact]
    public async Task List_ReturnsPagedResults()
    {
        await CreateDraftEntry();
        await CreateDraftEntry(2000m);

        var result = await _service.GetJournalEntriesAsync(new ListJournalEntriesQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
        result.Value!.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task List_FilterByStatus_FiltersCorrectly()
    {
        var entry = await CreateDraftEntry();
        await _service.PostJournalEntryAsync(entry.Id, Guid.NewGuid());

        var draftResult = await _service.GetJournalEntriesAsync(new ListJournalEntriesQuery(Status: JournalEntryStatus.Draft));
        var postedResult = await _service.GetJournalEntriesAsync(new ListJournalEntriesQuery(Status: JournalEntryStatus.Posted));

        draftResult.Value!.TotalCount.Should().Be(0);
        postedResult.Value!.TotalCount.Should().Be(1);
    }

    // ── Update ──

    [Fact]
    public async Task Update_DraftEntry_UpdatesFields()
    {
        var created = await CreateDraftEntry();

        UpdateJournalEntryCommand cmd = new(
            JournalEntryId: created.Id,
            Description: "Updated description",
            EntryDate: new DateOnly(2026, 2, 1));

        var result = await _service.UpdateJournalEntryAsync(cmd);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Description.Should().Be("Updated description");
        result.Value!.EntryDate.Should().Be(new DateOnly(2026, 2, 1));
    }

    [Fact]
    public async Task Update_PostedEntry_ReturnsInvalidStatus()
    {
        var created = await CreateDraftEntry();
        await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        UpdateJournalEntryCommand cmd = new(
            JournalEntryId: created.Id,
            Description: "Should fail");

        var result = await _service.UpdateJournalEntryAsync(cmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    // ── Delete ──

    [Fact]
    public async Task Delete_DraftEntry_Succeeds()
    {
        var created = await CreateDraftEntry();

        var result = await _service.DeleteJournalEntryAsync(created.Id);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Delete_PostedEntry_ReturnsInvalidStatus()
    {
        var created = await CreateDraftEntry();
        await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        var result = await _service.DeleteJournalEntryAsync(created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    // ── Post ──

    [Fact]
    public async Task Post_DraftEntry_SetsPostedStatus()
    {
        var created = await CreateDraftEntry();

        var result = await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(JournalEntryStatus.Posted);
        result.Value!.PostedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Post_AlreadyPosted_ReturnsInvalidStatus()
    {
        var created = await CreateDraftEntry();
        await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        var result = await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Post_ClosedPeriod_ReturnsPeriodClosed()
    {
        // Seed a closed period covering the entry date
        _db.Set<AccountingPeriod>().Add(new AccountingPeriod
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            PeriodNumber = 1,
            FiscalYear = 2026,
            PeriodName = "January 2026",
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 1, 31),
            Status = PeriodStatus.HardClosed,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        await _db.SaveChangesAsync();

        var created = await CreateDraftEntry();

        var result = await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PERIOD_CLOSED");
    }

    // ── Reverse ──

    [Fact]
    public async Task Reverse_PostedEntry_CreatesReversalEntry()
    {
        var created = await CreateDraftEntry();
        await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        var result = await _service.ReverseJournalEntryAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(JournalEntryStatus.Posted);
        result.Value!.Description.Should().Contain("Reversal of");
        result.Value!.Lines.Should().HaveCount(2);
    }

    [Fact]
    public async Task Reverse_DraftEntry_ReturnsInvalidStatus()
    {
        var created = await CreateDraftEntry();

        var result = await _service.ReverseJournalEntryAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Reverse_SwapsDebitsAndCredits()
    {
        var created = await CreateDraftEntry();
        await _service.PostJournalEntryAsync(created.Id, Guid.NewGuid());

        var result = await _service.ReverseJournalEntryAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        var reversal = result.Value!;

        // The original had debit=1000, credit=0 on line 1 and debit=0, credit=1000 on line 2
        // Reversal should swap: line 1 becomes credit=1000, line 2 becomes debit=1000
        var line1 = reversal.Lines.First(l => l.LineNumber == 1);
        var line2 = reversal.Lines.First(l => l.LineNumber == 2);

        line1.CreditAmount.Should().Be(1000m);
        line1.DebitAmount.Should().Be(0m);
        line2.DebitAmount.Should().Be(1000m);
        line2.CreditAmount.Should().Be(0m);
    }
}
