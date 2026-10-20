"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { formatPrice } from "@/lib/format-price";
import type { PublicBadge, PublicCategory, PublicDish, PublicMedia } from "@/lib/menu-contract";
import { message } from "@/lib/menu-messages";
import { tenantMediaLoader } from "@/lib/tenant-media";

export type DesignMenuClasses = Readonly<{
  browser: string;
  categoryNav: string;
  categoryStrip: string;
  categoryLink: string;
  panels: string;
  panel: string;
  categoryHeading: string;
  emptyCategory: string;
  dishGrid: string;
  dishCard: string;
  unavailableCard: string;
  mediaFrame: string;
  mediaPlaceholder: string;
  dishBody: string;
  dishHeading: string;
  price: string;
  unavailable: string;
  description: string;
  badges: string;
  badge: string;
  allergenBadge: string;
}>;

type DesignMenuBrowserProps = Readonly<{
  categories: readonly PublicCategory[];
  locale: string;
  currency: string;
  classes: DesignMenuClasses;
}>;

const selectionEvent = "menu-selection";
const subscribeToHydration = () => () => undefined;
const hydratedSnapshot = () => true;
const serverHydratedSnapshot = () => false;
const locationSnapshot = () => window.location.hash;
const serverLocationSnapshot = () => "";

/**
 * Below this width the menu reads as one continuous page: every category stays shown, a tab jumps to
 * its category, and scrolling moves the highlight. At and above it, one category shows at a time.
 * `48rem` is the width the dish photo `sizes` hint below already treats as a phone.
 */
const continuousLayoutQuery = "(width < 48rem)";
const layoutSnapshot = () => window.matchMedia(continuousLayoutQuery).matches;
const serverLayoutSnapshot = () => false;

const badgeRegistry: Readonly<Record<string, string>> = {
  vegetarian: "menu.badge.vegetarian",
  vegan: "menu.badge.vegan",
  gluten_free: "menu.badge.glutenFree",
  dairy_free: "menu.badge.dairyFree",
  halal: "menu.badge.halal",
  spicy: "menu.badge.spicy",
  contains_nuts: "menu.badge.containsNuts",
  popular: "menu.badge.popular",
  new: "menu.badge.new",
};

function subscribeToLayout(callback: () => void) {
  const query = window.matchMedia(continuousLayoutQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

const serverScrollSnapshot = () => null;
/** Input that means the reader is scrolling on their own, which ends a tab tap's pending scroll. */
const readerInput = ["wheel", "touchstart", "keydown"] as const;

function subscribeToScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  window.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("scroll", callback);
    window.removeEventListener("resize", callback);
  };
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** How much of the top of the viewport the sticky category nav covers once it has stuck. */
function stickyNavOffset(nav: HTMLElement | null): number {
  if (!nav) return 0;
  const stickyTop = Number.parseFloat(window.getComputedStyle(nav).top);
  return nav.getBoundingClientRect().height + (Number.isFinite(stickyTop) ? stickyTop : 0);
}

function subscribeToLocation(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(selectionEvent, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(selectionEvent, callback);
  };
}

export function DesignMenuBrowser({ categories, locale, currency, classes }: DesignMenuBrowserProps) {
  const enhanced = useSyncExternalStore(subscribeToHydration, hydratedSnapshot, serverHydratedSnapshot);
  const hash = useSyncExternalStore(subscribeToLocation, locationSnapshot, serverLocationSnapshot);
  // `useSyncExternalStore` fires on every hashchange, popstate, and in-page selection, and the large
  // fixture puts 30 categories behind this. Resolving the slug in a memo keeps the scan off the path
  // that the category-switch budget measures; the render below then only has to compare strings.
  const { selectedSlug, invalidHash } = useMemo(() => {
    const firstSlug = categories[0]?.slug ?? null;
    const requestedSlug = hash.startsWith("#") ? hash.slice(1) : "";
    const resolved = categories.some((category) => category.slug === requestedSlug) ? requestedSlug : firstSlug;
    return {
      selectedSlug: resolved,
      invalidHash: requestedSlug.length > 0 && requestedSlug !== resolved,
    };
  }, [categories, hash]);

  useEffect(() => {
    if (!invalidHash) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }, [invalidHash]);

  const continuous = useSyncExternalStore(subscribeToLayout, layoutSnapshot, serverLayoutSnapshot) && enhanced;
  // Held in state rather than a ref so the scroll position read below re-reads once the nav mounts.
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Continuous layout: the category in view is the last one whose panel has reached the sticky nav.
  const categoryInView = useCallback(() => {
    if (!continuous || categories.length < 2) return null;
    const scroller = document.scrollingElement ?? document.documentElement;
    // At the very bottom a short last category may never reach the nav; it is still the one in view.
    if (window.innerHeight + window.scrollY >= scroller.scrollHeight - 1) return categories[categories.length - 1].slug;
    const line = stickyNavOffset(nav) + 1;
    let current = categories[0].slug;
    for (const category of categories) {
      const panel = document.getElementById(`category-panel-${category.id}`);
      if (!panel || panel.getBoundingClientRect().top > line) break;
      current = category.slug;
    }
    return current;
  }, [continuous, categories, nav]);
  const scrolledSlug = useSyncExternalStore(subscribeToScroll, categoryInView, serverScrollSnapshot);

  // Set by a tab tap while the page scrolls to that category, so the categories it passes on the way
  // do not flash in the nav. Cleared once the target is reached or the reader scrolls on their own.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingSlug) return;
    const settle = () => {
      if (categoryInView() === pendingSlug) setPendingSlug(null);
    };
    const release = () => setPendingSlug(null);
    window.addEventListener("scroll", settle, { passive: true });
    for (const type of readerInput) window.addEventListener(type, release, { passive: true });
    return () => {
      window.removeEventListener("scroll", settle);
      for (const type of readerInput) window.removeEventListener(type, release);
    };
  }, [pendingSlug, categoryInView]);

  const activeSlug = continuous ? pendingSlug ?? scrolledSlug ?? selectedSlug : selectedSlug;

  const scrollToCategory = useCallback(
    (slug: string) => {
      const category = categories.find((item) => item.slug === slug);
      const panel = category ? document.getElementById(`category-panel-${category.id}`) : null;
      if (!panel) return;
      const top = window.scrollY + panel.getBoundingClientRect().top - stickyNavOffset(nav);
      window.scrollTo({ top, behavior: scrollBehavior() });
    },
    [categories, nav],
  );

  // Continuous layout: a tap, a back/forward step and a deep link all arrive as a hash. The page
  // scrolls to that category, measuring the sticky nav so it never covers the category heading.
  useEffect(() => {
    if (!continuous || !hash.startsWith("#") || invalidHash || !selectedSlug) return;
    scrollToCategory(selectedSlug);
  }, [continuous, hash, invalidHash, selectedSlug, scrollToCategory]);

  // Keeps the highlighted tab in view. Only the tab strip scrolls: `scrollIntoView` used to do this,
  // and it also scrolls every scrollable ancestor, the page included, which shifted the page sideways.
  useEffect(() => {
    const strip = stripRef.current;
    const category = categories.find((item) => item.slug === activeSlug);
    if (!enhanced || !strip || !category || strip.scrollWidth <= strip.clientWidth) return;
    const link = strip.querySelector<HTMLElement>(`[aria-controls="category-panel-${category.id}"]`);
    if (!link) return;
    const stripBox = strip.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    const left = strip.scrollLeft + (linkBox.left - stripBox.left) - (stripBox.width - linkBox.width) / 2;
    strip.scrollTo({ left, behavior: scrollBehavior() });
  }, [enhanced, activeSlug, categories]);

  function selectCategory(event: MouseEvent<HTMLAnchorElement>, slug: string) {
    event.preventDefault();
    if (continuous) setPendingSlug(slug);
    if (window.location.hash !== `#${slug}`) {
      window.history.pushState({ category: slug }, "", `#${slug}`);
      window.dispatchEvent(new Event(selectionEvent));
    } else if (continuous) {
      // The hash is unchanged, so the effect above will not run: the reader scrolled away and tapped again.
      scrollToCategory(slug);
    }
  }

  return (
    <div
      className={classes.browser}
      data-enhanced={enhanced ? "true" : "false"}
      data-layout={continuous ? "continuous" : "tabs"}
    >
      {categories.length > 1 ? (
        <nav className={classes.categoryNav} aria-label={message("categories")} ref={setNav}>
          <div className={classes.categoryStrip} ref={stripRef}>
            {categories.map((category) => {
              const selected = activeSlug === category.slug;
              return (
                <a
                  className={classes.categoryLink}
                  data-selected={enhanced && selected ? "true" : "false"}
                  aria-current={enhanced && selected ? "true" : undefined}
                  aria-controls={`category-panel-${category.id}`}
                  // A real URL, not a fragment, so a crawler discovers every category page from
                  // /menu (PR-19 Task 6). The click handler still switches panels in place and
                  // pushes the `#slug` hash, so the interactive behavior is unchanged and
                  // `/menu#slug` deep links keep working.
                  href={`/menu/${encodeURIComponent(category.slug)}`}
                  key={category.id}
                  onClick={(event) => selectCategory(event, category.slug)}
                >
                  {category.name}
                </a>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div className={classes.panels}>
        {categories.map((category, categoryIndex) => (
          <section
            className={classes.panel}
            id={`category-panel-${category.id}`}
            key={category.id}
            aria-labelledby={`category-heading-${category.id}`}
            hidden={enhanced && !continuous && selectedSlug !== category.slug}
          >
            <div className={classes.categoryHeading} id={category.slug}>
              <h2 id={`category-heading-${category.id}`}>{category.name}</h2>
              {category.description ? <p>{category.description}</p> : null}
            </div>
            {category.dishes.length === 0 ? (
              <p className={classes.emptyCategory} role="status">{message("emptyCategory")}</p>
            ) : (
              <div className={classes.dishGrid}>
                {category.dishes.map((dish, dishIndex) => (
                  <DesignDish
                    classes={classes}
                    currency={currency}
                    dish={dish}
                    key={dish.id}
                    locale={locale}
                    eager={categoryIndex === 0 && dishIndex === 0}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

type DesignDishProps = Readonly<{
  dish: PublicDish;
  locale: string;
  currency: string;
  classes: DesignMenuClasses;
  eager: boolean;
}>;

/**
 * Every dish stays mounted — non-selected panels are hidden, never unmounted, because a crawler has
 * to find all of them in the markup (README ruling 6). That makes a category switch a re-render of
 * 1,000 cards, none of which can have changed: their props come from the published snapshot and from
 * a module-level class map. Memoizing turns that re-render into 1,000 prop comparisons and stops the
 * price formatting, the badge mapping, and the media lookup from running again.
 */
function DesignDishCard({
  dish,
  locale,
  currency,
  classes,
  eager,
}: DesignDishProps) {
  const unavailable = dish.availability === "unavailable";
  const headingId = `dish-${dish.id}`;
  const unavailableId = `dish-status-${dish.id}`;
  return (
    <article
      className={`${classes.dishCard} ${unavailable ? classes.unavailableCard : ""}`}
      aria-labelledby={headingId}
      aria-describedby={unavailable ? unavailableId : undefined}
    >
      <DesignDishMedia classes={classes} dishName={dish.name} media={dish.media} eager={eager} />
      <div className={classes.dishBody}>
        <div className={classes.dishHeading}>
          <h3 id={headingId}>{dish.name}</h3>
          <p className={classes.price}>{formatPrice(dish.price, locale, currency)}</p>
        </div>
        {unavailable ? <p className={classes.unavailable} id={unavailableId} role="status">{message("unavailable")}</p> : null}
        {dish.description ? <p className={classes.description}>{dish.description}</p> : null}
        <DesignBadges badges={dish.badges} classes={classes} />
      </div>
    </article>
  );
}

const DesignDish = memo(DesignDishCard);
DesignDish.displayName = "DesignDish";

function DesignDishMedia({
  media,
  dishName,
  classes,
  eager,
}: Readonly<{
  media: PublicMedia | null;
  dishName: string;
  classes: DesignMenuClasses;
  eager: boolean;
}>) {
  const [failed, setFailed] = useState(false);
  const variant = media?.variants.reduce<PublicMedia["variants"][number] | null>(
    (largest, item) => (!largest || item.width > largest.width ? item : largest),
    null,
  );
  if (!variant || failed) {
    return <div className={classes.mediaPlaceholder} role="img" aria-label={`${dishName}: ${message("imageUnavailable")}`}><span aria-hidden="true">◇</span></div>;
  }
  return (
    // A grid item with an aspect ratio sizes its width from its height instead of stretching, so a
    // design's min-height (12rem on a 3:2 photo makes 18rem) pushed the photo over the dish text.
    <div className={classes.mediaFrame} style={{ aspectRatio: `${variant.width} / ${variant.height}`, width: "100%", minWidth: 0 }}>
      <Image
        src={variant.url}
        loader={tenantMediaLoader(media?.variants ?? [])}
        alt={media?.altText ?? ""}
        width={variant.width}
        height={variant.height}
        sizes="(max-width: 48rem) calc(100vw - 2rem), 36rem"
        priority={eager}
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function DesignBadges({ badges, classes }: Readonly<{ badges: readonly PublicBadge[]; classes: DesignMenuClasses }>) {
  // The registry lookup and the label resolution depend only on the published badge list, which never
  // changes for the life of the page. Without this, switching category re-derived the labels for every
  // badge on every one of the 1,000 dishes.
  const known = useMemo(
    () => badges.flatMap((badge) => {
      const expectedKey = badgeRegistry[badge.code];
      return expectedKey && badge.labelKey === expectedKey ? [{ ...badge, label: message(expectedKey) }] : [];
    }),
    [badges],
  );
  if (known.length === 0) return null;
  return (
    <ul className={classes.badges} aria-label="Dish information">
      {known.map((badge) => (
        <li className={`${classes.badge} ${badge.category === "allergen" ? classes.allergenBadge : ""}`} key={badge.code}>
          {badge.label}
        </li>
      ))}
    </ul>
  );
}
