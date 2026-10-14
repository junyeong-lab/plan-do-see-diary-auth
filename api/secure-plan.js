// T07 owned-plan API. Unauthorized requests are 401; inaccessible IDs are 404.
// The public Supabase publishable key is not a server secret.
const BASE = "https://jrjkoierayrsknlhoqlb.supabase.co";
const PUBLIC_KEY = "sb_publishable_RbOYTnIoLsj7d9YpMEVwmA_GKIFn2KT";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "PATCH", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const id = Number(req.query?.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid_id" });
  const auth = req.headers.authorization || "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(auth)) return res.status(401).json({ error: "authentication_required" });
  const token = auth.slice(7);
  const headers = { apikey: PUBLIC_KEY, Authorization: "Bearer " + token };
  try {
    // Do not trust client-supplied account IDs. Resolve identity with Supabase Auth.
    const check = await fetch(BASE + "/auth/v1/user", { headers, cache: "no-store" });
    if (!check.ok) return res.status(401).json({ error: "invalid_session" });
    const user = await check.json();
    if (!user.id) return res.status(401).json({ error: "invalid_session" });
    const url = BASE + "/rest/v1/plans?id=eq." + id + "&user_id=eq." + encodeURIComponent(user.id) + "&select=id,title,user_id";
    const found = await fetch(url, { headers, cache: "no-store" });
    if (!found.ok) return res.status(502).json({ error: "data_lookup_failed" });
    const rows = await found.json();
    if (!Array.isArray(rows) || rows.length !== 1) return res.status(404).json({ error: "not_found" });
    if (req.method === "GET") return res.status(200).json({ id: rows[0].id, title: rows[0].title });
    if (req.method === "PATCH") {
      if (typeof req.body?.title !== "string" || !req.body.title.trim() || req.body.title.length > 160)
        return res.status(400).json({ error: "invalid_title" });
    }
    const method = req.method;
    const mutate = await fetch(BASE + "/rest/v1/plans?id=eq." + id + "&user_id=eq." + encodeURIComponent(user.id), {
      method,
      headers: { ...headers, ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}), Prefer: "return=minimal" },
      ...(method === "PATCH" ? { body: JSON.stringify({ title: req.body.title.trim() }) } : {})
    });
    if (!mutate.ok) return res.status(502).json({ error: "operation_failed" });
    return res.status(204).end();
  } catch (_) {
    return res.status(503).json({ error: "service_unavailable" });
  }
}
