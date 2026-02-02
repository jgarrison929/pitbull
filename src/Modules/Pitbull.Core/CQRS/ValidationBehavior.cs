using FluentValidation;
using MediatR;

namespace Pitbull.Core.CQRS;

/// <summary>
/// MediatR pipeline behavior that runs FluentValidation validators
/// before the handler executes. Catches validation failures early.
/// </summary>
public class ValidationBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
    where TResponse : Result
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);

        var validationResults = await Task.WhenAll(
            validators.Select(v => v.ValidateAsync(context, cancellationToken)));

        var failures = validationResults
            .SelectMany(r => r.Errors)
            .Where(f => f is not null)
            .ToList();

        if (failures.Count != 0)
        {
            var errors = string.Join("; ", failures.Select(f => f.ErrorMessage));
            return (TResponse)(object)Result.Failure(errors, "VALIDATION_ERROR");
        }

        return await next();
    }
}
