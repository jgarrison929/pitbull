using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Pitbull.Core.Services;

namespace Pitbull.Tests.Unit.Security;

public class FieldEncryptionServiceTests
{
    private readonly IFieldEncryptionService _service;

    public FieldEncryptionServiceTests()
    {
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddDataProtection()
            .UseEphemeralDataProtectionProvider();
        var sp = serviceCollection.BuildServiceProvider();
        var provider = sp.GetRequiredService<IDataProtectionProvider>();
        _service = new FieldEncryptionService(provider);
    }

    [Fact]
    public void Encrypt_Decrypt_RoundTrip_ReturnsOriginal()
    {
        var plaintext = "1234";
        var encrypted = _service.Encrypt(plaintext);
        var decrypted = _service.Decrypt(encrypted);

        decrypted.Should().Be(plaintext);
    }

    [Fact]
    public void Encrypt_ReturnsNonPlaintext()
    {
        var plaintext = "5678";
        var encrypted = _service.Encrypt(plaintext);

        encrypted.Should().NotBe(plaintext);
        encrypted.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Encrypt_Null_ReturnsNull()
    {
        var result = _service.Encrypt(null!);
        result.Should().BeNull();
    }

    [Fact]
    public void Encrypt_Empty_ReturnsEmpty()
    {
        var result = _service.Encrypt(string.Empty);
        result.Should().BeEmpty();
    }

    [Fact]
    public void Decrypt_Null_ReturnsNull()
    {
        var result = _service.Decrypt(null!);
        result.Should().BeNull();
    }

    [Fact]
    public void Decrypt_Empty_ReturnsEmpty()
    {
        var result = _service.Decrypt(string.Empty);
        result.Should().BeEmpty();
    }

    [Fact]
    public void Encrypt_DifferentInputs_ProduceDifferentOutputs()
    {
        var encrypted1 = _service.Encrypt("1111");
        var encrypted2 = _service.Encrypt("2222");

        encrypted1.Should().NotBe(encrypted2);
    }

    [Fact]
    public void Encrypt_BankAccountNumber_RoundTrip()
    {
        var accountNumber = "123456789012";
        var encrypted = _service.Encrypt(accountNumber);
        var decrypted = _service.Decrypt(encrypted);

        decrypted.Should().Be(accountNumber);
        encrypted.Should().NotContain(accountNumber);
    }

    [Fact]
    public void Encrypt_BankRoutingNumber_RoundTrip()
    {
        var routingNumber = "021000021";
        var encrypted = _service.Encrypt(routingNumber);
        var decrypted = _service.Decrypt(encrypted);

        decrypted.Should().Be(routingNumber);
        encrypted.Should().NotContain(routingNumber);
    }

    [Fact]
    public void Encrypt_SsnLastFour_RoundTrip()
    {
        var ssn = "1234";
        var encrypted = _service.Encrypt(ssn);
        var decrypted = _service.Decrypt(encrypted);

        decrypted.Should().Be(ssn);
        encrypted.Should().NotContain(ssn);
    }
}
