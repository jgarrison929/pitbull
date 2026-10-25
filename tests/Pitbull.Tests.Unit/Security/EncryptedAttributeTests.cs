using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Services;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Security;

public class EncryptedAttributeTests
{
    [Fact]
    public void EncryptedAttribute_CanBeAppliedToProperties()
    {
        var attr = typeof(Vendor)
            .GetProperty(nameof(Vendor.BankAccountNumber))!
            .GetCustomAttribute<EncryptedAttribute>();

        attr.Should().NotBeNull();
    }

    [Fact]
    public void Vendor_BankAccountNumber_HasEncryptedAttribute()
    {
        typeof(Vendor).GetProperty(nameof(Vendor.BankAccountNumber))!
            .GetCustomAttribute<EncryptedAttribute>()
            .Should().NotBeNull();
    }

    [Fact]
    public void Vendor_BankRoutingNumber_HasEncryptedAttribute()
    {
        typeof(Vendor).GetProperty(nameof(Vendor.BankRoutingNumber))!
            .GetCustomAttribute<EncryptedAttribute>()
            .Should().NotBeNull();
    }

    [Fact]
    public void EmployeeTaxCompliance_SsnLastFour_HasEncryptedAttribute()
    {
        typeof(EmployeeTaxCompliance).GetProperty(nameof(EmployeeTaxCompliance.SsnLastFour))!
            .GetCustomAttribute<EncryptedAttribute>()
            .Should().NotBeNull();
    }

    [Fact]
    public void Vendor_Name_DoesNotHaveEncryptedAttribute()
    {
        typeof(Vendor).GetProperty(nameof(Vendor.Name))!
            .GetCustomAttribute<EncryptedAttribute>()
            .Should().BeNull();
    }

    [Fact]
    public void EncryptedStringConverter_RoundTrip()
    {
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddDataProtection()
            .UseEphemeralDataProtectionProvider();
        var sp = serviceCollection.BuildServiceProvider();
        var provider = sp.GetRequiredService<IDataProtectionProvider>();
        var encryptionService = new FieldEncryptionService(provider);
        var converter = new EncryptedStringConverter(encryptionService);

        var modelToProvider = converter.ConvertToProviderExpression.Compile();
        var providerToModel = converter.ConvertFromProviderExpression.Compile();

        var plaintext = "9876";
        var encrypted = modelToProvider(plaintext);
        var decrypted = providerToModel(encrypted);

        encrypted.Should().NotBe(plaintext);
        decrypted.Should().Be(plaintext);
    }

    [Fact]
    public void OnModelCreating_DiscoverEncryptedProperties_WhenServiceRegistered()
    {
        // Register encryption service before creating context
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddDataProtection()
            .UseEphemeralDataProtectionProvider();
        var sp = serviceCollection.BuildServiceProvider();
        var provider = sp.GetRequiredService<IDataProtectionProvider>();
        var encryptionService = new FieldEncryptionService(provider);
        PitbullDbContext.RegisterEncryptionService(encryptionService);

        using var db = TestDbContextFactory.Create();

        // After model is created, verify encrypted properties have a value converter
        var vendorEntityType = db.Model.FindEntityType(typeof(Vendor))!;

        var bankAccountProp = vendorEntityType.FindProperty(nameof(Vendor.BankAccountNumber))!;
        bankAccountProp.GetValueConverter().Should().NotBeNull();

        var bankRoutingProp = vendorEntityType.FindProperty(nameof(Vendor.BankRoutingNumber))!;
        bankRoutingProp.GetValueConverter().Should().NotBeNull();

        var taxComplianceEntityType = db.Model.FindEntityType(typeof(EmployeeTaxCompliance))!;
        var ssnProp = taxComplianceEntityType.FindProperty(nameof(EmployeeTaxCompliance.SsnLastFour))!;
        ssnProp.GetValueConverter().Should().NotBeNull();
    }

    [Fact]
    public void OnModelCreating_NonEncryptedProperties_HaveNoValueConverter()
    {
        using var db = TestDbContextFactory.Create();

        var vendorEntityType = db.Model.FindEntityType(typeof(Vendor))!;
        var nameProp = vendorEntityType.FindProperty(nameof(Vendor.Name))!;

        // Name should NOT have a value converter (it's not [Encrypted])
        nameProp.GetValueConverter().Should().BeNull();
    }
}
