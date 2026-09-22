import { MapPin, Settings } from "lucide-react";

export default function AddressRequiredModal({ open, onClose, onGoToSettings }) {
  if (!open) return null;

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-card address-required-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delivery-address-heading" style={{ marginBottom: 12 }}>
          <MapPin size={18} />
          <span>Delivery address required</span>
        </div>
        <p className="login-modal-sub" style={{ marginBottom: 20 }}>
          Set your delivery address in Settings before you can place an order.
        </p>
        <div className="address-required-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="add-cart-btn buy-btn login-modal-submit"
            onClick={onGoToSettings}
          >
            <Settings size={16} />
            Go to Settings
          </button>
        </div>
      </div>
    </div>
  );
}
