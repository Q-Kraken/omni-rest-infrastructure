using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using OmniRest.Api.Data;
using OmniRest.Api.Menus;
using SixLabors.ImageSharp;

namespace OmniRest.Api.Restaurants;

/// <summary>
/// One restaurant's complete launch content, as an operator prepares it in
/// <c>restaurants/&lt;slug&gt;/restaurant.json</c>. Image paths are relative to that file.
/// </summary>
public sealed record RestaurantContentFile(
    string Slug,
    string Name,
    string? Description,
    string? Phone,
    string? PhoneDisplay,
    string? Email,
    string? WebsiteUrl,
    string? RestaurantType,
    string? PriceRange,
    string? TimeZone,
    string? Locale,
    string? Currency,
    string? TaxDisplayMode,
    string? DesignId,
    AdminAddressRequest? Address,

    /// <summary>Lowercase English day name to "HH:mm-HH:mm" intervals; a missing or empty day is closed.</summary>
    IReadOnlyDictionary<string, IReadOnlyList<string>>? Hours,

    /// <summary>Platform code (instagram, facebook, google_business, ...) to its https URL.</summary>
    IReadOnlyDictionary<string, string>? SocialLinks,
    RestaurantContentImage? MainImage,
    RestaurantContentImage? Logo,
    RestaurantContentImage? CoverImage,
    IReadOnlyList<RestaurantContentGalleryImage>? Gallery,
    RestaurantContentMenu? Menu);

public sealed record RestaurantContentImage(string File, string Alt);

public sealed record RestaurantContentGalleryImage(string File, string Alt, string? Caption);

public sealed record RestaurantContentMenu(string? Name, IReadOnlyList<RestaurantContentCategory>? Categories);

public sealed record RestaurantContentCategory(
    string Name,
    string? Description,
    IReadOnlyList<RestaurantContentDish>? Dishes);

public sealed record RestaurantContentDish(
    string Name,
    string? Description,
    decimal Price,
    RestaurantContentImage? Image,
    IReadOnlyList<string>? Badges,
    bool Available = true);

public sealed record ImportedRestaurant(
    Guid Id,
    string Slug,
    string Name,
    bool Created,
    int Categories,
    int Dishes,
    int Images,
    long PublishedVersion);

/// <summary>
/// Loads a restaurant's full content (profile, address, hours, links, photos and menu) from a
/// <see cref="RestaurantContentFile"/> and publishes it, so a new tenant opens with its real menu
/// instead of an empty portal. It is the operator's <c>--import-restaurant</c> command.
/// </summary>
/// <remarks>
/// Every value passes the same validators the owner portal uses and every image goes through the same
/// validation and responsive ladder as an owner upload, so imported content is indistinguishable from
/// content the owner typed in. The whole file is checked, and every image read, before anything is
/// written. Importing over a restaurant that already has a menu or gallery is refused unless
/// <c>replace</c> is set, because a re-import replaces whatever the owner has edited since.
/// </remarks>
public static class RestaurantContentImport
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        NumberHandling = JsonNumberHandling.Strict
    };

    private static readonly string[] DayNames =
        ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    public static async Task<ImportedRestaurant> ImportAsync(
        IServiceProvider services,
        IHostEnvironment environment,
        string contentPath,
        bool replace,
        CancellationToken cancellationToken = default)
    {
        var fullPath = Path.GetFullPath(contentPath);
        if (Directory.Exists(fullPath))
        {
            fullPath = Path.Combine(fullPath, "restaurant.json");
        }
        if (!File.Exists(fullPath))
        {
            throw new InvalidOperationException($"No content file at {fullPath}.");
        }

        RestaurantContentFile content;
        await using (var stream = File.OpenRead(fullPath))
        {
            content = await JsonSerializer.DeserializeAsync<RestaurantContentFile>(stream, JsonOptions, cancellationToken)
                ?? throw new InvalidOperationException("The content file is empty.");
        }

        var baseDirectory = Path.GetDirectoryName(fullPath)!;
        var plan = Validate(content);
        var storage = services.GetRequiredService<ILocalMediaStorage>();
        var images = await LoadImagesAsync(storage, baseDirectory, plan, cancellationToken);

        var onboarded = await RestaurantOnboarding.CreateAsync(
            services, environment, content.Slug, content.Name, cancellationToken);

        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MenuDbContext>();
        var variantFactory = scope.ServiceProvider.GetRequiredService<IResponsiveImageVariantFactory>();
        var builder = scope.ServiceProvider.GetRequiredService<PublicMenuProjectionBuilder>();
        var serializer = scope.ServiceProvider.GetRequiredService<PublicMenuSnapshotSerializer>();

        var restaurant = await LoadAggregateAsync(dbContext, onboarded.Id, cancellationToken);
        var menu = restaurant.Menus.Single(item => item.IsActive);
        var hasContent = menu.Categories.Count != 0 || restaurant.GalleryImages.Count != 0;
        if (hasContent && !onboarded.Created && !replace)
        {
            throw new InvalidOperationException(
                $"The restaurant '{onboarded.Slug}' already has a menu or gallery. Re-run with --replace to overwrite it with the file.");
        }

        var stored = new List<StoredMedia>();
        try
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            var now = DateTimeOffset.UtcNow;

            // Removals are saved on their own first: the replacement rows reuse the same unique
            // (menu, slug), (menu, display order) and (restaurant, display order) values.
            restaurant.MainMediaAssetId = null;
            restaurant.LogoMediaAssetId = null;
            restaurant.CoverMediaAssetId = null;
            dbContext.MenuCategories.RemoveRange(menu.Categories);
            dbContext.GalleryImages.RemoveRange(restaurant.GalleryImages);
            dbContext.RegularHourIntervals.RemoveRange(restaurant.RegularHours);
            dbContext.SocialLinks.RemoveRange(restaurant.SocialLinks);
            await dbContext.SaveChangesAsync(cancellationToken);

            var assets = new Dictionary<string, MediaAssetEntity>(StringComparer.Ordinal);
            foreach (var (file, image) in images)
            {
                assets[file] = await EnsureAssetAsync(
                    dbContext, storage, variantFactory, restaurant.Id, image, stored, cancellationToken);
            }

            ApplyProfile(restaurant, content, now);
            ApplyHours(dbContext, restaurant, plan.Hours);
            ApplySocialLinks(dbContext, restaurant, content.SocialLinks);
            restaurant.MainMediaAssetId = content.MainImage is null ? null : assets[content.MainImage.File].Id;
            restaurant.LogoMediaAssetId = content.Logo is null ? null : assets[content.Logo.File].Id;
            restaurant.CoverMediaAssetId = content.CoverImage is null ? null : assets[content.CoverImage.File].Id;
            ApplyGallery(dbContext, restaurant, content.Gallery, assets, now);
            var (categoryCount, dishCount) = await ApplyMenuAsync(
                dbContext, restaurant, menu, content.Menu, assets, now, cancellationToken);

            restaurant.DraftVersion++;
            restaurant.ConcurrencyVersion++;
            restaurant.UpdatedAt = now;
            await dbContext.SaveChangesAsync(cancellationToken);

            // Publish directly, as onboarding does, so the public address shows the content whether or
            // not the web app (and with it the outbox worker) is running.
            dbContext.ChangeTracker.Clear();
            var saved = await LoadAggregateAsync(dbContext, restaurant.Id, cancellationToken);
            var savedMenu = saved.Menus.Single(item => item.IsActive);
            await dbContext.Publications
                .Where(item => item.RestaurantId == saved.Id && item.IsCurrent)
                .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.IsCurrent, false), cancellationToken);
            dbContext.Publications.Add(new PublicationEntity
            {
                Id = Guid.NewGuid(),
                RestaurantId = saved.Id,
                Version = saved.DraftVersion,
                SnapshotJson = serializer.Serialize(builder.Build(saved, savedMenu, saved.DraftVersion)),
                IsCurrent = true,
                PublishedAt = now
            });
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new ImportedRestaurant(
                saved.Id, onboarded.Slug, saved.Name, onboarded.Created, categoryCount, dishCount, images.Count, saved.DraftVersion);
        }
        catch
        {
            foreach (var blob in stored)
            {
                try
                {
                    await blob.CompensateAsync(CancellationToken.None);
                }
                catch
                {
                    // The import failure is the error worth reporting; a leftover file is harmless.
                }
            }
            throw;
        }
        finally
        {
            foreach (var blob in stored)
            {
                await blob.DisposeAsync();
            }
        }
    }

    private sealed record ImportPlan(
        UpdateRegularHoursRequest Hours,
        IReadOnlyList<(string File, string Alt, bool IsMain)> Images);

    private sealed record LoadedImage(string File, string Alt, ValidatedImage Image, Guid AssetSeed);

    /// <summary>
    /// Checks the whole file with the portal's own validators and collects every problem, so one run
    /// reports everything that needs fixing rather than the first mistake only.
    /// </summary>
    private static ImportPlan Validate(RestaurantContentFile content)
    {
        var errors = new List<string>();
        void Collect(string prefix, IReadOnlyDictionary<string, string[]> found)
        {
            foreach (var (field, codes) in found)
            {
                errors.Add($"{prefix}{field}: {string.Join(", ", codes)}");
            }
        }

        if (string.IsNullOrWhiteSpace(content.Slug) || !RestaurantSlugs.IsValid(content.Slug.Trim()))
        {
            errors.Add("slug: must be lowercase letters, digits and single hyphens");
        }
        if (content.Address is null)
        {
            errors.Add("address: field_required");
        }
        else
        {
            Collect("", RestaurantValidation.ValidateProfile(new UpdateRestaurantProfileRequest(
                content.Name, content.Description, content.Phone, content.PhoneDisplay, content.Email,
                content.TimeZone ?? "America/Winnipeg", content.Address, content.RestaurantType,
                content.PriceRange, content.WebsiteUrl)));
        }
        if (content.Locale is not null && content.Locale.Trim().Length is 0 or > 35)
        {
            errors.Add("locale: field_length_invalid");
        }
        if (content.Currency is not null && (content.Currency.Length != 3 || !content.Currency.All(char.IsAsciiLetterUpper)))
        {
            errors.Add("currency: must be a three-letter code such as CAD");
        }
        if (content.TaxDisplayMode is not null and not ("inclusive" or "exclusive"))
        {
            errors.Add("taxDisplayMode: must be inclusive or exclusive");
        }
        if (content.DesignId is not null && !WebsiteDesignCatalog.IsSelectable(content.DesignId))
        {
            errors.Add($"designId: must be one of {string.Join(", ", WebsiteDesignCatalog.Selectable.Select(item => item.Id))}");
        }

        var days = new List<AdminRegularHoursDayRequest>();
        foreach (var (dayName, intervals) in content.Hours ?? new Dictionary<string, IReadOnlyList<string>>())
        {
            var day = Array.IndexOf(DayNames, dayName.Trim().ToLowerInvariant());
            if (day < 0)
            {
                errors.Add($"hours.{dayName}: not a day name");
                continue;
            }
            var parsed = new List<AdminHourIntervalRequest>();
            foreach (var interval in intervals ?? [])
            {
                var parts = interval.Split('-', StringSplitOptions.TrimEntries);
                if (parts.Length != 2)
                {
                    errors.Add($"hours.{dayName}: '{interval}' must look like 11:00-21:00");
                    continue;
                }
                parsed.Add(new AdminHourIntervalRequest(parts[0], parts[1]));
            }
            days.Add(new AdminRegularHoursDayRequest(day, parsed));
        }
        var hours = new UpdateRegularHoursRequest(days);
        Collect("hours.", RestaurantValidation.ValidateRegularHours(hours));

        if (content.SocialLinks is { Count: > 0 })
        {
            Collect("socialLinks.", RestaurantValidation.ValidateSocialLinks(new UpdateSocialLinksRequest(
                content.SocialLinks.Select(item => new AdminSocialLinkRequest(item.Key, item.Value)).ToArray())));
        }

        var images = new List<(string File, string Alt, bool IsMain)>();
        void AddImage(string field, RestaurantContentImage? image, bool isMain = false)
        {
            if (image is null)
            {
                return;
            }
            if (string.IsNullOrWhiteSpace(image.File))
            {
                errors.Add($"{field}.file: field_required");
                return;
            }
            Collect($"{field}.", RestaurantValidation.ValidateAltText(image.Alt));
            images.Add((image.File, image.Alt, isMain));
        }

        AddImage("mainImage", content.MainImage, isMain: true);
        AddImage("logo", content.Logo);
        AddImage("coverImage", content.CoverImage);
        var gallery = content.Gallery ?? [];
        for (var index = 0; index < gallery.Count; index++)
        {
            var photo = gallery[index];
            AddImage($"gallery[{index}]", new RestaurantContentImage(photo.File, photo.Alt));
            if (photo.Caption is not null && photo.Caption.Trim().Length is 0 or > 300)
            {
                errors.Add($"gallery[{index}].caption: field_length_invalid");
            }
        }
        if (gallery.Select(item => item.File).Distinct(StringComparer.Ordinal).Count() != gallery.Count)
        {
            errors.Add("gallery: the same file appears twice");
        }

        var categories = content.Menu?.Categories ?? [];
        if (content.Menu?.Name is { } menuName && menuName.Trim().Length is 0 or > 100)
        {
            errors.Add("menu.name: field_length_invalid");
        }
        for (var c = 0; c < categories.Count; c++)
        {
            var category = categories[c];
            Collect($"menu.categories[{c}].", MenuManagementValidation.ValidateCreateCategory(
                new CreateMenuCategoryRequest(category.Name, category.Description)));
            var dishes = category.Dishes ?? [];
            for (var d = 0; d < dishes.Count; d++)
            {
                var dish = dishes[d];
                Collect($"menu.categories[{c}].dishes[{d}] ({dish.Name}).", MenuManagementValidation.ValidateCreateDish(
                    new CreateDishRequest(Guid.NewGuid(), dish.Name, dish.Price, dish.Description, null,
                        dish.Available ? AvailabilityStatus.Available : AvailabilityStatus.Unavailable, dish.Badges)));
                AddImage($"menu.categories[{c}].dishes[{d}].image", dish.Image);
            }
        }

        foreach (var conflict in images.GroupBy(item => item.File, StringComparer.Ordinal)
                     .Where(group => group.Select(item => item.Alt.Trim()).Distinct(StringComparer.Ordinal).Count() > 1))
        {
            errors.Add($"{conflict.Key}: used more than once with different alt text");
        }

        if (errors.Count != 0)
        {
            throw new InvalidOperationException(
                "The content file has problems:" + Environment.NewLine + string.Join(Environment.NewLine, errors.Select(item => "  - " + item)));
        }

        return new ImportPlan(hours, images);
    }

    /// <summary>
    /// Reads and validates every image before the database is touched, with the same checks an owner
    /// upload gets, so a bad or oversized photo fails the import instead of half-applying it.
    /// </summary>
    private static async Task<IReadOnlyList<(string File, LoadedImage Image)>> LoadImagesAsync(
        ILocalMediaStorage storage,
        string baseDirectory,
        ImportPlan plan,
        CancellationToken cancellationToken)
    {
        var errors = new List<string>();
        var loaded = new List<(string, LoadedImage)>();
        foreach (var group in plan.Images.GroupBy(item => item.File, StringComparer.Ordinal))
        {
            var file = group.Key;
            var path = Path.GetFullPath(Path.Combine(baseDirectory, file));
            if (!path.StartsWith(Path.GetFullPath(baseDirectory) + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            {
                errors.Add($"{file}: must be inside the restaurant's folder");
                continue;
            }
            if (!File.Exists(path))
            {
                errors.Add($"{file}: file not found");
                continue;
            }

            var bytes = await File.ReadAllBytesAsync(path, cancellationToken);
            ValidatedImage image;
            try
            {
                var format = Image.DetectFormat(bytes);
                using var stream = new MemoryStream(bytes, writable: false);
                var formFile = new FormFile(stream, 0, bytes.Length, "file", Path.GetFileName(path))
                {
                    Headers = new HeaderDictionary(),
                    ContentType = format.DefaultMimeType
                };
                image = await storage.ValidateAsync(formFile, cancellationToken);
            }
            catch (Exception exception) when (exception is MediaValidationException or UnknownImageFormatException)
            {
                errors.Add($"{file}: {(exception as MediaValidationException)?.Code ?? "media_content_invalid"} (JPEG, PNG or WebP up to 5 MB)");
                continue;
            }
            if (group.Any(item => item.IsMain) && image.Width < RestaurantValidation.MinimumMainImageWidth)
            {
                errors.Add($"{file}: main image must be at least {RestaurantValidation.MinimumMainImageWidth}px wide");
                continue;
            }

            loaded.Add((file, new LoadedImage(file, group.First().Alt.Trim(), image, ContentSeed(bytes))));
        }

        if (errors.Count != 0)
        {
            throw new InvalidOperationException(
                "Some images could not be used:" + Environment.NewLine + string.Join(Environment.NewLine, errors.Select(item => "  - " + item)));
        }
        return loaded;
    }

    /// <summary>
    /// Reuses the asset when the same picture was imported before, so re-running an import does not
    /// pile duplicate photos into the owner's media library; a new picture is stored like an upload.
    /// </summary>
    private static async Task<MediaAssetEntity> EnsureAssetAsync(
        MenuDbContext dbContext,
        ILocalMediaStorage storage,
        IResponsiveImageVariantFactory variantFactory,
        Guid restaurantId,
        LoadedImage loaded,
        List<StoredMedia> stored,
        CancellationToken cancellationToken)
    {
        var id = AssetId(restaurantId, loaded.AssetSeed);
        var existing = dbContext.MediaAssets.Local.SingleOrDefault(item => item.Id == id) ??
            await dbContext.MediaAssets.Include(item => item.Variants)
                .SingleOrDefaultAsync(item => item.Id == id && item.RestaurantId == restaurantId, cancellationToken);
        if (existing is not null)
        {
            existing.AltText = loaded.Alt;
            return existing;
        }

        var asset = new MediaAssetEntity
        {
            Id = id,
            RestaurantId = restaurantId,
            AltText = loaded.Alt,
            ProcessingStatus = "ready"
        };
        foreach (var variant in await variantFactory.CreateAsync(loaded.Image, cancellationToken))
        {
            var seed = variant.ReusedSource ? id : Guid.NewGuid();
            var blob = await storage.StoreAsync(
                restaurantId,
                seed,
                variant.ReusedSource
                    ? loaded.Image
                    : new ValidatedImage(variant.Bytes, loaded.Image.Extension, loaded.Image.ContentType, variant.Width, variant.Height),
                cancellationToken);
            stored.Add(blob);
            asset.Variants.Add(new MediaVariantEntity
            {
                Id = Guid.NewGuid(),
                RestaurantId = restaurantId,
                MediaAssetId = id,
                MediaAsset = asset,
                Url = blob.Url,
                Width = blob.Width,
                Height = blob.Height,
                StorageKey = GalleryStorageKey.Create(restaurantId, seed, loaded.Image.Extension),
                FileSizeBytes = variant.Bytes.LongLength
            });
        }
        dbContext.MediaAssets.Add(asset);
        return asset;
    }

    private static void ApplyProfile(RestaurantEntity restaurant, RestaurantContentFile content, DateTimeOffset now)
    {
        restaurant.Name = content.Name.Trim();
        restaurant.Description = Trimmed(content.Description);
        restaurant.PhoneE164 = Trimmed(content.Phone);
        restaurant.PhoneDisplay = RestaurantValidation.FormatPhoneDisplay(restaurant.PhoneE164, content.PhoneDisplay);
        restaurant.Email = Trimmed(content.Email);
        restaurant.WebsiteUrl = Trimmed(content.WebsiteUrl);
        restaurant.RestaurantType = Trimmed(content.RestaurantType);
        restaurant.PriceRange = Trimmed(content.PriceRange);

        var settings = restaurant.Settings;
        settings.TimeZoneId = content.TimeZone ?? settings.TimeZoneId;
        settings.Locale = content.Locale?.Trim() ?? settings.Locale;
        settings.Currency = content.Currency ?? settings.Currency;
        if (content.TaxDisplayMode is not null)
        {
            settings.TaxDisplayMode = content.TaxDisplayMode;
            settings.TaxNoticeKey = content.TaxDisplayMode == "exclusive" ? "menu.tax.exclusive" : null;
        }
        settings.WebsiteDesignId = content.DesignId ?? settings.WebsiteDesignId;
        settings.ConcurrencyVersion++;

        var address = content.Address!;
        restaurant.Address ??= new RestaurantAddressEntity { RestaurantId = restaurant.Id, Restaurant = restaurant };
        restaurant.Address.Line1 = address.Line1.Trim();
        restaurant.Address.Line2 = Trimmed(address.Line2);
        restaurant.Address.City = address.City.Trim();
        restaurant.Address.Region = address.Region.Trim();
        restaurant.Address.PostalCode = Trimmed(address.PostalCode);
        restaurant.Address.CountryCode = address.CountryCode;
        restaurant.Address.Latitude = address.Latitude;
        restaurant.Address.Longitude = address.Longitude;
        restaurant.UpdatedAt = now;
    }

    private static void ApplyHours(MenuDbContext dbContext, RestaurantEntity restaurant, UpdateRegularHoursRequest hours)
    {
        foreach (var day in hours.Days)
        {
            for (var index = 0; index < day.Intervals.Count; index++)
            {
                var interval = day.Intervals[index];
                dbContext.RegularHourIntervals.Add(new RegularHourIntervalEntity
                {
                    Id = Guid.NewGuid(),
                    RestaurantId = restaurant.Id,
                    Restaurant = restaurant,
                    DayOfWeek = day.DayOfWeek,
                    OpensAt = ParseTime(interval.OpensAt),
                    ClosesAt = ParseTime(interval.ClosesAt),
                    DisplayOrder = index
                });
            }
        }
    }

    private static void ApplySocialLinks(
        MenuDbContext dbContext,
        RestaurantEntity restaurant,
        IReadOnlyDictionary<string, string>? links)
    {
        foreach (var (platform, url) in links ?? new Dictionary<string, string>())
        {
            dbContext.SocialLinks.Add(new SocialLinkEntity
            {
                Id = Guid.NewGuid(),
                RestaurantId = restaurant.Id,
                Restaurant = restaurant,
                Platform = platform,
                Url = url
            });
        }
    }

    private static void ApplyGallery(
        MenuDbContext dbContext,
        RestaurantEntity restaurant,
        IReadOnlyList<RestaurantContentGalleryImage>? gallery,
        IReadOnlyDictionary<string, MediaAssetEntity> assets,
        DateTimeOffset now)
    {
        var photos = gallery ?? [];
        for (var index = 0; index < photos.Count; index++)
        {
            var asset = assets[photos[index].File];
            dbContext.GalleryImages.Add(new GalleryImageEntity
            {
                Id = Guid.NewGuid(),
                RestaurantId = restaurant.Id,
                Restaurant = restaurant,
                MediaAssetId = asset.Id,
                MediaAsset = asset,
                Caption = Trimmed(photos[index].Caption),
                DisplayOrder = index + 1,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
    }

    private static async Task<(int Categories, int Dishes)> ApplyMenuAsync(
        MenuDbContext dbContext,
        RestaurantEntity restaurant,
        MenuEntity menu,
        RestaurantContentMenu? content,
        IReadOnlyDictionary<string, MediaAssetEntity> assets,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (content?.Name is { } name)
        {
            menu.Name = name.Trim();
        }
        menu.UpdatedAt = now;

        var badges = await dbContext.Badges
            .Where(item => item.RestaurantId == restaurant.Id)
            .ToDictionaryAsync(item => item.Code, StringComparer.Ordinal, cancellationToken);
        var slugs = new HashSet<string>(StringComparer.Ordinal);
        var categories = content?.Categories ?? [];
        var dishCount = 0;
        for (var c = 0; c < categories.Count; c++)
        {
            var source = categories[c];
            var category = new MenuCategoryEntity
            {
                Id = Guid.NewGuid(),
                RestaurantId = restaurant.Id,
                MenuId = menu.Id,
                Menu = menu,
                Name = source.Name.Trim(),
                Description = Trimmed(source.Description),
                DisplayOrder = c,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            category.Slug = MenuValidation.CreateSlug(category.Name, category.Id, slugs);
            dbContext.MenuCategories.Add(category);

            var dishes = source.Dishes ?? [];
            for (var d = 0; d < dishes.Count; d++)
            {
                var item = dishes[d];
                var media = item.Image is null ? null : assets[item.Image.File];
                var dish = new DishEntity
                {
                    Id = Guid.NewGuid(),
                    RestaurantId = restaurant.Id,
                    MenuId = menu.Id,
                    CategoryId = category.Id,
                    Category = category,
                    Name = item.Name.Trim(),
                    Description = Trimmed(item.Description),
                    Price = item.Price,
                    MediaAssetId = media?.Id,
                    MediaAsset = media,
                    Availability = item.Available ? AvailabilityStatus.Available : AvailabilityStatus.Unavailable,
                    IsActive = true,
                    DisplayOrder = d,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                category.Dishes.Add(dish);
                foreach (var code in (item.Badges ?? []).Distinct(StringComparer.Ordinal))
                {
                    if (!badges.TryGetValue(code, out var badge))
                    {
                        BadgeCatalog.TryGet(code, out var definition);
                        badge = new BadgeEntity
                        {
                            RestaurantId = restaurant.Id,
                            Restaurant = restaurant,
                            Code = code,
                            LabelKey = definition.LabelKey,
                            Category = definition.Category
                        };
                        badges[code] = badge;
                        dbContext.Badges.Add(badge);
                    }
                    var assignment = new DishBadgeEntity
                    {
                        RestaurantId = restaurant.Id,
                        DishId = dish.Id,
                        BadgeCode = code,
                        Dish = dish,
                        Badge = badge
                    };
                    dish.Badges.Add(assignment);
                    dbContext.DishBadges.Add(assignment);
                }
                dishCount++;
            }
        }
        return (categories.Count, dishCount);
    }

    private static Task<RestaurantEntity> LoadAggregateAsync(
        MenuDbContext dbContext,
        Guid restaurantId,
        CancellationToken cancellationToken) => dbContext.Restaurants
        .Include(item => item.Settings)
        .Include(item => item.Address)
        .Include(item => item.RegularHours)
        .Include(item => item.SpecialHours).ThenInclude(item => item.Intervals)
        .Include(item => item.SocialLinks)
        .Include(item => item.MainMediaAsset).ThenInclude(item => item!.Variants)
        .Include(item => item.LogoMediaAsset).ThenInclude(item => item!.Variants)
        .Include(item => item.CoverMediaAsset).ThenInclude(item => item!.Variants)
        .Include(item => item.GalleryImages).ThenInclude(item => item.MediaAsset).ThenInclude(item => item.Variants)
        .Include(item => item.Menus).ThenInclude(item => item.Categories).ThenInclude(item => item.Dishes).ThenInclude(item => item.Badges).ThenInclude(item => item.Badge)
        .Include(item => item.Menus).ThenInclude(item => item.Categories).ThenInclude(item => item.Dishes).ThenInclude(item => item.MediaAsset).ThenInclude(item => item!.Variants)
        .AsSplitQuery()
        .SingleAsync(item => item.Id == restaurantId, cancellationToken);

    private static TimeOnly ParseTime(string value) =>
        TimeOnly.ParseExact(value, ["HH:mm", "HH:mm:ss"], CultureInfo.InvariantCulture);

    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static Guid ContentSeed(byte[] bytes)
    {
        var hash = SHA256.HashData(bytes);
        return new Guid(hash.AsSpan(0, 16));
    }

    /// <summary>A stable asset id per restaurant and picture, shaped as a version 5 style GUID.</summary>
    private static Guid AssetId(Guid restaurantId, Guid contentSeed)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"import:{restaurantId:N}:{contentSeed:N}"));
        Span<byte> guidBytes = stackalloc byte[16];
        bytes.AsSpan(0, 16).CopyTo(guidBytes);
        guidBytes[7] = (byte)((guidBytes[7] & 0x0F) | 0x50);
        guidBytes[8] = (byte)((guidBytes[8] & 0x3F) | 0x80);
        return new Guid(guidBytes);
    }
}
