namespace Pitbull.Core.Domain;

/// <summary>
/// Marks a string property for automatic field-level encryption at rest.
/// EF Core will apply an EncryptedStringConverter to encrypt on write and decrypt on read.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public class EncryptedAttribute : Attribute { }
