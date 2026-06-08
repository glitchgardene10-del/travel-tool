const memoryStore = new Map();

export default async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse(204, "");
  }

  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const tripId = url.searchParams.get("tripId");
      const pin = url.searchParams.get("pin");
      const record = await readTrip(tripId, pin);
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
      await writeRecord(tripId, record);
      return jsonResponse(200, { tripId, updatedAt });
    }

    return jsonResponse(405, { error: "method not allowed" });
  } catch (error) {
    const status = error.statusCode || 500;
    return jsonResponse(status, { error: error.message || "server error" });
  }
};

async function readTrip(tripId, pin) {
  validatePair(tripId, pin);
  const record = await readRecord(tripId);
  if (!record) throw httpError(404, "trip not found");
  if (record.pinHash !== hashPin(pin)) throw httpError(403, "invalid pin");
  return {
    tripId,
    trip: record.trip,
    updatedAt: record.updatedAt
  };
}

async function readRecord(tripId) {
  if (hasGithubStorage()) {
    return readGithubRecord(tripId);
  }
  return memoryStore.get(tripId) || null;
}

async function writeRecord(tripId, record) {
  if (hasGithubStorage()) {
    await writeGithubRecord(tripId, record);
    return;
  }
  memoryStore.set(tripId, record);
}

function hasGithubStorage() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
}

async function readGithubRecord(tripId) {
  const path = githubPath(tripId);
  const response = await githubFetch(path);
  if (response.status === 404) return null;
  if (!response.ok) throw httpError(502, "github read failed");
  const data = await response.json();
  const text = Buffer.from(data.content || "", "base64").toString("utf8");
  return JSON.parse(text);
}

async function writeGithubRecord(tripId, record) {
  const path = githubPath(tripId);
  const current = await githubFetch(path);
  let sha;
  if (current.ok) {
    const data = await current.json();
    sha = data.sha;
  } else if (current.status !== 404) {
    throw httpError(502, "github write lookup failed");
  }

  const body = {
    message: `Update ${tripId}`,
    content: Buffer.from(JSON.stringify(record, null, 2), "utf8").toString("base64"),
    branch: process.env.GITHUB_BRANCH || "main"
  };
  if (sha) body.sha = sha;

  const response = await githubFetch(path, {
    method: "PUT",
    body: JSON.stringify(body)
  });
  if (!response.ok) throw httpError(502, "github write failed");
}

function githubPath(tripId) {
  return `/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/data/trips/${tripId}.json`;
}

function githubFetch(path, options = {}) {
  const url = new URL(`https://api.github.com${path}`);
  if (!options.method || options.method === "GET") {
    url.searchParams.set("ref", process.env.GITHUB_BRANCH || "main");
  }
  return fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
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
