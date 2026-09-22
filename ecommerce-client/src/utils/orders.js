const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function normalizeOrder(order) {
  return {
    ...order,
    createdAt: order.createdAt ? new Date(order.createdAt) : null,
  };
}

/** Orders always come from the API server (local JSON in dev, Firestore on Railway in prod). */
export async function fetchUserOrders(user) {
  if (!user?.uid) return { orders: [], error: null, source: API_URL };

  try {
    const res = await fetch(
      `${API_URL}/api/orders?userId=${encodeURIComponent(user.uid)}`
    );
    if (!res.ok) {
      return {
        orders: [],
        error: "Could not load orders from the store API.",
        source: API_URL,
      };
    }

    const data = await res.json();
    const orders = (Array.isArray(data) ? data : [])
      .map(normalizeOrder)
      .sort(
        (a, b) =>
          (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );

    return { orders, error: null, source: API_URL };
  } catch {
    return {
      orders: [],
      error: `Cannot reach the store API at ${API_URL}. Start it with: cd server && npm run dev`,
      source: API_URL,
    };
  }
}

export { API_URL as ordersApiUrl };
