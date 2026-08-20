// Sanasto progress store.
// GET  /.netlify/functions/progress?u=alex   -> { user, profile|null }
// PUT  /.netlify/functions/progress?u=alex   <- { profile: {...} }
// Storage is Netlify Blobs: one JSON blob per lowercased username.
// No password. A name is a slot, exactly like the old localStorage profile,
// except it now lives on the server so it survives a new device, a cleared
// browser, and a site rename.

import { getStore } from "@netlify/blobs";

const HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

const MAX_BYTES = 2_000_000;

function cleanUser(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ._-]/g, "")
    .slice(0, 60);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: HEADERS });

  const user = cleanUser(new URL(req.url).searchParams.get("u"));
  if (!user) return json({ error: "missing user" }, 400);

  let store;
  try {
    store = getStore({ name: "sanasto-progress", consistency: "strong" });
  } catch (e) {
    return json({ error: "store unavailable", detail: String(e) }, 503);
  }

  if (req.method === "GET") {
    const profile = await store.get(user, { type: "json" });
    return json({ user, profile: profile || null });
  }

  if (req.method === "PUT" || req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    const profile = body && body.profile;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return json({ error: "no profile" }, 400);
    }
    if (JSON.stringify(profile).length > MAX_BYTES) {
      return json({ error: "profile too large" }, 413);
    }
    profile.updated = Date.now();
    await store.setJSON(user, profile);
    return json({ ok: true, user, updated: profile.updated });
  }

  return json({ error: "method not allowed" }, 405);
};
