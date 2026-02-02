namespace Pitbull.Core.CQRS;

/// <summary>
/// Base class for queries that support pagination.
/// Page defaults to 1, PageSize defaults to 10 with max of 100.
/// </summary>
public abstract record PaginationQuery
{
    private int _page = 1;
    private int _pageSize = 10;

    public int Page
    {
        get => _page;
        init => _page = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        init => _pageSize = value switch
        {
            < 1 => 10,
            > 100 => 100,
            _ => value
        };
    }
}