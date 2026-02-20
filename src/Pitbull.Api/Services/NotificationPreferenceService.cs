using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Entities;

namespace Pitbull.Api.Services;

public interface INotificationPreferenceService
{
    Task<IReadOnlyList<NotificationPreferenceDto>> GetPreferencesAsync(Guid userId, Guid tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<NotificationPreferenceDto>> UpdatePreferencesAsync(Guid userId, Guid tenantId, IReadOnlyCollection<NotificationPreferenceUpdateDto> updates, CancellationToken ct = default);
    Task<bool> IsNotificationEnabledAsync(Guid userId, Guid tenantId, string category, CancellationToken ct = default);
    Task<EmailDigestSettingDto> GetDigestAsync(Guid userId, Guid tenantId, CancellationToken ct = default);
    Task<EmailDigestSettingDto> UpdateDigestAsync(Guid userId, Guid tenantId, EmailDigestSettingUpdateDto update, CancellationToken ct = default);
}

public sealed class NotificationPreferenceService(PitbullDbContext db) : INotificationPreferenceService
{
    public static readonly string[] Categories =
    [
        "time_entry_submitted",
        "time_entry_approved",
        "time_entry_rejected",
        "pay_period_locked",
        "rfi_created",
        "rfi_responded",
        "submittal_status_changed",
        "daily_report_submitted",
        "rfi_deadline_approaching",
        "overdue_rfi",
        "submittal_deadline_approaching",
        "overdue_submittal",
        "retention_deadline",
        "inspection_deadline",
        "document_uploaded",
        "system_announcement"
    ];

    public async Task<IReadOnlyList<NotificationPreferenceDto>> GetPreferencesAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken ct = default)
    {
        await EnsureDefaultPreferencesAsync(userId, tenantId, ct);

        var preferences = await db.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.UserId == userId)
            .OrderBy(p => p.Category)
            .Select(p => new NotificationPreferenceDto(p.Category, p.InApp, p.Email))
            .ToListAsync(ct);

        return preferences;
    }

    public async Task<bool> IsNotificationEnabledAsync(
        Guid userId,
        Guid tenantId,
        string category,
        CancellationToken ct = default)
    {
        var preference = await db.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.UserId == userId && p.Category == category)
            .FirstOrDefaultAsync(ct);

        // If no preference exists, default to enabled (InApp = true)
        return preference?.InApp ?? true;
    }

    public async Task<IReadOnlyList<NotificationPreferenceDto>> UpdatePreferencesAsync(
        Guid userId,
        Guid tenantId,
        IReadOnlyCollection<NotificationPreferenceUpdateDto> updates,
        CancellationToken ct = default)
    {
        await EnsureDefaultPreferencesAsync(userId, tenantId, ct);

        var invalidCategory = updates.FirstOrDefault(u => !Categories.Contains(u.Category));
        if (invalidCategory is not null)
        {
            throw new ArgumentException($"Invalid notification category: {invalidCategory.Category}");
        }

        var byCategory = updates.ToDictionary(u => u.Category, u => u, StringComparer.OrdinalIgnoreCase);

        var preferences = await db.NotificationPreferences
            .Where(p => p.TenantId == tenantId && p.UserId == userId)
            .ToListAsync(ct);

        foreach (var preference in preferences)
        {
            if (!byCategory.TryGetValue(preference.Category, out var update))
                continue;

            preference.InApp = update.InApp;
            preference.Email = update.Email;
            preference.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return await GetPreferencesAsync(userId, tenantId, ct);
    }

    public async Task<EmailDigestSettingDto> GetDigestAsync(Guid userId, Guid tenantId, CancellationToken ct = default)
    {
        var digest = await EnsureDigestAsync(userId, tenantId, ct);

        return new EmailDigestSettingDto(
            Frequency: digest.Frequency.ToString(),
            SendTime: digest.SendTime.ToString("HH:mm"),
            DayOfWeek: digest.DayOfWeek,
            LastSentAt: digest.LastSentAt);
    }

    public async Task<EmailDigestSettingDto> UpdateDigestAsync(
        Guid userId,
        Guid tenantId,
        EmailDigestSettingUpdateDto update,
        CancellationToken ct = default)
    {
        if (!Enum.TryParse<DigestFrequency>(update.Frequency, true, out var frequency))
        {
            throw new ArgumentException("Frequency must be None, Daily, or Weekly.");
        }

        if (!TimeOnly.TryParse(update.SendTime, out var sendTime))
        {
            throw new ArgumentException("SendTime must be a valid HH:mm value.");
        }

        if (frequency == DigestFrequency.Weekly && update.DayOfWeek is null)
        {
            throw new ArgumentException("DayOfWeek is required when frequency is Weekly.");
        }

        var digest = await EnsureDigestAsync(userId, tenantId, ct);

        digest.Frequency = frequency;
        digest.SendTime = sendTime;
        digest.DayOfWeek = frequency == DigestFrequency.Weekly ? update.DayOfWeek : null;
        digest.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return await GetDigestAsync(userId, tenantId, ct);
    }

    private async Task EnsureDefaultPreferencesAsync(Guid userId, Guid tenantId, CancellationToken ct)
    {
        var existingCategories = await db.NotificationPreferences
            .Where(p => p.TenantId == tenantId && p.UserId == userId)
            .Select(p => p.Category)
            .ToListAsync(ct);

        var missingCategories = Categories
            .Where(c => !existingCategories.Contains(c))
            .ToList();

        if (missingCategories.Count == 0)
            return;

        foreach (var category in missingCategories)
        {
            db.NotificationPreferences.Add(new NotificationPreference
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Category = category,
                InApp = true,
                Email = false,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<EmailDigestSetting> EnsureDigestAsync(Guid userId, Guid tenantId, CancellationToken ct)
    {
        var digest = await db.EmailDigestSettings
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.UserId == userId, ct);

        if (digest is not null)
            return digest;

        digest = new EmailDigestSetting
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Frequency = DigestFrequency.None,
            SendTime = new TimeOnly(8, 0),
            DayOfWeek = DayOfWeek.Monday,
            CreatedAt = DateTime.UtcNow,
        };

        db.EmailDigestSettings.Add(digest);
        await db.SaveChangesAsync(ct);
        return digest;
    }
}

public sealed record NotificationPreferenceDto(string Category, bool InApp, bool Email);
public sealed record NotificationPreferenceUpdateDto(string Category, bool InApp, bool Email);
public sealed record EmailDigestSettingDto(string Frequency, string SendTime, DayOfWeek? DayOfWeek, DateTime? LastSentAt);
public sealed record EmailDigestSettingUpdateDto(string Frequency, string SendTime, DayOfWeek? DayOfWeek);
