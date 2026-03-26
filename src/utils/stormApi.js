import { AREA_MAP, STORM_EVENTS } from "../constants";
import { lsrToAlert } from "./parsers";

const NWS_HEADERS = { "User-Agent": "(StormLeads, storm-leads-app)" };

// ── IEM Historical Local Storm Reports ───────────────────────────────────────
// Returns IEM LSR features already converted to synthetic NWS alert shape.
export async function fetchHistoricalAlerts(dateFrom, dateTo) {
  const from = new Date(dateFrom + "T12:00:00");
  const to   = new Date(dateTo   + "T12:00:00");
  const end  = new Date(to); end.setDate(end.getDate() + 1); // exclusive end date
  const pad  = n => String(n).padStart(2, "0");
  const url  =
    `https://mesonet.agron.iastate.edu/geojson/lsr.geojson` +
    `?syear=${from.getFullYear()}&smonth=${pad(from.getMonth()+1)}&sday=${pad(from.getDate())}` +
    `&eyear=${end.getFullYear()}&emonth=${pad(end.getMonth()+1)}&eday=${pad(end.getDate())}` +
    `&wfo=LOT`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`IEM API returned ${res.status}`);
  const json = await res.json();
  return (json.features || [])
    .filter(f => {
      const st = (f.properties?.state  || "").toUpperCase();
      const co = (f.properties?.county || "").toUpperCase();
      return st === "IL" && ["COOK","DUPAGE","LAKE","WILL"].some(c => co.includes(c));
    })
    .map(lsrToAlert);
}

// ── NWS Live Alerts ───────────────────────────────────────────────────────────
// Returns filtered NWS active alerts for Cook/DuPage/Lake/Will service areas.
export async function fetchLiveAlerts() {
  const res  = await fetch(
    "https://api.weather.gov/alerts/active?area=IL&status=actual&limit=50",
    { headers: NWS_HEADERS }
  );
  const json = await res.json();
  const names    = AREA_MAP.map(a => a.label.toLowerCase());
  const counties = ["cook","dupage","lake","will"];
  return (json.features || []).filter(f => {
    const ev = (f.properties.event    || "").toLowerCase();
    const ar = (f.properties.areaDesc || "").toLowerCase();
    return STORM_EVENTS.some(k => ev.includes(k.toLowerCase())) &&
      (names.some(n => ar.includes(n)) || counties.some(c => ar.includes(c)));
  });
}

// ── NWS Hazardous Weather Outlook ─────────────────────────────────────────────
// Returns { hailMentioned, severeMentioned, summary } or null on failure.
export async function fetchHWO() {
  try {
    const listRes  = await fetch(
      "https://api.weather.gov/products/types/HWO/locations/LOT",
      { headers: NWS_HEADERS }
    );
    const listJson = await listRes.json();
    const latest   = listJson["@graph"]?.[0];
    if (!latest) return null;
    const prodRes  = await fetch(latest["@id"], { headers: NWS_HEADERS });
    const prodJson = await prodRes.json();
    const text     = prodJson.productText || "";
    const lower    = text.toLowerCase();
    const lines    = text.split("\n").map(l => l.trim()).filter(l =>
      l.toLowerCase().includes("hail") ||
      l.toLowerCase().includes("severe") ||
      l.toLowerCase().includes("thunderstorm")
    );
    return {
      hailMentioned:   lower.includes("hail"),
      severeMentioned: lower.includes("severe") || lower.includes("damaging wind") || lower.includes("tornado"),
      summary: lines.slice(0, 2).join(" ").replace(/\s+/g, " ").trim().slice(0, 220),
    };
  } catch { return null; }
}

// ── IEM 5-Year Storm History ──────────────────────────────────────────────────
// Returns { [areaLabel]: hitCount } for all AREA_MAP entries.
// Only counts significant events; groups by calendar date to avoid inflation.
export async function fetchStormHistory() {
  const now  = new Date();
  const then = new Date(now); then.setFullYear(now.getFullYear() - 5);
  const pad  = n => String(n).padStart(2, "0");
  const url  =
    `https://mesonet.agron.iastate.edu/geojson/lsr.geojson` +
    `?syear=${then.getFullYear()}&smonth=${pad(then.getMonth()+1)}&sday=${pad(then.getDate())}` +
    `&eyear=${now.getFullYear()}&emonth=${pad(now.getMonth()+1)}&eday=${pad(now.getDate())}` +
    `&wfo=LOT`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`IEM ${res.status}`);
  const json = await res.json();

  const hitDays = {};
  AREA_MAP.forEach(a => { hitDays[a.label] = new Set(); });

  for (const f of (json.features || [])) {
    const p  = f.properties || {};
    if ((p.state  || "").toUpperCase() !== "IL") continue;
    const co = (p.county || "").toUpperCase();
    if (!["COOK","DUPAGE","LAKE","WILL"].some(c => co.includes(c))) continue;

    const type = (p.typetext || "").toUpperCase();
    const mag  = parseFloat(p.magnitude) || 0;
    if (type.includes("HAIL") && mag < 0.75) continue;
    if (type.includes("WIND") && !type.includes("TORNADO") && mag < 45) continue;
    if (!type.includes("HAIL") && !type.includes("WIND") && !type.includes("TORNADO")) continue;

    const city    = (p.city || "").toUpperCase();
    const dateKey = (p.valid || "").slice(0, 10);

    for (const a of AREA_MAP) {
      if (
        (a.city && city.includes(a.city)) ||
        city.includes(a.label.toUpperCase()) ||
        a.label.toUpperCase().split(" ").some(w => w.length > 3 && city.includes(w))
      ) {
        hitDays[a.label].add(dateKey);
      }
    }
  }

  const result = {};
  AREA_MAP.forEach(a => { result[a.label] = hitDays[a.label].size; });
  return result;
}
