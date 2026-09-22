import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import imgbbUploader from "imgbb-uploader";
import admin from "firebase-admin";
import {
  buildLineItems,
  createQrphCheckoutSession,
  isCheckoutSessionPaid,
  isPayMongoConfigured,
  retrieveCheckoutSession,
  toCentavos,
} from "./paymongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const DATA_FILE = path.join(__dirname, "data", "products.json");
const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");
const BATCHES_FILE = path.join(__dirname, "data", "dryer-batches.json");
const SESSIONS_FILE = path.join(__dirname, "data", "drying-sessions.json");
const ORDERS_FILE = path.join(__dirname, "data", "orders.json");
const PENDING_ORDERS_FILE = path.join(__dirname, "data", "pending-orders.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const STORE_URL = process.env.STORE_URL || "http://localhost:5174";

function resolveStoreRedirectUrl(clientStoreUrl) {
  const fallback = STORE_URL.replace(/\/$/, "");
  if (typeof clientStoreUrl !== "string" || !clientStoreUrl.trim()) {
    return fallback;
  }
  try {
    const parsed = new URL(clientStoreUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallback;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
}

const DEFAULT_BANNER =
  "Shop Premium Dried Kamias — Perfect for Snacks & Cooking";

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const FIREBASE_CREDENTIALS = (() => {
  const json = process.env.FIREBASE_CREDENTIALS_JSON || process.env.GOOGLE_DRIVE_CREDENTIALS_JSON;
  if (json) {
    try {
      return typeof json === "string" ? JSON.parse(json) : json;
    } catch {
      return null;
    }
  }
  const explicitPath = process.env.GOOGLE_DRIVE_CREDENTIALS_FILE;
  if (explicitPath && fs.existsSync(explicitPath)) {
    try {
      return JSON.parse(fs.readFileSync(explicitPath, "utf8"));
    } catch {
      return null;
    }
  }
  const credsPath = path.join(__dirname, "credentials.json");
  if (fs.existsSync(credsPath)) {
    try {
      return JSON.parse(fs.readFileSync(credsPath, "utf8"));
    } catch {
      return null;
    }
  }
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json");
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(__dirname, f), "utf8"));
      if (data.type === "service_account" && data.client_email && data.private_key) {
        return data;
      }
    } catch {
      /* skip */
    }
  }
  return null;
})();

const DRIVE_CREDENTIALS = FIREBASE_CREDENTIALS;
const isDriveConfigured = Boolean(DRIVE_FOLDER_ID && DRIVE_CREDENTIALS);
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const isImgbbConfigured = Boolean(IMGBB_API_KEY);

let db = null;
if (FIREBASE_CREDENTIALS) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(FIREBASE_CREDENTIALS) });
    }
    db = admin.firestore();
  } catch (err) {
    console.warn("Firestore init failed:", err.message);
  }
}
const isFirestoreConfigured = Boolean(db);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, message: "KamyasDryer API" });
});

app.get("/status", (req, res) => {
  res.json({
    firestore: isFirestoreConfigured ? "configured" : "not configured (using local JSON)",
    imgbb: isImgbbConfigured ? "configured" : "not configured",
    drive: isDriveConfigured ? "configured" : "not configured",
    paymongo: isPayMongoConfigured() ? "configured" : "not configured",
  });
});

const PRODUCTS_COLL = "products";
const SETTINGS_COLL = "settings";
const SETTINGS_DOC = "config";
const ORDERS_COLL = "orders";
const DRYER_BATCHES_COLL = "dryerBatches";
const DRYING_SESSIONS_COLL = "dryingSessions";

function dryerBatchDocJson(d) {
  const data = d.data();
  const startAt = data.startAt?.toDate?.();
  return {
    id: d.id,
    startAt: startAt ? startAt.toISOString() : null,
    durationHours: typeof data.durationHours === "number" ? data.durationHours : 3,
    batchSizeKg: typeof data.batchSizeKg === "number" ? data.batchSizeKg : 15,
  };
}

function dryingSessionDocJson(d) {
  const data = d.data();
  const startedAt = data.startedAt?.toDate?.();
  const endedAt = data.endedAt?.toDate?.();
  return {
    id: d.id,
    source: data.source || "run",
    batchId: data.batchId || null,
    startedAt: startedAt ? startedAt.toISOString() : null,
    endedAt: endedAt ? endedAt.toISOString() : null,
    durationHours:
      typeof data.durationHours === "number" ? data.durationHours : null,
    batchSizeKg: typeof data.batchSizeKg === "number" ? data.batchSizeKg : 15,
    status: data.status || "completed",
    progressPct:
      typeof data.progressPct === "number" ? data.progressPct : null,
    avgTemperature:
      typeof data.avgTemperature === "number" ? data.avgTemperature : null,
    avgHumidity:
      typeof data.avgHumidity === "number" ? data.avgHumidity : null,
  };
}

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value._seconds === "number") {
    return new Date(value._seconds * 1000).toISOString();
  }
  return null;
}

function historyRowFromBatch(row) {
  const start = row.startAt ? new Date(row.startAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const durationHours = row.durationHours ?? 3;
  const endMs = start.getTime() + durationHours * 3600000;
  const isPending = endMs > Date.now();
  return {
    id: row.id,
    source: "scheduled",
    startedAt: start.toISOString(),
    endedAt: new Date(endMs).toISOString(),
    durationHours,
    batchSizeKg: row.batchSizeKg ?? 15,
    status: isPending ? "pending" : "completed",
    progressPct: isPending ? 0 : 100,
    avgTemperature: null,
    avgHumidity: null,
  };
}

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function ensureJsonFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
}

function normalizeDryerBatch(row) {
  return {
    id: row.id,
    startAt: row.startAt || null,
    durationHours:
      typeof row.durationHours === "number" ? row.durationHours : 3,
    batchSizeKg: typeof row.batchSizeKg === "number" ? row.batchSizeKg : 15,
  };
}

function resolveBatchStartAt(body) {
  const { startAt, startDate, startTime } = body || {};

  if (startAt) {
    const parsed = new Date(String(startAt).trim());
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Invalid startAt datetime." };
    }
    return { date: parsed };
  }

  if (startDate && startTime) {
    const parsed = new Date(
      `${String(startDate).trim()}T${String(startTime).trim()}`,
    );
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Invalid start date or time." };
    }
    return { date: parsed };
  }

  return { error: "startAt is required." };
}

function normalizeDryingSession(row) {
  return {
    id: row.id,
    source: row.source || "run",
    batchId: row.batchId || null,
    startedAt: row.startedAt || null,
    endedAt: row.endedAt || null,
    durationHours:
      typeof row.durationHours === "number" ? row.durationHours : null,
    batchSizeKg: typeof row.batchSizeKg === "number" ? row.batchSizeKg : 15,
    status: row.status || "completed",
    progressPct:
      typeof row.progressPct === "number" ? row.progressPct : null,
    avgTemperature:
      typeof row.avgTemperature === "number" ? row.avgTemperature : null,
    avgHumidity:
      typeof row.avgHumidity === "number" ? row.avgHumidity : null,
  };
}

function readLocalDryerBatches() {
  ensureJsonFile(BATCHES_FILE);
  try {
    const rows = JSON.parse(fs.readFileSync(BATCHES_FILE, "utf8"));
    if (!Array.isArray(rows)) return [];
    return rows
      .map(normalizeDryerBatch)
      .sort(
        (a, b) =>
          new Date(a.startAt || 0).getTime() - new Date(b.startAt || 0).getTime()
      );
  } catch {
    return [];
  }
}

function writeLocalDryerBatches(batches) {
  ensureJsonFile(BATCHES_FILE);
  fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2));
}

function readLocalDryingSessions() {
  ensureJsonFile(SESSIONS_FILE);
  try {
    const rows = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    if (!Array.isArray(rows)) return [];
    return rows
      .map(normalizeDryingSession)
      .sort(
        (a, b) =>
          new Date(b.startedAt || b.endedAt || 0).getTime() -
          new Date(a.startedAt || a.endedAt || 0).getTime()
      );
  } catch {
    return [];
  }
}

function writeLocalDryingSessions(sessions) {
  ensureJsonFile(SESSIONS_FILE);
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function buildCompletedSessionFromBatch(batch, endedAt = new Date()) {
  const start = batch.startAt ? new Date(batch.startAt) : new Date();
  const end = endedAt instanceof Date ? endedAt : new Date(endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const durationHours =
    Math.round(
      Math.min(
        Math.max(0, (end.getTime() - start.getTime()) / 3600000),
        batch.durationHours ?? 3,
      ) * 100,
    ) / 100;

  return normalizeDryingSession({
    id: randomUUID(),
    batchId: batch.id,
    source: "scheduled",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    durationHours,
    batchSizeKg: batch.batchSizeKg ?? 15,
    status: "completed",
    progressPct: 100,
    createdAt: new Date().toISOString(),
  });
}

async function completeDryerBatchById(batchId) {
  if (isFirestoreConfigured) {
    const docRef = db.collection(DRYER_BATCHES_COLL).doc(batchId);
    const snap = await docRef.get();
    if (!snap.exists) return { error: "Batch not found", status: 404 };

    const batch = dryerBatchDocJson(snap);
    const endedAt = new Date();
    const startDate = batch.startAt ? new Date(batch.startAt) : endedAt;
    const scheduledHours = batch.durationHours ?? 3;
    const durationHours =
      Math.round(
        Math.min(
          Math.max(0, (endedAt.getTime() - startDate.getTime()) / 3600000),
          scheduledHours,
        ) * 100,
      ) / 100;

    const sessionRef = await db.collection(DRYING_SESSIONS_COLL).add({
      batchId: batch.id,
      source: "scheduled",
      startedAt: admin.firestore.Timestamp.fromDate(startDate),
      endedAt: admin.firestore.Timestamp.fromDate(endedAt),
      durationHours,
      batchSizeKg: batch.batchSizeKg ?? 15,
      status: "completed",
      progressPct: 100,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await docRef.delete();

    const sessionDoc = await sessionRef.get();
    return { session: dryingSessionDocJson(sessionDoc) };
  }

  const batches = readLocalDryerBatches();
  const batch = batches.find((row) => row.id === batchId);
  if (!batch) return { error: "Batch not found", status: 404 };

  const session = buildCompletedSessionFromBatch(batch);
  if (!session) return { error: "Invalid batch data", status: 400 };

  const sessions = readLocalDryingSessions();
  sessions.unshift(session);
  writeLocalDryingSessions(sessions);
  writeLocalDryerBatches(batches.filter((row) => row.id !== batchId));

  return { session };
}

async function deleteHistoryEntryById(id) {
  if (isFirestoreConfigured) {
    const sessionRef = db.collection(DRYING_SESSIONS_COLL).doc(id);
    const sessionSnap = await sessionRef.get();
    if (sessionSnap.exists) {
      await sessionRef.delete();
      return { ok: true };
    }

    const batchRef = db.collection(DRYER_BATCHES_COLL).doc(id);
    const batchSnap = await batchRef.get();
    if (batchSnap.exists) {
      await batchRef.delete();
      return { ok: true };
    }

    return { error: "History entry not found", status: 404 };
  }

  const sessions = readLocalDryingSessions();
  if (sessions.some((row) => row.id === id)) {
    writeLocalDryingSessions(sessions.filter((row) => row.id !== id));
    return { ok: true };
  }

  const batches = readLocalDryerBatches();
  if (batches.some((row) => row.id === id)) {
    writeLocalDryerBatches(batches.filter((row) => row.id !== id));
    return { ok: true };
  }

  return { error: "History entry not found", status: 404 };
}

function buildDryingHistoryRows(sessions, batches) {
  const rows = [
    ...sessions.map(normalizeDryingSession),
    ...batches
      .map((row) => historyRowFromBatch(normalizeDryerBatch(row)))
      .filter(Boolean),
  ];
  rows.sort((a, b) => {
    const aTime = new Date(a.startedAt || a.endedAt || 0).getTime();
    const bTime = new Date(b.startedAt || b.endedAt || 0).getTime();
    return bTime - aTime;
  });
  return rows;
}

function normalizeDeliveryAddress(address) {
  if (!address || typeof address !== "object") return null;
  const lat = Number(address.lat);
  const lng = Number(address.lng);
  const normalized = {
    fullName: String(address.fullName || "").trim(),
    phone: String(address.phone || "").trim(),
    street: String(address.street || "").trim(),
    city: String(address.city || "").trim(),
    province: String(address.province || "").trim(),
    postalCode: String(address.postalCode || "").trim(),
    notes: String(address.notes || "").trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
  if (
    !normalized.fullName ||
    !normalized.phone ||
    !normalized.street ||
    !normalized.city ||
    !normalized.province ||
    normalized.lat == null ||
    normalized.lng == null
  ) {
    return null;
  }
  return normalized;
}

function normalizeOrder(row) {
  return {
    id: row.id,
    userId: row.userId || "",
    userEmail: row.userEmail || "",
    items: Array.isArray(row.items) ? row.items : [],
    total: typeof row.total === "number" ? row.total : Number(row.total) || 0,
    paymentMethod: row.paymentMethod || "qrph",
    paymentStatus: row.paymentStatus || null,
    paymongoSessionId: row.paymongoSessionId || null,
    status: row.status || "pending",
    deliveryAddress: normalizeDeliveryAddress(row.deliveryAddress),
    createdAt: toIsoDate(row.createdAt) || row.createdAt || null,
  };
}

function readLocalOrdersRaw() {
  ensureJsonFile(ORDERS_FILE);
  try {
    const rows = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function readLocalOrders() {
  return readLocalOrdersRaw()
    .map(normalizeOrder)
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
}

function writeLocalOrders(orders) {
  ensureJsonFile(ORDERS_FILE);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function appendLocalOrder(orderRow) {
  const rows = readLocalOrdersRaw();
  rows.unshift(orderRow);
  writeLocalOrders(rows);
}

function readPendingOrdersRaw() {
  ensureJsonFile(PENDING_ORDERS_FILE);
  try {
    const rows = JSON.parse(fs.readFileSync(PENDING_ORDERS_FILE, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writePendingOrders(rows) {
  ensureJsonFile(PENDING_ORDERS_FILE);
  fs.writeFileSync(PENDING_ORDERS_FILE, JSON.stringify(rows, null, 2));
}

function savePendingOrder(pendingOrder) {
  const rows = readPendingOrdersRaw();
  rows.unshift(pendingOrder);
  writePendingOrders(rows);
}

function getPendingOrder(pendingOrderId) {
  return readPendingOrdersRaw().find((row) => row.id === pendingOrderId) || null;
}

function removePendingOrder(pendingOrderId) {
  writePendingOrders(readPendingOrdersRaw().filter((row) => row.id !== pendingOrderId));
}

function buildOrderPayload(body) {
  const { userId, userEmail, items, total, deliveryAddress } = body;
  if (!userId || !userEmail) {
    return { error: "userId and userEmail are required" };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "items are required" };
  }

  const normalizedAddress = normalizeDeliveryAddress(deliveryAddress);
  if (!normalizedAddress) {
    return {
      error:
        "Complete delivery address and map pin are required (name, phone, street, city, province, location).",
    };
  }

  const orderTotal = Number(total);
  const lineItems = buildLineItems(items);
  const computedTotal = lineItems.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0,
  );
  if (computedTotal !== toCentavos(orderTotal)) {
    return { error: "Order total does not match cart items." };
  }

  return {
    payload: {
      userId: String(userId),
      userEmail: String(userEmail),
      items,
      total: Number.isFinite(orderTotal) ? orderTotal : 0,
      paymentMethod: "qrph",
      deliveryAddress: normalizedAddress,
    },
    lineItems,
  };
}

async function finalizePaidOrder(pendingOrder, sessionId) {
  const existing = readLocalOrdersRaw().find(
    (row) => row.paymongoSessionId === sessionId,
  );
  if (existing) {
    return normalizeOrder(existing);
  }

  const orderRow = {
    id: randomUUID(),
    userId: pendingOrder.userId,
    userEmail: pendingOrder.userEmail,
    items: pendingOrder.items,
    total: pendingOrder.total,
    paymentMethod: "qrph",
    paymentStatus: "paid",
    paymongoSessionId: sessionId,
    status: "pending",
    deliveryAddress: pendingOrder.deliveryAddress,
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreConfigured) {
    const ref = await db.collection(ORDERS_COLL).add({
      ...orderRow,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await ref.get();
    removePendingOrder(pendingOrder.id);
    return normalizeOrder({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null,
    });
  }

  appendLocalOrder(orderRow);
  removePendingOrder(pendingOrder.id);
  return normalizeOrder(orderRow);
}

async function readOrders(userId = null) {
  if (isFirestoreConfigured) {
    let snap;
    if (userId) {
      snap = await db
        .collection(ORDERS_COLL)
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    } else {
      snap = await db.collection(ORDERS_COLL).orderBy("createdAt", "desc").get();
    }
    return snap.docs.map((d) =>
      normalizeOrder({ id: d.id, ...d.data() })
    );
  }

  const orders = readLocalOrders();
  if (!userId) return orders;
  return orders.filter((order) => order.userId === userId);
}

async function readDryerBatches() {
  if (isFirestoreConfigured) {
    const snap = await db
      .collection(DRYER_BATCHES_COLL)
      .orderBy("startAt", "asc")
      .get();
    return snap.docs.map(dryerBatchDocJson);
  }
  return readLocalDryerBatches();
}

async function readDryingHistoryRows() {
  if (isFirestoreConfigured) {
    const [sessionsSnap, batchesSnap] = await Promise.all([
      db.collection(DRYING_SESSIONS_COLL).orderBy("startedAt", "desc").get(),
      db.collection(DRYER_BATCHES_COLL).orderBy("startAt", "desc").get(),
    ]);
    return buildDryingHistoryRows(
      sessionsSnap.docs.map(dryingSessionDocJson),
      batchesSnap.docs.map(dryerBatchDocJson)
    );
  }
  return buildDryingHistoryRows(
    readLocalDryingSessions(),
    readLocalDryerBatches()
  );
}

async function readProducts() {
  if (isFirestoreConfigured) {
    try {
      const snap = await db.collection(PRODUCTS_COLL).get();
      const products = snap.docs.map((d) => ({ id: d.data().id, ...d.data() }));
      return products.sort((a, b) => (a.id || 0) - (b.id || 0));
    } catch (err) {
      console.error("Firestore readProducts:", err.message);
      return [];
    }
  }
  ensureDataDir();
  const data = fs.readFileSync(DATA_FILE, "utf8");
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeProducts(products) {
  if (isFirestoreConfigured) {
    try {
      const batch = db.batch();
      const coll = db.collection(PRODUCTS_COLL);
      const existing = await coll.get();
      const newIds = new Set(products.map((p) => String(p.id)));
      existing.docs.forEach((d) => {
        if (!newIds.has(d.id)) batch.delete(d.ref);
      });
      products.forEach((p) => {
        const ref = coll.doc(String(p.id));
        const data = { id: p.id, name: p.name, price: p.price, description: p.description || "", image: p.image || "" };
        if (p.imageDeleteUrl) data.imageDeleteUrl = p.imageDeleteUrl;
        batch.set(ref, data);
      });
      await batch.commit();
    } catch (err) {
      console.error("Firestore writeProducts:", err.message);
      throw err;
    }
    return;
  }
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

async function addProductFirestore(product) {
  const data = {
    id: product.id,
    name: String(product.name || ""),
    price: Number(product.price) || 0,
    description: String(product.description || ""),
    image: String(product.image || ""),
  };
  if (product.imageDeleteUrl) data.imageDeleteUrl = String(product.imageDeleteUrl);
  await db.collection(PRODUCTS_COLL).doc(String(product.id)).set(data);
}

async function updateProductFirestore(id, product) {
  const ref = db.collection(PRODUCTS_COLL).doc(String(id));
  const data = { id: product.id, name: product.name, price: product.price, description: product.description || "", image: product.image || "" };
  if (product.imageDeleteUrl) {
    data.imageDeleteUrl = product.imageDeleteUrl;
  } else {
    data.imageDeleteUrl = admin.firestore.FieldValue.delete();
  }
  await ref.set(data, { merge: true });
  return true;
}

async function deleteProductFirestore(id) {
  await db.collection(PRODUCTS_COLL).doc(String(id)).delete();
}

function nextId(products) {
  const ids = products.map((p) => p.id).filter(Boolean);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

async function readSettings() {
  if (isFirestoreConfigured) {
    try {
      const doc = await db.collection(SETTINGS_COLL).doc(SETTINGS_DOC).get();
      if (doc.exists) {
        const d = doc.data();
        return { bannerText: d.bannerText || DEFAULT_BANNER };
      }
    } catch (err) {
      console.error("Firestore readSettings:", err.message);
    }
    return { bannerText: DEFAULT_BANNER };
  }
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) {
    return { bannerText: DEFAULT_BANNER };
  }
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    return { bannerText: data.bannerText || DEFAULT_BANNER };
  } catch {
    return { bannerText: DEFAULT_BANNER };
  }
}

async function writeSettings(settings) {
  if (isFirestoreConfigured) {
    try {
      await db.collection(SETTINGS_COLL).doc(SETTINGS_DOC).set(settings, { merge: true });
    } catch (err) {
      console.error("Firestore writeSettings:", err.message);
      throw err;
    }
    return;
  }
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET /api/settings
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
app.put("/api/settings", async (req, res) => {
  try {
    const { bannerText } = req.body;
    const settings = await readSettings();
    if (bannerText != null) settings.bannerText = String(bannerText);
    await writeSettings(settings);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload - upload to Google Drive (or fallback to local disk)
app.post("/api/upload", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file" });
  const filePath = req.file.path;

  const cleanup = () => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  };

  try {
    if (isImgbbConfigured) {
      const result = await imgbbUploader({
        apiKey: IMGBB_API_KEY,
        imagePath: filePath,
        name: req.file.originalname || path.basename(filePath),
      });
      cleanup();
      const url = result.url || result.display_url || result.image?.url;
      const deleteUrl = result.delete_url || null;
      if (url) return res.json({ url, deleteUrl });
      throw new Error("ImgBB did not return image URL");
    }

    if (isDriveConfigured) {
      const auth = new google.auth.GoogleAuth({
        credentials: DRIVE_CREDENTIALS,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
      const drive = google.drive({ version: "v3", auth });

      const { data } = await drive.files.create({
        requestBody: {
          name: req.file.originalname || path.basename(filePath),
          parents: [DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(filePath),
        },
        fields: "id",
      });

      await drive.permissions.create({
        fileId: data.id,
        requestBody: { role: "reader", type: "anyone" },
      });

      cleanup();
      const url = `https://drive.google.com/uc?export=view&id=${data.id}`;
      return res.json({ url });
    }

    const port = process.env.PORT || 3001;
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (err) {
    cleanup();
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

app.use("/uploads", express.static(UPLOADS_DIR));

// GET /api/products
app.get("/api/products", async (req, res) => {
  try {
    const products = await readProducts();
    res.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ error: err.message });
  }
});

function deleteImgbbImage(deleteUrl) {
  const match = deleteUrl && typeof deleteUrl === "string" && deleteUrl.match(/ibb\.co\/([^/]+)\/([^/?#]+)/);
  if (!match) return Promise.resolve();
  const [, imageId, imageHash] = match;
  const formData = new URLSearchParams({
    pathname: `/${imageId}/${imageHash}`,
    action: "delete",
    delete: "image",
    from: "resource",
    "deleting[id]": imageId,
    "deleting[hash]": imageHash,
  }).toString();
  return fetch("https://ibb.co/json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  }).catch(() => {});
}

// POST /api/products
app.post("/api/products", async (req, res) => {
  try {
    const products = await readProducts();
    const { name, price, description, image, imageDeleteUrl } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: "name and price are required" });
    }
    const id = nextId(products);
    const product = {
      id,
      name: String(name),
      price: Number(price),
      description: String(description || ""),
      image: String(image || "/kamyas.jpg"),
      ...(imageDeleteUrl && { imageDeleteUrl: String(imageDeleteUrl) }),
    };
    if (isFirestoreConfigured) {
      await addProductFirestore(product);
    } else {
      products.push(product);
      await writeProducts(products);
    }
    res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/products error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
app.put("/api/products/:id", async (req, res) => {
  try {
    const products = await readProducts();
    const id = Number(req.params.id);
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });
    const { name, price, description, image, imageDeleteUrl } = req.body;
    const updates = {
      ...(name != null && { name: String(name) }),
      ...(price != null && { price: Number(price) }),
      ...(description != null && { description: String(description) }),
      ...(image != null && { image: String(image) }),
      ...(imageDeleteUrl != null && { imageDeleteUrl: imageDeleteUrl ? String(imageDeleteUrl) : undefined }),
    };
    const updated = {
      ...products[idx],
      ...updates,
    };
    if (updated.imageDeleteUrl === undefined) delete updated.imageDeleteUrl;
    if (isFirestoreConfigured) {
      await updateProductFirestore(id, updated);
    } else {
      products[idx] = updated;
      await writeProducts(products);
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dryer-batches (Admin SDK — no client Firestore rules)
app.get("/api/dryer-batches", async (req, res) => {
  try {
    res.json(await readDryerBatches());
  } catch (err) {
    console.error("GET /api/dryer-batches error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/dryer-batches", async (req, res) => {
  try {
    const { durationHours, batchSizeKg } = req.body;
    const resolved = resolveBatchStartAt(req.body);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    const startAtDate = resolved.date;
    const dh = Number(durationHours);
    const bk = Number(batchSizeKg);

    if (isFirestoreConfigured) {
      const startAt = admin.firestore.Timestamp.fromDate(startAtDate);
      const ref = await db.collection(DRYER_BATCHES_COLL).add({
        startAt,
        durationHours: Number.isFinite(dh) ? dh : 3,
        batchSizeKg: Number.isFinite(bk) ? bk : 15,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const doc = await ref.get();
      return res.json(dryerBatchDocJson(doc));
    }

    const batch = normalizeDryerBatch({
      id: randomUUID(),
      startAt: startAtDate.toISOString(),
      durationHours: Number.isFinite(dh) ? dh : 3,
      batchSizeKg: Number.isFinite(bk) ? bk : 15,
      createdAt: new Date().toISOString(),
    });
    const batches = readLocalDryerBatches();
    batches.push(batch);
    writeLocalDryerBatches(batches);
    res.json(batch);
  } catch (err) {
    console.error("POST /api/dryer-batches error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/dryer-batches/:id", async (req, res) => {
  try {
    const { durationHours, batchSizeKg } = req.body;
    const resolved =
      req.body.startAt != null || (req.body.startDate && req.body.startTime)
        ? resolveBatchStartAt(req.body)
        : null;
    if (resolved?.error) {
      return res.status(400).json({ error: resolved.error });
    }

    if (isFirestoreConfigured) {
      const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      if (resolved?.date) {
        updates.startAt = admin.firestore.Timestamp.fromDate(resolved.date);
      }
      if (durationHours != null) {
        const dh = Number(durationHours);
        if (Number.isFinite(dh)) updates.durationHours = dh;
      }
      if (batchSizeKg != null) {
        const bk = Number(batchSizeKg);
        if (Number.isFinite(bk)) updates.batchSizeKg = bk;
      }
      const docRef = db.collection(DRYER_BATCHES_COLL).doc(req.params.id);
      await docRef.update(updates);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Batch not found" });
      return res.json(dryerBatchDocJson(doc));
    }

    const batches = readLocalDryerBatches();
    const idx = batches.findIndex((batch) => batch.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Batch not found" });

    const current = { ...batches[idx] };
    if (resolved?.date) {
      current.startAt = resolved.date.toISOString();
    }
    if (durationHours != null) {
      const dh = Number(durationHours);
      if (Number.isFinite(dh)) current.durationHours = dh;
    }
    if (batchSizeKg != null) {
      const bk = Number(batchSizeKg);
      if (Number.isFinite(bk)) current.batchSizeKg = bk;
    }
    current.updatedAt = new Date().toISOString();
    batches[idx] = normalizeDryerBatch(current);
    writeLocalDryerBatches(batches);
    res.json(batches[idx]);
  } catch (err) {
    console.error("PATCH /api/dryer-batches error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/dryer-batches/:id", async (req, res) => {
  try {
    if (isFirestoreConfigured) {
      await db.collection(DRYER_BATCHES_COLL).doc(req.params.id).delete();
      return res.json({ success: true });
    }

    const batches = readLocalDryerBatches();
    const next = batches.filter((batch) => batch.id !== req.params.id);
    if (next.length === batches.length) {
      return res.status(404).json({ error: "Batch not found" });
    }
    writeLocalDryerBatches(next);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/dryer-batches error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dryer-batches/:id/complete — mark batch done and record in history
app.post("/api/dryer-batches/:id/complete", async (req, res) => {
  try {
    const result = await completeDryerBatchById(req.params.id);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.json({ ok: true, session: result.session });
  } catch (err) {
    console.error("POST /api/dryer-batches/:id/complete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/drying-history — completed runs + past scheduled batches
app.get("/api/drying-history", async (req, res) => {
  try {
    res.json(await readDryingHistoryRows());
  } catch (err) {
    console.error("GET /api/drying-history error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drying-sessions — log a completed/interrupted dashboard run
app.post("/api/drying-sessions", async (req, res) => {
  try {
    const {
      startedAt,
      endedAt,
      durationHours,
      batchSizeKg,
      status,
      progressPct,
      avgTemperature,
      avgHumidity,
    } = req.body;

    if (!startedAt || !endedAt) {
      return res.status(400).json({ error: "startedAt and endedAt are required" });
    }

    const startDate = new Date(startedAt);
    const endDate = new Date(endedAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid startedAt or endedAt" });
    }

    const dh = Number(durationHours);
    const bk = Number(batchSizeKg);
    const pct = Number(progressPct);
    const avgT = Number(avgTemperature);
    const avgH = Number(avgHumidity);

    if (isFirestoreConfigured) {
      const payload = {
        startedAt: admin.firestore.Timestamp.fromDate(startDate),
        endedAt: admin.firestore.Timestamp.fromDate(endDate),
        durationHours: Number.isFinite(dh)
          ? dh
          : Math.max(0, (endDate - startDate) / 3600000),
        batchSizeKg: Number.isFinite(bk) ? bk : 15,
        status: ["completed", "interrupted", "stopped"].includes(status)
          ? status
          : "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (Number.isFinite(pct)) {
        payload.progressPct = Math.min(100, Math.max(0, pct));
      }
      if (Number.isFinite(avgT)) payload.avgTemperature = avgT;
      if (Number.isFinite(avgH)) payload.avgHumidity = avgH;

      const ref = await db.collection(DRYING_SESSIONS_COLL).add(payload);
      const doc = await ref.get();
      return res.json(dryingSessionDocJson(doc));
    }

    const session = normalizeDryingSession({
      id: randomUUID(),
      startedAt: startDate.toISOString(),
      endedAt: endDate.toISOString(),
      durationHours: Number.isFinite(dh)
        ? dh
        : Math.max(0, (endDate.getTime() - startDate.getTime()) / 3600000),
      batchSizeKg: Number.isFinite(bk) ? bk : 15,
      status: ["completed", "interrupted", "stopped"].includes(status)
        ? status
        : "completed",
      progressPct: Number.isFinite(pct)
        ? Math.min(100, Math.max(0, pct))
        : null,
      avgTemperature: Number.isFinite(avgT) ? avgT : null,
      avgHumidity: Number.isFinite(avgH) ? avgH : null,
      createdAt: new Date().toISOString(),
    });
    const sessions = readLocalDryingSessions();
    sessions.unshift(session);
    writeLocalDryingSessions(sessions);
    res.json(session);
  } catch (err) {
    console.error("POST /api/drying-sessions error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/drying-history/:id — remove a session or scheduled batch from history
app.delete("/api/drying-history/:id", async (req, res) => {
  try {
    const result = await deleteHistoryEntryById(req.params.id);
    if (result.error) {
      return res.status(result.status || 404).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/drying-history error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/qrph/checkout — create PayMongo QR Ph checkout session
app.post("/api/payments/qrph/checkout", async (req, res) => {
  try {
    if (!isPayMongoConfigured()) {
      return res.status(503).json({ error: "PayMongo is not configured on the server." });
    }

    const built = buildOrderPayload(req.body);
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    const pendingOrderId = randomUUID();
    const pendingOrder = {
      id: pendingOrderId,
      ...built.payload,
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
    };

    const storeBase = resolveStoreRedirectUrl(req.body?.storeUrl);

    const { sessionId, checkoutUrl } = await createQrphCheckoutSession({
      lineItems: built.lineItems,
      successUrl: `${storeBase}/?payment=success&pending_order_id=${pendingOrderId}`,
      cancelUrl: `${storeBase}/?payment=cancelled`,
      referenceNumber: pendingOrderId,
      metadata: {
        pendingOrderId,
        userId: built.payload.userId,
      },
    });

    pendingOrder.paymongoSessionId = sessionId;
    savePendingOrder(pendingOrder);

    res.json({
      checkoutUrl,
      sessionId,
      pendingOrderId,
    });
  } catch (err) {
    console.error("POST /api/payments/qrph/checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/qrph/complete — verify PayMongo payment and create order
app.post("/api/payments/qrph/complete", async (req, res) => {
  try {
    if (!isPayMongoConfigured()) {
      return res.status(503).json({ error: "PayMongo is not configured on the server." });
    }

    const { pendingOrderId } = req.body || {};
    if (!pendingOrderId) {
      return res.status(400).json({ error: "pendingOrderId is required." });
    }

    const pendingOrder = getPendingOrder(String(pendingOrderId));
    if (!pendingOrder) {
      const existing = readLocalOrdersRaw().find(
        (row) => row.id === String(pendingOrderId),
      );
      if (existing) {
        return res.json({ ok: true, order: normalizeOrder(existing) });
      }
      return res.status(404).json({ error: "Pending order not found or already completed." });
    }

    const sessionId = pendingOrder.paymongoSessionId;
    if (!sessionId) {
      return res.status(400).json({ error: "Checkout session missing for this order." });
    }

    const session = await retrieveCheckoutSession(String(sessionId));
    if (!isCheckoutSessionPaid(session)) {
      return res.status(402).json({
        error: "Payment is not completed yet. Please scan the QR Ph code and complete payment.",
        paymentStatus: "pending",
      });
    }

    const order = await finalizePaidOrder(pendingOrder, String(sessionId));
    res.json({ ok: true, order });
  } catch (err) {
    console.error("POST /api/payments/qrph/complete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders — direct checkout (legacy/admin); store uses QR Ph PayMongo flow
app.post("/api/orders", async (req, res) => {
  try {
    const { userId, userEmail, items, total, paymentMethod, status, deliveryAddress } =
      req.body;
    if (!userId || !userEmail) {
      return res.status(400).json({ error: "userId and userEmail are required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items are required" });
    }

    const normalizedAddress = normalizeDeliveryAddress(deliveryAddress);
    if (!normalizedAddress) {
      return res.status(400).json({
        error:
          "Complete delivery address and map pin are required (name, phone, street, city, province, location).",
      });
    }

    const orderTotal = Number(total);
    const payload = {
      userId: String(userId),
      userEmail: String(userEmail),
      items,
      total: Number.isFinite(orderTotal) ? orderTotal : 0,
      paymentMethod: paymentMethod || "qrph",
      status: status || "pending",
      deliveryAddress: normalizedAddress,
    };

    if (isFirestoreConfigured) {
      const ref = await db.collection(ORDERS_COLL).add({
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const doc = await ref.get();
      return res.json({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null,
      });
    }

    const orderRow = {
      id: randomUUID(),
      ...payload,
      createdAt: new Date().toISOString(),
    };
    appendLocalOrder(orderRow);
    res.status(201).json(normalizeOrder(orderRow));
  } catch (err) {
    console.error("POST /api/orders error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders
app.get("/api/orders", async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : null;
    res.json(await readOrders(userId));
  } catch (err) {
    console.error("GET /api/orders error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["pending", "processing", "shipped", "completed", "cancelled"];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (isFirestoreConfigured) {
      await db.collection(ORDERS_COLL).doc(req.params.id).update({ status });
      return res.json({ ok: true, status });
    }

    const rows = readLocalOrdersRaw();
    const idx = rows.findIndex((order) => order.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Order not found" });
    rows[idx] = { ...rows[idx], status };
    writeLocalOrders(rows);
    res.json({ ok: true, status });
  } catch (err) {
    console.error("PATCH /api/orders error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/orders/:id (only for cancelled orders)
app.delete("/api/orders/:id", async (req, res) => {
  try {
    if (isFirestoreConfigured) {
      const docRef = db.collection(ORDERS_COLL).doc(req.params.id);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ error: "Order not found" });
      const status = snap.data().status;
      if (status !== "cancelled") {
        return res.status(400).json({ error: "Only cancelled orders can be deleted" });
      }
      await docRef.delete();
      return res.json({ success: true });
    }

    const rows = readLocalOrdersRaw();
    const order = rows.find((row) => row.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "cancelled") {
      return res.status(400).json({ error: "Only cancelled orders can be deleted" });
    }
    writeLocalOrders(rows.filter((row) => row.id !== req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/orders error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
app.delete("/api/products/:id", async (req, res) => {
  try {
    const products = await readProducts();
    const id = Number(req.params.id);
    const product = products.find((p) => p.id === id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (product.imageDeleteUrl) {
      await deleteImgbbImage(product.imageDeleteUrl);
    }
    if (isFirestoreConfigured) {
      await deleteProductFirestore(id);
    } else {
      const filtered = products.filter((p) => p.id !== id);
      await writeProducts(filtered);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Products API running at http://${HOST}:${PORT}`);
  console.log(`Firestore: ${isFirestoreConfigured ? "configured" : "NOT configured (add FIREBASE_CREDENTIALS_JSON to Railway)"}`);
  if (isFirestoreConfigured) {
    console.log("Data: Firestore (persistent)");
  } else {
    console.log("Data: local JSON (set credentials for Firestore)");
  }
  if (isImgbbConfigured) {
    console.log("Image upload: ImgBB (free, no billing)");
  } else if (isDriveConfigured) {
    console.log("Image upload: Google Drive");
  } else {
    console.log("Image upload: local disk (set IMGBB_API_KEY for free cloud upload)");
  }
});
