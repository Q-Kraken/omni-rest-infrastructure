using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OmniRest.Api.Data;
using OmniRest.Api.Menus;
using OmniRest.Api.Restaurants;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using static OmniRest.Api.Tests.Integration.OwnerApiHarness;

namespace OmniRest.Api.Tests.Integration;

/// <summary>
/// The operator content import: one <c>restaurant.json</c> must produce a published restaurant whose
/// public page and owner portal already show the real menu, photos, hours and contact details.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class RestaurantContentImportApiTests(PostgresFixture postgres) : IDisposable
{
    private const string Email = "owner@noodle-test.example.test";
    private readonly string folder = Directory.CreateTempSubdirectory("omnirest-import-").FullName;

    public void Dispose() => Directory.Delete(folder, recursive: true);

    [Fact]
    public async Task ImportPublishesTheWholeRestaurantAndTheOwnerSeesItInThePortal()
    {
        using var seedFactory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(seedFactory);
        using var factory = seedFactory.WithWebHostBuilder(builder =>
            builder.UseSetting("PublicMenu:PlatformBaseDomains:0", "example.app"));
        var environment = factory.Services.GetRequiredService<IHostEnvironment>();
        await WriteContentAsync(soupPrice: "14.50");

        var imported = await RestaurantContentImport.ImportAsync(factory.Services, environment, folder, replace: false);
        Assert.True(imported.Created);
        Assert.Equal(2, imported.Categories);
        Assert.Equal(3, imported.Dishes);

        using var client = factory.CreateClient();
        using (var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/public/menu"))
        {
            request.Headers.Host = "noodle-test.example.app";
            using var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var menu = (await response.Content.ReadFromJsonAsync<PublicMenuResponse>())!;
            Assert.Equal("Noodle Test House", menu.RestaurantName);
            Assert.Equal(["Noodle Soups", "Rice Plates"], menu.Menu!.Categories.Select(item => item.Name));
            var pho = menu.Menu.Categories[0].Dishes[0];
            Assert.Equal("Beef Pho", pho.Name);
            Assert.Equal("14.50", pho.Price);
            Assert.Equal(["spicy"], pho.Badges.Select(item => item.Code));
            Assert.NotNull(pho.Media);
            Assert.True(pho.Media!.Variants.Count >= 2);
            Assert.Equal(AvailabilityStatus.Unavailable, menu.Menu.Categories[0].Dishes[1].Availability);

            var restaurant = menu.Restaurant!;
            Assert.Equal("+12045550123", restaurant.Phone!.E164);
            Assert.Equal("(204) 555-0123", restaurant.Phone.Display);
            Assert.Equal("840 Example St", restaurant.Address!.StreetLine1);
            Assert.Equal(6, restaurant.RegularHours.Count(item => item.Intervals.Count != 0));
            Assert.Equal(2, restaurant.RegularHours.Single(item => item.DayOfWeek == 5).Intervals.Count);
            Assert.Equal("instagram", Assert.Single(restaurant.SocialLinks).Platform);
            Assert.NotNull(restaurant.MainImage);
        }

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
            Assert.Equal(2, await db.GalleryImages.CountAsync(item => item.RestaurantId == imported.Id));
            Assert.Single(await db.Publications.Where(item => item.RestaurantId == imported.Id && item.IsCurrent).ToArrayAsync());
        }

        await CreateOwnerAsync(seedFactory, imported.Id, Email);
        using var ownerClient = CreateSecureClient(factory);
        await LoginAsync(ownerClient, Email);
        var adminMenu = await ownerClient.GetFromJsonAsync<AdminMenuResponse>("/api/v1/admin/menu");
        Assert.Equal(3, adminMenu!.Categories.Sum(item => item.Dishes.Count));
        var mutation = await ExpectOkAsync<AdminMenuMutationResponse>(await SendAsync(
            ownerClient, HttpMethod.Post, "/api/v1/admin/menu/categories",
            new CreateMenuCategoryRequest("Drinks", null),
            await GetAntiforgeryAsync(ownerClient), adminMenu.ETag));
        Assert.Equal(["Noodle Soups", "Rice Plates", "Drinks"], mutation.Menu.Categories.Select(item => item.Name));
    }

    [Fact]
    public async Task ReimportKeepsTheOwnersMenuUnlessReplacedAndNeverDuplicatesPhotos()
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        var environment = factory.Services.GetRequiredService<IHostEnvironment>();
        await WriteContentAsync(soupPrice: "14.50");
        var first = await RestaurantContentImport.ImportAsync(factory.Services, environment, folder, replace: false);

        await WriteContentAsync(soupPrice: "15.25");
        var kept = await RestaurantContentImport.ImportAsync(factory.Services, environment, folder, replace: false);
        Assert.False(kept.Imported);
        Assert.Equal(first.PublishedVersion, kept.PublishedVersion);
        await using (var check = factory.Services.CreateAsyncScope())
        {
            var keptDb = check.ServiceProvider.GetRequiredService<MenuDbContext>();
            Assert.Equal(14.50m, (await keptDb.Dishes.SingleAsync(item => item.RestaurantId == first.Id && item.Name == "Beef Pho")).Price);
        }

        var second = await RestaurantContentImport.ImportAsync(factory.Services, environment, folder, replace: true);

        Assert.Equal(first.Id, second.Id);
        Assert.True(second.PublishedVersion > first.PublishedVersion);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
        Assert.Equal(3, await db.Dishes.CountAsync(item => item.RestaurantId == first.Id));
        Assert.Equal(15.25m, (await db.Dishes.SingleAsync(item => item.RestaurantId == first.Id && item.Name == "Beef Pho")).Price);
        Assert.Equal(3, await db.MediaAssets.CountAsync(item => item.RestaurantId == first.Id));
        Assert.Equal(7, await db.RegularHourIntervals.CountAsync(item => item.RestaurantId == first.Id));
    }

    [Fact]
    public async Task AnInvalidFileReportsEveryProblemAndWritesNothing()
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        var environment = factory.Services.GetRequiredService<IHostEnvironment>();
        await File.WriteAllTextAsync(Path.Combine(folder, "restaurant.json"), """
            {
              "slug": "broken-noodles",
              "name": "Broken Noodles",
              "phone": "204-555-0123",
              "address": { "line1": "1 Main St", "city": "Winnipeg", "region": "MB", "countryCode": "CA" },
              "hours": { "funday": ["11:00-21:00"] },
              "menu": { "categories": [ { "name": "Soups", "dishes": [ { "name": "Pho", "price": 12.345, "image": { "file": "missing.jpg", "alt": "Pho" } } ] } ] }
            }
            """);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            RestaurantContentImport.ImportAsync(factory.Services, environment, folder, replace: false));
        Assert.Contains("phoneE164", error.Message);
        Assert.Contains("funday", error.Message);
        Assert.Contains("price_scale_invalid", error.Message);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
        Assert.False(await db.Restaurants.AnyAsync(item => item.Slug == "broken-noodles"));
    }

    private async Task WriteContentAsync(string soupPrice)
    {
        Directory.CreateDirectory(Path.Combine(folder, "photos"));
        await WriteImageAsync("photos/hero.jpg", 1200, 800, new Rgba32(200, 80, 40));
        await WriteImageAsync("photos/pho.jpg", 1000, 750, new Rgba32(160, 110, 60));
        await WriteImageAsync("photos/room.png", 640, 480, new Rgba32(40, 90, 160));
        await File.WriteAllTextAsync(Path.Combine(folder, "restaurant.json"), $$"""
            {
              // Comments are allowed, so an operator can note where each value came from.
              "slug": "noodle-test",
              "name": "Noodle Test House",
              "description": "Hand-pulled noodles in Winnipeg.",
              "phone": "+12045550123",
              "restaurantType": "Restaurant",
              "priceRange": "$$",
              "address": { "line1": "840 Example St", "city": "Winnipeg", "region": "MB", "postalCode": "R3T 5Z7", "countryCode": "CA" },
              "hours": {
                "monday": [], "tuesday": ["11:00-21:00"], "wednesday": ["11:00-21:00"], "thursday": ["11:00-21:00"],
                "friday": ["11:00-14:00", "16:00-22:00"], "saturday": ["11:00-22:00"], "sunday": ["12:00-20:00"]
              },
              "socialLinks": { "instagram": "https://www.instagram.com/noodletest" },
              "mainImage": { "file": "photos/hero.jpg", "alt": "A steaming bowl of noodles" },
              "gallery": [
                { "file": "photos/hero.jpg", "alt": "A steaming bowl of noodles", "caption": "House special" },
                { "file": "photos/room.png", "alt": "The dining room" }
              ],
              "menu": {
                "name": "Menu",
                "categories": [
                  { "name": "Noodle Soups", "description": "Served with herbs and lime.", "dishes": [
                    { "name": "Beef Pho", "description": "Rare beef, brisket.", "price": {{soupPrice}}, "image": { "file": "photos/pho.jpg", "alt": "Beef pho" }, "badges": ["spicy"] },
                    { "name": "Wonton Soup", "price": 12.00, "available": false }
                  ] },
                  { "name": "Rice Plates", "dishes": [ { "name": "Lemongrass Chicken", "price": 16.95, "badges": ["popular"] } ] }
                ]
              }
            }
            """);
    }

    private async Task WriteImageAsync(string relativePath, int width, int height, Rgba32 color)
    {
        using var image = new Image<Rgba32>(width, height, color);
        await image.SaveAsync(Path.Combine(folder, relativePath));
    }
}
