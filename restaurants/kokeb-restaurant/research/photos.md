# Kokeb Restaurant: photos (collected 2026-11-01, America/Winnipeg)

Rights for every image below: unknown, platform/customer image, owner to confirm.

Sources checked in a browser:
- SkipTheDishes https://skipthedishes.com/kokeb: no item photos at all; only a store banner and a 75 px logo.
- DoorDash https://www.doordash.com/en-US/store/kokeb-restaurant-winnipeg-341816 and its storefront
  https://order.online/store/341816: 8 of 31 item cards carry a photo; store header and square logo.
  Each card's photo was read from the `<img>` inside that card (`data-anchor-id="MenuItem"`), and the
  same URL appeared on the card in both "Most Ordered"/featured and its own category.
- Originals downloaded from `https://doordash-static.s3.amazonaws.com/media/...` (the path behind the
  `img.cdn4dd.com` resize URLs on the cards).

The six item photos of food (Kokeb Mix, Veggie Combo, Tibs, Cha Cha, Doro Tibs, Samosa) are one
professional shoot on the same table and cutlery, so they appear to be merchant-supplied.

## Used in restaurant.json

| Use | Menu item | Source page | Original image URL | File | Size | Bytes | SHA-256 | Class |
|---|---|---|---|---|---|---|---|---|
| dish, mainImage, gallery | Cha Cha | order.online/store/341816 (Main Dishes card); also the DoorDash store header | https://doordash-static.s3.amazonaws.com/media/photos/be0c2a88-b321-4518-9056-8b22de0703f5-retina-large.jpg (header: .../media/store/header/ee47c1ef-dc4f-4b37-ba45-0a4ad161fe24.jpg, byte-identical) | photos/cha-cha.jpg | 1600x900 | 1242573 | 83eb95945219376fb2153589cd157a562b6220c606f93b6e1a2af88af6577a16 | confirmed |
| dish, gallery | Kokeb Mix (serves 2 people) | order.online/store/341816 (Combos card) | https://doordash-static.s3.amazonaws.com/media/photos/110120b1-62ca-42ec-bcd6-0d6971993381-retina-large.jpg | photos/kokeb-mix.jpg | 1600x900 | 1452777 | 9e7f9e0645dc5ec76d221f67dbe065f09e647f5cd5839f324a06dc9a9b4d1bbd | confirmed |
| dish, gallery | Veggie Combo (serves 1 person) | order.online/store/341816 (Combos card) | https://doordash-static.s3.amazonaws.com/media/photos/75cb203e-f995-4f63-8354-52c9a896902c-retina-large.jpg | photos/veggie-combo.jpg | 1600x900 | 1406230 | f84d49a713774206102570616ae06aa990d3d7efb8ceaef1242c22f94ee018d5 | confirmed |
| dish, gallery | Samosa | order.online/store/341816 (Appetizers card) | https://doordash-static.s3.amazonaws.com/media/photos/6d3d45e6-6c85-4601-918f-4368161ce261-retina-large.jpg | photos/samosa.jpg | 1600x900 | 986844 | 4600e2b4a02841e73369a66786773933a5784a2fc571430c07588a7b4ae0709b | confirmed |
| dish | Canned Soda (355 ml) | order.online/store/341816 (Beverages card) | https://doordash-static.s3.amazonaws.com/media/photos/175d86be-0550-40ba-912e-32c667978cae-retina-large-jpeg | photos/canned-soda.jpg | 4000x2250 | 559198 | 0e35f1c4ee3cee444f50d1de6068e94733c5320ea0d0f2c7235c835e070ef561 | confirmed (generic platform beverage photo of a Coca-Cola can; the item is assorted soda) |
| logo | - | DoorDash store page (store logo) | https://doordash-static.s3.amazonaws.com/media/restaurant/cover_square/eb35ef8d-3a73-4f51-b4aa-1192bdee8ce0.png | photos/logo.png | 230x230 | 5423 | 8d79f26c72652a6cd3cd52cee9cf87d20c3536c58564b2c50374a02ffb366b18 | confirmed (text logo "KOKEB Ethiopian Restaurant" on brown) |

Notes:
- The Samosa photo also shows two stuffed jalapenos (likely Siening Kariya), but it is attached only to
  the Samosa card, so it is not used for Siening Kariya.
- The Kokeb Mix photo is used for the 2-person combo even though Skip's and DoorDash's wording differ
  slightly; it is the same item.

## Found but not used

| Menu item | Source | Original image URL | Size | Bytes | SHA-256 | Class | Why not used |
|---|---|---|---|---|---|---|---|
| Tibs | order.online/store/341816 (Main Dishes card) | https://doordash-static.s3.amazonaws.com/media/photos/f3c83ad3-ef3c-43f3-9ff2-153b7f83825b-retina-large.jpg | 1600x900 | 1121862 | 3f7cdfb05815f1b70f93a23510b3baac96e697ed2d7e6523a116590364a1acee | probable (attached, but disputed) | Shows beef pieces in a thin red berbere sauce with pepper strips, i.e. a stew. The menu describes Tibs as sauteed beef/lamb, and the same shoot's Kokeb Mix shows Kokeb's tibs as dry browned cubes. Looks like it may be the Qeye Wot photo on the wrong card. Owner to confirm. |
| Doro Tibs | order.online/store/341816 (Main Dishes card) | https://doordash-static.s3.amazonaws.com/media/photos/9ce93bcc-9d47-4da6-ad24-dad92312d5fc-retina-large.jpg | 1600x900 | 1261011 | dab55f2d06de6a86418f005fdec79a71a6cce21620d923ecff668b38c47b8760 | probable (attached, but disputed) | Shows a dark red chicken stew with three hard-boiled eggs. Doro Tibs (sauteed chicken) has no egg; Doro Wot's description is "served with hard-boiled egg". Likely the Doro Wot photo on the wrong card; not moved to Doro Wot because that would be matching by appearance. Owner to confirm. |
| Bottle of Water | order.online/store/341816 (Beverages card) | https://doordash-static.s3.amazonaws.com/media/photosV2/697d3dbe-a5f9-4a8d-a161-3b49746cdd27-retina-large.JPEG | 230x129 | 3328 | 74841c1ea45a76a2854bf6c0a81a0ffc4d1dc10751d021e7bc405ae7da070f30 | confirmed | Too small to display (230x129); generic Nestle Pure Life bottle. |
| (store banner) | SkipTheDishes store page | https://static.skipthedishes.com/kokeb-menu-image-large-1493824391228.jpg | 1400x1400 | 221983 | 35c633e6a94badcfed07b937d758cc7a75403448977260e471d051cec9732a5c | unlabelled | Large Ethiopian platter on a mesob, uploaded 2017. Not shot with the DoorDash set, and nothing ties it to Kokeb (could be a stock photo); the DoorDash header was preferred for mainImage. |
| (logo) | SkipTheDishes store page | https://static.skipthedishes.com/kokeb-list-image-web-1523638405012.png | 75x75 | 3908 | 603c369a7ec9220be11f02a5d27a442b99be39c625e3ef2a52c5629c0a621b0a | confirmed | Older flame-style "KOKEB RESTAURANT" logo, too small; DoorDash's 230 px logo used instead. |

Not reviewed: the Google Maps photos (108 on the listing, 20 mirrored on spinach.guide). They are
unlabelled, and the DoorDash merchant shoot already covers main and gallery images.

Duplicate screening: exact SHA-256 comparison only (no perceptual comparison tool available). The
only duplicate is the DoorDash store header = Cha Cha photo.

## Missing-photo checklist (25 of 30 items have no photo)

Appetizers
- [ ] Siening Kariya
- [ ] French Fries
- [ ] Chicken Wings with Fries
- [ ] Chicken Fingers with Fries

Main Dishes
- [ ] Tibs (DoorDash photo disputed, see above)
- [ ] Yegel Tibs
- [ ] Doro Tibs (DoorDash photo disputed, see above)
- [ ] Kitfo
- [ ] Dulet Kitfo
- [ ] Kitfo Very Lean Minced Beef
- [ ] Gored Gored
- [ ] Qeye Wot
- [ ] Doro Wot
- [ ] Qunta Firfir
- [ ] Kokeb Rice

Vegetarian
- [ ] Misir
- [ ] Kik Alecha
- [ ] Tikil Gomen
- [ ] Difin Misir
- [ ] Qeye Seir
- [ ] Dinich Wot
- [ ] Shiro

Combos
- [ ] Kornis (serves 2 people)

Beverages
- [ ] Bottle of Water (DoorDash photo too small)
- [ ] Juice
