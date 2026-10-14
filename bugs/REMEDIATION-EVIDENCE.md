# Bug-folder remediation evidence

Reviewed 2026-10-13. Source main: `7ecd51d`. Work branch: `fix/bug-folder`. Restored workspace: `/Users/volkvolk/Documents/omni-rest-infra`; the clean older checkout at `/Users/volkvolk/Documents/Work/omni-rest-infra/omni-rest-infrastructure` was preserved. Runtime/SDK/package pins remain unchanged.

## Results

| Work orders | Result and evidence |
|---|---|
| WO-01–03 | Existing fixes reconfirmed by the backend seed-media/status tests and frontend priority renderer tests. |
| WO-04 | Calendar window evaluated on every public read, retaining yesterday for overnight status and limiting output to 180 days ahead. Cached publication snapshots remain complete. Calendar/status changes update ETags; home designs hide past dates. `PublicRestaurantScheduleTests` cover timezone, midnight, expiry and overnight behavior. |
| WO-05 | Restaurant title/description plus canonical and Open Graph on public pages. Largest main photo uses an absolute URL. Canonical host is validated by a successful published-restaurant resolution; scheme comes from deployment configuration. An unresolved host receives a safe fallback without canonical or indexing. SEO unit and browser assertions pass. |
| WO-06 | Open by owner instruction. Original PR-9 Tasks 3–14 are missing and were not invented. |
| WO-07 | Owner approved seven social platforms, visible unavailable active dishes and confirmed overnight service. Older PRD/task/spec wording reconciled. |
| WO-08 / WO-13 | Task-level traceability and formal Phase 1 evidence added. Shared Hero, About and CTA components preserve the five designs and existing heading IDs. About is omitted when no content exists. |
| WO-09 / WO-19 postal | Additive EF migration adds optional `website_url`, backfills special-date timestamps and permits nullable postal codes. Existing rows survive. Owner save/read/publication round-trip and staged migration tests pass. |
| WO-10 | Guarded sample includes paired coordinates; directions use coordinates and editor explains placement. Existing validation rejects out-of-range/unpaired coordinates. |
| WO-11 | Configured Maps Embed iframe is accessible, lazy and responsive. Missing key/coordinates produce no empty iframe. URL/key/location tests pass; a live provider response requires a restricted deployment key. [Google Embed configuration](https://developers.google.com/maps/documentation/embed/embedding-map) supports the iframe and `strict-origin-when-cross-origin` referrer setting. |
| WO-12 | Prepared API restaurant-local date controls current weekday. All seven days use semantic times and overnight labels; editor requires renewed overnight confirmation when times change. Unit and real owner tests pass. |
| WO-14 | Uploads generate ascending 320/640/1024/1600 derivatives below original width plus the original. Decoded dimensions match metadata; originals are never upscaled. Main-image upload/selection reject widths below 704px. Compensation cleans every exact-file lease after write/persistence failure. Real hero resolution is checked against rendered width. |
| WO-15 | Blank display derives NANP formatting; explicit custom display remains available. Editor supplies automatic formatting and warns on raw international display. Telephone URI construction remains centralized and E.164-only. |
| WO-16 | Evidence base SHA resolves. Logout success/failed-recovery/router-refresh tests live in the referenced dedicated file. Real logout, protected refresh and back navigation pass. |
| WO-17 | Isolated line-ending normalization plus binary rules; existing migration encoding normalized to the formatter baseline. No unrelated logic is included in normalization commits. |
| WO-18 | Both cookie 401/403 handlers write generic Problem Details with no redirect. Unit tests assert status, code, content type and no private redirect leakage; real API 401 coverage passes. |
| WO-19 | Public directions open safely in a new tab. Next image configuration and menu parser share the deployment media-host allowlist, empty by default. `.env.example` documents configuration. |
| WO-20 | Already implemented in Phase 4 on latest main; menu-category/dish/availability integration and frontend manager tests pass. |

## Verification

- Backend build: passed; full xUnit/VSTest suite **254/254**, no skips. This includes clean/staged migrations, profile publication, image variants/cleanup, authentication and previously delivered menu/gallery behavior.
- `dotnet format ... --verify-no-changes --no-restore --severity warn`: passed.
- Frontend lint/typecheck/production build: passed.
- Vitest: **234/234** across **30** files. Coverage gates passed: **81.07% statements, 75.62% branches, 81.83% functions, 84.21% lines**.
- General Playwright suite: **24 passed**, **76 intentional project-specific skips**, using Chromium/Firefox/WebKit and 320/768/1440 viewport projects.
- Dedicated design suite: **8 passed**, including all four selectable designs at **320, 375, 768 and 1440px**, overflow, long/minimal content, keyboard behavior, stylesheet isolation and axe checks.
- Real owner suite: **1 comprehensive scenario passed** against ephemeral PostgreSQL, migrations, actual API and Next production server. Includes overnight confirmation, media upload, tenant isolation, preview/public values, image resolution, semantic current-day hours, accessibility and logout.
- Production asset separation audit: passed.
- Large-menu performance: **1 passed** on the production build with 30 categories / 1,000 dishes; **299.2ms navigation**, **33.4ms client category switch** (100ms switch budget passed), **302,429 gzip JS bytes** across 33 files. Local measurement only.

No files were sent, deployed or pushed. No persistent database volume was removed. The local Compose database remains available for follow-up development; real-owner/test databases were disposable test containers.

## Remaining limits

- PR-9 original Tasks 3–14 are required to close WO-06.
- Maps is optional and hidden until a referrer-restricted Embed API key is configured; no live keyed provider check was possible.
- Engine coverage does not prove actual Edge/Safari applications or physical-device telephone handoff. Local performance does not establish staging/field performance.
- Backend restore emitted existing vulnerability advisories for pinned ImageSharp and transitive SSH.NET. These are tracked as DEP-001; dependency versions were not changed.
