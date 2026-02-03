using FluentValidation;

namespace Pitbull.Bids.Features.ListBids;

public class ListBidsValidator : AbstractValidator<ListBidsQuery>
{
    public ListBidsValidator()
    {
        RuleFor(x => x.Search)
            .MaximumLength(200)
            .WithMessage("Search query cannot exceed 200 characters");

        // Note: Page and PageSize validation is handled by the PaginationQuery base class
        // which automatically clamps values to safe ranges (Page >= 1, PageSize 1-100)
    }
}