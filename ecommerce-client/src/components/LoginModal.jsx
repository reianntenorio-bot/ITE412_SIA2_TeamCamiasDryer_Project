import { useState } from "react";
import { X, Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../firebase";

export default function LoginModal({ open, onClose, onSuccess }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!open) return null;

  const reset = () => {
    setEmail("");
    setPassword("");
    setError("");
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      reset();
      onSuccess?.();
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      reset();
      onSuccess?.();
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay" onClick={handleClose}>
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-header">
          <h2>{mode === "signup" ? "Create Account" : "Sign In"}</h2>
          <button
            type="button"
            className="cart-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p className="login-modal-sub">
          {mode === "signup"
            ? "Create an account to start shopping."
            : "Sign in to add items to your cart."}
        </p>

        {!isFirebaseConfigured && (
          <p className="login-modal-error">
            Firebase is not configured. Add VITE_FIREBASE_* values to the project
            root <code>.env</code> file, then restart the store dev server.
          </p>
        )}

        <button
          type="button"
          className="google-sign-in-btn"
          onClick={handleGoogle}
          disabled={loading || !isFirebaseConfigured}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M47.532 24.552c0-1.636-.132-3.2-.378-4.704H24.48v9.02h12.952c-.558 3.01-2.242 5.564-4.782 7.282v6.05h7.742c4.532-4.172 7.14-10.316 7.14-17.648z" fill="#4285F4"/>
            <path d="M24.48 48c6.504 0 11.956-2.154 15.942-5.8l-7.742-6.05c-2.154 1.444-4.908 2.296-8.2 2.296-6.306 0-11.646-4.258-13.556-9.978H2.924v6.244C6.894 42.804 15.098 48 24.48 48z" fill="#34A853"/>
            <path d="M10.924 28.468A14.44 14.44 0 0 1 10 24c0-1.558.268-3.068.924-4.468v-6.244H2.924A23.934 23.934 0 0 0 .48 24c0 3.876.928 7.542 2.444 10.712l8-6.244z" fill="#FBBC05"/>
            <path d="M24.48 9.554c3.558 0 6.748 1.224 9.26 3.626l6.944-6.944C36.432 2.396 30.98 0 24.48 0 15.098 0 6.894 5.196 2.924 13.288l8 6.244c1.91-5.72 7.25-9.978 13.556-9.978z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="login-modal-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit} className="login-modal-form">
          <div className="login-modal-field">
            <label htmlFor="lm-email">
              <Mail size={15} /> Email
            </label>
            <input
              id="lm-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || !isFirebaseConfigured}
            />
          </div>

          <div className="login-modal-field">
            <label htmlFor="lm-password">
              <Lock size={15} /> Password
            </label>
            <div className="login-modal-password-wrap">
              <input
                id="lm-password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || !isFirebaseConfigured}
              />
              <button
                type="button"
                className="login-modal-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="login-modal-error">{error}</p>}

          <button
            type="submit"
            className="add-cart-btn buy-btn login-modal-submit"
            disabled={loading || !isFirebaseConfigured}
          >
            <LogIn size={16} />
            {loading
              ? "Please wait…"
              : mode === "signup"
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <p className="login-modal-toggle">
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button type="button" onClick={() => { setMode("signin"); setError(""); }}>
                Sign in
              </button>
            </>
          ) : (
            <>New here?{" "}
              <button type="button" onClick={() => { setMode("signup"); setError(""); }}>
                Create account
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/popup-blocked":
      return "Google sign-in popup was blocked. Allow popups for this site and try again.";
    case "auth/cancelled-popup-request":
      return "Google sign-in was interrupted. Please try again.";
    case "auth/configuration-not-found":
      return "Firebase Auth is not configured. Check your VITE_FIREBASE_* environment variables.";
    default:
      return code ? `Auth error: ${code}` : "Something went wrong. Please try again.";
  }
}
