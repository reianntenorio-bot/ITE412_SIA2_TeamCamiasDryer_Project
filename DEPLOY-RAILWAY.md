# Deploy to Railway (with /status and Firestore)

Your latest code is committed locally but not on Railway. Follow these steps:

## 1. Login to Railway (run in terminal)

```bash
railway login
```

A browser will open — sign in with your Railway account.

## 2. Link to your project (if not already linked)

```bash
cd server
railway link
```

Select your **kamyasdryer** project and the API service.

## 3. Deploy

```bash
railway up
```

This deploys the `server/` folder to Railway.

## 4. Add Firestore credentials (if not done)

1. Run: `node scripts/prepare-firebase-credentials.js`
2. Copy the output
3. Railway → Your service → **Variables** → Add `FIREBASE_CREDENTIALS_JSON` → Paste
4. Redeploy (or it may auto-redeploy)

## 5. Verify

Visit: https://kamyasdryer-production.up.railway.app/status

You should see: `"firestore": "configured"`
