using Pitbull.Core.CQRS;

namespace Pitbull.Documents.Services;

public interface IFileValidationService
{
    Result ValidateFile(string fileName, string contentType, long fileSize);
}
