using Pitbull.Billing.Features.JournalEntries;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IJournalEntryService
{
    Task<Result<ListJournalEntriesResult>> GetJournalEntriesAsync(ListJournalEntriesQuery query, CancellationToken cancellationToken = default);
    Task<Result<JournalEntryDto>> GetJournalEntryAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<JournalEntryDto>> CreateJournalEntryAsync(CreateJournalEntryCommand command, CancellationToken cancellationToken = default);
    Task<Result<JournalEntryDto>> UpdateJournalEntryAsync(UpdateJournalEntryCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteJournalEntryAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<JournalEntryDto>> PostJournalEntryAsync(Guid id, Guid postedByUserId, CancellationToken cancellationToken = default);
    Task<Result<JournalEntryDto>> ReverseJournalEntryAsync(Guid id, Guid reversedByUserId, CancellationToken cancellationToken = default);
}
