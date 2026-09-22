import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCrrHD2_WUvmBN8MDzmW9r6ayvEO8H-TN8",
  authDomain: "camiasdryer.firebaseapp.com",
  projectId: "camiasdryer",
  storageBucket: "camiasdryer.firebasestorage.app",
  messagingSenderId: "265742518594",
  appId: "1:265742518594:web:ee7ba734d0af82059560db",
  measurementId: "G-C74Z72CJBC",
  databaseURL: "https://camiasdryer-default-rtdb.firebaseio.com",
};

const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket
);

const missingFirebaseEnvVars = [
  ["VITE_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["VITE_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["VITE_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["VITE_FIREBASE_STORAGE_BUCKET", firebaseConfig.storageBucket],
  ["VITE_FIREBASE_MESSAGING_SENDER_ID", firebaseConfig.messagingSenderId],
  ["VITE_FIREBASE_APP_ID", firebaseConfig.appId],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

let app = null;
let storage = null;
let db = null;
let auth = null;
let rtdb = null;

const isRtdbConfigured = Boolean(
  isFirebaseConfigured && firebaseConfig.databaseURL
);

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);

  storage = getStorage(app);
  db = getFirestore(app);
  auth = getAuth(app);

  if (firebaseConfig.databaseURL) {
    try {
      rtdb = getDatabase(app);
    } catch {
      rtdb = null;
    }
  }
}

export {
  app,
  storage,
  db,
  auth,
  rtdb,
  isFirebaseConfigured,
  isRtdbConfigured,
  missingFirebaseEnvVars,
};