import type { PublicRestaurant } from "@/lib/restaurant-contract";

export function RestaurantMap({ address, apiKey }: Readonly<{
  address: PublicRestaurant["address"];
  apiKey?: string;
}>) {
  if (!apiKey || !address || address.latitude == null || address.longitude == null) return null;
  const query = new URLSearchParams({ key: apiKey, q: `${address.latitude},${address.longitude}` });
  return <iframe
    src={`https://www.google.com/maps/embed/v1/place?${query}`}
    title={`Map of ${address.formatted}`}
    loading="lazy"
    referrerPolicy="strict-origin-when-cross-origin"
    style={{ width: "100%", maxWidth: "100%", height: "300px", border: 0 }}
    allowFullScreen
  />;
}
