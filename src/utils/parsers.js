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
    address : row.prop_address_full      || row.property_address || row.address  || row.Address || "",
    city    : row.prop_address_city_name || row.property_city    || row.city     || row.City    || "",
    zip     : row.prop_address_zipcode_1 || row.property_zip     || row.zip_code || row.zip     || "",
    ownerName : row.owner_address_name      || row.mailing_name     || row.owner    || "",
    ownerCity : row.owner_address_city_name || row.owner_city       || row.mailing_city || "",
    year    : row.year_built  || row["Year Built"]    || row.year  || "",
    value   : row.av_total    || row["Assessed Value"] || row.value || "",
    cls     : row.class || row.Class || "",
    pin     : row.pin   || row.PIN   || "",
  };
}

// ── IEM LSR → synthetic NWS alert converter ───────────────────────────────────
// Converts an IEM Local Storm Report into the same shape as a live NWS alert
// so areaSeverity / areaRanking logic works identically in historical mode.
export function lsrToAlert(feature) {
  const p    = feature.properties || {};
  const type = (p.typetext || p.type || "").toUpperCase();
  const mag  = parseFloat(p.magnitude) || 0;
  let event, severity;
  const params = {};

  if (type.includes("TORNADO")) {
    event = "Tornado"; severity = "Extreme";
  } else if (type.includes("HAIL")) {
    event = "Hail";
    severity = mag >= 2 ? "Severe" : mag >= 1 ? "Moderate" : "Minor";
    if (mag > 0) params.hailSize = [mag.toFixed(2)];
  } else if (type.includes("WIND") || type.includes("WND")) {
    event = "Severe Thunderstorm";
    severity = mag >= 65 ? "Severe" : mag >= 45 ? "Moderate" : "Minor";
    if (mag > 0) params.windGust = [String(mag)];
  } else if (type.includes("TSTM") || type.includes("THUNDER")) {
    event = "Severe Thunderstorm"; severity = "Moderate";
  } else {
    event = p.typetext || "Storm Report"; severity = "Minor";
  }

  const city    = (p.city || "").toUpperCase();
  const matched = AREA_MAP.find(a =>
    (a.city && city.includes(a.city)) ||
    city.includes(a.label.toUpperCase()) ||
    a.label.toUpperCase().includes(city)
  );
  const areaDesc = matched ? matched.label : (p.city || p.county || "");

  return { properties: { event, severity, areaDesc, parameters: params } };
}
