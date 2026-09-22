# Deploying KamyasDryer to Vercel

You have 3 parts: **Admin app**, **E-commerce store**, and **API server**. Here’s how to deploy them.

---

## 1. Deploy the main app (Admin – KamyasDryer)

1. Go to [vercel.com](https://vercel.com) and sign in.
2. **Add New** → **Project**.
3. Import your GitHub repo.
4. Use these settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `./` (leave default)
   - **Build Command:** `npm run build` (or `vite build` if `tsc` fails)
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Click **Deploy**.

Your admin app will be at `https://your-project.vercel.app`.

---

## 2. Deploy the e-commerce store

1. **Add New** → **Project** again.
2. Import the **same repo**.
3. Use these settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `ecommerce-client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add **Environment Variable:**
   - `VITE_API_URL` = your API URL (see step 3)
5. Click **Deploy**.

---

## 3. Deploy the API server

The server uses the file system (products, uploads). Vercel’s serverless environment is not ideal for that. Use one of these:

### Option A: Railway (recommended)

1. Go to [railway.app](https://railway.app) and sign in.
2. **New Project** → **Deploy from GitHub**.
3. Select your repo and set:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add env var: `BASE_URL` = `https://your-server.railway.app`
5. Deploy. Copy the public URL (e.g. `https://xxx.railway.app`).

### Option B: Render

1. Go to [render.com](https://render.com).
2. **New** → **Web Service**.
3. Connect your repo, set:
   - **Root Directory:** `server`
   - **Build:** `npm install`
   - **Start:** `npm start`
4. Deploy and copy the service URL.

---

## 4. Connect everything

### Admin app (main app)

Add env vars in Vercel:

- `VITE_API_URL` = `https://your-api-url.railway.app` (or Render URL)
- `VITE_STORE_URL` = `https://kamyas-dryer-349d.vercel.app` (or your e-commerce URL)
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (from Firebase Console)

### E-commerce store

Add env var in Vercel:

- `VITE_API_URL` = `https://your-api-url.railway.app` (or Render URL)

### Redeploy

After changing env vars, redeploy each project.

---

## 5. Summary

| App                 | URL                               | Vercel              |
| ------------------- | --------------------------------- | ------------------- |
| Admin (KamyasDryer) | `https://kamyasdryer.vercel.app`  | Yes                 |
| E-commerce Store    | `https://kamyas-store.vercel.app` | Yes                 |
| API Server          | `https://xxx.railway.app`         | No (Railway/Render) |

---

## Troubleshooting

- **Build fails with `tsc`:** Change the main app’s build command to `vite build` only.
- **404 on refresh:** `vercel.json` rewrites should handle SPA routing. Ensure it’s in the project root.
- **Images not loading:** Ensure `VITE_API_URL` is correct and the API server is reachable.
- **`ERR_CONNECTION_REFUSED` on localhost:3001:** Start the API server: `cd server && npm run dev`.
- **Railway "Application failed to respond":** (1) Set **Root Directory** to `server`. (2) In **Settings** → **Networking** → your domain, set **Target Port** to `3000` (or check deploy logs for the port the app uses). (3) Add `PORT=3000` in Railway Variables if needed. (4) Redeploy.
- **Firebase Storage CORS blocked:** Configure CORS on your bucket (see below).

### Firebase Storage CORS (fix "blocked by CORS policy")

If image uploads fail with CORS errors when running from localhost or your deployed admin:

1. Open [Google Cloud Console](https://console.cloud.google.com) → select project `kamyasdryer-dae01`.
2. Open **Cloud Shell** (icon `>_` in the top bar).
3. Create `cors.json` in Cloud Shell (copy the contents from `firebase-storage-cors.json` in the project root), then run:

   ```bash
   gsutil cors set cors.json gs://kamyasdryer-dae01.firebasestorage.app
   ```

   If that bucket doesn't exist, try: `gs://kamyasdryer-dae01.appspot.com`

4. Hard-refresh the admin page (Ctrl+Shift+R) or disable cache in DevTools, then try uploading again.
