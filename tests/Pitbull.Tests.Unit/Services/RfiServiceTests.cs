using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Contracts.Domain;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.RFIs.Features.ListRfis;
using Pitbull.RFIs.Features.UpdateRfi;
using Pitbull.RFIs.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class RfiServiceTests
{
    private readonly Mock<IValidator<CreateRfiCommand>> _createValidatorMock;
    private readonly Mock<IValidator<UpdateRfiCommand>> _updateValidatorMock;
    private readonly Mock<ILogger<RfiService>> _loggerMock;

    public RfiServiceTests()
    {
        _createValidatorMock = new Mock<IValidator<CreateRfiCommand>>();
        _updateValidatorMock = new Mock<IValidator<UpdateRfiCommand>>();
        _loggerMock = new Mock<ILogger<RfiService>>();

        // Default to valid
        _createValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<CreateRfiCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());
        _updateValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<UpdateRfiCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());
    }

    private RfiService CreateService(Pitbull.Core.Data.PitbullDbContext db) =>
        new(db, _createValidatorMock.Object, _updateValidatorMock.Object, _loggerMock.Object);

    #region GetRfiAsync

    [Fact]
    public async Task GetRfiAsync_ExistingRfi_ReturnsRfiDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Test RFI",
            Question = "What is the spec?",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetRfiAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(rfi.Id);
        result.Value.Subject.Should().Be("Test RFI");
        result.Value.Number.Should().Be(1);
    }

    [Fact]
    public async Task GetRfiAsync_NonExistentRfi_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.GetRfiAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region GetRfisAsync

    [Fact]
    public async Task GetRfisAsync_ReturnsPagedResults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        for (int i = 0; i < 15; i++)
        {
            db.Set<Rfi>().Add(new Rfi
            {
                Id = Guid.NewGuid(),
                Number = i + 1,
                Subject = $"RFI {i}",
                Question = $"Question {i}",
                Status = RfiStatus.Open,
                Priority = RfiPriority.Normal,
                ProjectId = projectId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-i)
            });
        }
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListRfisQuery(ProjectId: projectId, Status: null, Priority: null, BallInCourtUserId: null, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetRfisAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(10);
        result.Value.TotalCount.Should().Be(15);
    }

    [Fact]
    public async Task GetRfisAsync_FiltersByProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId1 = Guid.NewGuid();
        var projectId2 = Guid.NewGuid();

        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 1, Subject = "RFI 1", Question = "Q1", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId1, CreatedAt = DateTime.UtcNow });
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 1, Subject = "RFI 2", Question = "Q2", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId2, CreatedAt = DateTime.UtcNow });
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 2, Subject = "RFI 3", Question = "Q3", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId1, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListRfisQuery(ProjectId: projectId1, Status: null, Priority: null, BallInCourtUserId: null, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetRfisAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetRfisAsync_FiltersByStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 1, Subject = "Open RFI", Question = "Q1", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId, CreatedAt = DateTime.UtcNow });
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 2, Subject = "Answered RFI", Question = "Q2", Status = RfiStatus.Answered, Priority = RfiPriority.Normal, ProjectId = projectId, CreatedAt = DateTime.UtcNow });
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 3, Subject = "Closed RFI", Question = "Q3", Status = RfiStatus.Closed, Priority = RfiPriority.Normal, ProjectId = projectId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListRfisQuery(ProjectId: projectId, Status: RfiStatus.Open, Priority: null, BallInCourtUserId: null, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetRfisAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Subject.Should().Be("Open RFI");
    }

    [Fact]
    public async Task GetRfisAsync_SearchBySubjectOrQuestion()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 1, Subject = "Concrete Specs", Question = "What type of concrete?", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId, CreatedAt = DateTime.UtcNow });
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 2, Subject = "Steel Details", Question = "What grade of steel?", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListRfisQuery(ProjectId: projectId, Status: null, Priority: null, BallInCourtUserId: null, Search: "concrete") { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetRfisAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Subject.Should().Be("Concrete Specs");
    }

    #endregion

    #region CreateRfiAsync

    [Fact]
    public async Task CreateRfiAsync_ValidCommand_CreatesRfi()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var service = CreateService(db);
        var command = new CreateRfiCommand(
            ProjectId: projectId,
            Subject: "New RFI",
            Question: "What is the specification?",
            Priority: RfiPriority.High,
            DueDate: DateTime.UtcNow.AddDays(7),
            AssignedToUserId: null,
            AssignedToName: null,
            BallInCourtUserId: null,
            BallInCourtName: null,
            CreatedByName: "Test User"
        );

        // Act
        var result = await service.CreateRfiAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Subject.Should().Be("New RFI");
        result.Value.Status.Should().Be(RfiStatus.Open);
        result.Value.Priority.Should().Be(RfiPriority.High);
        result.Value.Number.Should().Be(1);
    }

    [Fact]
    public async Task CreateRfiAsync_AssignsSequentialNumber()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        // Add existing RFIs
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 1, Subject = "RFI 1", Question = "Q1", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId, CreatedAt = DateTime.UtcNow });
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 2, Subject = "RFI 2", Question = "Q2", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new CreateRfiCommand(
            ProjectId: projectId,
            Subject: "New RFI",
            Question: "What is the specification?",
            Priority: RfiPriority.Normal,
            DueDate: null,
            AssignedToUserId: null,
            AssignedToName: null,
            BallInCourtUserId: null,
            BallInCourtName: null,
            CreatedByName: null
        );

        // Act
        var result = await service.CreateRfiAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Number.Should().Be(3);
    }

    [Fact]
    public async Task CreateRfiAsync_DifferentProjects_HaveIndependentNumbers()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId1 = Guid.NewGuid();
        var projectId2 = Guid.NewGuid();

        // Add existing RFI to project 1
        db.Set<Rfi>().Add(new Rfi { Id = Guid.NewGuid(), Number = 5, Subject = "RFI 5", Question = "Q5", Status = RfiStatus.Open, Priority = RfiPriority.Normal, ProjectId = projectId1, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new CreateRfiCommand(
            ProjectId: projectId2,
            Subject: "New RFI for Project 2",
            Question: "Question",
            Priority: RfiPriority.Normal,
            DueDate: null,
            AssignedToUserId: null,
            AssignedToName: null,
            BallInCourtUserId: null,
            BallInCourtName: null,
            CreatedByName: null
        );

        // Act
        var result = await service.CreateRfiAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Number.Should().Be(1); // First RFI for project 2
    }

    [Fact]
    public async Task CreateRfiAsync_ValidationFails_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        _createValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<CreateRfiCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("Subject", "Subject is required") }));

        var service = CreateService(db);
        var command = new CreateRfiCommand(Guid.NewGuid(), "", "Question", RfiPriority.Normal, null, null, null, null, null, null);

        // Act
        var result = await service.CreateRfiAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    #endregion

    #region UpdateRfiAsync

    [Fact]
    public async Task UpdateRfiAsync_ValidCommand_UpdatesRfi()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Original Subject",
            Question = "Original Question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new UpdateRfiCommand(
            Id: rfi.Id,
            ProjectId: projectId,
            Subject: "Updated Subject",
            Question: "Updated Question",
            Answer: "The answer is 42",
            Status: RfiStatus.Answered,
            Priority: RfiPriority.High,
            DueDate: DateTime.UtcNow.AddDays(14),
            AssignedToUserId: null,
            AssignedToName: null,
            BallInCourtUserId: null,
            BallInCourtName: null
        );

        // Act
        var result = await service.UpdateRfiAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Subject.Should().Be("Updated Subject");
        result.Value.Status.Should().Be(RfiStatus.Answered);
        result.Value.Answer.Should().Be("The answer is 42");
        result.Value.AnsweredAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateRfiAsync_NonExistentRfi_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new UpdateRfiCommand(
            Id: Guid.NewGuid(),
            ProjectId: Guid.NewGuid(),
            Subject: "Subject",
            Question: "Question",
            Answer: null,
            Status: RfiStatus.Open,
            Priority: RfiPriority.Normal,
            DueDate: null,
            AssignedToUserId: null,
            AssignedToName: null,
            BallInCourtUserId: null,
            BallInCourtName: null
        );

        // Act
        var result = await service.UpdateRfiAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateRfiAsync_WithoutAnswer_KeepsOriginalAnsweredAt()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var originalAnsweredAt = DateTime.UtcNow.AddDays(-1);
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Subject",
            Question = "Question",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.Normal,
            Answer = "Original answer",
            AnsweredAt = originalAnsweredAt,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new UpdateRfiCommand(
            Id: rfi.Id,
            ProjectId: projectId,
            Subject: "Updated Subject",
            Question: "Question",
            Answer: null,  // No answer change
            Status: RfiStatus.Answered,
            Priority: RfiPriority.Normal,
            DueDate: null,
            AssignedToUserId: null,
            AssignedToName: null,
            BallInCourtUserId: null,
            BallInCourtName: null
        );

        // Act
        var result = await service.UpdateRfiAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.AnsweredAt.Should().Be(originalAnsweredAt);
    }

    #endregion

    #region DeleteRfiAsync

    [Fact]
    public async Task DeleteRfiAsync_ExistingRfi_SoftDeletes()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "To Delete",
            Question = "Question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            ProjectId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.DeleteRfiAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var deleted = await db.Set<Rfi>().FindAsync(rfi.Id);
        deleted!.IsDeleted.Should().BeTrue();
        deleted.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteRfiAsync_NonExistentRfi_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.DeleteRfiAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DeleteRfiAsync_AlreadyDeleted_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Already Deleted",
            Question = "Question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            IsDeleted = true,
            DeletedAt = DateTime.UtcNow.AddDays(-1),
            ProjectId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.DeleteRfiAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region GetRfiCostImpactAsync

    [Fact]
    public async Task GetRfiCostImpactAsync_ExistingRfi_ReturnsImpactAnalysis()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Foundation Change",
            Question = "What is the required depth?",
            Status = RfiStatus.Open,
            Priority = RfiPriority.High,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow.AddDays(-5),
            CreatedByName = "John Foreman"
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetRfiCostImpactAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.RfiId.Should().Be(rfi.Id);
        result.Value.RfiNumber.Should().Be(1);
        result.Value.Subject.Should().Be("Foundation Change");
        result.Value.Status.Should().Be("Open");
        result.Value.DaysOpen.Should().BeGreaterThan(3);
        result.Value.ChangeOrders.Should().BeEmpty();
        result.Value.Timeline.Should().NotBeEmpty();
        result.Value.Timeline.Should().Contain(t => t.Event == "RFI Created");
    }

    [Fact]
    public async Task GetRfiCostImpactAsync_NonExistentRfi_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.GetRfiCostImpactAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetRfiCostImpactAsync_WithLinkedChangeOrders_CalculatesCosts()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Structural Change",
            Question = "Please clarify detail",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.High,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            AnsweredAt = DateTime.UtcNow.AddDays(-25),
            ClosedAt = DateTime.UtcNow.AddDays(-20)
        };
        db.Set<Rfi>().Add(rfi);

        // Create a subcontract for change orders
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            SubcontractNumber = "SC-001",
            SubcontractorName = "Test Contractor",
            ScopeOfWork = "Test work",
            OriginalValue = 100000m,
            CurrentValue = 100000m,
            Status = SubcontractStatus.Executed,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Subcontract>().Add(subcontract);

        // Add linked change orders
        db.Set<ChangeOrder>().Add(new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "CO-001",
            Title = "Additional work",
            Amount = 25000m,
            DelayDays = 5,
            DelayCost = 8000m,
            Status = ChangeOrderStatus.Approved,
            OriginatingRfiId = rfi.Id,
            ApprovedDate = DateTime.UtcNow.AddDays(-15),
            ApprovedBy = "PM Smith",
            CreatedAt = DateTime.UtcNow.AddDays(-20)
        });
        db.Set<ChangeOrder>().Add(new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "CO-002",
            Title = "Delay compensation",
            Amount = 10000m,
            DelayDays = 3,
            DelayCost = 5000m,
            Status = ChangeOrderStatus.Pending,
            OriginatingRfiId = rfi.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-18)
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetRfiCostImpactAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.DirectCost.Should().Be(35000m); // 25000 + 10000
        result.Value.DelayCost.Should().Be(13000m); // 8000 + 5000
        result.Value.TotalCost.Should().Be(48000m);
        result.Value.ChangeOrders.Should().HaveCount(2);
        result.Value.ChangeOrders.Should().Contain(co => co.ChangeOrderNumber == "CO-001");
        result.Value.ChangeOrders.Should().Contain(co => co.ChangeOrderNumber == "CO-002");
    }

    [Fact]
    public async Task GetRfiCostImpactAsync_WithDueDate_CalculatesResponseDelay()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Overdue RFI",
            Question = "Question",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.High,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow.AddDays(-20),
            DueDate = DateTime.UtcNow.AddDays(-15), // Due 15 days ago
            AnsweredAt = DateTime.UtcNow.AddDays(-10) // Answered 10 days ago (5 days late)
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetRfiCostImpactAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ResponseDelayDays.Should().Be(5); // 5 days past due when answered
        result.Value.DueDate.Should().NotBeNull();
        result.Value.AnsweredAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetRfiCostImpactAsync_AnsweredOnTime_NoResponseDelay()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "On-Time RFI",
            Question = "Question",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.Normal,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            DueDate = DateTime.UtcNow.AddDays(-3), // Due 3 days ago
            AnsweredAt = DateTime.UtcNow.AddDays(-5) // Answered 5 days ago (2 days early)
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetRfiCostImpactAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ResponseDelayDays.Should().BeNull(); // No delay, answered before due
    }

    [Fact]
    public async Task GetRfiCostImpactAsync_BuildsTimelineCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Timeline Test RFI",
            Question = "Question",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.Normal,
            ProjectId = projectId,
            CreatedAt = DateTime.UtcNow.AddDays(-20),
            DueDate = DateTime.UtcNow.AddDays(-15),
            AnsweredAt = DateTime.UtcNow.AddDays(-10),
            ClosedAt = DateTime.UtcNow.AddDays(-5),
            CreatedByName = "John Doe"
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetRfiCostImpactAsync(rfi.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Timeline.Should().HaveCount(4);
        result.Value.Timeline.Should().Contain(t => t.Event == "RFI Created" && t.Actor == "John Doe");
        result.Value.Timeline.Should().Contain(t => t.Event == "Due Date");
        result.Value.Timeline.Should().Contain(t => t.Event == "Answer Received");
        result.Value.Timeline.Should().Contain(t => t.Event == "RFI Closed");
    }

    #endregion
}
