export const DEFAULT_MAP_CENTER = { lat: 14.5995, lng: 120.9842 };

export function createEmptyDeliveryAddress() {
  return {
    fullName: "",
    phone: "",
    street: "",
    city: "",
    province: "",
    postalCode: "",
    notes: "",
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  };
}

export function normalizeDeliveryAddress(address) {
  if (!address || typeof address !== "object") return null;
  const lat = Number(address.lat);
  const lng = Number(address.lng);
  return {
    fullName: String(address.fullName || "").trim(),
    phone: String(address.phone || "").trim(),
    street: String(address.street || "").trim(),
    city: String(address.city || "").trim(),
    province: String(address.province || "").trim(),
    postalCode: String(address.postalCode || "").trim(),
    notes: String(address.notes || "").trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

export function validateDeliveryAddress(address) {
  const normalized = normalizeDeliveryAddress(address);
  if (!normalized) {
    return { ok: false, error: "Delivery address is required." };
  }
  if (!normalized.fullName) {
    return { ok: false, error: "Full name is required for delivery." };
  }
  if (!normalized.phone) {
    return { ok: false, error: "Phone number is required for delivery." };
  }
  if (!normalized.street) {
    return { ok: false, error: "Street address is required." };
  }
  if (!normalized.city) {
    return { ok: false, error: "City is required." };
  }
  if (!normalized.province) {
    return { ok: false, error: "Province is required." };
  }
  if (normalized.lat == null || normalized.lng == null) {
    return { ok: false, error: "Pin your delivery location on the map." };
  }
  return { ok: true, address: normalized };
}

export function formatDeliveryAddress(address) {
  const normalized = normalizeDeliveryAddress(address);
  if (!normalized) return "—";
  const parts = [
    normalized.street,
    normalized.city,
    normalized.province,
    normalized.postalCode,
  ].filter(Boolean);
  return parts.join(", ") || "—";
}

export function mapsLink(address) {
  const normalized = normalizeDeliveryAddress(address);
  if (!normalized?.lat || !normalized?.lng) return null;
  return `https://www.google.com/maps?q=${normalized.lat},${normalized.lng}`;
}

function storageKey(userId) {
  return `kamyas-delivery-address:${userId}`;
}

export function getSavedDeliveryAddress(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const check = validateDeliveryAddress(parsed);
    return check.ok ? check.address : null;
  } catch {
    return null;
  }
}

export function saveDeliveryAddress(userId, address) {
  const check = validateDeliveryAddress(address);
  if (!userId || !check.ok) {
    return { ok: false, error: check.error || "Invalid address." };
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(check.address));
  return { ok: true, address: check.address };
}

export function hasSavedDeliveryAddress(userId) {
  return Boolean(getSavedDeliveryAddress(userId));
}

export async function reverseGeocodeAddress(lat, lng) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
    },
  });

  if (!response.ok) {
    throw new Error("Reverse geocoding failed.");
  }

  const data = await response.json();
  const addr = data.address || {};
  const house = addr.house_number || "";
  const road = addr.road || addr.street || "";
  const street =
    [house, road].filter(Boolean).join(" ") ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.hamlet ||
    "";
  const city =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.village ||
    addr.county ||
    "";
  const province = addr.state || addr.province || addr.region || "";
  const postalCode = addr.postcode || "";

  return { street, city, province, postalCode };
}
