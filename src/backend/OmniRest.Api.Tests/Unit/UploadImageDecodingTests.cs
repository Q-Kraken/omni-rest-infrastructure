using OmniRest.Api.Restaurants;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Tiff;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.PixelFormats;

namespace OmniRest.Api.Tests.Unit;

public sealed class UploadImageDecodingTests
{
    [Fact]
    public void TiffIsRejectedByDetectionBeforeMetadataParsing()
    {
        using var image = new Image<Rgba32>(2, 3);
        using var stream = new MemoryStream();
        image.Save(stream, new TiffEncoder());
        var bytes = stream.ToArray();
        Assert.IsType<TiffFormat>(Image.DetectFormat(bytes));
        Assert.Throws<UnknownImageFormatException>(() => Image.Identify(UploadImageDecoding.Options, bytes));
        Assert.Throws<UnknownImageFormatException>(() => Image.Load(UploadImageDecoding.Options, bytes));
    }

    [Theory]
    [InlineData("jpeg")]
    [InlineData("png")]
    [InlineData("webp")]
    public void SupportedUploadsRemainDecodable(string format)
    {
        using var image = new Image<Rgba32>(2, 3);
        using var stream = new MemoryStream();
        IImageEncoder encoder = format switch
        {
            "jpeg" => new JpegEncoder(),
            "png" => new PngEncoder(),
            _ => new WebpEncoder()
        };
        image.Save(stream, encoder);
        using var decoded = Image.Load(UploadImageDecoding.Options, stream.ToArray());
        Assert.Equal(new Size(2, 3), decoded.Size);
        Assert.Single(decoded.Frames);
    }
}
