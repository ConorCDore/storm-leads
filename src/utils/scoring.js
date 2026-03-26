import { ROOF_VULN } from "../constants";

// ── Roof material inference ───────────────────────────────────────────────────
// Fallback when Cook County inspection record is absent (~89% of properties).
// Build-year heuristics for Cook County suburban housing stock.
export function inferRoofMaterial(yr) {
  if (!yr || yr <= 0) return { score: 1, label: "Roof type unknown" };
  if (yr < 1960)  return { score: 2, label: "Est. built-up/flat roof" };
  if (yr < 2005)  return { score: 3, label: "Est. asphalt shingle" };
  return { score: 2, label: "Est. architectural shingle" };
}

// ── Value filter ──────────────────────────────────────────────────────────────
// Converts operator's market-value range to AV equivalent (AV ≈ market / 3.3)
export function filterByValue(properties, minValue, maxValue) {
  if (!minValue && !maxValue) return properties;
  return properties.filter(r => {
    const av = parseInt(r.value);
    if (!av || av <= 0) return true; // keep unknowns — don't exclude potential leads
    const estMarket = av * 3.3;
    if (minValue && estMarket < minValue) return false;
    if (maxValue && estMarket > maxValue) return false;
    return true;
  });
}

// ── Score a single property ───────────────────────────────────────────────────
// Returns { pin, address, score, tier, reason, summary }
// weights: { roofAge, propertyValue, stormSeverity, roofMaterial, permitAge } each 0-5
// alertInfo: { pts: 0-3, label: string }
export function scoreProperty(r, alertInfo, weights, maxYear = 2010) {
  const reasons  = [];
  const factors  = {};
  const thisYear = new Date().getFullYear();

  // Roof Age (0-3)
  const yr = parseInt(r.year);
  if      (yr >= 1960 && yr <= 1990) { factors.roofAge = 3; reasons.push(`Built ${yr} (prime age)`); }
  else if (yr >= 1991 && yr <= 2005) { factors.roofAge = 2; reasons.push(`Built ${yr}`); }
  else if (yr > 2005  && yr <= maxYear){ factors.roofAge = 1; reasons.push(`Built ${yr}`); }
  else                                { factors.roofAge = 1; reasons.push(yr > 0 ? `Built ${yr}` : "Year unknown"); }

  // Property Value (0-3)
  const av = parseInt(r.value);
  if      (av >= 60000 && av <= 180000) { factors.propertyValue = 3; reasons.push(`AV $${av.toLocaleString()}`); }
  else if (av > 180000)                  { factors.propertyValue = 2; reasons.push(`AV $${av.toLocaleString()} (high-end)`); }
  else if (av > 0)                       { factors.propertyValue = 1; reasons.push(`AV $${av.toLocaleString()}`); }
  else                                   { factors.propertyValue = 1; reasons.push("AV unknown"); }

  // Storm Severity (0-3)
  factors.stormSeverity = alertInfo.pts;
  if (alertInfo.pts > 0) reasons.push(alertInfo.label);

  // Roof Material (0-3) — verified first, year-based inference fallback
  const mat      = (r.roofMaterial || "").toLowerCase();
  const matScore = mat
    ? Object.entries(ROOF_VULN).reduce((best, [kw, s]) => mat.includes(kw) ? Math.max(best, s) : best, -1)
    : -1;
  let roofLabel = "";
  if (matScore >= 0) {
    factors.roofMaterial = matScore;
    roofLabel = `${r.roofMaterial}${matScore === 0 ? " (durable)" : ""}`;
    reasons.push(`${roofLabel} ✓`);
  } else {
    const inf = inferRoofMaterial(yr);
    factors.roofMaterial = inf.score;
    roofLabel = inf.label + " (est.)";
    reasons.push(roofLabel);
  }

  // Permit History (0-3)
  const permitYr = parseInt(r.lastPermitYear);
  if      (!permitYr)                        { factors.permitAge = 2; reasons.push("No roof permit found"); }
  else if (thisYear - permitYr > 15)         { factors.permitAge = 3; reasons.push(`Last permit ${permitYr} (aged)`); }
  else if (thisYear - permitYr > 10)         { factors.permitAge = 2; reasons.push(`Last permit ${permitYr}`); }
  else if (thisYear - permitYr > 5)          { factors.permitAge = 1; reasons.push(`Permit ${permitYr}`); }
  else                                       { factors.permitAge = 0; reasons.push(`Recent permit ${permitYr}`); }

  // Weighted score — each factor 0-3, weights 0-5, normalize to 0-10
  let totalWeight = 0, totalScore = 0;
  for (const [key, raw] of Object.entries(factors)) {
    const w = weights[key] || 0;
    totalWeight += w;
    totalScore  += raw * w;
  }
  const score = totalWeight > 0
    ? Math.min(10, Math.round((totalScore / totalWeight) * (10 / 3)))
    : 0;

  // Plain-English summary
  const sumParts = [];
  if (yr > 0)      sumParts.push(`${thisYear - yr}yr old`);
  if (roofLabel)   sumParts.push(roofLabel.toLowerCase() + " roof");
  if (av > 0)      sumParts.push(`~$${Math.round(av * 3.3 / 1000)}k est. value`);
  if (permitYr && thisYear - permitYr > 15) sumParts.push(`roof permit expired ${permitYr}`);
  else if (!permitYr)                        sumParts.push("no roof permits on file");
  if (alertInfo.pts >= 2)                    sumParts.push("storm-impacted area");
  const summary = sumParts.join(", ");

  const tier    = score >= 7 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW";
  const address = [r.address, r.city, r.zip].filter(Boolean).join(", ") || r.pin || "unknown";

  return { pin: r.pin || "", address, score, tier, reason: reasons.join(" · "), summary };
}
