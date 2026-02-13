using FluentValidation.TestHelper;
using Pitbull.Bids.Features.ListBids;
using Xunit;

namespace Pitbull.Tests.Unit.Validation;

public class ListBidsValidatorTests
{
    private readonly ListBidsValidator _validator = new();

    [Fact]
    public void PaginationQuery_AutoClampsInvalidValues_NoValidationNeeded()
    {
        // Arrange & Act - The PaginationQuery base class already clamps values
        var queryNegativePage = new ListBidsQuery() { Page = -1 };
        var queryZeroPage = new ListBidsQuery() { Page = 0 };
        var queryLargePageSize = new ListBidsQuery() { PageSize = 1000 };
        var queryZeroPageSize = new ListBidsQuery() { PageSize = 0 };

        // Assert - Base class clamping works correctly
        Assert.Equal(1, queryNegativePage.Page);  // Clamped to 1
        Assert.Equal(1, queryZeroPage.Page);      // Clamped to 1
        Assert.Equal(100, queryLargePageSize.PageSize);  // Clamped to 100
        Assert.Equal(10, queryZeroPageSize.PageSize);    // Clamped to default 10

        // Validation should pass since base class already fixed the values
        var result1 = _validator.TestValidate(queryNegativePage);
        var result2 = _validator.TestValidate(queryLargePageSize);
        result1.ShouldNotHaveValidationErrorFor(x => x.Page);
        result2.ShouldNotHaveValidationErrorFor(x => x.PageSize);
    }

    [Fact]
    public void Search_WithLongString_ShouldFail()
    {
        // Arrange - Create a string longer than 200 characters
        var longSearch = new string('A', 201);
        var query = new ListBidsQuery(Search: longSearch);

        // Act & Assert
        var result = _validator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x.Search)
              .WithErrorMessage("Search query cannot exceed 200 characters");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("valid search")]
    [InlineData("A")]
    public void Search_WithValidValues_ShouldPass(string? validSearch)
    {
        // Arrange
        var query = new ListBidsQuery(Search: validSearch);

        // Act & Assert
        var result = _validator.TestValidate(query);
        result.ShouldNotHaveValidationErrorFor(x => x.Search);
    }

    [Fact]
    public void Search_WithExactly200Characters_ShouldPass()
    {
        // Arrange - Exactly 200 characters should be valid
        var exactSearch = new string('A', 200);
        var query = new ListBidsQuery(Search: exactSearch);

        // Act & Assert
        var result = _validator.TestValidate(query);
        result.ShouldNotHaveValidationErrorFor(x => x.Search);
    }

    [Fact]
    public void ValidQuery_ShouldPassAllValidation()
    {
        // Arrange
        var query = new ListBidsQuery(
            Status: Bids.Domain.BidStatus.Submitted,
            Search: "office building"
        )
        {
            Page = 2,
            PageSize = 25
        };

        // Act & Assert
        var result = _validator.TestValidate(query);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
