# Restaurant research and content preparation

## Baseline and source assignments

Verify identity using address and phone before matching a restaurant or branch. Inspect supplied content and any existing tenant first. Record category/entry counts, existing photos and missing-photo count. For local JSON use zero-based category/dish indexes plus exact names; menu numbers can repeat and imported database IDs may not exist yet.

Check official pages, Maps, social accounts, delivery platforms operating in the location, and review/menu sites. Confirm actual listings rather than inventing platform URLs. An unavailable delivery listing does not establish that the restaurant closed. A similarly named business in another city is not a source.

When delegation is supported and permitted, give each source researcher the same identity/baseline, one source and a separate output folder under `research/<source>/`. Run waves if necessary. Require source links, collection date/time zone, factual findings, structured menu/photo records and access limitations. Keep production operations with the coordinating operator. With no delegation, preserve the same source separation and describe the work as sequential research.

Inspect complete category/item cards, galleries, captions, reviews and menu scans. Search unresolved dishes by restaurant/city plus exact name, menu number, alternative spelling and original-language name, restricted to a relevant source when useful. Stop at a decisive exclusion or access restriction; do not bypass sign-in requirements, challenges, robots restrictions or explicit reuse restrictions. Record bounded searches that found no verified listing as limitations, not proof of absence.

## Photo evidence

Each proposed asset record should contain:

- Restaurant/branch, exact menu entry and category/dish indexes where applicable.
- Source page, actual original image URL and the observed caption/card evidence connecting it to the item.
- Local file, dimensions, format, byte size and SHA-256 when downloadable.
- Classification: confirmed match, probable match, unlabelled owner-review, existing/duplicate, placeholder, unrelated or unusable thumbnail.
- Duplicate assessment, reuse-permission status and access limitations.

Do not identify a dish from appearance, automated labels, or a review naming several dishes beside several unlabelled photos. A restaurant banner can be branding evidence without being a dish match. A small original logo may suit a small branding slot without contributing to dish-photo coverage.

Compare exact hashes and screen likely resized/cropped duplicates with perceptual comparison/contact sheets when available. Record the limits of that screening. Gallery repetitions and multiple variants do not increase distinct dish coverage.

Public availability is not reuse permission. Record unknown rights honestly, separate customer uploads from merchant assets, and respect explicit restrictions. Publish only exact dish matches selected within the user's authorized scope; leave probable/unlabelled images for owner identification. Do not use generated or unrelated food pictures to fill gaps.

## Menu and profile facts

Select an identified menu/price source and label platform prices on the public site when dine-in prices are unverified. Exclude repeated recommendation sections such as Most Ordered from totals. Do not silently merge prices or availability from different channels. Keep extra/historical entries and disagreements in a discrepancy record.

Preserve source names, original-language text, portions and factual descriptions. Keep known AI-generated descriptions and uncertain descriptive claims separate for review. Do not invent ingredients, allergens, dietary claims, prices, translations, email addresses, missing descriptions or option prices. Record unsupported choices/sizes/supplements outside the strict import file.

Distinguish dining/store hours from ordering hours. Choose a stated source for public hours and address/postal code; preserve conflicts for the owner. Do not publish a historical domain as a working official website without checking its current identity and response.

## Package and review

Use `restaurants/<slug>/restaurant.json`, adjacent `photos/` and `research/`. Inspect `src/backend/OmniRest.Api/Restaurants/RestaurantContentImport.cs` for the actual schema; a prior restaurant is a structural example, not content to copy.

Provide a concise findings report with collection dates/source links, JSON or CSV inventory, missing-photo checklist, confirmed/probable records, unlabelled evidence/contact sheets where available, discrepancies, and owner questions. Preserve source-specific evidence rather than only a final merged menu.

Review the consolidated result against raw source evidence. Check exact names/prices, counts, item-photo associations, asset hashes, unsupported fields, duplicate handling and uncertain claims. An independent reviewer should receive the user's scope and artifacts without a requested verdict. Correct findings and re-review changed portions. Report entries with confirmed photo candidates separately from selected/published coverage and total gallery size.
