import { MapPin } from "lucide-react";
import DeliveryMap from "./DeliveryMap";

export default function DeliveryAddressForm({ address, onChange }) {
  const setField = (field) => (event) => {
    onChange({ ...address, [field]: event.target.value });
  };

  const handleLocationChange = (lat, lng, patch = {}) => {
    onChange((prev) => ({ ...prev, lat, lng, ...patch }));
  };

  return (
    <div className="delivery-address-section">
      <div className="delivery-address-heading">
        <MapPin size={16} />
        <span>Delivery Address</span>
      </div>

      <DeliveryMap
        lat={address.lat}
        lng={address.lng}
        onLocationChange={handleLocationChange}
      />

      <div className="delivery-address-grid">
        <label className="delivery-field delivery-field-full">
          <span>Full name</span>
          <input
            type="text"
            value={address.fullName}
            onChange={setField("fullName")}
            placeholder="Juan Dela Cruz"
            required
          />
        </label>

        <label className="delivery-field delivery-field-full">
          <span>Phone</span>
          <input
            type="tel"
            value={address.phone}
            onChange={setField("phone")}
            placeholder="09XX XXX XXXX"
            required
          />
        </label>

        <label className="delivery-field delivery-field-full">
          <span>Street / house no. / building</span>
          <input
            type="text"
            value={address.street}
            onChange={setField("street")}
            placeholder="123 Main St, Brgy. Sample"
            required
          />
        </label>

        <label className="delivery-field">
          <span>City / Municipality</span>
          <input
            type="text"
            value={address.city}
            onChange={setField("city")}
            placeholder="Cebu City"
            required
          />
        </label>

        <label className="delivery-field">
          <span>Province</span>
          <input
            type="text"
            value={address.province}
            onChange={setField("province")}
            placeholder="Cebu"
            required
          />
        </label>

        <label className="delivery-field">
          <span>Postal code</span>
          <input
            type="text"
            value={address.postalCode}
            onChange={setField("postalCode")}
            placeholder="6000"
          />
        </label>

        <label className="delivery-field delivery-field-full">
          <span>Delivery notes (optional)</span>
          <input
            type="text"
            value={address.notes}
            onChange={setField("notes")}
            placeholder="Landmark, gate code, etc."
          />
        </label>
      </div>
    </div>
  );
}
