import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  Search,
  Home,
  Settings,
  Eye,
  EyeOff,
  LogOut,
  User,
  Package,
  Save,
  Loader2,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";
import DeliveryAddressForm from "../components/DeliveryAddressForm";
import AddressRequiredModal from "../components/AddressRequiredModal";
import { fetchUserOrders } from "../utils/orders";
import { startQrphCheckout, completeQrphCheckout } from "../utils/payments";
import {
  createEmptyDeliveryAddress,
  validateDeliveryAddress,
  formatDeliveryAddress,
  mapsLink,
  getSavedDeliveryAddress,
  saveDeliveryAddress,
  hasSavedDeliveryAddress,
} from "../utils/deliveryAddress";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const PAYMENT_RETURN_TTL_MS = 10 * 60 * 1000;

function clearPaymentSession() {
  sessionStorage.removeItem("kamyas_pending_order");
  sessionStorage.removeItem("kamyas_payment_return");
  sessionStorage.removeItem("kamyas_checkout_started");
}

function markPaymentReturn(pendingOrderId) {
  sessionStorage.setItem("kamyas_pending_order", pendingOrderId);
  sessionStorage.setItem("kamyas_payment_return", String(Date.now()));
}

function shouldConfirmPayment() {
  const pendingOrderId = sessionStorage.getItem("kamyas_pending_order");
  const returnedAt = Number(sessionStorage.getItem("kamyas_payment_return"));
  if (!pendingOrderId || !returnedAt) return false;
  return Date.now() - returnedAt < PAYMENT_RETURN_TTL_MS;
}

function expireStalePaymentSession() {
  const returnedAt = Number(sessionStorage.getItem("kamyas_payment_return"));
  if (!returnedAt || Date.now() - returnedAt >= PAYMENT_RETURN_TTL_MS) {
    clearPaymentSession();
  }
}

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23d1fae5' width='200' height='200'/%3E%3Ctext fill='%23047857' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='16' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Dried Kamias Premium 500g",
    price: 299,
    description: "Premium dried Kamias",
    image: "/kamyas.jpg",
  },
  {
    id: 2,
    name: "Dried Kamias Bulk 2kg",
    price: 999,
    description: "Bulk pack for commercial use",
    image: "/kamyas.jpg",
  },
  {
    id: 3,
    name: "Kamyas Smart Machine",
    price: 14999,
    description: "IoT-enabled automated dryer",
    image: "/kamyas.jpg",
  },
  {
    id: 4,
    name: "Dried Kamias Sample 100g",
    price: 99,
    description: "Try our premium dried Kamias",
    image: "/kamyas.jpg",
  },
  {
    id: 5,
    name: "Dried Kamias Family Pack 1kg",
    price: 549,
    description: "Ideal for family consumption",
    image: "/kamyas.jpg",
  },
  {
    id: 6,
    name: "Drying Rack Set",
    price: 499,
    description: "Stainless steel racks",
    image: "/kamyas.jpg",
  },
];

function Shop() {
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal,
    cartCount,
  } = useCart();
  const { user, loading: authLoading, signOut } = useAuth();

  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [bannerText, setBannerText] = useState(
    "Shop Premium Dried Kamias — Perfect for Snacks & Cooking",
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const [settingsAddress, setSettingsAddress] = useState(createEmptyDeliveryAddress);
  const [savedAddress, setSavedAddress] = useState(null);
  const [addressSaveLoading, setAddressSaveLoading] = useState(false);
  const [addressRequiredOpen, setAddressRequiredOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };
  const [expandedDescId, setExpandedDescId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [ordersSource, setOrdersSource] = useState(null);

  // Auth modal state
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const pendingProductRef = useRef(null);

  const handleHome = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSettings = () => {
    setSettingsOpen(true);
  };

  useEffect(() => {
    if (!user) {
      setSavedAddress(null);
      setSettingsAddress(createEmptyDeliveryAddress());
      return;
    }
    const saved = getSavedDeliveryAddress(user.uid);
    setSavedAddress(saved);
    setSettingsAddress(saved || createEmptyDeliveryAddress());
  }, [user?.uid]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get("payment");
    const pendingOrderId = params.get("pending_order_id");

    setCheckoutLoading(false);

    if (paymentState === "cancelled") {
      clearPaymentSession();
      setPaymentConfirming(false);
      window.history.replaceState({}, "", window.location.pathname);
      showToast("QR Ph payment was cancelled.");
      return;
    }

    if (paymentState === "success" && pendingOrderId) {
      markPaymentReturn(pendingOrderId);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    expireStalePaymentSession();
    setPaymentConfirming(false);
  }, []);

  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      setCheckoutLoading(false);
      if (!shouldConfirmPayment()) {
        setPaymentConfirming(false);
        expireStalePaymentSession();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setProducts(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.bannerText) setBannerText(data.bannerText);
      })
      .catch(() => {});
  }, []);

  const loadOrders = async (showLoading = false) => {
    if (!user) {
      setOrders([]);
      setOrdersError(null);
      return;
    }
    if (showLoading) setOrdersLoading(true);
    const { orders: nextOrders, error, source } = await fetchUserOrders(user);
    setOrders(nextOrders);
    setOrdersError(error);
    setOrdersSource(source);
    if (showLoading) setOrdersLoading(false);
  };

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setOrdersError(null);
      return;
    }

    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), 12000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  useEffect(() => {
    if (ordersOpen && user) {
      loadOrders(true);
    }
  }, [ordersOpen, user?.uid]);

  useEffect(() => {
    if (!user) {
      setPaymentConfirming(false);
      return;
    }

    if (!shouldConfirmPayment()) {
      setPaymentConfirming(false);
      return;
    }

    const pendingOrderId = sessionStorage.getItem("kamyas_pending_order");
    if (!pendingOrderId) {
      setPaymentConfirming(false);
      return;
    }

    let cancelled = false;
    const confirmPayment = async () => {
      setPaymentConfirming(true);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (cancelled) return;
        try {
          await completeQrphCheckout(pendingOrderId);
          clearPaymentSession();
          await loadOrders(false);
          setCheckoutSuccess(true);
          clearCart();
          setCartOpen(false);
          showToast("Payment successful! Your order has been placed.");
          setTimeout(() => setCheckoutSuccess(false), 2500);
          setPaymentConfirming(false);
          return;
        } catch (err) {
          const unpaid = err.status === 402;
          const notFound = err.status === 404;
          const stopRetrying =
            notFound ||
            (unpaid && attempt >= 2) ||
            attempt === 4;

          if (stopRetrying) {
            clearPaymentSession();
            setPaymentConfirming(false);
            if (!unpaid) {
              showToast(
                err.message ||
                  "Payment confirmation failed. Please try checkout again.",
              );
            }
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    };

    confirmPayment();
    return () => {
      cancelled = true;
      setPaymentConfirming(false);
    };
  }, [user?.uid]);

  const runCheckout = async (items, total) => {
    if (!items.length) return;
    if (!user) {
      showToast("Please sign in to checkout");
      setLoginModalOpen(true);
      return;
    }

    if (!hasSavedDeliveryAddress(user.uid)) {
      setAddressRequiredOpen(true);
      return false;
    }

    const address = savedAddress || getSavedDeliveryAddress(user.uid);
    const addressCheck = validateDeliveryAddress(address);
    if (!addressCheck.ok) {
      setAddressRequiredOpen(true);
      return false;
    }

    setCheckoutLoading(true);
    try {
      const { checkoutUrl } = await startQrphCheckout({
        userId: user.uid,
        userEmail: user.email,
        storeUrl: window.location.origin,
        items: items.map(({ id, name, price, image, quantity }) => ({
          id,
          name,
          price,
          image,
          quantity,
        })),
        total,
        deliveryAddress: addressCheck.address,
      });
      sessionStorage.setItem("kamyas_checkout_started", "1");
      window.location.href = checkoutUrl;
      return true;
    } catch (err) {
      console.error("Checkout error:", err);
      showToast(err.message || "Could not start QR Ph payment.");
      setCheckoutLoading(false);
      return false;
    }
  };

  const handleCheckout = async () => {
    await runCheckout(cart, cartTotal);
  };

  const handleAddToCart = (product) => {
    if (!user) {
      pendingProductRef.current = product;
      setLoginModalOpen(true);
      return;
    }
    addToCart(product);
    showToast(`Added ${product.name} to cart`);
  };

  const handleProductClick = () => {
    setCartOpen(true);
  };

  useEffect(() => {
    if (!user || !pendingProductRef.current) return;

    const product = pendingProductRef.current;
    pendingProductRef.current = null;

    addToCart(product);
    showToast(`Added ${product.name} to cart`);
  }, [user?.uid]);

  const openSettingsForAddress = () => {
    setAddressRequiredOpen(false);
    setCartOpen(false);
    setSettingsOpen(true);
  };

  const handleSaveAddress = () => {
    if (!user) return;
    setAddressSaveLoading(true);
    const result = saveDeliveryAddress(user.uid, settingsAddress);
    setAddressSaveLoading(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    setSavedAddress(result.address);
    setSettingsAddress(result.address);
    showToast("Delivery address saved.");
  };

  const handleLoginSuccess = () => {
    setLoginModalOpen(false);
  };

  const handleLoginModalClose = () => {
    setLoginModalOpen(false);
    pendingProductRef.current = null;
  };

  const truncateEmail = (email) => {
    if (!email) return "";
    if (email.length <= 20) return email;
    const [local, domain] = email.split("@");
    return `${local.slice(0, 8)}…@${domain}`;
  };

  const CARD_COLORS = ["#ede9fe", "#fef9c3", "#dcfce7", "#ffedd5", "#dbeafe"];

  return (
    <div className="shop-page">
      {/* Mobile-only user bar */}
      {!authLoading && (
        <div className="mobile-user-bar">
          {user ? (
            <span className="user-email-badge" title={user.email}>
              <User size={12} style={{ display: "inline", marginRight: 4 }} />
              <button
                type="button"
                className="user-settings-icon-btn"
                onClick={handleSettings}
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={12} />
              </button>
              <span className="user-email-text">{truncateEmail(user.displayName || user.email)}</span>
            </span>
          ) : (
            <button
              type="button"
              className="sign-in-link-btn"
              onClick={() => setLoginModalOpen(true)}
            >
              Sign in
            </button>
          )}
        </div>
      )}

      <div className="shop-banner-row shop-banner-desktop">
        <div className="shop-banner">{bannerText}</div>
        {!authLoading && (
          user ? (
            <div className="user-indicator">
              <span className="user-email-badge" title={user.email}>
                <User size={12} style={{ display: "inline", marginRight: 4 }} />
                <button
                  type="button"
                  className="user-settings-icon-btn"
                  onClick={handleSettings}
                  title="Settings"
                  aria-label="Settings"
                >
                  <Settings size={12} />
                </button>
                <span className="user-email-text">{truncateEmail(user.displayName || user.email)}</span>
              </span>
              <button
                type="button"
                className="sign-out-btn"
                onClick={signOut}
                title="Sign out"
              >
                <LogOut size={13} style={{ display: "inline", marginRight: 3 }} />
                Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="sign-in-link-btn"
              onClick={() => setLoginModalOpen(true)}
            >
              Sign in
            </button>
          )
        )}
      </div>

      <header className="shop-header">
        <h1 className="shop-title">K-Smart Store</h1>
        <div className="shop-header-actions">
          <button type="button" className="icon-btn" aria-label="Search">
            <Search size={22} />
          </button>
          <button
            type="button"
            className="icon-btn cart-icon-btn"
            onClick={() => setCartOpen(true)}
            aria-label="Cart"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
        <div className="shop-header-btns">
          <button
            type="button"
            className="cart-toggle-btn"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart size={20} />
            Cart ({cartCount})
          </button>
          {user && (
            <button
              type="button"
              className="cart-toggle-btn"
              onClick={() => setOrdersOpen(true)}
            >
              <Package size={20} />
              My Orders
            </button>
          )}
        </div>
      </header>

      <div className="products-section">
        <h2 className="section-label">Recommendation</h2>
        <div className="products-window">
          <div className="products-grid">
            {loading ? (
              <p className="shop-loading">Loading products...</p>
            ) : (
              products.map((product, i) => {
                const showDesc = expandedDescId === product.id;
                return (
                  <div
                    key={product.id}
                    className="product-card product-card-clickable"
                    style={{ "--card-bg": CARD_COLORS[i % CARD_COLORS.length] }}
                    role="button"
                    tabIndex={0}
                    onClick={handleProductClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleProductClick();
                      }
                    }}
                    aria-label={`Open cart for ${product.name}`}
                  >
                    <div className="product-image">
                      <img
                        src={product.image || PLACEHOLDER_IMG}
                        alt={product.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = PLACEHOLDER_IMG;
                        }}
                      />
                    </div>
                    <div className="product-info">
                      <div className="product-name-row">
                        <h3 className="product-name">{product.name}</h3>
                        <button
                          type="button"
                          className="eye-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDescId(showDesc ? null : product.id);
                          }}
                          title={
                            showDesc ? "Hide description" : "Show description"
                          }
                          aria-label={
                            showDesc ? "Hide description" : "Show description"
                          }
                        >
                          {showDesc ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p
                        className={`product-desc product-desc-desktop ${showDesc ? "product-desc-visible" : ""}`}
                      >
                        {product.description}
                      </p>
                      <div className="product-footer">
                        <span className="product-price">
                          ₱{product.price.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          className="add-cart-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product);
                          }}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <nav className="bottom-nav">
        <button type="button" className="nav-item" onClick={handleHome}>
          <Home size={24} />
          <span>Home</span>
        </button>
        <button
          type="button"
          className="nav-item"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart size={24} />
          <span>Cart</span>
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </button>
        {user && (
          <button
            type="button"
            className="nav-item"
            onClick={() => setOrdersOpen(true)}
          >
            <Package size={24} />
            <span>My Orders</span>
          </button>
        )}
        <button type="button" className="nav-item" onClick={handleSettings}>
          <Settings size={24} />
          <span>Settings</span>
        </button>
      </nav>

      {cartOpen && (
        <div className="cart-overlay" onClick={() => setCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2>Your Cart ({cartCount})</h2>
              <button
                type="button"
                className="cart-close-btn"
                onClick={() => setCartOpen(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="cart-body">
              {cart.length === 0 ? (
                <p className="cart-empty">Your cart is empty</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-image">
                        <img
                          src={item.image || PLACEHOLDER_IMG}
                          alt={item.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = PLACEHOLDER_IMG;
                          }}
                        />
                      </div>
                      <div className="cart-item-details">
                        <span className="cart-item-name">{item.name}</span>
                        <span className="cart-item-price">
                          ₱{item.price.toLocaleString()} each
                        </span>
                        <div className="cart-item-actions">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            className="cart-remove-btn"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <span className="cart-item-total">
                        ₱{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-total-row">
                  <span>Total</span>
                  <span className="cart-total">
                    ₱{cartTotal.toLocaleString()}
                  </span>
                </div>
                <div className="cart-payment-section">
                  <span className="cart-payment-label">Payment method</span>
                  <div className="cart-payment-option cart-payment-qrph">
                    <span className="qrph-badge">QR</span>
                    <span>
                      <strong>QR Ph</strong>
                      <small>Scan with GCash, Maya, or any QR Ph app</small>
                    </span>
                  </div>
                </div>
                {user && savedAddress && (
                  <div className="cart-saved-address">
                    <span className="cart-payment-label">Deliver to</span>
                    <p>{formatDeliveryAddress(savedAddress)}</p>
                    <button
                      type="button"
                      className="cart-edit-address-btn"
                      onClick={() => {
                        setCartOpen(false);
                        setSettingsOpen(true);
                      }}
                    >
                      Edit in Settings
                    </button>
                  </div>
                )}
                {user && !savedAddress && (
                  <p className="cart-address-warning">
                    No delivery address saved. Set your address in Settings before checkout.
                  </p>
                )}
                <button
                  type="button"
                  className="checkout-btn checkout-btn-qrph"
                  onClick={handleCheckout}
                  disabled={checkoutLoading || checkoutSuccess || paymentConfirming || !user}
                >
                  {paymentConfirming ? (
                    <span className="checkout-loader">
                      <span className="checkout-spinner" />
                      Confirming payment...
                    </span>
                  ) : checkoutLoading ? (
                    <span className="checkout-loader">
                      <span className="checkout-spinner" />
                      Redirecting to QR Ph...
                    </span>
                  ) : checkoutSuccess ? (
                    "Order Placed!"
                  ) : !user ? (
                    "Sign in to checkout"
                  ) : (
                    "Pay with QR Ph"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {ordersOpen && user && (
        <div
          className="cart-overlay"
          onClick={() => setOrdersOpen(false)}
        >
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2>My Orders</h2>
              <button
                type="button"
                className="cart-close-btn"
                onClick={() => setOrdersOpen(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="cart-body">
              {ordersLoading ? (
                <p className="cart-empty">Loading orders…</p>
              ) : orders.length === 0 ? (
                <>
                  {ordersError && (
                    <p className="login-modal-error">{ordersError}</p>
                  )}
                  <p className="cart-empty">No orders yet.</p>
                  {import.meta.env.DEV && ordersSource && (
                    <p className="cart-empty" style={{ fontSize: 12, marginTop: 8 }}>
                      Using API: {ordersSource}
                    </p>
                  )}
                </>
              ) : (
                <div className="orders-list">
                  {ordersError && (
                    <p className="login-modal-error">{ordersError}</p>
                  )}
                  {orders.map((order) => (
                    <div key={order.id} className="order-card">
                      <div className="order-card-header">
                        <span className="order-id">#{order.id.slice(0, 8)}</span>
                        <span
                          className={`order-status order-status-${order.status || "pending"}`}
                        >
                          {(order.status || "pending").charAt(0).toUpperCase() +
                            (order.status || "pending").slice(1)}
                        </span>
                      </div>
                      <div className="order-card-date">
                        {order.createdAt
                          ? order.createdAt.toLocaleDateString()
                          : "—"}
                      </div>
                      <ul className="order-items">
                        {(order.items || []).map((item, i) => (
                          <li key={i}>
                            {item.name} × {item.quantity} — ₱
                            {(item.price * item.quantity).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                      <div className="order-total">
                        Total: ₱{(order.total || 0).toLocaleString()}
                      </div>
                      <div className="order-payment">
                        Payment:{" "}
                        {order.paymentMethod === "qrph"
                          ? "QR Ph"
                          : order.paymentMethod === "gcash"
                            ? "GCash"
                          : order.paymentMethod === "cod"
                            ? "Cash on Delivery"
                            : order.paymentMethod || "—"}
                        {order.paymentStatus === "paid" && " (Paid)"}
                      </div>
                      {order.deliveryAddress && (
                        <div className="order-delivery">
                          <strong>Delivery:</strong>{" "}
                          {formatDeliveryAddress(order.deliveryAddress)}
                          {mapsLink(order.deliveryAddress) && (
                            <>
                              {" "}
                              <a
                                href={mapsLink(order.deliveryAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View on map
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="settings-overlay"
          onClick={() => setSettingsOpen(false)}
        >
          <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>Settings</h2>
              <button
                type="button"
                className="settings-close-btn"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="settings-body">
              {user && (
                <section className="settings-section settings-account-section">
                  <h3>Account</h3>
                  <p className="settings-user-name">
                    {user.displayName || "Customer"}
                  </p>
                  <p className="settings-user-email">{user.email}</p>
                </section>
              )}
              {user && (
                <section className="settings-section settings-address-section">
                  <DeliveryAddressForm
                    address={settingsAddress}
                    onChange={setSettingsAddress}
                  />
                  <button
                    type="button"
                    className="settings-save-btn"
                    onClick={handleSaveAddress}
                    disabled={addressSaveLoading}
                  >
                    {addressSaveLoading ? (
                      <>
                        <Loader2 size={18} className="icon-spin" aria-hidden="true" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save size={18} aria-hidden="true" />
                        Save delivery address
                      </>
                    )}
                  </button>
                  {savedAddress && (
                    <p className="settings-address-saved-note">
                      Saved: {formatDeliveryAddress(savedAddress)}
                    </p>
                  )}
                </section>
              )}
              <section className="settings-section">
                <h3>About</h3>
                <p>
                  K-Smart Store — Dried Kamias & Kamyas Smart Machine products.
                </p>
              </section>
              <section className="settings-section">
                <h3>Contact</h3>
                <p>
                  For orders and inquiries, contact your local K-Smart dealer.
                </p>
              </section>
              <section className="settings-section">
                <h3>Version</h3>
                <p>K-Smart Store v1.0</p>
              </section>
              {user && (
                <section className="settings-section settings-signout-section">
                  <button
                    type="button"
                    className="sign-out-btn"
                    onClick={() => { signOut(); setSettingsOpen(false); }}
                  >
                    <LogOut size={14} style={{ display: "inline", marginRight: 5 }} />
                    Sign Out
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      <LoginModal
        open={loginModalOpen}
        onClose={handleLoginModalClose}
        onSuccess={handleLoginSuccess}
      />

      <AddressRequiredModal
        open={addressRequiredOpen}
        onClose={() => setAddressRequiredOpen(false)}
        onGoToSettings={openSettingsForAddress}
      />

      {toast && (
        <div className="shop-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default Shop;
