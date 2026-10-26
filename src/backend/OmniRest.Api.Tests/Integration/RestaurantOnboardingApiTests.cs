using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OmniRest.Api.Data;
using OmniRest.Api.Menus;
using OmniRest.Api.Restaurants;
using static OmniRest.Api.Tests.Integration.OwnerApiHarness;

namespace OmniRest.Api.Tests.Integration;

/// <summary>
/// The operator onboarding commands: a restaurant created with <c>--create-restaurant</c> must be
/// reachable on its slug straight away, manageable by its owner, and safe to create twice.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class RestaurantOnboardingApiTests(PostgresFixture postgres)
{
    private const string Email = "owner@new-bistro.example.test";

    [Fact]
    public async Task CreatedRestaurantIsPublishedOnItsSlugAndItsOwnerCanBuildTheMenu()
    {
        using var seedFactory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(seedFactory);
        using var factory = seedFactory.WithWebHostBuilder(builder =>
            builder.UseSetting("PublicMenu:PlatformBaseDomains:0", "example.app"));

        var environment = factory.Services.GetRequiredService<IHostEnvironment>();
        var created = await RestaurantOnboarding.CreateAsync(factory.Services, environment, " New-Bistro ", "  New Bistro ");
        Assert.True(created.Created);
        Assert.Equal("new-bistro", created.Slug);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
            var restaurant = await db.Restaurants.Include(item => item.Settings).SingleAsync(item => item.Id == created.Id);
            Assert.Equal("New Bistro", restaurant.Name);
            Assert.Equal("en-CA", restaurant.Settings.Locale);
            Assert.Equal("CAD", restaurant.Settings.Currency);
            Assert.True(WebsiteDesignCatalog.IsSelectable(restaurant.Settings.WebsiteDesignId));
            Assert.Single(await db.Menus.Where(item => item.RestaurantId == created.Id && item.IsActive).ToArrayAsync());
            Assert.Single(await db.Publications.Where(item => item.RestaurantId == created.Id && item.IsCurrent).ToArrayAsync());
        }

        using var publicClient = factory.CreateClient();
        using (var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/public/menu"))
        {
            request.Headers.Host = "new-bistro.example.app";
            using var response = await publicClient.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var menu = await response.Content.ReadFromJsonAsync<PublicMenuResponse>();
            Assert.Equal("New Bistro", menu!.RestaurantName);
            Assert.Equal(created.Id.ToString(), menu.RestaurantId);
        }

        await CreateOwnerAsync(seedFactory, created.Id, Email);
        using var ownerClient = CreateSecureClient(factory, "new-bistro.example.app");
        await LoginAsync(ownerClient, Email);
        var adminMenu = await ownerClient.GetFromJsonAsync<AdminMenuResponse>("/api/v1/admin/menu");
        Assert.Empty(adminMenu!.Categories);
        var mutation = await ExpectOkAsync<AdminMenuMutationResponse>(await SendAsync(
            ownerClient, HttpMethod.Post, "/api/v1/admin/menu/categories",
            new CreateMenuCategoryRequest("Starters", null),
            await GetAntiforgeryAsync(ownerClient), adminMenu.ETag));
        Assert.Equal(["Starters"], mutation.Menu.Categories.Select(item => item.Name));
    }

    [Fact]
    public async Task CreatingTheSameSlugAgainReturnsTheExistingRestaurantUnchanged()
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        var environment = factory.Services.GetRequiredService<IHostEnvironment>();

        var first = await RestaurantOnboarding.CreateAsync(factory.Services, environment, "repeat-kitchen", "Repeat Kitchen");
        var second = await RestaurantOnboarding.CreateAsync(factory.Services, environment, "repeat-kitchen", "Renamed Kitchen");

        Assert.True(first.Created);
        Assert.False(second.Created);
        Assert.Equal(first.Id, second.Id);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
        var restaurant = await db.Restaurants.SingleAsync(item => item.Slug == "repeat-kitchen");
        Assert.Equal("Repeat Kitchen", restaurant.Name);
    }

    [Theory]
    [InlineData("Not A Slug", "Name")]
    [InlineData("-leading", "Name")]
    [InlineData("www", "Name")]
    [InlineData("admin", "Name")]
    [InlineData("valid-slug", "   ")]
    public async Task InvalidSlugsReservedSlugsAndBlankNamesAreRefused(string slug, string name)
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        var environment = factory.Services.GetRequiredService<IHostEnvironment>();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            RestaurantOnboarding.CreateAsync(factory.Services, environment, slug, name));
    }

    [Fact]
    public async Task CustomDomainResolvesToTheRestaurantAndCannotBeTakenByAnother()
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        var environment = factory.Services.GetRequiredService<IHostEnvironment>();
        await RestaurantOnboarding.CreateAsync(factory.Services, environment, "domain-diner", "Domain Diner");

        Assert.True(await RestaurantOnboarding.AddDomainAsync(factory.Services, environment, "domain-diner", "WWW.DomainDiner.example.test"));
        Assert.False(await RestaurantOnboarding.AddDomainAsync(factory.Services, environment, "domain-diner", "www.domaindiner.example.test"));

        using var client = factory.CreateClient();
        using (var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/public/restaurant"))
        {
            request.Headers.Host = "www.domaindiner.example.test";
            using var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var restaurant = await response.Content.ReadFromJsonAsync<PublicRestaurantResponse>();
            Assert.Equal("Domain Diner", restaurant!.Name);
        }

        // menu.localhost belongs to the seeded Prairie Table; another tenant must not capture it.
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            RestaurantOnboarding.AddDomainAsync(factory.Services, environment, "domain-diner", "menu.localhost"));
        foreach (var invalid in new[] { "example.test:8080", "127.0.0.1", "https://example.test" })
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                RestaurantOnboarding.AddDomainAsync(factory.Services, environment, "domain-diner", invalid));
        }
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            RestaurantOnboarding.AddDomainAsync(factory.Services, environment, "no-such-slug", "free.example.test"));
    }
}
