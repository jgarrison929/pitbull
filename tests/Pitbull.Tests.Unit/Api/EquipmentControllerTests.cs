using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.Equipment;

namespace Pitbull.Tests.Unit.Api;

public class EquipmentControllerTests
{
    private readonly Mock<IEquipmentService> _serviceMock;
    private readonly EquipmentController _controller;

    private static readonly Guid TestId = Guid.NewGuid();

    public EquipmentControllerTests()
    {
        _serviceMock = new Mock<IEquipmentService>();
        _controller = new EquipmentController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static EquipmentDto CreateTestDto(Guid? id = null) => new(
        Id: id ?? TestId,
        Code: "EX-001",
        Name: "CAT 320 Excavator",
        Description: "2020 Caterpillar 320 GC Hydraulic Excavator",
        Type: EquipmentType.HeavyEquipment,
        TypeName: "HeavyEquipment",
        HourlyRate: 150.00m,
        BillingRate: 185.00m,
        IsActive: true,
        SerialNumber: "CAT0320GC123456",
        LicensePlate: null,
        CreatedAt: DateTime.UtcNow,
        UpdatedAt: null
    );

    private static ListEquipmentResult CreateTestListResult(params EquipmentDto[] items) => new(
        Items: items,
        TotalCount: items.Length,
        Page: 1,
        PageSize: 25,
        TotalPages: 1
    );

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var listResult = CreateTestListResult(CreateTestDto());
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Success(listResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(listResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var listResult = CreateTestListResult();
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Success(listResult));

        await _controller.List(
            isActive: true,
            type: EquipmentType.HeavyEquipment,
            searchTerm: "excavator",
            page: 2,
            pageSize: 50);

        _serviceMock.Verify(s => s.ListEquipmentAsync(
            It.Is<ListEquipmentQuery>(q =>
                q.IsActive == true &&
                q.Type == EquipmentType.HeavyEquipment &&
                q.SearchTerm == "excavator" &&
                q.Page == 2 &&
                q.PageSize == 50),
            default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var listResult = CreateTestListResult();
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Success(listResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListEquipmentAsync(
            It.Is<ListEquipmentQuery>(q =>
                q.Page == 1 &&
                q.PageSize == 25),
            default), Times.Once);
    }

    [Fact]
    public async Task List_NullFilters_PassesNullToQuery()
    {
        var listResult = CreateTestListResult();
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Success(listResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListEquipmentAsync(
            It.Is<ListEquipmentQuery>(q =>
                q.IsActive == null &&
                q.Type == null &&
                q.SearchTerm == null),
            default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Failure<ListEquipmentResult>("Invalid query"));

        var result = await _controller.List(null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_EmptyResults_Returns200WithEmptyList()
    {
        var listResult = CreateTestListResult();
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Success(listResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<ListEquipmentResult>().Subject;
        returned.TotalCount.Should().Be(0);
        returned.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task List_FilterByActiveStatus_PassesToQuery()
    {
        var listResult = CreateTestListResult();
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Success(listResult));

        await _controller.List(isActive: false, type: null, searchTerm: null);

        _serviceMock.Verify(s => s.ListEquipmentAsync(
            It.Is<ListEquipmentQuery>(q => q.IsActive == false),
            default), Times.Once);
    }

    [Fact]
    public async Task List_FilterByType_PassesToQuery()
    {
        var listResult = CreateTestListResult();
        _serviceMock
            .Setup(s => s.ListEquipmentAsync(It.IsAny<ListEquipmentQuery>(), default))
            .ReturnsAsync(Result.Success(listResult));

        await _controller.List(isActive: null, type: EquipmentType.Vehicles, searchTerm: null);

        _serviceMock.Verify(s => s.ListEquipmentAsync(
            It.Is<ListEquipmentQuery>(q => q.Type == EquipmentType.Vehicles),
            default), Times.Once);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetEquipmentAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetEquipmentAsync(TestId, default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Equipment not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetEquipmentAsync(TestId, default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetById_ReturnsFullDtoFields()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetEquipmentAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<EquipmentDto>().Subject;
        returned.Id.Should().Be(dto.Id);
        returned.Code.Should().Be("EX-001");
        returned.Name.Should().Be("CAT 320 Excavator");
        returned.Description.Should().Be("2020 Caterpillar 320 GC Hydraulic Excavator");
        returned.Type.Should().Be(EquipmentType.HeavyEquipment);
        returned.TypeName.Should().Be("HeavyEquipment");
        returned.HourlyRate.Should().Be(150.00m);
        returned.BillingRate.Should().Be(185.00m);
        returned.IsActive.Should().BeTrue();
        returned.SerialNumber.Should().Be("CAT0320GC123456");
        returned.LicensePlate.Should().BeNull();
    }

    [Fact]
    public async Task GetById_PassesIdToService()
    {
        var equipmentId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.GetEquipmentAsync(equipmentId, default))
            .ReturnsAsync(Result.Success(CreateTestDto(equipmentId)));

        await _controller.GetById(equipmentId);

        _serviceMock.Verify(s => s.GetEquipmentAsync(equipmentId, default), Times.Once);
    }

    #endregion

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithEquipment()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new CreateEquipmentRequest(
            Code: "EX-001",
            Name: "CAT 320 Excavator",
            Description: "2020 Caterpillar 320 GC Hydraulic Excavator",
            Type: EquipmentType.HeavyEquipment,
            HourlyRate: 150.00m,
            BillingRate: 185.00m,
            IsActive: true,
            SerialNumber: "CAT0320GC123456",
            LicensePlate: null);

        var result = await _controller.Create(request);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.Value.Should().Be(dto);
        created.ActionName.Should().Be("GetById");
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtRouteWithCorrectId()
    {
        var equipmentId = Guid.NewGuid();
        var dto = CreateTestDto(equipmentId);
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new CreateEquipmentRequest(
            Code: "EX-002",
            Name: "Bobcat Loader");

        var result = await _controller.Create(request);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.RouteValues.Should().ContainKey("id");
        created.RouteValues!["id"].Should().Be(equipmentId);
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Code is required", "VALIDATION_ERROR"));

        var request = new CreateEquipmentRequest(
            Code: "",
            Name: "Test Equipment");

        var result = await _controller.Create(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_DuplicateCode_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Equipment code already exists", "DUPLICATE_CODE"));

        var request = new CreateEquipmentRequest(
            Code: "EX-001",
            Name: "Duplicate Equipment");

        var result = await _controller.Create(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new CreateEquipmentRequest(
            Code: "TRK-010",
            Name: "Freightliner Dump Truck",
            Description: "2022 Freightliner 114SD Dump Truck",
            Type: EquipmentType.Vehicles,
            HourlyRate: 95.00m,
            BillingRate: 120.00m,
            IsActive: true,
            SerialNumber: "FL114SD2022XYZ",
            LicensePlate: "ABC-1234");

        await _controller.Create(request);

        _serviceMock.Verify(s => s.CreateEquipmentAsync(
            It.Is<CreateEquipmentCommand>(c =>
                c.Code == "TRK-010" &&
                c.Name == "Freightliner Dump Truck" &&
                c.Description == "2022 Freightliner 114SD Dump Truck" &&
                c.Type == EquipmentType.Vehicles &&
                c.HourlyRate == 95.00m &&
                c.BillingRate == 120.00m &&
                c.IsActive == true &&
                c.SerialNumber == "FL114SD2022XYZ" &&
                c.LicensePlate == "ABC-1234"),
            default), Times.Once);
    }

    [Fact]
    public async Task Create_ErrorResponse_ContainsErrorAndCode()
    {
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Name is required", "VALIDATION_ERROR"));

        var request = new CreateEquipmentRequest(
            Code: "EX-001",
            Name: "");

        var result = await _controller.Create(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
        bad.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task Create_DefaultValues_PassesDefaults()
    {
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new CreateEquipmentRequest(
            Code: "EQ-100",
            Name: "Basic Equipment");

        await _controller.Create(request);

        _serviceMock.Verify(s => s.CreateEquipmentAsync(
            It.Is<CreateEquipmentCommand>(c =>
                c.Code == "EQ-100" &&
                c.Name == "Basic Equipment" &&
                c.Description == null &&
                c.Type == EquipmentType.Other &&
                c.HourlyRate == 0 &&
                c.BillingRate == null &&
                c.IsActive == true &&
                c.SerialNumber == null &&
                c.LicensePlate == null),
            default), Times.Once);
    }

    [Fact]
    public async Task Create_ZeroHourlyRate_PassesThrough()
    {
        var dto = CreateTestDto() with { HourlyRate = 0m };
        _serviceMock
            .Setup(s => s.CreateEquipmentAsync(It.IsAny<CreateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new CreateEquipmentRequest(
            Code: "TL-001",
            Name: "Hand Tools Set",
            Type: EquipmentType.Tools,
            HourlyRate: 0);

        var result = await _controller.Create(request);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var returnedDto = created.Value.Should().BeOfType<EquipmentDto>().Subject;
        returnedDto.HourlyRate.Should().Be(0m);
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UpdateEquipmentRequest(
            Code: "EX-001",
            Name: "Updated Excavator",
            HourlyRate: 175.00m);

        var result = await _controller.Update(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Equipment not found", "NOT_FOUND"));

        var request = new UpdateEquipmentRequest(Name: "Updated Name");

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Code cannot be empty", "VALIDATION_ERROR"));

        var request = new UpdateEquipmentRequest(Code: "");

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_DuplicateCode_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Equipment code already exists", "DUPLICATE_CODE"));

        var request = new UpdateEquipmentRequest(Code: "EX-001");

        var result = await _controller.Update(TestId, request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Failure<EquipmentDto>("Unknown error", "UNKNOWN"));

        var request = new UpdateEquipmentRequest(Name: "Test");

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new UpdateEquipmentRequest(
            Code: "TRK-099",
            Name: "Updated Dump Truck",
            Description: "Refurbished 2022 dump truck",
            Type: EquipmentType.Vehicles,
            HourlyRate: 110.00m,
            BillingRate: 140.00m,
            IsActive: false,
            SerialNumber: "UPD2022XYZ",
            LicensePlate: "XYZ-9999");

        await _controller.Update(TestId, request);

        _serviceMock.Verify(s => s.UpdateEquipmentAsync(
            It.Is<UpdateEquipmentCommand>(c =>
                c.EquipmentId == TestId &&
                c.Code == "TRK-099" &&
                c.Name == "Updated Dump Truck" &&
                c.Description == "Refurbished 2022 dump truck" &&
                c.Type == EquipmentType.Vehicles &&
                c.HourlyRate == 110.00m &&
                c.BillingRate == 140.00m &&
                c.IsActive == false &&
                c.SerialNumber == "UPD2022XYZ" &&
                c.LicensePlate == "XYZ-9999"),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_UsesRouteIdForCommand()
    {
        var routeId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto(routeId)));

        var request = new UpdateEquipmentRequest(Name: "Updated Name");

        await _controller.Update(routeId, request);

        _serviceMock.Verify(s => s.UpdateEquipmentAsync(
            It.Is<UpdateEquipmentCommand>(c => c.EquipmentId == routeId),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_NullFields_PassesNullToCommand()
    {
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new UpdateEquipmentRequest();

        await _controller.Update(TestId, request);

        _serviceMock.Verify(s => s.UpdateEquipmentAsync(
            It.Is<UpdateEquipmentCommand>(c =>
                c.EquipmentId == TestId &&
                c.Code == null &&
                c.Name == null &&
                c.Description == null &&
                c.Type == null &&
                c.HourlyRate == null &&
                c.BillingRate == null &&
                c.IsActive == null &&
                c.SerialNumber == null &&
                c.LicensePlate == null),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_DeactivateEquipment_Returns200()
    {
        var dto = CreateTestDto() with { IsActive = false };
        _serviceMock
            .Setup(s => s.UpdateEquipmentAsync(It.IsAny<UpdateEquipmentCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UpdateEquipmentRequest(IsActive: false);

        var result = await _controller.Update(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedDto = ok.Value.Should().BeOfType<EquipmentDto>().Subject;
        returnedDto.IsActive.Should().BeFalse();
    }

    #endregion

    #region Delete

    [Fact]
    public async Task Delete_Success_Returns204()
    {
        _serviceMock
            .Setup(s => s.DeleteEquipmentAsync(TestId, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.DeleteEquipmentAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Equipment not found", "NOT_FOUND"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.DeleteEquipmentAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Delete failed", "INTERNAL_ERROR"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Delete_PassesIdToService()
    {
        var deleteId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.DeleteEquipmentAsync(deleteId, default))
            .ReturnsAsync(Result.Success());

        await _controller.Delete(deleteId);

        _serviceMock.Verify(s => s.DeleteEquipmentAsync(deleteId, default), Times.Once);
    }

    #endregion
}
