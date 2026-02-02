using MediatR;

namespace Pitbull.Core.CQRS;

/// <summary>
/// Marker interface for commands (write operations).
/// Returns a Result with optional value.
/// </summary>
public interface ICommand : IRequest<Result> { }
public interface ICommand<TResponse> : IRequest<Result<TResponse>> { }

/// <summary>
/// Marker interface for queries (read operations).
/// </summary>
public interface IQuery<TResponse> : IRequest<Result<TResponse>> { }

/// <summary>
/// Result type for all CQRS operations. No exceptions for business logic.
/// </summary>
public class Result
{
    public bool IsSuccess { get; }
    public string? Error { get; }
    public string? ErrorCode { get; }

    protected Result(bool isSuccess, string? error, string? errorCode)
    {
        IsSuccess = isSuccess;
        Error = error;
        ErrorCode = errorCode;
    }

    public static Result Success() => new(true, null, null);
    public static Result Failure(string error, string? errorCode = null) => new(false, error, errorCode);
    public static Result<T> Success<T>(T value) => new(value, true, null, null);
    public static Result<T> Failure<T>(string error, string? errorCode = null) => new(default, false, error, errorCode);
}

public class Result<T> : Result
{
    public T? Value { get; }

    internal Result(T? value, bool isSuccess, string? error, string? errorCode)
        : base(isSuccess, error, errorCode)
    {
        Value = value;
    }

    public static implicit operator Result<T>(T value) => Result.Success(value);
}
