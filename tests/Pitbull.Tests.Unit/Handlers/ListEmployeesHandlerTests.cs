using FluentAssertions;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.ListEmployees;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ListEmployeesHandlerTests
{
    [Fact]
    public async Task Handle_NoFilters_ReturnsAllEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(5);
        result.Value.TotalCount.Should().Be(5);
    }

    [Fact]
    public async Task Handle_FilterByIsActive_ReturnsOnlyActiveEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(IsActive: true);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(4);
        result.Value.Items.Should().OnlyContain(e => e.IsActive);
    }

    [Fact]
    public async Task Handle_FilterByInactive_ReturnsOnlyInactiveEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(IsActive: false);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items.Should().OnlyContain(e => !e.IsActive);
    }

    [Fact]
    public async Task Handle_FilterByClassification_ReturnsMatchingEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(Classification: EmployeeClassification.Hourly);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.Items.Should().OnlyContain(e => 
            e.Classification == EmployeeClassification.Hourly);
    }

    [Fact]
    public async Task Handle_FilterBySalaried_ReturnsOnlySalariedEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(Classification: EmployeeClassification.Salaried);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Items.Should().OnlyContain(e => 
            e.Classification == EmployeeClassification.Salaried);
    }

    [Fact]
    public async Task Handle_SearchByFirstName_ReturnsMatchingEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        // Search for "alice" - unique first name in test data
        var query = new ListEmployeesQuery(Search: "alice");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items.First().FirstName.Should().Be("Alice");
    }

    [Fact]
    public async Task Handle_SearchByLastName_ReturnsMatchingEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(Search: "smith");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items.First().LastName.Should().Be("Smith");
    }

    [Fact]
    public async Task Handle_SearchByEmployeeNumber_ReturnsMatchingEmployee()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(Search: "EMP-003");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items.First().EmployeeNumber.Should().Be("EMP-003");
    }

    [Fact]
    public async Task Handle_SearchByEmail_ReturnsMatchingEmployee()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(Search: "jane.smith");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items.First().Email.Should().Contain("jane.smith");
    }

    [Fact]
    public async Task Handle_SearchMixedCase_ReturnsMatchingEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        // The handler converts both search term and data to lowercase for case-insensitive search
        // Using "ALICE" (all caps) to verify case insensitivity works
        var query = new ListEmployeesQuery(Search: "ALICE");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items.First().FirstName.Should().Be("Alice");
    }

    [Fact]
    public async Task Handle_CombinedFilters_ReturnsFilteredResults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(
            IsActive: true, 
            Classification: EmployeeClassification.Hourly);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2); // Only active hourly employees
        result.Value.Items.Should().OnlyContain(e => 
            e.IsActive && e.Classification == EmployeeClassification.Hourly);
    }

    [Fact]
    public async Task Handle_Pagination_ReturnsCorrectPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery { Page = 1, PageSize = 2 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(5);
        result.Value.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(2);
        result.Value.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task Handle_SecondPage_ReturnsCorrectItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery { Page = 2, PageSize = 2 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Page.Should().Be(2);
    }

    [Fact]
    public async Task Handle_LastPage_ReturnsRemainingItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery { Page = 3, PageSize = 2 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1); // Only 1 remaining on page 3
        result.Value.Page.Should().Be(3);
    }

    [Fact]
    public async Task Handle_OrdersByLastNameThenFirstName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var lastNames = result.Value!.Items.Select(e => e.LastName).ToList();
        lastNames.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task Handle_EmptyDatabase_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
        result.Value.TotalPages.Should().Be(0);
    }

    [Fact]
    public async Task Handle_NoMatchingResults_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employees = CreateTestEmployees();
        db.Set<Employee>().AddRange(employees);
        await db.SaveChangesAsync();

        var handler = new ListEmployeesHandler(db);
        var query = new ListEmployeesQuery(Search: "NonExistent");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    private static List<Employee> CreateTestEmployees()
    {
        return new List<Employee>
        {
            new Employee
            {
                EmployeeNumber = "EMP-001",
                FirstName = "John",
                LastName = "Doe",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 35.00m,
                HireDate = new DateOnly(2025, 1, 15),
                Email = "john.doe@example.com",
                IsActive = true
            },
            new Employee
            {
                EmployeeNumber = "EMP-002",
                FirstName = "Jane",
                LastName = "Smith",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 50.00m,
                HireDate = new DateOnly(2024, 6, 1),
                Email = "jane.smith@example.com",
                IsActive = true
            },
            new Employee
            {
                EmployeeNumber = "EMP-003",
                FirstName = "Bob",
                LastName = "Johnson",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 30.00m,
                HireDate = new DateOnly(2025, 2, 1),
                Email = "bob.johnson@example.com",
                IsActive = true
            },
            new Employee
            {
                EmployeeNumber = "EMP-004",
                FirstName = "Alice",
                LastName = "Williams",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 55.00m,
                HireDate = new DateOnly(2023, 3, 15),
                Email = "alice.williams@example.com",
                IsActive = true
            },
            new Employee
            {
                EmployeeNumber = "EMP-005",
                FirstName = "Charlie",
                LastName = "Brown",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 28.00m,
                HireDate = new DateOnly(2024, 9, 1),
                TerminationDate = new DateOnly(2025, 1, 31),
                Email = "charlie.brown@example.com",
                IsActive = false
            }
        };
    }
}
