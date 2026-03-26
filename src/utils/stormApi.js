import { AREA_MAP, STORM_EVENTS } from "../constants";
import { lsrToAlert, getDistance } from "./parsers";

const NWS_HEADERS = { "User-Agent": "(StormLeads, storm-leads-app)" };

// ── IEM Historical Local Storm Reports ───────────────────────────────────────
// Returns IEM LSR features already converted to synthetic NWS alert shape.
export async function fetchHistoricalAlerts(dateFrom, dateTo) {
  const sts = `${dateFrom}T00:00Z`;
  const ets = `${dateTo}T23:59Z`;
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${sts}&ets=${ets}&wfos=LOT,ILX`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`IEM API returned ${res.status}`);
  const json = await res.json();
  return (json.features || []).map(lsrToAlert).filter(a => a !== null);
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
  const sts = then.toISOString().split(".")[0] + "Z";
  const ets = now.toISOString().split(".")[0] + "Z";
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${sts}&ets=${ets}&wfos=LOT,ILX`;
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
    const isHail    = type.includes("HAIL");
    const isWind    = type.includes("WIND") || type.includes("WND") || type.includes("TSTM");
    const isTornado = type.includes("TORNADO");

    if (!isHail && !isWind && !isTornado) continue;
    if (isHail && mag > 0 && mag < 0.75) continue;
    if (isWind && !isTornado && mag > 0 && mag < 45) continue;

    const coords = f.geometry?.coordinates || [0, 0];
    const [lon, lat] = coords;
    const dateKey = (p.valid || "").slice(0, 10);

    for (const a of AREA_MAP) {
      if (!a.lat || !a.lon) continue;
      const dist = getDistance(lat, lon, a.lat, a.lon);
      if (dist <= 5) {
        hitDays[a.label].add(dateKey);
      }
    }
  }

  const result = {};
  AREA_MAP.forEach(a => { result[a.label] = hitDays[a.label].size; });
  return result;
}
