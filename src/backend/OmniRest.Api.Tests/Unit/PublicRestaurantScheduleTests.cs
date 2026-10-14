using OmniRest.Api.Restaurants;

namespace OmniRest.Api.Tests.Unit;

public sealed class PublicRestaurantScheduleTests
{
    [Fact]
    public void WindowUsesRestaurantDateKeepsYesterdayForOvernightAndLeavesSnapshotUntouched()
    {
        var now = DateTimeOffset.Parse("2026-10-13T06:00:00Z"); // Tuesday 01:00 in Winnipeg.
        var restaurant = Restaurant([
            new("2026-10-11", true, null, []),
            new("2026-10-12", false, "overnight", [new("22:00:00", "03:00:00", true)]),
            new("2026-10-14", true, null, []),
            new("2027-04-11", true, null, []), // Exactly 180 days ahead.
            new("2027-04-12", true, null, [])
        ]);
        var prepared = PublicRestaurantSchedule.Prepare(restaurant, now);
        Assert.Equal("2026-10-13", prepared.LocalDate);
        Assert.Equal(new[] { "2026-10-12", "2026-10-14", "2027-04-11" }, prepared.SpecialHours.Select(day => day.Date));
        Assert.Equal("open", prepared.Status.State);
        Assert.Equal("Closes at 03:00", prepared.Status.Label);
        Assert.Equal(DateTimeOffset.Parse("2026-10-13T08:00:00Z"), prepared.Status.NextChangeAt);
        Assert.Equal(5, restaurant.SpecialHours.Count);
    }

    [Fact]
    public void ValidatorChangesAtLocalMidnightAndAtClosingWithoutRepublishing()
    {
        var restaurant = Restaurant([new("2026-10-12", false, null, [new("22:00:00", "03:00:00", true)])]);
        var times = new[] { "2026-10-13T04:00:00Z", "2026-10-13T06:00:00Z", "2026-10-13T08:00:00Z" }.Select(DateTimeOffset.Parse).ToArray();
        var tokens = times.Select(now => PublicRestaurantSchedule.CacheToken(PublicRestaurantSchedule.Prepare(restaurant, now), now)).ToArray();
        Assert.Equal(3, tokens.Distinct().Count());
        Assert.Equal("2026-10-12", PublicRestaurantSchedule.Prepare(restaurant, times[0]).LocalDate);
        Assert.Equal("closed", PublicRestaurantSchedule.Prepare(restaurant, times[2]).Status.State);
    }

    private static PublicRestaurantResponse Restaurant(IReadOnlyList<PublicSpecialHours> special) => new(
        "restaurant", "Restaurant", null, null, null, "America/Winnipeg", null, [], special,
        new("closed", "Closed", null, "regularHours"), [], null, "1", []);
}
