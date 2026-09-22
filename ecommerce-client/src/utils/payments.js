const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function startQrphCheckout(orderDraft) {
  const res = await fetch(`${API_URL}/api/payments/qrph/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderDraft),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not start QR Ph payment.");
  }

  return data;
}

export async function completeQrphCheckout(pendingOrderId) {
  const res = await fetch(`${API_URL}/api/payments/qrph/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingOrderId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Could not confirm QR Ph payment.");
    err.status = res.status;
    throw err;
  }

  return data;
}
