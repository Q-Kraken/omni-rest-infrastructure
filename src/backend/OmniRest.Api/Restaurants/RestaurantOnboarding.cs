using System.Net;
using Microsoft.EntityFrameworkCore;
using OmniRest.Api.Data;
using OmniRest.Api.Infrastructure;
using OmniRest.Api.Menus;

namespace OmniRest.Api.Restaurants;

public sealed record OnboardedRestaurant(Guid Id, string Slug, bool Created);

/// <summary>
/// The controlled operator commands that add a restaurant to the platform. Owners never create
/// restaurants: an operator runs <c>--create-restaurant</c> once per new tenant, then provisions its
/// owner with <c>--provision-owner</c>, and the owner fills in everything else through the portal.
/// </summary>
/// <remarks>
/// A new restaurant gets the defaults a Winnipeg tenant needs (en-CA, CAD, America/Winnipeg,
/// tax-exclusive prices) and the first selectable design; the owner can change all of them later. It
/// also gets an empty active menu, because menu management refuses a restaurant without one, and an
/// initial publication, so its public address answers immediately instead of returning 404 until the
/// owner's first save.
/// </remarks>
public static class RestaurantOnboarding
{
    public const string ProductionOnboardingGate = "OMNIREST_ALLOW_RESTAURANT_ONBOARDING";
    public const int MaximumNameLength = 120;

    /// <summary>
    /// Labels a platform base domain needs for itself. A restaurant slugged <c>www</c> would capture
    /// <c>www.platform-domain</c>, so these are refused up front.
    /// </summary>
    private static readonly HashSet<string> ReservedSlugs = new(StringComparer.Ordinal)
    {
        "www", "api", "admin", "app", "mail", "media", "static"
    };

    /// <summary>
    /// Creates the restaurant with <paramref name="slug"/>. Re-running for a slug that already exists
    /// changes nothing and returns the existing restaurant, so an interrupted onboarding script can
    /// simply be run again.
    /// </summary>
    public static async Task<OnboardedRestaurant> CreateAsync(
        IServiceProvider services,
        IHostEnvironment environment,
        string slug,
        string name,
        CancellationToken cancellationToken = default)
    {
        EnsureGate(environment);
        var normalizedSlug = NormalizeSlug(slug);
        var normalizedName = name.Trim();
        if (normalizedName.Length is 0 or > MaximumNameLength)
        {
            throw new InvalidOperationException($"The restaurant name must be 1 to {MaximumNameLength} characters.");
        }

        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
        var existing = await dbContext.Restaurants.AsNoTracking()
            .Where(item => item.Slug == normalizedSlug)
            .Select(item => (Guid?)item.Id)
            .SingleOrDefaultAsync(cancellationToken);
        if (existing is Guid existingId)
        {
            return new OnboardedRestaurant(existingId, normalizedSlug, Created: false);
        }

        var builder = scope.ServiceProvider.GetRequiredService<PublicMenuProjectionBuilder>();
        var serializer = scope.ServiceProvider.GetRequiredService<PublicMenuSnapshotSerializer>();
        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var restaurant = new RestaurantEntity
        {
            Id = id,
            Name = normalizedName,
            Slug = normalizedSlug,
            CreatedAt = now,
            UpdatedAt = now,
            Settings = new RestaurantSettingsEntity
            {
                RestaurantId = id,
                Locale = "en-CA",
                Currency = "CAD",
                TimeZoneId = "America/Winnipeg",
                WebsiteDesignId = WebsiteDesignCatalog.Selectable[0].Id,
                TaxDisplayMode = "exclusive",
                TaxNoticeKey = "menu.tax.exclusive"
            }
        };
        restaurant.Settings.Restaurant = restaurant;

        var menu = new MenuEntity
        {
            Id = Guid.NewGuid(),
            RestaurantId = id,
            Restaurant = restaurant,
            Name = "Menu",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        restaurant.Menus.Add(menu);

        var publication = new PublicationEntity
        {
            Id = Guid.NewGuid(),
            RestaurantId = id,
            Restaurant = restaurant,
            Version = restaurant.DraftVersion,
            SnapshotJson = serializer.Serialize(builder.Build(restaurant, menu, restaurant.DraftVersion)),
            IsCurrent = true,
            PublishedAt = now
        };
        restaurant.Publications.Add(publication);

        dbContext.Restaurants.Add(restaurant);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new OnboardedRestaurant(id, normalizedSlug, Created: true);
    }

    /// <summary>
    /// Points a custom domain at the restaurant with <paramref name="slug"/>. Adding a domain the
    /// restaurant already has is a no-op; a domain that belongs to another restaurant is refused.
    /// </summary>
    public static async Task<bool> AddDomainAsync(
        IServiceProvider services,
        IHostEnvironment environment,
        string slug,
        string domain,
        CancellationToken cancellationToken = default)
    {
        EnsureGate(environment);
        var normalizedSlug = NormalizeSlug(slug);
        var requested = new HostString(domain.Trim());
        if (!RestaurantResolver.TryNormalizeHost(requested, out var host) ||
            requested.Port is not null || IPAddress.TryParse(host, out _))
        {
            throw new InvalidOperationException("The domain must be a bare host name such as www.example.ca.");
        }

        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
        var restaurantId = await dbContext.Restaurants.AsNoTracking()
            .Where(item => item.Slug == normalizedSlug)
            .Select(item => (Guid?)item.Id)
            .SingleOrDefaultAsync(cancellationToken) ??
            throw new InvalidOperationException($"No restaurant has the slug '{normalizedSlug}'.");

        var owner = await dbContext.RestaurantDomains.AsNoTracking()
            .Where(item => item.Host == host)
            .Select(item => (Guid?)item.RestaurantId)
            .SingleOrDefaultAsync(cancellationToken);
        if (owner == restaurantId)
        {
            return false;
        }
        if (owner is not null)
        {
            throw new InvalidOperationException($"The domain '{host}' already belongs to another restaurant.");
        }

        dbContext.RestaurantDomains.Add(new RestaurantDomainEntity
        {
            Id = Guid.NewGuid(),
            RestaurantId = restaurantId,
            Host = host
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static string NormalizeSlug(string slug)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        if (!RestaurantSlugs.IsValid(normalized))
        {
            throw new InvalidOperationException(
                "The slug must be lowercase letters, digits and single hyphens, for example prairie-table.");
        }
        if (ReservedSlugs.Contains(normalized))
        {
            throw new InvalidOperationException($"The slug '{normalized}' is reserved for the platform.");
        }

        return normalized;
    }

    private static void EnsureGate(IHostEnvironment environment)
    {
        if (environment.IsProduction() &&
            !string.Equals(Environment.GetEnvironmentVariable(ProductionOnboardingGate), "true", StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"Production restaurant onboarding requires the controlled job gate {ProductionOnboardingGate}=true.");
        }
    }
}
