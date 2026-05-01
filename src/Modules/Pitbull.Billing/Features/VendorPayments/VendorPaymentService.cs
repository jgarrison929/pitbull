using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.JournalEntries;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.VendorPayments;

public class VendorPaymentService(
    PitbullDbContext db,
    IJournalEntryService journalEntryService,
    ILogger<VendorPaymentService> logger) : IVendorPaymentService
{
    public async Task<Result<ListVendorPaymentsResult>> GetVendorPaymentsAsync(ListVendorPaymentsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<VendorPayment> dbQuery = db.Set<VendorPayment>()
            .AsNoTracking()
            .Include(p => p.Applications)
                .ThenInclude(a => a.VendorInvoice)
            .Include(p => p.Vendor)
            .Include(p => p.BankAccount);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(p => p.Status == query.Status.Value);

        if (query.VendorId.HasValue)
            dbQuery = dbQuery.Where(p => p.VendorId == query.VendorId.Value);

        if (query.PaymentMethod.HasValue)
            dbQuery = dbQuery.Where(p => p.PaymentMethod == query.PaymentMethod.Value);

        if (query.StartDate.HasValue)
            dbQuery = dbQuery.Where(p => p.PaymentDate >= query.StartDate.Value);

        if (query.EndDate.HasValue)
            dbQuery = dbQuery.Where(p => p.PaymentDate <= query.EndDate.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim().ToLower();
            dbQuery = dbQuery.Where(p =>
                p.PaymentNumber.ToLower().Contains(term) ||
                (p.ReferenceNumber != null && p.ReferenceNumber.ToLower().Contains(term)) ||
                (p.Memo != null && p.Memo.ToLower().Contains(term)));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<VendorPayment> items = await dbQuery
            .OrderByDescending(p => p.PaymentDate)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListVendorPaymentsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<VendorPaymentDto>> GetVendorPaymentAsync(Guid id, CancellationToken cancellationToken = default)
    {
        VendorPayment? payment = await db.Set<VendorPayment>()
            .AsNoTracking()
            .Include(p => p.Applications)
                .ThenInclude(a => a.VendorInvoice)
            .Include(p => p.Vendor)
            .Include(p => p.BankAccount)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (payment is null)
            return Result.Failure<VendorPaymentDto>("Vendor payment not found", "NOT_FOUND");

        return Result.Success(MapToDto(payment));
    }

    public async Task<Result<VendorPaymentDto>> CreateVendorPaymentAsync(CreateVendorPaymentCommand command, CancellationToken cancellationToken = default)
    {
        if (command.VendorId == Guid.Empty)
            return Result.Failure<VendorPaymentDto>("VendorId is required", "VALIDATION_ERROR");

        if (command.Applications is null || command.Applications.Count == 0)
            return Result.Failure<VendorPaymentDto>("At least one invoice application is required", "VALIDATION_ERROR");

        // Validate all invoice applications
        var invoiceIds = command.Applications.Select(a => a.VendorInvoiceId).Distinct().ToList();
        var invoices = await db.Set<VendorInvoice>()
            .AsNoTracking()
            .Where(i => invoiceIds.Contains(i.Id))
            .ToListAsync(cancellationToken);

        foreach (var app in command.Applications)
        {
            if (app.AppliedAmount <= 0)
                return Result.Failure<VendorPaymentDto>("Applied amount must be positive", "VALIDATION_ERROR");

            var invoice = invoices.FirstOrDefault(i => i.Id == app.VendorInvoiceId);
            if (invoice is null)
                return Result.Failure<VendorPaymentDto>($"Invoice {app.VendorInvoiceId} not found", "NOT_FOUND");

            if (invoice.VendorId != command.VendorId)
                return Result.Failure<VendorPaymentDto>(
                    $"Invoice {invoice.InvoiceNumber} does not belong to the selected vendor", "VALIDATION_ERROR");

            // Check remaining balance
            decimal existingPayments = await GetTotalAppliedToInvoiceAsync(invoice.Id, cancellationToken);
            decimal remaining = invoice.TotalAmount - existingPayments;

            if (app.AppliedAmount > remaining + 0.01m) // small tolerance for rounding
                return Result.Failure<VendorPaymentDto>(
                    $"Applied amount ({app.AppliedAmount:N2}) exceeds remaining balance ({remaining:N2}) for invoice {invoice.InvoiceNumber}",
                    "OVERPAYMENT");
        }

        decimal totalAmount = command.Applications.Sum(a => a.AppliedAmount);

        string paymentNumber = await GeneratePaymentNumberAsync(command.PaymentDate.Year, cancellationToken);

        VendorPayment payment = new()
        {
            VendorId = command.VendorId,
            PaymentDate = command.PaymentDate,
            TotalAmount = totalAmount,
            PaymentMethod = command.PaymentMethod,
            ReferenceNumber = command.ReferenceNumber?.Trim(),
            BankAccountId = command.BankAccountId,
            Memo = command.Memo?.Trim(),
            Status = VendorPaymentStatus.Draft,
            PaymentNumber = paymentNumber
        };

        foreach (var app in command.Applications)
        {
            payment.Applications.Add(new VendorPaymentApplication
            {
                VendorInvoiceId = app.VendorInvoiceId,
                AppliedAmount = app.AppliedAmount
            });
        }

        db.Set<VendorPayment>().Add(payment);

        try
        {
            await db.SaveChangesAsync(cancellationToken);

            // Reload with navigations
            return await GetVendorPaymentAsync(payment.Id, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create vendor payment");
            return Result.Failure<VendorPaymentDto>("Failed to create vendor payment", "DATABASE_ERROR");
        }
    }

    public async Task<Result<VendorPaymentDto>> UpdateVendorPaymentAsync(UpdateVendorPaymentCommand command, CancellationToken cancellationToken = default)
    {
        VendorPayment? payment = await db.Set<VendorPayment>()
            .Include(p => p.Applications)
            .FirstOrDefaultAsync(p => p.Id == command.VendorPaymentId, cancellationToken);

        if (payment is null)
            return Result.Failure<VendorPaymentDto>("Vendor payment not found", "NOT_FOUND");

        if (payment.Status != VendorPaymentStatus.Draft)
            return Result.Failure<VendorPaymentDto>("Only draft payments can be edited", "INVALID_STATUS");

        if (command.PaymentDate.HasValue)
            payment.PaymentDate = command.PaymentDate.Value;

        if (command.PaymentMethod.HasValue)
            payment.PaymentMethod = command.PaymentMethod.Value;

        if (command.ReferenceNumber is not null)
            payment.ReferenceNumber = command.ReferenceNumber.Trim();

        if (command.ClearBankAccountId)
            payment.BankAccountId = null;
        else if (command.BankAccountId.HasValue)
            payment.BankAccountId = command.BankAccountId.Value;

        if (command.Memo is not null)
            payment.Memo = command.Memo.Trim();

        if (command.Applications is not null)
        {
            if (command.Applications.Count == 0)
                return Result.Failure<VendorPaymentDto>("At least one invoice application is required", "VALIDATION_ERROR");

            // Validate applications
            var invoiceIds = command.Applications.Select(a => a.VendorInvoiceId).Distinct().ToList();
            var invoices = await db.Set<VendorInvoice>()
                .AsNoTracking()
                .Where(i => invoiceIds.Contains(i.Id))
                .ToListAsync(cancellationToken);

            foreach (var app in command.Applications)
            {
                if (app.AppliedAmount <= 0)
                    return Result.Failure<VendorPaymentDto>("Applied amount must be positive", "VALIDATION_ERROR");

                var invoice = invoices.FirstOrDefault(i => i.Id == app.VendorInvoiceId);
                if (invoice is null)
                    return Result.Failure<VendorPaymentDto>($"Invoice {app.VendorInvoiceId} not found", "NOT_FOUND");

                // Check remaining balance (exclude current payment's existing applications)
                decimal existingPayments = await GetTotalAppliedToInvoiceAsync(invoice.Id, cancellationToken, excludePaymentId: payment.Id);
                decimal remaining = invoice.TotalAmount - existingPayments;

                if (app.AppliedAmount > remaining + 0.01m)
                    return Result.Failure<VendorPaymentDto>(
                        $"Applied amount ({app.AppliedAmount:N2}) exceeds remaining balance ({remaining:N2}) for invoice {invoice.InvoiceNumber}",
                        "OVERPAYMENT");
            }

            // Replace applications
            db.Set<VendorPaymentApplication>().RemoveRange(payment.Applications);
            payment.Applications.Clear();

            foreach (var app in command.Applications)
            {
                payment.Applications.Add(new VendorPaymentApplication
                {
                    VendorInvoiceId = app.VendorInvoiceId,
                    AppliedAmount = app.AppliedAmount
                });
            }

            payment.TotalAmount = command.Applications.Sum(a => a.AppliedAmount);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return await GetVendorPaymentAsync(payment.Id, cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<VendorPaymentDto>("Payment was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update vendor payment {Id}", command.VendorPaymentId);
            return Result.Failure<VendorPaymentDto>("Failed to update vendor payment", "DATABASE_ERROR");
        }
    }

    public async Task<Result<VendorPaymentDto>> ApproveVendorPaymentAsync(ApproveVendorPaymentCommand command, CancellationToken cancellationToken = default)
    {
        VendorPayment? payment = await db.Set<VendorPayment>()
            .Include(p => p.Applications)
            .FirstOrDefaultAsync(p => p.Id == command.VendorPaymentId, cancellationToken);

        if (payment is null)
            return Result.Failure<VendorPaymentDto>("Vendor payment not found", "NOT_FOUND");

        if (payment.Status != VendorPaymentStatus.Draft)
            return Result.Failure<VendorPaymentDto>("Only draft payments can be approved", "INVALID_STATUS");

        payment.Status = VendorPaymentStatus.Approved;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return await GetVendorPaymentAsync(payment.Id, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to approve vendor payment {Id}", command.VendorPaymentId);
            return Result.Failure<VendorPaymentDto>("Failed to approve vendor payment", "DATABASE_ERROR");
        }
    }

    public async Task<Result<VendorPaymentDto>> PostVendorPaymentAsync(PostVendorPaymentCommand command, CancellationToken cancellationToken = default)
    {
        VendorPayment? payment = await db.Set<VendorPayment>()
            .Include(p => p.Applications)
                .ThenInclude(a => a.VendorInvoice)
            .Include(p => p.Vendor)
            .FirstOrDefaultAsync(p => p.Id == command.VendorPaymentId, cancellationToken);

        if (payment is null)
            return Result.Failure<VendorPaymentDto>("Vendor payment not found", "NOT_FOUND");

        if (payment.Status != VendorPaymentStatus.Approved)
            return Result.Failure<VendorPaymentDto>("Only approved payments can be posted", "INVALID_STATUS");

        // Create journal entry: Debit AP, Credit Cash/Bank
        string vendorName = payment.Vendor?.Name ?? "Unknown Vendor";
        var jeCommand = new CreateJournalEntryCommand(
            EntryDate: payment.PaymentDate,
            Description: $"AP Payment {payment.PaymentNumber} to {vendorName}",
            SourceModule: "VendorPayment",
            SourceDocumentId: payment.Id,
            SourceDocumentRef: payment.PaymentNumber,
            IsAutoGenerated: true,
            Lines:
            [
                new CreateJournalEntryLineCommand(
                    GlAccountId: command.ApAccountId,
                    DebitAmount: payment.TotalAmount,
                    CreditAmount: 0m,
                    Description: $"AP Payment - {vendorName}"
                ),
                new CreateJournalEntryLineCommand(
                    GlAccountId: command.CashAccountId,
                    DebitAmount: 0m,
                    CreditAmount: payment.TotalAmount,
                    Description: $"Cash disbursement - {payment.PaymentNumber}"
                )
            ]
        );

        var jeResult = await journalEntryService.CreateJournalEntryAsync(jeCommand, cancellationToken);
        if (!jeResult.IsSuccess)
            return Result.Failure<VendorPaymentDto>($"Failed to create journal entry: {jeResult.Error}", "GL_ERROR");

        // Post the journal entry
        var postResult = await journalEntryService.PostJournalEntryAsync(jeResult.Value!.Id, command.PostedByUserId, cancellationToken);
        if (!postResult.IsSuccess)
            return Result.Failure<VendorPaymentDto>($"Failed to post journal entry: {postResult.Error}", "GL_ERROR");

        // Update payment
        payment.Status = VendorPaymentStatus.Posted;
        payment.JournalEntryId = jeResult.Value!.Id;
        payment.PostedByUserId = command.PostedByUserId;
        payment.PostedAt = DateTime.UtcNow;

        // Update invoice statuses — mark as Paid if fully paid
        foreach (var app in payment.Applications)
        {
            decimal totalApplied = await GetTotalAppliedToInvoiceAsync(app.VendorInvoiceId, cancellationToken);
            // Include current application since we haven't saved yet — it's already tracked
            if (totalApplied >= app.VendorInvoice.TotalAmount - 0.01m)
            {
                app.VendorInvoice.Status = VendorInvoiceStatus.Paid;
            }
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return await GetVendorPaymentAsync(payment.Id, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to post vendor payment {Id}", command.VendorPaymentId);
            return Result.Failure<VendorPaymentDto>("Failed to post vendor payment", "DATABASE_ERROR");
        }
    }

    public async Task<Result<VendorPaymentDto>> VoidVendorPaymentAsync(VoidVendorPaymentCommand command, CancellationToken cancellationToken = default)
    {
        VendorPayment? payment = await db.Set<VendorPayment>()
            .Include(p => p.Applications)
                .ThenInclude(a => a.VendorInvoice)
            .FirstOrDefaultAsync(p => p.Id == command.VendorPaymentId, cancellationToken);

        if (payment is null)
            return Result.Failure<VendorPaymentDto>("Vendor payment not found", "NOT_FOUND");

        if (payment.Status == VendorPaymentStatus.Voided)
            return Result.Failure<VendorPaymentDto>("Payment is already voided", "INVALID_STATUS");

        // If posted, reverse the journal entry
        if (payment.Status == VendorPaymentStatus.Posted && payment.JournalEntryId.HasValue)
        {
            var reverseResult = await journalEntryService.ReverseJournalEntryAsync(
                payment.JournalEntryId.Value, Guid.Empty, cancellationToken);

            if (!reverseResult.IsSuccess)
                logger.LogWarning("Failed to reverse journal entry {JeId} for voided payment {PaymentId}: {Error}",
                    payment.JournalEntryId, payment.Id, reverseResult.Error);
        }

        payment.Status = VendorPaymentStatus.Voided;

        // Revert invoice statuses if they were marked as Paid by this payment
        foreach (var app in payment.Applications)
        {
            if (app.VendorInvoice.Status == VendorInvoiceStatus.Paid)
            {
                // Re-check — maybe another payment also contributed
                decimal totalAppliedExcludingThis = await GetTotalAppliedToInvoiceAsync(
                    app.VendorInvoiceId, cancellationToken, excludePaymentId: payment.Id);

                if (totalAppliedExcludingThis < app.VendorInvoice.TotalAmount - 0.01m)
                {
                    app.VendorInvoice.Status = VendorInvoiceStatus.Approved;
                }
            }
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return await GetVendorPaymentAsync(payment.Id, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to void vendor payment {Id}", command.VendorPaymentId);
            return Result.Failure<VendorPaymentDto>("Failed to void vendor payment", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteVendorPaymentAsync(Guid id, CancellationToken cancellationToken = default)
    {
        VendorPayment? payment = await db.Set<VendorPayment>()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (payment is null)
            return Result.Failure("Vendor payment not found", "NOT_FOUND");

        if (payment.Status != VendorPaymentStatus.Draft)
            return Result.Failure("Only draft payments can be deleted", "INVALID_STATUS");

        db.Set<VendorPayment>().Remove(payment);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete vendor payment {Id}", id);
            return Result.Failure("Failed to delete vendor payment", "DATABASE_ERROR");
        }
    }

    private async Task<decimal> GetTotalAppliedToInvoiceAsync(Guid invoiceId, CancellationToken ct, Guid? excludePaymentId = null)
    {
        IQueryable<VendorPaymentApplication> query = db.Set<VendorPaymentApplication>()
            .AsNoTracking()
            .Include(a => a.VendorPayment)
            .Where(a => a.VendorInvoiceId == invoiceId)
            .Where(a => a.VendorPayment.Status != VendorPaymentStatus.Voided);

        if (excludePaymentId.HasValue)
            query = query.Where(a => a.VendorPaymentId != excludePaymentId.Value);

        return await query.SumAsync(a => a.AppliedAmount, ct);
    }

    private async Task<string> GeneratePaymentNumberAsync(int year, CancellationToken ct)
    {
        string prefix = $"PMT-{year}-";
        var maxPaymentNumber = await db.Set<VendorPayment>()
            .Where(p => p.PaymentNumber.StartsWith(prefix))
            .OrderByDescending(p => p.PaymentNumber)
            .Select(p => p.PaymentNumber)
            .FirstOrDefaultAsync(ct);

        int nextNum = 1;
        if (maxPaymentNumber is not null)
        {
            var suffix = maxPaymentNumber[prefix.Length..];
            if (int.TryParse(suffix, out int lastNum))
                nextNum = lastNum + 1;
        }

        return $"{prefix}{nextNum:D6}";
    }

    private static VendorPaymentDto MapToDto(VendorPayment payment)
    {
        return new VendorPaymentDto(
            Id: payment.Id,
            PaymentNumber: payment.PaymentNumber,
            VendorId: payment.VendorId,
            VendorName: payment.Vendor?.Name,
            PaymentDate: payment.PaymentDate,
            TotalAmount: payment.TotalAmount,
            PaymentMethod: payment.PaymentMethod,
            PaymentMethodName: payment.PaymentMethod.ToString(),
            ReferenceNumber: payment.ReferenceNumber,
            BankAccountId: payment.BankAccountId,
            BankAccountName: payment.BankAccount?.AccountName,
            Status: payment.Status,
            StatusName: payment.Status.ToString(),
            Memo: payment.Memo,
            JournalEntryId: payment.JournalEntryId,
            Applications: payment.Applications
                .Select(a => new VendorPaymentApplicationDto(
                    Id: a.Id,
                    VendorInvoiceId: a.VendorInvoiceId,
                    InvoiceNumber: a.VendorInvoice?.InvoiceNumber ?? "N/A",
                    InvoiceTotalAmount: a.VendorInvoice?.TotalAmount ?? 0,
                    AppliedAmount: a.AppliedAmount))
                .ToList(),
            CreatedAt: payment.CreatedAt,
            UpdatedAt: payment.UpdatedAt);
    }
}
