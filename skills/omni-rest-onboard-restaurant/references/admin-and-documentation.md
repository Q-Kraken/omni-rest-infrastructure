# Admin access and hostname documentation

These stages apply when requested or already authorized. Onboarding a public menu alone does not imply permission to reset accounts, add memberships, share credentials or edit external documentation.

## Provision and verify an account

Inspect `src/backend/OmniRest.Api/Security/OwnerProvisioning.cs`, `AuthEndpoints.cs`, current operational documentation and the intended restaurant's existing memberships. Reuse a verified intended account where appropriate. If an account exists but its password is unavailable, do not silently reset it or grant it broader access. Clarify only the missing decision.

The current supported creation contract is:

```text
--provision-owner <email> <restaurant-id> <display-name>
```

Use the chosen username/email as an account identifier, not as authority to contact that address. Inspect the current password policy. Generate a strong unique password through a secure local/runtime mechanism; do not put its literal value in tool inputs, shell arguments, chat, screenshots, Git, wiki content or normal logs.

Current Production provisioning uses `OMNIREST_ALLOW_OWNER_PROVISIONING=true` and one-time `OMNIREST_PROVISION_PASSWORD`. Pass them only to the controlled one-off process. A protected temporary secret file/environment may be used if required; delete temporary copies once secure storage is verified. Keep normal application gates closed. Inspect Compose options: a run subcommand may not support `--env-file` in the position one expects; forwarding named environment variables with `-e` avoids placing values in arguments.

Verify actual login, session, authenticated admin API/page, and the intended active membership. Use the application's antiforgery flow and log out after testing. Restrict a newly requested single-restaurant account to that restaurant unless broader scope was explicitly requested.

Do not infer authorization from HTTP status or the address bar alone. Admin routes may resolve the managed restaurant from authenticated membership independently of the public hostname. Check the returned restaurant ID and membership list. A response of 200 under a different hostname is not by itself evidence of access to that hostname's restaurant; verify the actual returned tenant. Keep public-host resolution/media-isolation checks separate.

Record only non-secret results. Do not report account provisioning or login as successful after an unverified command, failed attempt, or login-page check.

## Private credential storage

Use the user's selected password manager/private store. Inspect the intended vault/collection before adding an item; avoid duplicates and preserve existing entries. Adding the requested credential does not authorize creating an organization, inviting members or widening sharing. If storage destination/access is unknown, ask while continuing unrelated work.

For a Bitwarden project vault, store the name, exact admin URL, username, password and a non-secret tenant note. For restaurants on shared technical domains such as `sslip.io`, choose **Host** URI matching so autofill stays specific to that restaurant rather than matching the shared base domain. Treat this as an item setting, not permission to change all existing vault entries. Other password managers should use their equivalent hostname-specific match where available.

Verify that saving succeeded and the item is accessible in the intended store with the correct metadata. Keep the password concealed. Do not interpret redacted DOM/AX values as the real saved password or replace a secret because a redacted comparison fails. Retain any necessary protected temporary copy until storage succeeds, then remove it. Document remaining credential exposure if cleanup cannot be completed.

## Update the hostname inventory

Use the user's repository/wiki/documentation destination, preserving unrelated content. Inspect its current visibility. In a public wiki, publish home/menu/admin links, permitted account identifiers and authenticated private-vault links; never publish an active password or an unauthenticated secret-sharing link. A private vault link must still require normal access and must not grant it.

Recheck current DNS, HTTPS, intended tenant identity, `/menu`, `/admin/login`, host allowlists and domain mappings. Update counts, date/time zone, restaurant row and database slug without dropping older tenants. Distinguish public login-page availability from authenticated account verification. Link existing credential entries only when their identity/location was verified; do not claim their passwords were tested if they were not.

Prefer available service tooling. If it cannot edit a wiki, use the wiki's supported Git repository or signed-in editor. A wiki is separate from the application repository; editing it does not require merging application changes. Inspect the diff, publish within the user's scope, and verify the rendered result. Keep safe screenshots/evidence where helpful, with passwords concealed. Report the updated page and private credential location, never the password itself.
