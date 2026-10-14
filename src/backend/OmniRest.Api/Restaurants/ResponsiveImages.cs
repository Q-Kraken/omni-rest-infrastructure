using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace OmniRest.Api.Restaurants;

public static class ResponsiveImages
{
    public const int MinimumMainImageWidth = 704;

    public static async Task<IReadOnlyList<ValidatedImage>> CreateAsync(ValidatedImage source, CancellationToken token)
    {
        var variants = new List<ValidatedImage>();
        using var image = Image.Load(source.Bytes);
        foreach (var width in new[] { 320, 640, 1024, 1600 }.Where(width => width < source.Width))
        {
            var height = Math.Max(1, (int)Math.Round((double)source.Height * width / source.Width));
            using var resized = image.Clone(context => context.Resize(width, height));
            using var buffer = new MemoryStream();
            await resized.SaveAsWebpAsync(buffer, token);
            variants.Add(new ValidatedImage(buffer.ToArray(), ".webp", "image/webp", width, height));
        }
        variants.Add(source);
        return variants;
    }
}
