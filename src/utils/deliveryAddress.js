export function formatDeliveryAddress(address) {
  if (!address) return "—";
  const parts = [
    address.street,
    address.city,
    address.province,
    address.postalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function formatDeliveryRecipient(address) {
  if (!address) return "—";
  const name = address.fullName?.trim();
  const phone = address.phone?.trim();
  if (name && phone) return `${name} · ${phone}`;
  return name || phone || "—";
}

export function deliveryMapUrl(address) {
  if (!address?.lat || !address?.lng) return null;
  return `https://www.google.com/maps?q=${address.lat},${address.lng}`;
}

export const DEFAULT_MAP_CENTER = { lat: 14.5995, lng: 120.9842 };
