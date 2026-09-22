# K-Smart Store — E-commerce Client (RAG / Reference)

Structured reference for **kamyas-ecommerce-client**: a Vite + React storefront that loads products from the KamyasDryer API, uses Firebase Auth + Firestore for users and orders, and deploys well on Vercel.

---

## 1. Project identity

| Field | Value |
|--------|--------|
| Package name | `kamyas-ecommerce-client` |
| Stack | React 19, Vite 7, Firebase JS SDK 12, lucide-react |
| Entry | `src/main.jsx` → `AuthProvider` → `CartProvider` → `App` → `Shop` |
| Single page | `App.jsx` only renders `Shop` |

---

## 2. Directory layout

```
ecommerce-client/
├── package.json
├── vite.config.js
├── vercel.json          # SPA rewrites: all routes → index.html
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── firebase.js     # Firebase app, Firestore, Auth (env-gated)
│   ├── pages/
│   │   └── Shop.jsx      # Store UI, cart drawer, checkout, My Orders
│   ├── components/
│   │   └── LoginModal.jsx
│   ├── context/
│   │   ├── AuthContext.jsx   # Email/password, Google, signOut
│   │   └── CartContext.jsx   # In-memory cart, totals
│   └── styles/
│       └── index.css
└── RAG.md               # This file
```

---

## 3. Environment variables (Vite)

All public client vars must be prefixed with `VITE_`. Set them in `.env` locally and in **Vercel** for **Production** and **Preview** (not only Development).

| Variable | Purpose |
|----------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |
| `VITE_API_URL` | Backend base URL (e.g. Railway) for `/api/products`, `/api/settings` |
| `VITE_STORE_URL` | Optional; used by admin app links, not required in `Shop.jsx` |

**Retrieval note:** If login or Firestore fails on Vercel but works locally, env vars are often missing for Production/Preview.

---

## 4. External services

### 4.1 REST API (same repo server)

- **Products:** `GET ${VITE_API_URL}/api/products`
- **Banner / settings:** `GET ${VITE_API_URL}/api/settings` → `bannerText`

Defaults to `http://localhost:3001` if `VITE_API_URL` is unset.

### 4.2 Firebase Auth

- Email/password sign-in and sign-up
- Google sign-in via popup (`GoogleAuthProvider`)
- `onAuthStateChanged` drives `user` and `loading` in `AuthContext`

### 4.3 Firestore

- **Collection:** `orders`
- **Checkout:** `addDoc` with `userId`, `userEmail`, `items`, `total`, `status: "pending"`, `createdAt: serverTimestamp()`
- **My Orders:** `query(orders, where("userId", "==", uid), orderBy("createdAt", "desc"))` with `onSnapshot`

**Security:** Firestore rules must allow authenticated users to create orders and read their own orders (see repo root `firestore.rules`). A composite index on `orders` (`userId` ASC, `createdAt` DESC) is required for the My Orders query.

---

## 5. User flows (for Q&A retrieval)

**Q: How does the cart work?**  
A: Cart is React state in `CartContext.jsx` (not persisted). `addToCart` merges by product `id`; `cartTotal` and `cartCount` are derived.

**Q: What happens on Buy?**  
A: If not logged in, `LoginModal` opens and pending product is stored in a ref; after success, product is added and a toast can show. If logged in, product is added immediately.

**Q: What happens on Checkout?**  
A: If `db` and `user` exist, order is written to Firestore; then success UI, cart cleared, drawer closes after a delay. Loading state can show on the checkout button during the write.

**Q: Where is the store URL used?**  
A: This package’s `Shop.jsx` does not read `VITE_STORE_URL`; catalog uses `VITE_API_URL`. The variable is optional here if you mirror admin/Vercel config.

---

## 6. Deployment (Vercel)

- Build: `npm run build` (Vite output in `dist/`)
- `vercel.json` rewrites all paths to `index.html` for client-side routing if expanded later
- **Critical:** Mirror all `VITE_*` variables for Production (and Preview) in the Vercel dashboard, or use `vercel env add`

---

## 7. Common issues (retrieval snippets)

| Symptom | Likely cause |
|---------|----------------|
| Login fails on Vercel, works locally | Firebase `VITE_*` not set for Production/Preview |
| Checkout / My Orders permission denied | Firestore rules not deployed or wrong project |
| My Orders empty or error | Missing composite index on `orders` |
| Products empty | `VITE_API_URL` wrong or server down |
| Blank Firebase | Missing `apiKey` or `projectId` → `db` and `auth` stay null |

---

## 8. Related repository files

| Path | Relation |
|------|----------|
| `server/index.js` | Products API, settings, admin orders API |
| `firestore.rules` | Client access to `orders` |
| `firestore.indexes.json` | `userId` + `createdAt` index for My Orders |

---

## 9. Commands

```bash
cd ecommerce-client
npm install
npm run dev      # dev server
npm run build    # production build
npm run preview  # preview production build
```

---

*Last updated for RAG: single-file chunks map to sections 1–9 for embedding or manual lookup.*
