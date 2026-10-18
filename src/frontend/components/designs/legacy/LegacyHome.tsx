import { Hero } from "@/components/restaurant/Hero";
import { CtaGroup } from "@/components/restaurant/CtaGroup";
import { About } from "@/components/restaurant/About";
import { MenuLink } from "@/components/MenuLink";
import { PublicShell } from "@/components/PublicShell";
import { CallButton } from "@/components/phone/CallButton";
import { message } from "@/lib/menu-messages";
import type { WebsiteDesignHomeProps } from "../design-contract";
import { DesignGallery } from "../shared/DesignGallery";
import { createDesignClassNames } from "../shared/designClassNames";
import { TenantImage } from "@/components/TenantImage";
import { RestaurantMap } from "@/components/restaurant/RestaurantMap";
import { RestaurantSpecialHours } from "../shared/PublicDesignParts";

import { RestaurantHours } from "../shared/PublicDesignParts";
const styles = createDesignClassNames("legacy-current-v1");

export default function LegacyHome({ restaurant }: WebsiteDesignHomeProps) {
  const image = restaurant?.mainImage?.variants.at(-1);
  const gallery = restaurant?.gallery ?? [];
  return (
    <div data-website-design="legacy-current-v1">
      <PublicShell restaurantName={restaurant?.name} logo={restaurant?.logo}>
        <main className={styles.homeMain} id="main-content">
          <section className={styles.homeCard} aria-labelledby="page-title">
          <Hero headingId="page-title">
          {image ? <TenantImage className={styles.homeImage} src={image.url} variants={restaurant?.mainImage?.variants ?? []} width={image.width} height={image.height} sizes="(max-width: 704px) 100vw, 704px" alt={restaurant?.mainImage?.altText ?? ""} priority /> : null}
          <p className={styles.eyebrow}>Welcome</p>
          <h1 id="page-title">{restaurant?.name ?? message("unnamedRestaurant")}</h1>
          <About description={restaurant?.shortDescription} />
          {restaurant ? <p className={styles.restaurantStatus}><strong>{restaurant.status.label}</strong></p> : null}
          <CtaGroup className={styles.homeActions}>
            <MenuLink className={styles.primaryLink}>Browse the menu</MenuLink>
            {restaurant?.phone ? <CallButton e164={restaurant.phone.e164} display={restaurant.phone.display} /> : null}
          </CtaGroup>
          </Hero>
          {restaurant?.websiteUrl ? <p><a href={restaurant.websiteUrl}>Website</a></p> : null}
          {restaurant?.email ? <p><a href={`mailto:${restaurant.email}`}>{restaurant.email}</a></p> : null}
          {restaurant?.address ? <address className={styles.restaurantAddress}><span>{restaurant.address.formatted}</span><a href={restaurant.address.directionsUrl} target="_blank" rel="noreferrer noopener">Get directions</a></address> : null}
          <RestaurantMap address={restaurant?.address ?? null} apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY} />
          {restaurant ? <RestaurantHours restaurant={restaurant} className="" listClassName={styles.publicHours} headingId="public-hours" /> : null}
          {restaurant ? <RestaurantSpecialHours restaurant={restaurant} className={styles.specialSection} headingId="public-special" /> : null}
          {restaurant && gallery.length > 0 ? <DesignGallery photos={gallery} classes={styles} headingId="legacy-gallery" restaurantName={restaurant.name} /> : null}
          {restaurant && restaurant.socialLinks.length > 0 ? <nav aria-label="Social media" className={styles.publicSocial}>{restaurant.socialLinks.map((link) => <a key={link.platform} href={link.url} rel="noreferrer">{link.platform}</a>)}</nav> : null}
          </section>
        </main>
      </PublicShell>
    </div>
  );
}
