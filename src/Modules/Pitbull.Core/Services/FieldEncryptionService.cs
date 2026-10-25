using Microsoft.AspNetCore.DataProtection;

namespace Pitbull.Core.Services;

public interface IFieldEncryptionService
{
    string Encrypt(string plaintext);
    string Decrypt(string ciphertext);
}

public class FieldEncryptionService(IDataProtectionProvider provider) : IFieldEncryptionService
{
    private readonly IDataProtector _protector =
        provider.CreateProtector("Pitbull.FieldEncryption.v1");

    public string Encrypt(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return plaintext;
        return _protector.Protect(plaintext);
    }

    public string Decrypt(string ciphertext)
    {
        if (string.IsNullOrEmpty(ciphertext)) return ciphertext;
        return _protector.Unprotect(ciphertext);
    }
}
