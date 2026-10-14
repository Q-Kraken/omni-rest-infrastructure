using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OmniRest.Api.Security;

namespace OmniRest.Api.Tests.Unit;

public sealed class OwnerCookieEventsTests
{
    [Theory]
    [InlineData(401, "auth_required")]
    [InlineData(403, "auth_forbidden")]
    public async Task AuthenticationFailuresWriteGenericProblemDetailsWithoutRedirect(int status, string code)
    {
        using var services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        http.Response.Body = new MemoryStream();
        var context = new RedirectContext<CookieAuthenticationOptions>(http,
            new AuthenticationScheme("owner", null, typeof(CookieAuthenticationHandler)),
            new CookieAuthenticationOptions(), new AuthenticationProperties(), "/private-owner-login");
        var events = new OwnerCookieEvents(null!, null!, Options.Create(new AuthenticationLifecycleOptions()), TimeProvider.System);
        if (status == 401) await events.RedirectToLogin(context);
        else await events.RedirectToAccessDenied(context);
        Assert.Equal(status, http.Response.StatusCode);
        Assert.StartsWith("application/problem+json", http.Response.ContentType);
        Assert.False(http.Response.Headers.ContainsKey("Location"));
        http.Response.Body.Position = 0;
        using var payload = await JsonDocument.ParseAsync(http.Response.Body);
        Assert.Equal(code, payload.RootElement.GetProperty("code").GetString());
        Assert.Equal(status, payload.RootElement.GetProperty("status").GetInt32());
        Assert.DoesNotContain("private-owner", payload.RootElement.ToString(), StringComparison.Ordinal);
    }
}
