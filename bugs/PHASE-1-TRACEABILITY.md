# Phase 1 task traceability

Source base: main `7ecd51d`; remediation approved on 2026-10-13. Frontend paths are relative to `src/frontend`; `.cs` paths are under `src/backend/OmniRest.Api` or its test project. “Met” means implementation plus automated evidence. Physical devices, actual vendor browser applications, live keyed Maps service and field performance are not implied.

| Task | Status | Implementation evidence | Verification or remaining acceptance evidence |
|---|---|---|---|
| PR-1 Task 1.1 --- Create Public Website Skeleton | met | `HomeDesignRenderer.tsx`, `restaurant/Hero.tsx`, `About.tsx`, `CtaGroup.tsx` | All five designs preserve public skeleton and actions; design/component/browser checks. |
| PR-1 Task 1.2 --- Create Restaurant Information Model | met | `Data/MenuDbContext.cs`, `Data/Phase3Model.cs`, `Data/Phase6Model.cs` | Identity/contact/address/hours/media/domain fields; migration and owner API tests. |
| PR-1 Task 1.3 --- Implement Hero Section | met | `restaurant/Hero.tsx`, `shared/PublicDesignParts.tsx` | Priority image, name, conditional description and actions; renderer tests. |
| PR-1 Task 1.4 --- Implement View Menu Button | met | `components/MenuLink.tsx`, `e2e/menu.spec.ts` | Native menu action and client/server navigation. |
| PR-1 Task 1.5 --- Implement Call Button | met | `phone/CallButton.tsx`, `lib/phone.ts`, `lib/phone-display.ts` | E.164 telephone target; NANP display formatting and browser tests. |
| PR-1 Task 1.6 --- Implement Directions Button | met | `PublicRestaurantContracts.cs`, `shared/PublicDesignParts.tsx` | Coordinates in directions URL; safe new-tab links. |
| PR-1 Task 1.7 --- Implement Responsive Layout | met | `app/globals.css`, `public/design-previews/styles/*.css` | 320/375/768/1440 design checks and public browser viewport projects. |
| PR-1 Task 1.8 --- Implement Accessibility | met | `PublicShell.tsx`, `e2e/design.spec.ts`, `DesignRenderers.test.tsx` | Skip links, semantic headings, keyboard flows and axe checks. |
| PR-1 Task 1.9 --- Implement SEO Foundation | met | `lib/seo.ts`, `lib/site-origin.ts`, `app/page.tsx` | Per-tenant title, description, canonical and Open Graph; unresolved hosts get no canonical. |
| PR-1 Task 1.10 --- Final Integration & QA | partially met | `e2e/restaurant.spec.ts`, `e2e-real/phase3.spec.ts` | Automated integration passes; physical-device telephone handoff and actual Chrome/Edge/Safari remain manual checks. |
| PR-2 Task 2.1 --- Restaurant Contact Information Model | met | `Data/MenuDbContext.cs`, `AdminRestaurantContracts.cs` | Contact and optional HTTPS website; validation and publication round-trip. |
| PR-2 Task 2.2 --- Restaurant Address Model | met | `Data/Phase3Model.cs`, `RestaurantValidation.cs` | Structured address and optional postal code; migration/publication tests. |
| PR-2 Task 2.3 --- Restaurant Coordinates | met | `GuardedSampleDataSeeder.cs`, `RestaurantEditor.tsx` | Sample coordinates, owner hint and range/pair validation. |
| PR-2 Task 2.4 --- Restaurant Business Hours Model | met | `Data/Phase3Model.cs`, `RestaurantValidation.cs` | Closed/split/overnight regular hours; calculator and API tests. |
| PR-2 Task 2.5 --- Special Hours Support | met | `Data/Phase3Model.cs`, `RestaurantManagementService.cs` | Special dates, notes, timestamps, overrides and CRUD. |
| PR-2 Task 2.6 --- Restaurant Social Links Model | met | `RestaurantValidation.cs`, `Data/Phase6Model.cs` | Approved seven-platform set and HTTPS host allowlists. |
| PR-2 Task 2.7 --- Restaurant Information API | met | `Modules/PublicRestaurantEndpoints.cs`, `Menus/PublicMenuReader.cs` | Host-resolved publication; all profile fields returned. |
| PR-2 Task 2.8 --- Restaurant Information Validation | met | `RestaurantValidation.cs`, `RestaurantEditor.tsx` | Server rules plus explicit editor overnight confirmation. |
| PR-2 Task 2.9 --- Public Restaurant Information UI | met | `shared/PublicDesignParts.tsx`, `legacy/LegacyHome.tsx` | Contact, website, address, optional map, hours, social and media blocks. |
| PR-2 Task 2.10 --- Google Maps Integration | partially met | `restaurant/RestaurantMap.tsx`, `RestaurantMap.test.tsx` | Configured lazy Embed URL and missing-data fallbacks tested; live Google marker needs a restricted deployment key. |
| PR-2 Task 2.11 --- Business Hours Display | met | `restaurant/BusinessHours.tsx`, `PublicRestaurantSchedule.cs` | Prepared restaurant-local day; all seven days, semantic times, current-day marker, overnight suffix. |
| PR-2 Task 2.12 --- Open Now Status | met | `RestaurantStatusCalculatorTests.cs`, `PublicRestaurantScheduleTests.cs` | Open/closed/next-opening states; timezone and overnight boundaries. |
| PR-3 Task 1. Design the Data Model for Special Operating Hours | met | `Data/Phase3Model.cs`, `RestaurantProfileRemediation` migration | Special-date model and timestamp backfill preserve existing rows. |
| PR-3 Task 2. Implement CRUD API for Special Operating Hours | met | `Modules/AdminRestaurantEndpoints.cs`, `RestaurantManagementService.cs` | Owner-scoped CRUD with ETags and meaningful failures. |
| PR-3 Task 3. Build Owner UI for Managing Special Hours | met | `components/admin/RestaurantEditor.tsx` | Create/edit/delete, confirmation dialog and overnight confirmation. |
| PR-3 Task 4. Apply Override Logic to Restaurant Schedule | met | `RestaurantStatusCalculatorTests.cs` | Special hours override regular hours and yesterday carryover. |
| PR-3 Task 5. Update Public Restaurant Availability | met | `PublicRestaurantSchedule.cs`, `RestaurantSpecialHours` | Window refreshed on each read; stale display removed; calendar/status-aware ETags. |
| PR-3 Task 6. Validation and Business Rules | met | `RestaurantValidation.cs`, `RestaurantEditor.test.tsx` | Duplicate dates, invalid/overlapping periods, closed days and overnight confirmation. |
| PR-3 Task 7. Automated Testing | met | `AdminRestaurantApiTests.cs`, `PublicRestaurantScheduleTests.cs` | Persistence, publication, backfill and clock boundary coverage. |
| PR-4 Task 1. Define Responsive Breakpoints | met | `app/globals.css`, `e2e/design.spec.ts` | Shared 768/1024 px shell rules; individual fluid designs tested at 320/375/768/1440. |
| PR-4 Task 2. Responsive Layout System | met | `public/design-previews/styles/*.css` | Fluid grids/flex layouts and no-clipping assertions. |
| PR-4 Task 3. Responsive Header & Navigation | met | `PublicShell.tsx`, `shared/PublicDesignParts.tsx` | Single link fits supported widths; collapsible menu remains unnecessary. |
| PR-4 Task 4. Responsive Typography | met | `public/design-previews/styles/*.css` | Responsive typography; long-name and long-content browser checks. |
| PR-4 Task 5. Responsive Images & Media | met | `ResponsiveImages.cs`, `RestaurantHeroImage` | Ascending derivatives, no upscale, minimum hero width and decoded-dimension tests. |
| PR-4 Task 6. Responsive Forms | met | `app/admin/admin.module.css`, `RestaurantEditor.tsx` | Responsive field grids; accessible controls and editor tests. |
| PR-4 Task 7. Touch-Friendly Interface | met | `phone/PhoneLink.tsx`, design action/gallery styles | Touch targets preserved; axe and component checks. |
| PR-4 Task 8. Responsive Tables & Data Presentation | met | `components/admin/CategoryManager.tsx`, `DishManager.tsx` | Responsive list/grid presentation; no full-width fixed data tables. |
| PR-4 Task 9. Responsive Dialogs & Popups | met | `components/admin/RestaurantEditor.test.tsx`, `DesignGallery.test.tsx` | Dialog focus trapping/restore, inert background and lightbox tests. |
| PR-4 Task 10. Cross-Browser Responsive Compatibility | partially met | `playwright.config.ts`, `playwright.design.config.ts` | Chromium/Firefox/WebKit engines automated; actual Edge and Safari applications not run. |
| PR-4 Task 11. Responsive Performance | met | `e2e/menu.perf.spec.ts`, `ResponsiveImages.cs` | Local production performance passed: 30 categories / 1,000 dishes, 299.2ms navigation, 33.4ms category switch. No field/staging claim. |
| PR-4 Task 12. Responsive QA & Validation | met | `e2e/menu.spec.ts`, `e2e/design.spec.ts` | Viewport, zoom, reduced-motion, forced-color and overflow checks. |
