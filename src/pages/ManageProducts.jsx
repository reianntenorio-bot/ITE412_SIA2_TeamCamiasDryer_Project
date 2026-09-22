import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Upload,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const STORE_URL = import.meta.env.VITE_STORE_URL || "https://kamyas-dryer-eyde.vercel.app";

/** Converts Google Drive share links to direct image URLs for use in img src */
function toDirectImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  // drive.google.com/file/d/ID/view or /open?id=ID or /uc?id=ID
  const fileIdMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
  }
  return trimmed;
}

function ManageProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerText, setBannerText] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message = "Saved!") => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    image: "",
    imageDeleteUrl: "",
  });

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/products`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setBannerText(data.bannerText || "");
      }
    } catch {
      setBannerText("Shop Premium Dried Kamias — Perfect for Snacks & Cooking");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  const handleSaveBanner = async () => {
    setBannerSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerText: bannerText.trim() || "Shop Premium Dried Kamias" }),
      });
      if (res.ok) {
        const data = await res.json();
        setBannerText(data.bannerText);
        showToast("Banner saved!");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBannerSaving(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", price: "", description: "", image: "", imageDeleteUrl: "" });
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      description: p.description || "",
      image: p.image || "",
      imageDeleteUrl: p.imageDeleteUrl || "",
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const { url, deleteUrl } = await res.json();
      setForm((f) => ({ ...f, image: url, imageDeleteUrl: deleteUrl || "" }));
    } catch (err) {
      setError("Image upload failed: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      price: Number(form.price) || 0,
      description: form.description.trim(),
      image: toDirectImageUrl(form.image.trim()) || "",
      imageDeleteUrl: form.imageDeleteUrl?.trim() || undefined,
    };
    if (!payload.name) return;
    try {
      if (editingId) {
        const res = await fetch(`${API_URL}/api/products/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update");
        }
      } else {
        const res = await fetch(`${API_URL}/api/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to add");
        }
      }
      await fetchProducts();
      closeModal();
      showToast(editingId ? "Product updated!" : "Product added!");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchProducts();
      showToast("Product deleted!");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="manage-products-page">
      <div className="manage-products-banner">
        Kamyas Smart Machine for Automated Regulated Temperature
      </div>

      <div className="manage-products-header">
        <h1 className="manage-products-title">
          <Package size={28} />
          Manage Store Products
        </h1>
        <div className="manage-products-actions">
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-view-store"
          >
            <ShoppingBag size={20} />
            View Store
            <ExternalLink size={14} />
          </a>
          <button type="button" className="btn-add-product" onClick={openAdd}>
            <Plus size={20} />
            Add Product
          </button>
        </div>
      </div>

      <div className="store-banner-section">
        <label className="store-banner-label">Store Banner Text</label>
        <div className="store-banner-row">
          <input
            type="text"
            className="store-banner-input"
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            placeholder="Shop Premium Dried Kamias — Perfect for Snacks & Cooking"
          />
          <button
            type="button"
            className="btn-save-banner"
            onClick={handleSaveBanner}
            disabled={bannerSaving}
          >
            {bannerSaving ? "Saving..." : "Save"}
          </button>
        </div>
        <p className="store-banner-hint">This text appears at the top of the store.</p>
      </div>

      {error && (
        <div className="manage-products-error">
          {error} — Make sure the API is running: <code>cd server && npm run dev</code>
        </div>
      )}

      {loading ? (
        <p className="manage-products-loading">Loading products...</p>
      ) : products.length === 0 && !error ? (
        <p className="manage-products-empty">
          No products yet. Click &quot;Add Product&quot; to add your first item.
        </p>
      ) : (
        <div className="manage-products-table-wrap">
          <table className="manage-products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      {p.image ? (
                        <img src={p.image} alt="" className="product-thumb" onError={(e) => { e.target.onerror = null; e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Crect fill='%23d1fae5' width='48' height='48'/%3E%3C/svg%3E"; }} />
                      ) : (
                        <div className="product-thumb product-thumb-placeholder" />
                      )}
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td>₱{Number(p.price).toLocaleString()}</td>
                  <td className="desc-cell">{p.description || "—"}</td>
                  <td>
                    <div className="action-btns">
                      <a
                        href={STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-view"
                        title="View in store"
                      >
                        <ShoppingBag size={16} />
                      </a>
                      <button
                        type="button"
                        className="btn-edit"
                        onClick={() => openEdit(p)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => handleDelete(p.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? "Edit Product" : "Add Product"}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Dried Kamias Premium 500g"
                  required
                />
              </div>
              <div className="form-group">
                <label>Price (₱) *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="299"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Product description"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Product Image</label>
                <div className="image-upload-row">
                  <label className="upload-btn">
                    <Upload size={18} />
                    {uploading ? "Uploading..." : "Upload Image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      hidden
                    />
                  </label>
                  <span className="upload-hint">or paste Google Drive / image URL</span>
                </div>
                <input
                  type="text"
                  value={form.image}
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.value, imageDeleteUrl: "" }))}
                  onPaste={(e) => {
                    const pasted = (e.clipboardData?.getData("text") || "").trim();
                    const converted = toDirectImageUrl(pasted);
                    if (converted !== pasted) {
                      e.preventDefault();
                      setForm((f) => ({ ...f, image: converted, imageDeleteUrl: "" }));
                    }
                  }}
                  placeholder="Paste Google Drive link or image URL"
                  className="image-url-input"
                />
                {form.image && (
                  <div className="image-preview-wrap">
                    <img src={form.image} alt="Preview" className="image-preview" onError={(e) => e.target.style.display = "none"} />
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  <Save size={18} />
                  {editingId ? "Update" : "Add"} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default ManageProducts;
