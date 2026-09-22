# Products API

Simple REST API for K-Smart Store products. Used by the admin (KamyasDryer) to manage products and by the e-commerce client to display them.

## Setup

```bash
cd server
npm install
```

## Run

```bash
npm run dev
```

Runs at http://localhost:3001

## Firestore (persistent data)

Products and settings are stored in **Firestore** when a service account is configured. This keeps data across Railway restarts.

1. Enable **Firestore** in [Firebase Console](https://console.firebase.google.com) → your project → Build → Firestore Database → Create database.
2. Place your service account JSON in `server/` (e.g. `kamyasdryer-dae01-e46f40295dc6.json` or `credentials.json`).
3. For Railway: add `GOOGLE_DRIVE_CREDENTIALS_JSON` with the full JSON content.

If not configured, data uses local JSON files (lost on Railway redeploy).

## Image Upload

### ImgBB (recommended – free, no billing)

1. Sign up at [imgbb.com](https://imgbb.com)
2. Get your API key at [api.imgbb.com](https://api.imgbb.com)
3. Add to `server/.env`: `IMGBB_API_KEY=your_key`

Uploads go to ImgBB and return public image URLs. No storage quota issues.

### Google Drive (optional)

**Note:** Service accounts have storage quota limits and may fail with "Service Accounts do not have storage quota". Use ImgBB instead for reliable uploads.

### 1. Enable Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com) → your project (e.g. `kamyasdryer-dae01`)
2. **APIs & Services** → **Enable APIs and Services** → search **Google Drive API** → Enable

### 2. Create Service Account

1. **APIs & Services** → **Credentials** → **Create Credentials** → **Service account**
2. Name it (e.g. "store-uploader") → Create
3. Skip optional steps → Done
4. Click the service account → **Keys** tab → **Add Key** → **Create new key** → JSON
5. Save the JSON file as `server/credentials.json` (or set `GOOGLE_DRIVE_CREDENTIALS_FILE` to its path)

### 3. Create Folder & Share

1. Create a folder in your Google Drive (e.g. "K-Smart Product Images")
2. Right-click → **Share**
3. Add the service account email (from the JSON: `client_email`) as **Editor**
4. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 4. Configure Server

**Option A – Local (file):** Place `credentials.json` in the `server/` folder.

**Option B – Env vars (deployment):**

- `GOOGLE_DRIVE_FOLDER_ID` = your folder ID
- `GOOGLE_DRIVE_CREDENTIALS_JSON` = the entire JSON content as a string

If not configured, uploads fall back to local disk (`server/uploads/`).

## Endpoints

- `GET /api/settings` - Get store settings (banner text). Returns `{ bannerText }`.
- `PUT /api/settings` - Update store settings. Body: `{ bannerText }`.
- `POST /api/upload` - Upload product image (multipart/form-data, field: `image`). Returns `{ url }`. Uses Google Drive when configured.
- `GET /api/products` - List all products
- `POST /api/products` - Add product (body: name, price, description?, image?)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

Data is stored in `server/data/products.json`.
