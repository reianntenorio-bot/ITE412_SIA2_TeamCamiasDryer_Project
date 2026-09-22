import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { DEFAULT_MAP_CENTER } from "../utils/deliveryAddress";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function OrderDeliveryMap({ lat, lng }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const startLat = lat ?? DEFAULT_MAP_CENTER.lat;
    const startLng = lng ?? DEFAULT_MAP_CENTER.lng;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      dragging: true,
    }).setView([startLat, startLng], lat != null && lng != null ? 16 : 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    if (lat != null && lng != null) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;

    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }

    mapRef.current.setView([lat, lng], 16);
  }, [lat, lng]);

  if (lat == null || lng == null) {
    return (
      <div className="order-delivery-map-empty">
        No map pin saved for this order.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="order-delivery-map"
      aria-label="Delivery location map"
    />
  );
}
