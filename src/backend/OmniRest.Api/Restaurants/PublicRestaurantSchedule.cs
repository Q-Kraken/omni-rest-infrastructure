using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace OmniRest.Api.Restaurants;

public static class PublicRestaurantSchedule
{
    public static PublicRestaurantResponse Prepare(PublicRestaurantResponse restaurant, DateTimeOffset now)
    {
        var today = LocalDate(restaurant, now);
        // Calculate on the complete snapshot first: yesterday's override can carry past midnight.
        var status = new RestaurantStatusCalculator().Calculate(restaurant, now);
        return restaurant with
        {
            Status = status,
            LocalDate = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            SpecialHours = restaurant.SpecialHours.Where(day =>
                DateOnly.TryParseExact(day.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var date) &&
                date >= today.AddDays(-1) && date <= today.AddDays(180)).ToArray()
        };
    }

    public static string CacheToken(PublicRestaurantResponse restaurant, DateTimeOffset now)
    {
        var value = $"{LocalDate(restaurant, now):yyyy-MM-dd}|{restaurant.Status}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)))[..16];
    }

    private static DateOnly LocalDate(PublicRestaurantResponse restaurant, DateTimeOffset now) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now,
            TimeZoneInfo.FindSystemTimeZoneById(restaurant.TimeZone)).DateTime);
}
