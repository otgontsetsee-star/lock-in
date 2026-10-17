// Sends Lock In alarms as Web Push notifications (runs on GitHub Actions every 5 min).
import webpush from "web-push";
import fs from "fs";
const PUB = "BFG14P4JpcK7RupqMPNDXwAt-_NEZ8H_wjbbX6fkBZOb1z_MbZnuoWB3V9YOeKsWqr4ulEqfX0sPncsmRxzpUEA";
const PRIV = process.env.VAPID_PRIVATE;
if (!PRIV) { console.log("VAPID_PRIVATE secret missing"); process.exit(0); }
webpush.setVapidDetails("mailto:lockin@users.noreply.github.com", PUB, PRIV);
const subs = JSON.parse(fs.readFileSync("push/subs.json", "utf8"));
const SENT = "push/sent.json";
const sent = fs.existsSync(SENT) ? JSON.parse(fs.readFileSync(SENT, "utf8")) : {};
const WINDOW = 20; // minutes after the alarm time we still send
// Ulaanbaatar is UTC+8 (no DST)
const ub = new Date(Date.now() + 8 * 3600e3);
const key = d => d.toISOString().slice(0, 10);
const today = key(ub), yest = key(new Date(ub - 864e5));
const nowMin = ub.getUTCHours() * 60 + ub.getUTCMinutes();
const toMin = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const hhmm = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
function blocks(start, k) {
  const w = Math.max(toMin("07:00"), toMin("09:30") - Math.max(0, Math.floor(dayDiff(start, k) / 7)) * 15);
  return [
    ["wake", w, "Босох · ор засах", "Тогтмол нойр = тунгалаг шийдвэр"],
    ["move", Math.max(w + 30, toMin("09:00")), "Дасгал 20 мин", "Хүчтэй бие стресс даана"],
    ["study", toMin("11:00"), "LOCK IN · Сурах 2 цаг", "Утсаа хол тавиад эхэл"],
    ["food", toMin("13:00"), "Өөрөө хоол хийж идэх", "Тогтвортой энерги"],
    ["clean", toMin("15:15"), "Гэрээ цэвэрлэх 20 мин", "Цэвэр орчин = төвлөрөл"],
    ["market", toMin("16:00"), "LOCK IN · London нээлт 2 цаг", "Дүрмээрээ л trade хий"],
    ["read", toMin("19:00"), "Ном 20 хуудас", "Тайван ухаан = FOMO-гүй"],
    ["med", toMin("19:40"), "Бясалгал 10 мин", "Lock In-ээ нээгээд таймераа эхлүүл"],
    ["sleep", w + 16 * 60, "Унтах · утас өөр өрөөнд", "Маргаашийн трейд эндээс эхэлнэ"],
  ];
}
const tag = s => s.s.endpoint.slice(-16);
const keep = new Set([today, yest]);
for (const k of Object.keys(sent)) if (!keep.has(k.split("|")[1])) delete sent[k];
let n = 0;
for (const s of subs) {
  for (const [day, off] of [[today, 0], [yest, 1440]]) {
    for (const [id, t, title, body] of blocks(s.start || "2026-10-17", day)) {
      const rel = t - off, k = tag(s) + "|" + day + "|" + id;
      if (nowMin >= rel && nowMin <= rel + WINDOW && !sent[k]) {
        try {
          await webpush.sendNotification(s.s, JSON.stringify({ title: "⏰ " + hhmm(t) + " · " + title, body, tag: "lockin-" + id }), { TTL: 1800, urgency: "high" });
          console.log("sent", k);
        } catch (e) { console.log("fail", k, e.statusCode, e.body); }
        sent[k] = 1; n++;
      }
    }
  }
}
fs.writeFileSync(SENT, JSON.stringify(sent));
console.log("now", today, hhmm(nowMin), "sent", n);
