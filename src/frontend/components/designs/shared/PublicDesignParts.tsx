import Image from "next/image";
import { CtaGroup } from "@/components/restaurant/CtaGroup";
import { RestaurantMap } from "@/components/restaurant/RestaurantMap";
import Link from "next/link";

import { MenuLink } from "@/components/MenuLink";
import { PhoneLink } from "@/components/phone/PhoneLink";
import { brandLogoVariant } from "@/lib/brand";
import type { PublicImage, PublicRestaurant } from "@/lib/restaurant-contract";

import { BusinessHours, HourIntervals, prepareBusinessHours } from "@/components/restaurant/BusinessHours";

export function DesignSkipLink({ className }: Readonly<{ className: string }>) {
  return <a className={className} href="#main-content">Skip to content</a>;
}

/**
 * The brand link every design puts in its header.
 *
 * The published logo is rendered here rather than in each design so all five pick it up from one
 * place, keeping branding restaurant-specific (PR-20 Task 6) without touching any design's visual
 * character — each supplies its own class for the mark. The logo is decorative: the restaurant name
 * sits beside it in the same link, so a second announcement of the same name would only add noise.
 * Snapshots published before Phase 6 carry `logo: null` and simply render the name alone.
 */
export function HomeLink({
  className,
  restaurantName,
  logo,
  logoClassName,
}: Readonly<{
  className: string;
  restaurantName: string;
  logo?: PublicImage | null;
  logoClassName?: string;
}>) {
  const variant = brandLogoVariant(logo);
  return (
    <Link className={className} href="/" prefetch={false} aria-label={`${restaurantName} home`}>
      {variant ? (
        <Image
          className={logoClassName}
          src={variant.url}
          width={variant.width}
          height={variant.height}
          sizes="3rem"
          alt=""
        />
      ) : null}
      <span>{restaurantName}</span>
    </Link>
  );
}

export function MenuNavigationLink({ className }: Readonly<{ className: string }>) {
  return <MenuLink className={className}>Menu</MenuLink>;
}

/**
 * The header link the menu page shows in place of `MenuNavigationLink`. A "Menu" link on the menu
 * itself pointed back at the page already open, so clicking it only announced "Loading menu…" and
 * never went anywhere; on the menu the useful way out is home.
 */
export function HomeNavigationLink({ className }: Readonly<{ className: string }>) {
  return <Link className={className} href="/" prefetch={false}>Home</Link>;
}

export function RestaurantHeroImage({
  restaurant,
  className,
  sizes,
}: Readonly<{ restaurant: PublicRestaurant | null; className: string; sizes: string }>) {
  const image = restaurant?.mainImage?.variants.at(-1);
  if (!image || !restaurant?.mainImage) return null;
  return (
    <Image
      className={className}
      src={image.url}
      width={image.width}
      height={image.height}
      sizes={sizes}
      alt={restaurant.mainImage.altText}
      priority
    />
  );
}

export function RestaurantActions({
  restaurant,
  className,
  menuClassName,
  actionClassName,
}: Readonly<{
  restaurant: PublicRestaurant | null;
  className: string;
  menuClassName: string;
  actionClassName: string;
}>) {
  return (
    <CtaGroup className={className}>
      <MenuLink className={menuClassName}>Browse the menu</MenuLink>
      {restaurant?.phone ? (
        <PhoneLink
          className={actionClassName}
          e164={restaurant.phone.e164}
          ariaLabel={`Call ${restaurant.phone.display}`}
        >
          Call {restaurant.phone.display}
        </PhoneLink>
      ) : null}
      {restaurant?.address ? (
        <a className={actionClassName} href={restaurant.address.directionsUrl} target="_blank" rel="noreferrer noopener">Directions</a>
      ) : null}
    </CtaGroup>
  );
}

export function MenuRestaurantActions({
  restaurant,
  className,
  actionClassName,
}: Readonly<{
  restaurant: PublicRestaurant | null;
  className: string;
  actionClassName: string;
}>) {
  if (!restaurant?.phone && !restaurant?.address) return null;
  return (
    <nav className={className} aria-label="Restaurant actions">
      {restaurant.phone ? (
        <PhoneLink
          className={actionClassName}
          e164={restaurant.phone.e164}
          ariaLabel={`Call ${restaurant.phone.display}`}
        >
          Call {restaurant.phone.display}
        </PhoneLink>
      ) : null}
      {restaurant.address ? (
        <a className={actionClassName} href={restaurant.address.directionsUrl} target="_blank" rel="noreferrer noopener">Directions</a>
      ) : null}
    </nav>
  );
}

export function RestaurantContact({
  restaurant,
  className,
  linkClassName,
  headingId,
}: Readonly<{
  restaurant: PublicRestaurant;
  className: string;
  linkClassName: string;
  headingId: string;
}>) {
  if (!restaurant.address && !restaurant.email && !restaurant.websiteUrl) return null;
  return (
    <section className={className} aria-labelledby={headingId}>
      <h2 id={headingId}>Visit</h2>
      {restaurant.address ? <address>{restaurant.address.formatted}</address> : null}
      {restaurant.websiteUrl ? <a className={linkClassName} href={restaurant.websiteUrl}>Website</a> : null}
      <RestaurantMap address={restaurant.address} apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY} />
      {restaurant.email ? <a className={linkClassName} href={`mailto:${restaurant.email}`}>{restaurant.email}</a> : null}
    </section>
  );
}

export function RestaurantHours({
  restaurant,
  className,
  headingId,
  listClassName,
}: Readonly<{ restaurant: PublicRestaurant; className: string; headingId: string; listClassName?: string }>) {
  return (
    <section className={className} aria-labelledby={headingId}>
      <h2 id={headingId}>Hours</h2>
      <BusinessHours model={prepareBusinessHours(restaurant.regularHours, restaurant.localDate)} className={listClassName} />
    </section>
  );
}

export function RestaurantSpecialHours({
  restaurant,
  className,
  headingId,
}: Readonly<{ restaurant: PublicRestaurant; className: string; headingId: string }>) {
  const today = restaurant.localDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: restaurant.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const upcoming = restaurant.specialHours.filter((day) => day.date >= today);
  if (upcoming.length === 0) return null;
  return (
    <section className={className} aria-labelledby={headingId}>
      <h2 id={headingId}>Special hours</h2>
      <ul>
        {upcoming.map((day) => (
          <li key={day.date}>
            <strong>{day.date}</strong>: {day.isClosed ? "Closed" : <HourIntervals intervals={day.intervals} />}
            {day.note ? ` — ${day.note}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RestaurantSocialLinks({
  restaurant,
  className,
}: Readonly<{ restaurant: PublicRestaurant; className: string }>) {
  if (restaurant.socialLinks.length === 0) return null;
  return (
    <nav className={className} aria-label="Social media">
      {restaurant.socialLinks.map((link) => (
        <a key={link.platform} href={link.url} rel="noreferrer">{humanize(link.platform)}</a>
      ))}
    </nav>
  );
}

export function DesignFooter({ className, restaurantName }: Readonly<{ className: string; restaurantName: string }>) {
  return <footer className={className}><p>{restaurantName}</p></footer>;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
