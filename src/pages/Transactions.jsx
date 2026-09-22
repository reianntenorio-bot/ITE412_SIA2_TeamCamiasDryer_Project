import { useState, useEffect } from "react";
import { ShoppingBag, Trash2, X, MapPin, ExternalLink } from "lucide-react";
import OrderDeliveryMap from "../components/OrderDeliveryMap";
import {
  formatDeliveryAddress,
  formatDeliveryRecipient,
  deliveryMapUrl,
} from "../utils/deliveryAddress";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function Transactions() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`${API_URL}/api/orders`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data);
      setSelectedOrder((current) => {
        if (!current) return null;
        return data.find((order) => order.id === current.id) || null;
      });
    } catch (err) {
      setError(err.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (orderId) => {
    if (!confirm("Delete this cancelled order?")) return;
    setDeletingId(orderId);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setSelectedOrder((current) =>
          current?.id === orderId ? null : current,
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete order");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
        );
        setSelectedOrder((current) =>
          current?.id === orderId ? { ...current, status: newStatus } : current,
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return (
      d.toLocaleDateString() +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const formatPayment = (pm, paymentStatus) => {
    if (pm === "qrph") {
      return paymentStatus === "paid" ? "QR Ph (Paid)" : "QR Ph";
    }
    if (pm === "gcash") {
      return paymentStatus === "paid" ? "GCash (Paid)" : "GCash";
    }
    if (pm === "cod") return "Cash on Delivery (COD)";
    return pm ? String(pm) : "—";
  };

  const itemsSummary = (items) => {
    if (!items?.length) return "—";
    return items.map((i) => `${i.name} × ${i.quantity}`).join(", ");
  };

  const deliveryTableSummary = (address) => {
    if (!address) return "No address";
    const line = formatDeliveryAddress(address);
    const recipient = address.fullName?.trim();
    if (recipient && line !== "—") return `${recipient} — ${line}`;
    return line;
  };

  const stopRowClick = (event) => {
    event.stopPropagation();
  };

  const address = selectedOrder?.deliveryAddress;
  const mapUrl = deliveryMapUrl(address);

  return (
    <div className="settings-page">
      <div className="settings-banner">
        Kamyas Smart Machine for Automated Regulated Temperature
      </div>

      <div className="settings-header">
        <h1 className="settings-title">
          <ShoppingBag
            size={28}
            style={{ display: "inline", marginRight: 10, verticalAlign: "middle" }}
          />
          Transactions
        </h1>
        <p className="settings-subtitle">
          View and update order statuses from customer checkouts. Click a row to
          see full details and delivery map.
        </p>
      </div>

      {error && <div className="manage-products-error">{error}</div>}

      {loading ? (
        <p className="manage-products-loading">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="manage-products-empty">No orders yet.</p>
      ) : (
        <div className="manage-products-table-wrap">
          <table className="manage-products-table transactions-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th>Delivery</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={`transaction-row${
                    selectedOrder?.id === order.id ? " transaction-row-selected" : ""
                  }`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <td>
                    <code className="order-id-cell">#{order.id.slice(0, 8)}</code>
                  </td>
                  <td>{order.userEmail || "—"}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td
                    className="order-items-cell"
                    title={itemsSummary(order.items)}
                  >
                    {itemsSummary(order.items)}
                  </td>
                  <td
                    className="order-delivery-cell"
                    title={deliveryTableSummary(order.deliveryAddress)}
                  >
                    {deliveryTableSummary(order.deliveryAddress)}
                  </td>
                  <td>₱{(order.total || 0).toLocaleString()}</td>
                  <td>{formatPayment(order.paymentMethod, order.paymentStatus)}</td>
                  <td onClick={stopRowClick}>
                    <select
                      value={order.status || "pending"}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value)
                      }
                      disabled={updatingId === order.id}
                      className={`status-select status-${order.status || "pending"}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td onClick={stopRowClick}>
                    {(order.status || "pending") === "cancelled" && (
                      <button
                        type="button"
                        className="transaction-delete-btn"
                        onClick={() => handleDelete(order.id)}
                        disabled={deletingId === order.id}
                        title="Delete cancelled order"
                        aria-label="Delete order"
                      >
                        <Trash2 size={18} />
                        {deletingId === order.id ? "..." : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <div
          className="batch-modal-overlay"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="order-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="batch-modal-header">
              <h3>Order #{selectedOrder.id.slice(0, 8)}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="order-detail-body">
              <section className="order-detail-section">
                <h4>Order summary</h4>
                <div className="order-detail-grid">
                  <div className="order-detail-field">
                    <span>Customer</span>
                    <strong>{selectedOrder.userEmail || "—"}</strong>
                  </div>
                  <div className="order-detail-field">
                    <span>Date</span>
                    <strong>{formatDate(selectedOrder.createdAt)}</strong>
                  </div>
                  <div className="order-detail-field">
                    <span>Payment</span>
                    <strong>{formatPayment(selectedOrder.paymentMethod, selectedOrder.paymentStatus)}</strong>
                  </div>
                  <div className="order-detail-field">
                    <span>Status</span>
                    <select
                      value={selectedOrder.status || "pending"}
                      onChange={(e) =>
                        handleStatusChange(selectedOrder.id, e.target.value)
                      }
                      disabled={updatingId === selectedOrder.id}
                      className={`status-select status-${selectedOrder.status || "pending"}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="order-detail-section">
                <h4>Items</h4>
                <div className="order-detail-items">
                  {(selectedOrder.items || []).map((item) => (
                    <div
                      key={`${item.id}-${item.name}`}
                      className="order-detail-item-row"
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>Qty: {item.quantity}</span>
                      </div>
                      <strong>
                        ₱{((item.price || 0) * (item.quantity || 0)).toLocaleString()}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="order-detail-total">
                  <span>Total</span>
                  <strong>₱{(selectedOrder.total || 0).toLocaleString()}</strong>
                </div>
              </section>

              <section className="order-detail-section">
                <h4>
                  <MapPin size={16} />
                  Delivery address
                </h4>
                {address ? (
                  <>
                    <div className="order-detail-grid">
                      <div className="order-detail-field order-detail-field-full">
                        <span>Recipient</span>
                        <strong>{formatDeliveryRecipient(address)}</strong>
                      </div>
                      <div className="order-detail-field order-detail-field-full">
                        <span>Street</span>
                        <strong>{address.street || "—"}</strong>
                      </div>
                      <div className="order-detail-field">
                        <span>City</span>
                        <strong>{address.city || "—"}</strong>
                      </div>
                      <div className="order-detail-field">
                        <span>Province</span>
                        <strong>{address.province || "—"}</strong>
                      </div>
                      <div className="order-detail-field">
                        <span>Postal code</span>
                        <strong>{address.postalCode || "—"}</strong>
                      </div>
                      <div className="order-detail-field order-detail-field-full">
                        <span>Notes</span>
                        <strong>{address.notes || "—"}</strong>
                      </div>
                    </div>

                    <OrderDeliveryMap lat={address.lat} lng={address.lng} />

                    {mapUrl && (
                      <a
                        className="order-detail-map-link"
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={14} />
                        Open in Google Maps
                      </a>
                    )}
                  </>
                ) : (
                  <p className="order-detail-empty">No delivery address on this order.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transactions;
