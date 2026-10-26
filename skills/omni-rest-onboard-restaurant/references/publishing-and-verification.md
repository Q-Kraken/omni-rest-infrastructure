# Publication and live verification

## Contracts and preflight

Inspect the current versions of:

- `src/backend/OmniRest.Api/Restaurants/RestaurantContentImport.cs`
- `src/backend/OmniRest.Api/Restaurants/RestaurantOnboarding.cs`
- `src/backend/OmniRest.Api/Restaurants/RestaurantValidation.cs` and `MediaStorage.cs`
- `src/backend/OmniRest.Api/Program.cs` for supported command arguments
- Deployment scripts/runbooks and the actual server configuration

The importer publishes automatically. It validates the package and referenced images before writes; executing it against production is a live mutation, not a dry run. The helper in `scripts/validate_package.py` is a read-only partial preflight, not a substitute for application validation. Like the current importer, it accepts JSON comments and trailing commas; it rejects duplicate keys and requires portable relative image paths to avoid ambiguous or machine-specific packages.

Current source defaults include JPEG/PNG/WebP, 5 MiB per asset, 8000 pixels per dimension, 40 million pixels, and a main image at least 704 pixels wide. Verify the effective target configuration and pass helper overrides if different. The application fully decodes images; the helper reads headers only. Asset file references reused by hero, cover, gallery or dishes must have identical trimmed alt text. Do not add unsupported option fields.

Select an existing design appropriate for long names, original-language text, category navigation and mixed photo coverage. Check compact no-photo cards on mobile and desktop. If code changes are necessary, start from the actual running source baseline, preserve unrelated production fixes, validate the scoped change, and regenerate the normal style/cache version. Template changes affect every tenant using that template.

## Before any production mutation

Record the running release/image identities and existing tenants' IDs, domains, publication versions, menu counts and public snapshots. Discover all existing tenants, including ones added since historical reports. Compare snapshots using stable fields; computed local date/status/next-change values can change without a publication.

Back up database, persistent media/application state, relevant deployment configuration and any necessary gateway/certificate state. Keep raw backups private and outside Git. Retain a protected off-server copy; validate checksums/archive readability and restore the database into an isolated disposable environment. Record the restoration result without exposing credentials. Refresh backups after a material pause or intervening changes.

Prepare a proportional recovery procedure before writing. A new-host configuration failure can often be reversed by restoring previous host settings and the recorded release, leaving the new tenant unexposed for diagnosis. Do not automatically delete tenants or downgrade a database. Use full data restoration only when the actual failure requires it and the consistent recovery procedure has been established.

## Import and hostname configuration

Inspect actual command options before execution. Current command contracts are:

```text
--import-restaurant <absolute restaurant.json path or folder> [--replace]
--add-domain <slug> <bare-hostname>
```

Pass an absolute path even when using `dotnet run`, which can resolve relative paths beneath the backend project. Mount a remote package read-only where possible. For a remote Compose job close stdin (`</dev/null`) and capture protected output so command status and summary are visible without leaking configuration.

Use `OMNIREST_ALLOW_RESTAURANT_ONBOARDING=true` only on the controlled one-off job if the current Production implementation requires it. Import a new unique slug without `--replace`. Existing content, occupied domain mappings, or an unexpected already-existing result require inspection before retrying; do not convert an additive onboarding task into replacement.

Verify import output identifies the intended tenant and expected counts/version, then add its hostname through the supported domain command. Import does not assign or reassign a domain by itself.

Inspect `SITE_HOST`, `PUBLIC_SITE_HOSTS`, `PUBLIC_SITE_ALLOWED_HOSTS` and `restaurant_domains` in the actual deployment. Preserve the existing primary host and extend lists using their correct separators. Preserve all current mappings. Configure DNS/HTTPS through the existing gateway. Derive a technical hostname from the current configuration only when the user has authorized that convention; do not reuse an old IP blindly.

For configuration-only changes keep the current application images. Explicitly use the actual running release when invoking deployment commands if a default environment tag differs. Use the established release workflow for necessary application changes. Remove temporary gates/secrets afterward and verify service health. If an operation fails, inspect its protected diagnostics and before/after state before a retry; do not repeat a mutation blindly.

## Verify and record

Check trusted HTTPS and a real browser, not only process startup:

- `/`, `/menu`, category routes and `/admin/login` identify the correct restaurant. A login page returning 200 does not prove credentials work.
- Public menu/profile data match the selected package: identity, counts, exact names/prices, hours, address and phone. State which uncertainties remain.
- All distinct public media URLs load, including responsive variants. Test actual media routes independently of an image optimizer.
- Desktop/mobile/narrow layouts are readable, contain no horizontal page overflow or large empty photo blocks, and retain correct styling after refresh.
- Category links work; contact/directions links point to the verified destination. Checking a phone link does not require placing a call.
- Existing restaurants keep their own content, mappings and publication versions. Cross-tenant public media requests return 404.
- Services are healthy, persistent media/content survive the scoped restart, and temporary onboarding settings are absent.

Take and validate a post-publication protected backup, retain an off-server copy, and recheck availability after any backup maintenance/restart. Save non-secret evidence and deployment notes in the package. If a browser, source, backup or required check is unavailable, state the exact unverified requirement rather than claiming completion.
