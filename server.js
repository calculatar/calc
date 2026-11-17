const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 30);
const DATA_FILE = path.join(__dirname, "visits.json");

if (!ADMIN_PASSWORD) {
  console.error("Set ADMIN_PASSWORD before starting, e.g.  ADMIN_PASSWORD='something-long' npm start");
  process.exit(1);
}

const app = express();

// If you run behind a proxy/CDN (Nginx, Cloudflare, etc.), set TRUST_PROXY=1
// so req.ip uses X-Forwarded-For. Leave it unset when exposed directly,
// otherwise visitors could spoof their IP with a fake header.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || true);

// ---------- storage ----------
let visits = [];
try {
  visits = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
  visits = [];
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(visits));
}

function prune() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const before = visits.length;
  visits = visits.filter((v) => new Date(v.time).getTime() >= cutoff);
  if (visits.length !== before) save();
}
prune();
setInterval(prune, 60 * 60 * 1000);

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const [user, ...rest] = Buffer.from(header.slice(6), "base64").toString().split(":");
    const pass = rest.join(":");
    if (safeEqual(user, ADMIN_USER) && safeEqual(pass, ADMIN_PASSWORD)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Admin", charset="UTF-8"');
  res.status(401).send("Authentication required");
}

// ---------- public page ----------
app.get("/", (req, res) => {
  visits.push({
    time: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
    referrer: req.get("referer") || "",
  });
  save();

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 15vh auto; padding: 0 16px; color: #222; }
    small { color: #666; }
  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>Thanks for visiting.</p>
  <small>Privacy notice: this site records your IP address and visit time. Records are kept for ${RETENTION_DAYS} days and are visible only to the site administrator.</small>
</body>
</html>`);
});

// ---------- admin page ----------
app.get("/admin", requireAdmin, (req, res) => {
  const rows = [...visits]
    .reverse()
    .map(
      (v) => `<tr>
        <td>${esc(new Date(v.time).toLocaleString())}</td>
        <td><code>${esc(v.ip)}</code></td>
        <td>${esc(v.userAgent)}</td>
        <td>${esc(v.referrer)}</td>
      </tr>`
    )
    .join("");

  const unique = new Set(visits.map((v) => v.ip)).size;

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="15">
  <title>Admin: Visitors</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #222; }
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { background: #f5f5f5; position: sticky; top: 0; }
    td:nth-child(3) { max-width: 360px; word-break: break-word; color: #555; }
    .stats { margin-bottom: 16px; color: #555; }
  </style>
</head>
<body>
  <h1>Visitor log</h1>
  <p class="stats">${visits.length} visits &middot; ${unique} unique IPs &middot; retained ${RETENTION_DAYS} days &middot; auto-refreshes every 15s</p>
  <table>
    <thead><tr><th>Time</th><th>IP address</th><th>Browser</th><th>Referrer</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No visits yet.</td></tr>'}</tbody>
  </table>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}  (admin at /admin)`));
