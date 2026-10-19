using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;

namespace OmniRest.Api.Restaurants;

internal static class UploadImageDecoding
{
    // Reject unsupported codecs before Identify can parse their metadata. In particular, uploads
    // must never enter the TIFF/BigTIFF decoder. The app only accepts these three delivery formats.
    internal static DecoderOptions Options { get; } = new()
    {
        Configuration = new Configuration(new JpegConfigurationModule(), new PngConfigurationModule(), new WebpConfigurationModule()),
        SkipMetadata = true,
        MaxFrames = 1
    };
}
