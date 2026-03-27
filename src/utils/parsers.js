import { AREA_MAP } from "../constants";

// ── CSV parser ────────────────────────────────────────────────────────────────
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const parseRow = row => {
    const out = []; let cell = "", inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQ && row[i+1] === '"' ? (cell += '"', i++) : (inQ = !inQ); }
      else if (c === ',' && !inQ) { out.push(cell.trim()); cell = ""; }
      else cell += c;
    }
    out.push(cell.trim());
    return out;
  };
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseRow(line), obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
}

// ── Row normaliser — handles Cook County dataset column names + PropStream/custom ─
export function normaliseRow(row) {
  return {
    ...row,
    address : row.prop_address_full      || row.property_address || row.address  || row.Address || "",
    city    : row.prop_address_city_name || row.property_city    || row.city     || row.City    || "",
    zip     : row.prop_address_zipcode_1 || row.property_zip     || row.zip_code || row.zip     || "",
    ownerName : row.owner_address_name      || row.mail_address_name || row.mailing_name || row.owner || "",
    ownerCity : row.owner_address_city_name || row.mail_address_city_name || row.owner_city || row.mailing_city || "",
    year    : (() => {
      const yr = parseInt(row.year_built || row["Year Built"] || row.year);
      return yr > 1850 && yr < new Date().getFullYear() ? String(yr) : "";
    })(),
    value   : row.av_total    || row["Assessed Value"] || row.value || "",
    cls     : row.class || row.Class || "",
    pin     : row.pin   || row.PIN   || "",
  };
}

export function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── IEM LSR → synthetic NWS alert converter ───────────────────────────────────
// Converts an IEM Local Storm Report into the same shape as a live NWS alert
// so areaSeverity / areaRanking logic works identically in historical mode.
export function lsrToAlert(feature) {
  const p    = feature.properties || {};
  const type = (p.typetext || p.type || "").toUpperCase();
  const mag  = parseFloat(p.magnitude) || 0;
  const coords = feature.geometry?.coordinates || [0, 0];
  const [lon, lat] = coords;

  let event, severity;
  const params = {};

  if (type.includes("TORNADO")) {
    event = "Tornado"; severity = "Extreme";
  } else if (type.includes("HAIL")) {
    event = "Hail";
    severity = mag >= 2 ? "Severe" : mag >= 1 ? "Moderate" : "Minor";
    if (mag > 0) params.hailSize = [mag.toFixed(2)];
  } else if (type.includes("WIND") || type.includes("WND") || type.includes("TSTM")) {
    event = "Severe Thunderstorm";
    severity = mag >= 65 ? "Severe" : mag >= 45 ? "Moderate" : "Minor";
    if (mag > 0) params.windGust = [String(mag)];
  } else {
    // Other types (Flash Flood, etc)
    event = (p.typetext || "Storm Report").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    severity = "Minor";
  }

  // Geo-Fencing: Find all suburbs within 5 miles
  const impactedSuburbs = AREA_MAP.filter(area => {
    if (!area.lat || !area.lon) return false;
    const dist = getDistance(lat, lon, area.lat, area.lon);
    return dist <= 5;
  });

  if (impactedSuburbs.length === 0) return null;

  const areaDesc = impactedSuburbs.map(s => s.label).join("; ");

  return { properties: { event, severity, areaDesc, parameters: params } };
}
