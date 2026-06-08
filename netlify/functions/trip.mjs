import { getStore } from "@netlify/blobs";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse(204, "");
  }

  try {
    const store = getStore("trips");

    if (request.method === "GET") {
      const url = new URL(request.url);
      const tripId = url.searchParams.get("tripId");
      const pin = url.searchParams.get("pin");
      const record = await readTrip(store, tripId, pin);
      return jsonResponse(200, record);
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const { tripId, pin, trip } = body;
      validatePair(tripId, pin);
      if (!trip || typeof trip !== "object") {
        return jsonResponse(400, { error: "trip is required" });
      }

      const updatedAt = new Date().toISOString();
      const record = { tripId, pinHash: hashPin(pin), trip, updatedAt };
      await store.setJSON(tripId, record);
      return jsonResponse(200, { tripId, updatedAt });
    }

    return jsonResponse(405, { error: "method not allowed" });
  } catch (error) {
    const status = error.statusCode || 500;
    return jsonResponse(status, { error: error.message || "server error" });
  }
};

async function readTrip(store, tripId, pin) {
  validatePair(tripId, pin);
  const record = await store.get(tripId, { type: "json" });
  if (!record) throw httpError(404, "trip not found");
  if (record.pinHash !== hashPin(pin)) throw httpError(403, "invalid pin");
  return {
    tripId,
    trip: record.trip,
    updatedAt: record.updatedAt
  };
}

function validatePair(tripId, pin) {
  if (!tripId || !/^trip_[a-z0-9-]{6,40}$/i.test(tripId)) {
    throw httpError(400, "invalid tripId");
  }
  if (!pin || !/^[0-9]{6}$/.test(pin)) {
    throw httpError(400, "invalid pin");
  }
}

function hashPin(pin) {
  let hash = 5381;
  for (let index = 0; index < pin.length; index += 1) {
    hash = ((hash << 5) + hash) + pin.charCodeAt(index);
  }
  return String(hash >>> 0);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function jsonResponse(status, body) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
    }
  });
}
