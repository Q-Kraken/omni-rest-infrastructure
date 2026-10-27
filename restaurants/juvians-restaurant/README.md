# Juvian's Restaurant

Filipino restaurant at 1280 Notre Dame Ave, Winnipeg, (204) 589-0001. Live tenant at
https://juvians-restaurant.51-79-102-231.sslip.io (restaurant id `23d16206-d7be-4110-8c44-79390059aa6c`).
A separate Waterford Green Common branch exists; it is not this tenant.

## What is here

There is no `restaurant.json` import package for this tenant in the repo. The menu (56 dishes, 9 categories,
order.online pickup prices from 25 Oct 2026) and 32 restaurant dish photos were published on 2026-10-25.

On 2026-10-27, 17 dishes without a photo were given one through the owner admin:

- 16 labelled Wikimedia Commons illustrations (description: "Illustrative photo, not from this restaurant: author,
  licence, Wikimedia Commons."), listed with source page and licence in `research/wikimedia-illustrations.json`.
- Spaghetti w/ Chicken Kids reuses the restaurant's own Spaghetti with 2 Pieces Chicken photo, and its description says so.

Seven items still have no photo because no honest match was found: Gravy, Crush, Brisk Iced Tea, Celsius Tropical Vibe,
Celsius Peach Vibe, Pure Leaf Citron, Pure Leaf Raspberry. Reasons are in `research/wikimedia-illustrations.json`.

## Research files

- `research/live-menu-before-2026-10-27.json`, `research/live-menu-after-2026-10-27.json`: public menu API snapshots.
- `research/live-profile-2026-10-27.json`: public restaurant profile snapshot.
- `research/commons-candidates-round*.json`: the Commons search results the photos were picked from.

## Caveat

The illustrations live only in the production database and media storage. A future import of this restaurant with
`--replace` would drop them unless they are added to an import package.
