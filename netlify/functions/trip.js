const { getStore } = require("@netlify/blobs");

const store = getStore("trips");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return response(204, "");
  }

  try {
    if (event.httpMethod === "GET") {
      const tripId = event.queryStringParameters?.tripId;
      const pin = event.queryStringParameters?.pin;
      const record = await readTrip(tripId, pin);
      return response(200, record);
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { tripId, pin, trip } = body;
      validatePair(tripId, pin);
      if (!trip || typeof trip !== "object") {
        return response(400, { error: "trip is required" });
      }

      const updatedAt = new Date().toISOString();
      const record = { tripId, pinHash: hashPin(pin), trip, updatedAt };
      await store.setJSON(tripId, record);
      return response(200, { tripId, updatedAt });
    }

    return response(405, { error: "method not allowed" });
  } catch (error) {
    const status = error.statusCode || 500;
    return response(status, { error: error.message || "server error" });
  }
};

async function readTrip(tripId, pin) {
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

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  };
}
