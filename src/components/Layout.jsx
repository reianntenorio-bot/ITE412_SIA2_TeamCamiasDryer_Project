import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  History,
  Calendar,
  Package,
  ShoppingBag,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";

function Layout({ children, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logo = "/kamyas.jpg";

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/history", icon: History, label: "History" },
    { path: "/scheduler", icon: Calendar, label: "Add Batch" },
    { path: "/manage-products", icon: Package, label: "Manage Products" },
    { path: "/transactions", icon: ShoppingBag, label: "Transactions" },
    { path: "/settings", icon: Settings, label: "Settings" },
    { path: "/notifications", icon: Bell, label: "Notifications" },
  ];

  return (
    <div className="app-layout">
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          <X size={24} />
        </button>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src={logo} alt="K-Smart Dryer" className="sidebar-logo-img" />
          </div>
          <h1 className="sidebar-title">K-SMART DRYER</h1>
          <p className="sidebar-subtitle">IoT Drying System</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="system-status">
            <span className="status-dot"></span>
            <span>Online</span>
          </div>
          <button className="logout-btn" onClick={() => { setMobileMenuOpen(false); onLogout(); }}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}

export default Layout;
