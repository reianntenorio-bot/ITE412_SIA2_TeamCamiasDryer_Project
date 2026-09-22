import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const requireAuth = () => {
    if (!auth || !isFirebaseConfigured) {
      const err = new Error("Firebase Auth is not configured.");
      err.code = "auth/configuration-not-found";
      throw err;
    }
    return auth;
  };

  const signIn = (email, password) =>
    signInWithEmailAndPassword(requireAuth(), email, password);

  const signUp = (email, password) =>
    createUserWithEmailAndPassword(requireAuth(), email, password);

  const signInWithGoogle = () =>
    signInWithPopup(requireAuth(), new GoogleAuthProvider());

  const signOut = () => firebaseSignOut(requireAuth());

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
