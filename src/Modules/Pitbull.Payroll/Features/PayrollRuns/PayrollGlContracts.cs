using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Features.PayrollRuns;

public record PostPayrollRunToGlCommand(Guid PayrollRunId, Guid? PostedByUserId = null)
    : ICommand<PayrollGlPostResult>;

public record PayrollGlPostResult(
    Guid PayrollRunId,
    Guid JournalEntryId,
    string JournalEntryNumber,
    decimal TotalDebits,
    decimal TotalCredits,
    int LineCount,
    bool AlreadyPosted);
