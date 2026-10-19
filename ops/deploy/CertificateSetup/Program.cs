using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

if (!OperatingSystem.IsLinux())
    throw new PlatformNotSupportedException("This deployment certificate helper requires Linux.");

// Runs as the same unprivileged user as the API. Its PFX and the encrypted session key ring
// survive container replacement; the certificate is reimported into CurrentUser/My on startup.
var file = Environment.GetEnvironmentVariable("OMNI_SESSION_CERTIFICATE_FILE")
    ?? "/state/certificates/owner-sessions.pfx";
var password = Environment.GetEnvironmentVariable("OMNI_SESSION_CERTIFICATE_PASSWORD");
if (string.IsNullOrWhiteSpace(password) || password.Length < 32)
    throw new InvalidOperationException("A session certificate password of at least 32 characters is required.");

Directory.CreateDirectory(Path.GetDirectoryName(file)!);
if (!File.Exists(file))
{
    using var rsa = RSA.Create(3072);
    var request = new CertificateRequest("CN=OmniRest Owner Session Protection", rsa,
        HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
    request.CertificateExtensions.Add(new X509KeyUsageExtension(
        X509KeyUsageFlags.KeyEncipherment | X509KeyUsageFlags.DigitalSignature, true));
    using var created = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddYears(2));
    var bytes = created.Export(X509ContentType.Pfx, password);
    var temporary = file + "." + Guid.NewGuid().ToString("N") + ".tmp";
    try
    {
        // Write with restricted permissions before atomic installation, so a partial PFX cannot
        // become the persistent certificate after an interrupted startup.
        await using (var stream = new FileStream(temporary, new FileStreamOptions
        {
            Mode = FileMode.CreateNew, Access = FileAccess.Write,
            UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite
        }))
        {
            await stream.WriteAsync(bytes);
            stream.Flush(flushToDisk: true);
        }
        try { File.Move(temporary, file, overwrite: false); }
        catch (IOException) when (File.Exists(file)) { /* Another controlled job installed it. */ }
    }
    finally
    {
        CryptographicOperations.ZeroMemory(bytes);
        File.Delete(temporary);
    }
}

using var certificate = X509CertificateLoader.LoadPkcs12FromFile(file, password, X509KeyStorageFlags.Exportable);
if (!certificate.HasPrivateKey || certificate.NotAfter.ToUniversalTime() <= DateTime.UtcNow.AddDays(30))
    throw new InvalidOperationException("The session certificate is missing its key or needs rotation; preserve the old PFX and key ring.");
// The API deliberately requires a valid certificate chain. Trust only this application's
// self-signed protection certificate, in this container user's store (never the host trust store).
using var publicCertificate = X509CertificateLoader.LoadCertificate(certificate.Export(X509ContentType.Cert));
using var roots = new X509Store(StoreName.Root, StoreLocation.CurrentUser);
roots.Open(OpenFlags.ReadWrite);
if (roots.Certificates.Find(X509FindType.FindByThumbprint, certificate.Thumbprint, validOnly: false).Count == 0)
    roots.Add(publicCertificate);
using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
store.Open(OpenFlags.ReadWrite);
if (store.Certificates.Find(X509FindType.FindByThumbprint, certificate.Thumbprint, validOnly: true).Count == 0)
    store.Add(certificate);
Console.WriteLine(certificate.Thumbprint);
