using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateCertification;
using Pitbull.HR.Features.DeleteCertification;
using Pitbull.HR.Features.GetCertification;
using Pitbull.HR.Features.UpdateCertification;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class CertificationHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId)
    {
        return new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeNumber = "EMP001",
            FirstName = "John",
            LastName = "Doe",
            Email = "john@test.com",
            WorkerType = WorkerType.Field,
            Status = EmploymentStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
    }

    #region CreateCertification

    [Fact]
    public async Task CreateCertification_ValidCommand_CreatesCertification()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateCertificationHandler(context, tenantContext);
        var command = new CreateCertificationCommand(
            EmployeeId: employee.Id,
            CertificationTypeCode: "OSHA10",
            CertificationName: "OSHA 10-Hour Safety",
            CertificateNumber: "CERT-12345",
            IssuingAuthority: "OSHA",
            IssueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            ExpirationDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1))
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.CertificationTypeCode.Should().Be("OSHA10");
        result.Value.CertificationName.Should().Be("OSHA 10-Hour Safety");
        result.Value.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task CreateCertification_NonExistentEmployee_ReturnsFailure()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var handler = new CreateCertificationHandler(context, tenantContext);
        var command = new CreateCertificationCommand(
            EmployeeId: Guid.NewGuid(),
            CertificationTypeCode: "OSHA10",
            CertificationName: "OSHA 10-Hour Safety",
            CertificateNumber: null,
            IssuingAuthority: null,
            IssueDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task CreateCertification_DuplicateType_ReturnsFailure()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        
        // Add existing certification
        var existingCert = new Certification
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId,
            EmployeeId = employee.Id,
            CertificationTypeCode = "OSHA10",
            CertificationName = "OSHA 10-Hour Safety",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            Status = CertificationStatus.Verified,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Certification>().Add(existingCert);
        await context.SaveChangesAsync();

        var handler = new CreateCertificationHandler(context, tenantContext);
        var command = new CreateCertificationCommand(
            EmployeeId: employee.Id,
            CertificationTypeCode: "OSHA10",
            CertificationName: "OSHA 10-Hour Safety (renewal)",
            CertificateNumber: null,
            IssuingAuthority: null,
            IssueDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CERTIFICATION");
    }

    #endregion

    #region GetCertification

    [Fact]
    public async Task GetCertification_ExistingCertification_ReturnsCertification()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var certification = new Certification
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            CertificationTypeCode = "CDL",
            CertificationName = "Commercial Driver License",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            ExpirationDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(3)),
            Status = CertificationStatus.Verified,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Certification>().Add(certification);
        await context.SaveChangesAsync();

        var handler = new GetCertificationHandler(context);

        // Act
        var result = await handler.Handle(new GetCertificationQuery(certification.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CertificationTypeCode.Should().Be("CDL");
    }

    [Fact]
    public async Task GetCertification_NonExistent_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new GetCertificationHandler(context);

        // Act
        var result = await handler.Handle(new GetCertificationQuery(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetCertification_DeletedCertification_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var certification = new Certification
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            CertificationTypeCode = "CDL",
            CertificationName = "Commercial Driver License",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            Status = CertificationStatus.Verified,
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Certification>().Add(certification);
        await context.SaveChangesAsync();

        var handler = new GetCertificationHandler(context);

        // Act
        var result = await handler.Handle(new GetCertificationQuery(certification.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region UpdateCertification

    [Fact]
    public async Task UpdateCertification_ValidCommand_UpdatesCertification()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var certification = new Certification
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            CertificationTypeCode = "OSHA10",
            CertificationName = "OSHA 10-Hour Safety",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            Status = CertificationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Certification>().Add(certification);
        await context.SaveChangesAsync();

        var handler = new UpdateCertificationHandler(context);
        var command = new UpdateCertificationCommand(
            Id: certification.Id,
            CertificationTypeCode: "OSHA10",
            CertificationName: "OSHA 10-Hour Safety Training",
            CertificateNumber: "CERT-UPDATE-001",
            IssuingAuthority: "OSHA",
            IssueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            ExpirationDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(2)),
            Status: CertificationStatus.Verified
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CertificationName.Should().Be("OSHA 10-Hour Safety Training");
        result.Value.CertificateNumber.Should().Be("CERT-UPDATE-001");
        result.Value.Status.Should().Be("Verified");
    }

    [Fact]
    public async Task UpdateCertification_NonExistent_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new UpdateCertificationHandler(context);
        var command = new UpdateCertificationCommand(
            Id: Guid.NewGuid(),
            CertificationTypeCode: "OSHA10",
            CertificationName: "OSHA 10-Hour Safety",
            CertificateNumber: null,
            IssuingAuthority: null,
            IssueDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null,
            Status: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region DeleteCertification

    [Fact]
    public async Task DeleteCertification_ExistingCertification_SoftDeletes()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var certification = new Certification
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            CertificationTypeCode = "FIRST_AID",
            CertificationName = "First Aid/CPR",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-6)),
            Status = CertificationStatus.Verified,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Certification>().Add(certification);
        await context.SaveChangesAsync();

        var handler = new DeleteCertificationHandler(context);

        // Act
        var result = await handler.Handle(new DeleteCertificationCommand(certification.Id), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        var deleted = await context.Set<Certification>().FindAsync(certification.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteCertification_NonExistent_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new DeleteCertificationHandler(context);

        // Act
        var result = await handler.Handle(new DeleteCertificationCommand(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteCertification_AlreadyDeleted_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var certification = new Certification
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            CertificationTypeCode = "FIRST_AID",
            CertificationName = "First Aid/CPR",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = CertificationStatus.Verified,
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Certification>().Add(certification);
        await context.SaveChangesAsync();

        var handler = new DeleteCertificationHandler(context);

        // Act
        var result = await handler.Handle(new DeleteCertificationCommand(certification.Id), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    #endregion
}
