using OmniRest.Api.Restaurants;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace OmniRest.Api.Tests.Unit;

public sealed class ResponsiveImagesTests
{
    [Theory]
    [InlineData(2000, 1000)]
    [InlineData(225, 225)]
    [InlineData(640, 480)]
    public async Task VariantsAreRealImagesPreserveAspectRatioAndNeverUpscale(int width, int height)
    {
        using var source = new Image<Rgb24>(width, height);
        using var buffer = new MemoryStream();
        await source.SaveAsPngAsync(buffer);
        var original = new ValidatedImage(buffer.ToArray(), ".png", "image/png", width, height);
        var variants = await ResponsiveImages.CreateAsync(original, CancellationToken.None);
        Assert.Same(original, variants[^1]);
        Assert.Equal(variants.Select(item => item.Width).Order(), variants.Select(item => item.Width));
        Assert.Equal(variants.Count, variants.Select(item => item.Width).Distinct().Count());
        if (width == 2000) Assert.Equal(new[] { 320, 640, 1024, 1600, 2000 }, variants.Select(item => item.Width));
        foreach (var variant in variants)
        {
            using var decoded = Image.Load(variant.Bytes);
            Assert.Equal((variant.Width, variant.Height), (decoded.Width, decoded.Height));
            Assert.InRange(variant.Width, 1, width);
            Assert.InRange(Math.Abs((double)variant.Width / variant.Height - (double)width / height), 0, 0.01);
        }
    }
}
