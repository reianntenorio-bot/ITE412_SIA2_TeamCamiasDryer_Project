import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { LocateFixed, Loader2 } from "lucide-react";
import { DEFAULT_MAP_CENTER, reverseGeocodeAddress } from "../utils/deliveryAddress";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const LOCATION_ERRORS = {
  1: "Location access denied. Allow location in your browser settings.",
  2: "Could not determine your location.",
  3: "Location request timed out. Try again.",
};

export default function DeliveryMap({ lat, lng, onLocationChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const startLat = lat ?? DEFAULT_MAP_CENTER.lat;
    const startLng = lng ?? DEFAULT_MAP_CENTER.lng;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
    }).setView([startLat, startLng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);

    const emitLocation = (position) => {
      setLocationError("");
      onLocationChangeRef.current(position.lat, position.lng);
    };

    marker.on("dragend", () => emitLocation(marker.getLatLng()));

    map.on("click", (event) => {
      marker.setLatLng(event.latlng);
      emitLocation(event.latlng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markerRef.current || lat == null || lng == null) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current?.panTo([lat, lng]);
  }, [lat, lng]);

  const pinMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported on this device.");
      return;
    }

    setLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        markerRef.current?.setLatLng([latitude, longitude]);
        mapRef.current?.setView([latitude, longitude], 16);

        let addressPatch = {};
        try {
          addressPatch = await reverseGeocodeAddress(latitude, longitude);
        } catch {
          setLocationError("Location pinned, but address lookup failed. Fill in the fields manually.");
        }

        onLocationChangeRef.current(latitude, longitude, addressPatch);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationError(LOCATION_ERRORS[error.code] || "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="delivery-map-wrap">
      <div className="delivery-map-container">
        <div ref={containerRef} className="delivery-map" aria-label="Delivery location map" />
        <button
          type="button"
          className="delivery-map-locate-btn"
          onClick={pinMyLocation}
          disabled={locating}
        >
          {locating ? (
            <Loader2 size={16} className="icon-spin" aria-hidden="true" />
          ) : (
            <LocateFixed size={16} aria-hidden="true" />
          )}
          {locating ? "Finding you…" : "Pin my location"}
        </button>
      </div>
      <p className="delivery-map-hint">
        Pin my location to auto-fill your address, or tap the map and drag the pin to adjust.
      </p>
      {locationError && (
        <p className="delivery-map-error" role="alert">
          {locationError}
        </p>
      )}
    </div>
  );
}
