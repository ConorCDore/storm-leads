import { ROOF_VULN, WEIGHT_LABELS } from "../constants";

// ── Roof material inference ───────────────────────────────────────────────────
// Fallback when Cook County inspection record is absent (~89% of properties).
// Build-year heuristics for Cook County suburban housing stock.
export function inferRoofMaterial(yr) {
  if (!yr || yr <= 0) return { score: 1, label: "Roof type unknown" };
  if (yr < 1960) return { score: 2, label: "Est. built-up/flat roof" };
  if (yr < 2005) return { score: 3, label: "Est. asphalt shingle" };
  return { score: 2, label: "Est. architectural shingle" };
}

// ── Property class filter ─────────────────────────────────────────────────────
// Cook County class codes grouped into operator-friendly categories.
// allowedTypes: Set of category keys the operator has toggled on.
export const PROPERTY_TYPES = {
  residential:  { label: "🏠 Residential",  prefix: "2", desc: "Single-family homes (Class 2xx)" },
  condo:        { label: "🏢 Condo/Multi",  prefix: "3", desc: "Condos, co-ops, multi-family (Class 3xx)" },
  commercial:   { label: "🏪 Commercial",   prefix: "5", desc: "Commercial & industrial (Class 5xx)" },
  vacant:       { label: "🌿 Vacant Land",  prefix: "1", desc: "Vacant lots (Class 1xx)" },
  exempt:       { label: "⛪ Exempt",        prefix: "9", desc: "Tax-exempt — churches, gov't (Class 9xx)" },
};

export const DEFAULT_PROP_TYPES = new Set(["residential"]); // sensible default

export function filterByClass(properties, allowedTypes = DEFAULT_PROP_TYPES) {
  // If all types are on, skip filtering entirely
  if (allowedTypes.size === Object.keys(PROPERTY_TYPES).length) return properties;

  const allowedPrefixes = new Set();
  for (const key of allowedTypes) {
    const pt = PROPERTY_TYPES[key];
    if (pt) allowedPrefixes.add(pt.prefix);
  }

  return properties.filter(r => {
    const cls = (r.cls || "").replace(/\D/g, "").slice(0, 3);
    if (!cls) return true; // keep unknowns — don't exclude potential leads
    const prefix = cls.charAt(0);
    return allowedPrefixes.has(prefix);
  });
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
// Returns { pin, address, score, tier, reason, summary, breakdown }
// weights: { roofAge, propertyValue, stormSeverity, roofMaterial, permitAge, motivation } each 0-5
// alertInfo: { pts: 0-3, label: string }
export function scoreProperty(r, alertInfo, weights, maxYear = 2010, motivation = null) {
  const reasons = [];
  const factors = {};
  const factorDetails = {};  // human-readable per-factor label for breakdown card
  const thisYear = new Date().getFullYear();

  // Roof Age (0-3)
  const yr = parseInt(r.year);
  if (yr > 1850 && yr <= 1990) { factors.roofAge = 3; factorDetails.roofAge = `Built ${yr} (prime age)`; }
  else if (yr >= 1991 && yr <= 2005) { factors.roofAge = 2; factorDetails.roofAge = `Built ${yr}`; }
  else if (yr > 2005 && yr < thisYear) { factors.roofAge = 1; factorDetails.roofAge = `Built ${yr}`; }
  else { factors.roofAge = 0; factorDetails.roofAge = "Age Unknown"; }
  reasons.push(factorDetails.roofAge);

  // Property Value (0-3)
  const av = parseInt(r.value);
  if (av >= 60000 && av <= 180000) { factors.propertyValue = 3; factorDetails.propertyValue = `AV $${av.toLocaleString()}`; }
  else if (av > 180000) { factors.propertyValue = 2; factorDetails.propertyValue = `AV $${av.toLocaleString()} (high-end)`; }
  else if (av > 0) { factors.propertyValue = 1; factorDetails.propertyValue = `AV $${av.toLocaleString()}`; }
  else { factors.propertyValue = 1; factorDetails.propertyValue = "AV unknown"; }
  reasons.push(factorDetails.propertyValue);

  // Storm Severity (0-3)
  factors.stormSeverity = alertInfo.pts;
  factorDetails.stormSeverity = alertInfo.pts > 0 ? alertInfo.label : "No active alerts";
  if (alertInfo.pts > 0) reasons.push(factorDetails.stormSeverity);

  // Roof Material (0-3) — verified first, year-based inference fallback
  const mat = (r.roofMaterial || "").toLowerCase();
  const matScore = mat
    ? Object.entries(ROOF_VULN).reduce((best, [kw, s]) => mat.includes(kw) ? Math.max(best, s) : best, -1)
    : -1;
  let roofLabel = "";
  if (matScore >= 0) {
    factors.roofMaterial = matScore;
    roofLabel = `${r.roofMaterial}${matScore === 0 ? " (durable)" : ""}`;
    factorDetails.roofMaterial = `${roofLabel} ✓`;
    reasons.push(factorDetails.roofMaterial);
  } else {
    const inf = inferRoofMaterial(yr);
    factors.roofMaterial = inf.score;
    roofLabel = inf.label + " (est.)";
    factorDetails.roofMaterial = roofLabel;
    reasons.push(roofLabel);
  }

  // Permit History (0-3)
  const permitYr = parseInt(r.lastPermitYear);
  const isRoofPermit = r.isRoofPermit;
  if (!permitYr) { factors.permitAge = 2; factorDetails.permitAge = "No roof permit found"; }
  else if (thisYear - permitYr > 15) { factors.permitAge = 3; factorDetails.permitAge = `Last permit ${permitYr} (aged)`; }
  else if (thisYear - permitYr > 10) { factors.permitAge = 2; factorDetails.permitAge = `Last permit ${permitYr}`; }
  else if (thisYear - permitYr > 5) { factors.permitAge = 1; factorDetails.permitAge = `Permit ${permitYr}`; }
  else { factors.permitAge = 0; factorDetails.permitAge = `Recent permit ${permitYr}`; }
  reasons.push(factorDetails.permitAge);

  // Permit ↔ Roof Age interaction: if a ROOF permit exists within the last 10 years,
  // the roof was likely replaced — cap roofAge score at 1 regardless of build year
  if (isRoofPermit && permitYr && (thisYear - permitYr) <= 10 && factors.roofAge > 1) {
    factors.roofAge = 1;
    factorDetails.roofAge = `Built ${yr} — roof permit ${permitYr} (likely replaced)`;
  }

  // Motivation (0-3)
  const m = motivation?.tier || "STANDARD";
  if      (m === "ELITE_FLIPPER") { factors.motivation = 3; factorDetails.motivation = "🔥 Active Flip"; }
  else if (m === "INVESTOR")      { factors.motivation = 2; factorDetails.motivation = "Investor"; }
  else if (m === "FLIPPER")       { factors.motivation = 2; factorDetails.motivation = "Recent Flip"; }
  else if (m === "RECENT_BUYER")  { factors.motivation = 1; factorDetails.motivation = "New Owner"; }
  else                            { factors.motivation = 0; factorDetails.motivation = "Standard"; }
  if (factors.motivation > 0) reasons.push(factorDetails.motivation);

  // Weighted score — each factor 0-3, weights 0-5, normalize to 0-10
  let totalWeight = 0, totalScore = 0;
  for (const [key, raw] of Object.entries(factors)) {
    const w = weights[key] || 0;
    totalWeight += w;
    totalScore += raw * w;
  }
  const score = totalWeight > 0
    ? Math.min(10, Math.round((totalScore / totalWeight) * (10 / 3)))
    : 0;

  // Plain-English summary
  const sumParts = [];
  if (yr > 0) sumParts.push(`${thisYear - yr}yr old`);
  if (roofLabel) sumParts.push(roofLabel.toLowerCase() + " roof");
  if (av > 0) sumParts.push(`~$${Math.round(av * 3.3 / 1000)}k est. value`);
  if (permitYr && thisYear - permitYr > 15) sumParts.push(`roof permit expired ${permitYr}`);
  else if (!permitYr) sumParts.push("no roof permits on file");
  if (alertInfo.pts >= 2) sumParts.push("storm-impacted area");
  const summary = sumParts.join(", ");

  const tier = score >= 7 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW";
  const address = [r.address, r.city, r.zip].filter(Boolean).join(", ") || r.pin || "unknown";

  // Structured breakdown for expandable card view
  const breakdown = Object.keys(factors).map(key => ({
    key,
    label: WEIGHT_LABELS[key] || key,
    raw: factors[key],
    weight: weights[key] || 0,
    detail: factorDetails[key] || "",
  }));

  // Sortable numeric fields for the leads grid
  const estValue = av > 0 ? Math.round(av * 3.3) : 0;
  const yearBuilt = yr > 0 ? yr : 0;
  const roofAge = yr > 0 ? thisYear - yr : 0;
  const ownerName = r.ownerName || "";

  return { pin: r.pin || "", address, score, tier, reason: reasons.join(" · "), summary, breakdown, motivation, estValue, yearBuilt, roofAge, ownerName };
}
