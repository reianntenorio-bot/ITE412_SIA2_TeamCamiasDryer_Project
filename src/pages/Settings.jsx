import { useState } from "react";
import {
  Settings as SettingsIcon,
  Save,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import {
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../firebase";
import {
  getDryerRunMinutes,
  setDryerRunMinutes,
  DEFAULT_DRYER_RUN_MINUTES,
  MIN_DRYER_RUN_MINUTES,
  MAX_DRYER_RUN_MINUTES,
} from "../dryerRunSettings";

function Settings() {
  const user = auth?.currentUser;

  // Account section state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [accountMsg, setAccountMsg] = useState(null); // { type: "success"|"error", text }
  const [accountLoading, setAccountLoading] = useState(false);

  const showMsg = (type, text) => {
    setAccountMsg({ type, text });
    setTimeout(() => setAccountMsg(null), 4000);
  };

  const reauth = async () => {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    if (!newEmail || !currentPassword) return;
    setAccountLoading(true);
    try {
      await reauth();
      await updateEmail(user, newEmail);
      showMsg("success", "Email updated successfully.");
      setNewEmail("");
      setCurrentPassword("");
    } catch (err) {
      showMsg("error", friendlyAuthError(err.code));
    } finally {
      setAccountLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !currentPassword) return;
    setAccountLoading(true);
    try {
      await reauth();
      await updatePassword(user, newPassword);
      showMsg("success", "Password updated successfully.");
      setNewPassword("");
      setCurrentPassword("");
    } catch (err) {
      showMsg("error", friendlyAuthError(err.code));
    } finally {
      setAccountLoading(false);
    }
  };

  const [runDurationMinutes, setRunDurationMinutes] = useState(() =>
    getDryerRunMinutes()
  );

  const handleReset = () => {
    setRunDurationMinutes(DEFAULT_DRYER_RUN_MINUTES);
  };

  const handleSave = () => {
    const saved = setDryerRunMinutes(runDurationMinutes);
    setRunDurationMinutes(saved);
    alert("Settings saved successfully. Drying time is applied to monitoring.");
  };

  return (
    <div className="settings-page">
      <div className="settings-banner">
        Kamyas Smart Machine for Automated Regulated Temperature
      </div>

      <div className="settings-header">
        <h1 className="settings-title">System Settings</h1>
        <p className="settings-subtitle">
          Configure your K-SMART DRYER system preferences.
        </p>
      </div>

      <div className="settings-sections">
        {/* Account Settings */}
        <section className="settings-card">
          <h2 className="settings-card-title">
            <User size={20} className="settings-card-icon" />
            Account Settings
          </h2>

          {user && (
            <div className="settings-item">
              <label>Signed in as</label>
              <p style={{ fontWeight: 600, color: "var(--primary)", margin: "4px 0 0" }}>
                {user.email}
              </p>
            </div>
          )}

          {accountMsg && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "14px",
              marginBottom: "8px",
              background: accountMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${accountMsg.type === "success" ? "#86efac" : "#fca5a5"}`,
              color: accountMsg.type === "success" ? "#166534" : "#dc2626",
            }}>
              {accountMsg.text}
            </div>
          )}

          {/* Change Email */}
          <form onSubmit={handleUpdateEmail}>
            <div className="settings-item">
              <label><Mail size={14} style={{ display: "inline", marginRight: 5 }} />New Email Address</label>
              <input
                type="email"
                className="settings-input"
                placeholder="Enter new email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="settings-item">
              <label><Lock size={14} style={{ display: "inline", marginRight: 5 }} />Current Password (required)</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrentPw ? "text" : "password"}
                  className="settings-input"
                  placeholder="Confirm with current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ paddingRight: "44px" }}
                />
                <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", padding: 0 }}
                  tabIndex={-1}>
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-save" disabled={accountLoading || !newEmail || !currentPassword}
              style={{ marginTop: 4 }}>
              <Mail size={16} /> Update Email
            </button>
          </form>

          <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />

          {/* Change Password */}
          <form onSubmit={handleUpdatePassword}>
            <div className="settings-item">
              <label><Lock size={14} style={{ display: "inline", marginRight: 5 }} />New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showNewPw ? "text" : "password"}
                  className="settings-input"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingRight: "44px" }}
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", padding: 0 }}
                  tabIndex={-1}>
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="settings-item">
              <label><Lock size={14} style={{ display: "inline", marginRight: 5 }} />Current Password (required)</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrentPw ? "text" : "password"}
                  className="settings-input"
                  placeholder="Confirm with current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ paddingRight: "44px" }}
                />
                <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", padding: 0 }}
                  tabIndex={-1}>
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-save" disabled={accountLoading || !newPassword || !currentPassword}
              style={{ marginTop: 4 }}>
              <Lock size={16} /> Update Password
            </button>
          </form>
        </section>

        <section className="settings-card">
          <h2 className="settings-card-title">
            <SettingsIcon size={20} className="settings-card-icon" />
            System Configuration
          </h2>
          <div className="settings-item">
            <label>
              <Clock size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              Timed drying run (minutes)
            </label>
            <input
              type="number"
              min={MIN_DRYER_RUN_MINUTES}
              max={MAX_DRYER_RUN_MINUTES}
              step={1}
              value={runDurationMinutes}
              onChange={(e) => setRunDurationMinutes(Number(e.target.value))}
              className="settings-input"
            />
            <span className="settings-helper">
              Used by Monitoring → Start (countdown in this browser; ESP gets <code>heater: 1</code> then off when
              time ends). Range {MIN_DRYER_RUN_MINUTES}–{MAX_DRYER_RUN_MINUTES} min.
            </span>
          </div>
        </section>
      </div>

      <div className="settings-actions">
        <button type="button" className="btn-reset" onClick={handleReset}>
          Reset to Defaults
        </button>
        <button type="button" className="btn-save" onClick={handleSave}>
          <Save size={18} />
          Save Settings
        </button>
      </div>
    </div>
  );
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect.";
    case "auth/weak-password":
      return "New password must be at least 6 characters.";
    case "auth/email-already-in-use":
      return "This email is already in use.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/requires-recent-login":
      return "Session expired. Please log out and log in again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default Settings;
