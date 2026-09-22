const PAYMONGO_API = "https://api.paymongo.com";

export function isPayMongoConfigured() {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

function getSecretKey() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new Error("PayMongo is not configured on the server.");
  }
  return key;
}

function authHeader() {
  const token = Buffer.from(`${getSecretKey()}:`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function paymongoRequest(pathname, options = {}) {
  const response = await fetch(`${PAYMONGO_API}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader(),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      payload?.errors?.[0]?.detail ||
      payload?.errors?.[0]?.code ||
      "PayMongo request failed.";
    throw new Error(detail);
  }

  return payload;
}

export function toCentavos(amount) {
  return Math.round(Number(amount) * 100);
}

export function buildLineItems(items) {
  return items.map((item) => ({
    name: String(item.name || "Product").slice(0, 120),
    amount: toCentavos(item.price),
    currency: "PHP",
    quantity: Math.max(1, Number(item.quantity) || 1),
  }));
}

export async function createQrphCheckoutSession({
  lineItems,
  successUrl,
  cancelUrl,
  referenceNumber,
  metadata,
}) {
  const payload = await paymongoRequest("/v2/checkout_sessions", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: ["qrph"],
          success_url: successUrl,
          cancel_url: cancelUrl,
          reference_number: referenceNumber,
          send_email_receipt: false,
          metadata: metadata || {},
        },
      },
    }),
  });

  return {
    sessionId: payload.data.id,
    checkoutUrl: payload.data.attributes.checkout_url,
  };
}

export async function retrieveCheckoutSession(sessionId) {
  const payload = await paymongoRequest(`/v1/checkout_sessions/${sessionId}`, {
    method: "GET",
  });
  return payload.data;
}

export function isCheckoutSessionPaid(session) {
  const attrs = session?.attributes || {};
  if (attrs.paid_at) return true;

  const payments = Array.isArray(attrs.payments) ? attrs.payments : [];
  if (payments.some((payment) => payment?.attributes?.status === "paid")) {
    return true;
  }

  const paymentIntent = attrs.payment_intent?.attributes;
  if (paymentIntent?.status === "succeeded") return true;

  const intentPayments = Array.isArray(paymentIntent?.payments)
    ? paymentIntent.payments
    : [];
  if (intentPayments.some((payment) => payment?.attributes?.status === "paid")) {
    return true;
  }

  return attrs.status === "paid";
}
