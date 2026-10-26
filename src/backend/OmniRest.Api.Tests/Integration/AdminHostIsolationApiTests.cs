using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OmniRest.Api.Data;
using OmniRest.Api.Infrastructure;
using OmniRest.Api.Restaurants;
using OmniRest.Api.Security;
using static OmniRest.Api.Tests.Integration.OwnerApiHarness;

namespace OmniRest.Api.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class AdminHostIsolationApiTests(PostgresFixture postgres)
{
    private const string Email = "host-owner@example.test";

    [Theory]
    [InlineData("alternate.localhost", HttpStatusCode.Unauthorized)]
    [InlineData("unknown.localhost", HttpStatusCode.NotFound)]
    public async Task LoginRequiresMembershipForTheAddressedRestaurant(string host, HttpStatusCode expected)
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        await CreateOwnerAsync(factory, GuardedSampleDataSeeder.OrdinaryRestaurantId, Email);
        using var client = Client(factory, host);

        using var login = await SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new LoginRequest(Email, Password, "/admin"), await GetAntiforgeryAsync(client), null);
        Assert.Equal(expected, login.StatusCode);
        Assert.DoesNotContain(login.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies : [],
            cookie => cookie.StartsWith(".OmniRest.Owner=", StringComparison.Ordinal));
        using var session = await client.GetAsync("/api/v1/auth/session");
        Assert.Equal(HttpStatusCode.Unauthorized, session.StatusCode);
        await using var scope = factory.Services.CreateAsyncScope();
        var user = await scope.ServiceProvider.GetRequiredService<MenuDbContext>().Users.SingleAsync();
        Assert.Null(user.CurrentSessionStartedAt);
    }

    [Fact]
    public async Task ExistingCookieCannotReadOrMutateThroughAnotherRestaurantHost()
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        await CreateOwnerAsync(factory, GuardedSampleDataSeeder.OrdinaryRestaurantId, Email);
        using var client = Client(factory, "menu.localhost");
        await LoginAsync(client, Email);
        var before = await client.GetFromJsonAsync<AdminRestaurantResponse>("/api/v1/admin/restaurant");
        Assert.Equal(GuardedSampleDataSeeder.OrdinaryRestaurantId.ToString(), before!.Id);
        var token = await GetAntiforgeryAsync(client);

        // Deliberately replay the valid cookie under another Host, as an old wrong-domain session
        // could do after deployment. The request URI stays fixed so the test cookie handler sends it.
        client.DefaultRequestHeaders.Host = "alternate.localhost";
        foreach (var path in new[] { "/api/v1/auth/session", "/api/v1/admin/restaurant", "/api/v1/admin/menu", "/api/v1/admin/gallery" })
        {
            using var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.DoesNotContain("Prairie Table", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        }
        using var mutation = await SendAsync(client, HttpMethod.Put, "/api/v1/admin/restaurant/profile",
            new UpdateRestaurantProfileRequest("Wrong Host Rename", null, null, null, null, "America/Winnipeg",
                new AdminAddressRequest("1 Main Street", null, "Winnipeg", "MB", "R3C 0V8", "CA", null, null)),
            token, before.ETag);
        Assert.Equal(HttpStatusCode.Forbidden, mutation.StatusCode);

        client.DefaultRequestHeaders.Host = "unknown.localhost";
        using var unknown = await client.GetAsync("/api/v1/admin/restaurant");
        Assert.Equal(HttpStatusCode.Forbidden, unknown.StatusCode);
        client.DefaultRequestHeaders.Host = "menu.localhost";
        var after = await client.GetFromJsonAsync<AdminRestaurantResponse>("/api/v1/admin/restaurant");
        Assert.Equal(before.Name, after!.Name);
        Assert.Equal(before.ETag, after.ETag);
    }

    [Fact]
    public async Task MultipleMembershipsSelectTheHostInsteadOfTheFirstMembershipAndRecheckRevocation()
    {
        using var factory = postgres.CreateFactory();
        await postgres.RecreateLatestAndSeedAsync(factory);
        await CreateOwnerAsync(factory, GuardedSampleDataSeeder.OrdinaryRestaurantId, Email);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
            var first = await db.RestaurantMemberships.SingleAsync();
            db.RestaurantMemberships.Add(new RestaurantMembershipEntity
            {
                Id = Guid.NewGuid(),
                UserId = first.UserId,
                RestaurantId = GuardedSampleDataSeeder.AlternateRestaurantId,
                Role = MembershipRoles.Owner,
                Status = MembershipStatuses.Active,
                CreatedAt = first.CreatedAt.AddMinutes(1),
                UpdatedAt = first.UpdatedAt.AddMinutes(1)
            });
            await db.SaveChangesAsync();
        }
        using var client = Client(factory, "alternate.localhost");
        await LoginAsync(client, Email);
        var restaurant = await client.GetFromJsonAsync<AdminRestaurantResponse>("/api/v1/admin/restaurant");
        Assert.Equal(GuardedSampleDataSeeder.AlternateRestaurantId.ToString(), restaurant!.Id);
        var session = await client.GetFromJsonAsync<SessionResponse>("/api/v1/auth/session");
        Assert.Equal(GuardedSampleDataSeeder.AlternateRestaurantId.ToString(), Assert.Single(session!.Memberships).RestaurantId);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
            var membership = await db.RestaurantMemberships.SingleAsync(item => item.RestaurantId == GuardedSampleDataSeeder.AlternateRestaurantId);
            membership.Status = MembershipStatuses.Revoked;
            await db.SaveChangesAsync();
        }
        foreach (var path in new[] { "/api/v1/auth/session", "/api/v1/admin/restaurant" })
        {
            using var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    private static HttpClient Client(MenuApiFactory factory, string host) => factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri($"https://{host}"),
        HandleCookies = true,
        AllowAutoRedirect = false
    });
}
