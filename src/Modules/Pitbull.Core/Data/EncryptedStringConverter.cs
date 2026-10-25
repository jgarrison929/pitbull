using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Pitbull.Core.Services;

namespace Pitbull.Core.Data;

public class EncryptedStringConverter(IFieldEncryptionService encryption)
    : ValueConverter<string, string>(
        v => encryption.Encrypt(v),
        v => encryption.Decrypt(v))
{
}
