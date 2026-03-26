// ── Cook County Assessor Socrata API helpers ──────────────────────────────────
// Keeps all direct API calls in one place so StormLeads stays lean.
// Datasets used:
//   3723-97qp  Addresses     — pin, address, city, zip, owner
//   uzyt-m557  Assessments   — pin, class, certified_tot (AV)
//   bcnq-qi2z  Building      — pin, class, age (years old), bldg_sf
//   x54s-btds  Chars (roof)  — pin, char_roof_cnst (material code)
//   6yjf-dfxs  Permits       — pin, date_issued, work_description
//   wvhk-k5uv  Sales         — pin, sale_date, sale_price, buyer_name

const BASE      = "https://datacatalog.cookcountyil.gov/resource";
const PIN_BATCH = 100; // Socrata WHERE IN limit per request

// ── Step 1a: addresses for a township / city ──────────────────────────────────
export async function fetchAddressesByCity(city, limit) {
  const year = String(new Date().getFullYear());
  const url  =
    `${BASE}/3723-97qp.json` +
    `?$where=${encodeURIComponent(`upper(prop_address_city_name)='${city}' AND year='${year}'`)}` +
    `&$select=pin,prop_address_full,prop_address_city_name,prop_address_zipcode_1,owner_address_name` +
    `&$limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Address API ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

// ── Step 1b: addresses for a list of ZIP codes (map-based selection) ──────────
export async function fetchAddressesByZip(zips, limit) {
  const year    = String(new Date().getFullYear());
  const zipList = zips.map(z => `'${z}'`).join(",");
  const url     =
    `${BASE}/3723-97qp.json` +
    `?$where=${encodeURIComponent(`prop_address_zipcode_1 in(${zipList}) AND year='${year}'`)}` +
    `&$select=pin,prop_address_full,prop_address_city_name,prop_address_zipcode_1,owner_address_name` +
    `&$limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Address API ${res.status}`);
  return res.json();
}

// ── Step 2+3: enrich address rows with assessments, building, roof, permits ───
// addrNorm  — already-normalised address rows from normaliseRow()
// onStatus  — optional progress callback (msg: string) => void
// Returns { merged[], matchCount, roofCount, permitCount }
export async function enrichAddresses(addrNorm, onStatus = () => {}) {
  const pins      = addrNorm.map(r => r.pin).filter(Boolean);
  const thisYear  = new Date().getFullYear();
  const assessMap = new Map();
  const bldgMap   = new Map();
  const roofMap   = new Map();
  const permitMap = new Map();
  const saleMap   = new Map();

  // Build parallel fetches — 5 requests per PIN batch
  const fetches = [];
  for (let i = 0; i < pins.length; i += PIN_BATCH) {
    const pinList = pins.slice(i, i + PIN_BATCH).map(p => `'${p}'`).join(",");
    const prevYr  = String(thisYear - 1);
    fetches.push(
      // 0: Assessments (prior year — current year data often not yet certified)
      fetch(`${BASE}/uzyt-m557.json?$where=${encodeURIComponent(`pin in(${pinList}) AND year='${prevYr}'`)}&$select=pin,class,certified_tot&$limit=${PIN_BATCH}`)
        .catch(() => null),
      // 1: Building characteristics (age, sf)
      fetch(`${BASE}/bcnq-qi2z.json?$where=${encodeURIComponent(`pin in(${pinList})`)}&$select=pin,class,age,bldg_sf&$limit=${PIN_BATCH}`)
        .catch(() => null),
      // 2: Roof material — NOT NULL filter maximises verified coverage
      fetch(`${BASE}/x54s-btds.json?$where=${encodeURIComponent(`pin in(${pinList}) AND char_roof_cnst IS NOT NULL AND char_roof_cnst != ''`)}&$select=pin,char_roof_cnst&$order=year DESC&$limit=500`)
        .catch(() => null),
      // 3: Permits — most recent roofing permit per PIN
      fetch(`${BASE}/6yjf-dfxs.json?$where=${encodeURIComponent(`pin in(${pinList}) AND upper(work_description) like '%ROOF%'`)}&$select=pin,date_issued&$order=date_issued DESC&$limit=${PIN_BATCH}`)
        .catch(() => null),
      // 4: Sales — most recent sale per PIN
      fetch(`${BASE}/wvhk-k5uv.json?$where=${encodeURIComponent(`pin in(${pinList})`)}&$select=pin,sale_date,sale_price,buyer_name&$order=sale_date DESC&$limit=${PIN_BATCH}`)
        .catch(() => null),
    );
  }

  onStatus(`Fetching details for ${pins.length} properties (5 datasets)…`);
  const results = await Promise.all(fetches);

  // Process results — 4 per batch group: assess[0] bldg[1] roof[2] permit[3]
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (!res?.ok) continue;
    const data = await res.json();
    const idx  = i % 5;
    if (idx === 0) {
      for (const r of data) assessMap.set(r.pin, { cls: r.class || "", value: r.certified_tot || "" });
    } else if (idx === 1) {
      for (const r of data) {
        const age = parseInt(r.age);
        bldgMap.set(r.pin, { year: age > 0 ? String(thisYear - age) : "", cls: r.class || "" });
      }
    } else if (idx === 2) {
      for (const r of data) {
        const raw = String(r.char_roof_cnst || "").trim();
        if (raw) roofMap.set(r.pin, raw);
      }
    } else if (idx === 3) {
      for (const r of data) {
        if (!permitMap.has(r.pin) && r.date_issued) {
          const yr = new Date(r.date_issued).getFullYear();
          if (yr > 1900) permitMap.set(r.pin, yr);
        }
      }
    } else if (idx === 4) {
      for (const r of data) {
        if (!saleMap.has(r.pin) && r.sale_date) {
          saleMap.set(r.pin, {
            saleDate : r.sale_date,
            salePrice: parseFloat(r.sale_price) || 0,
            buyerName: r.buyer_name || ""
          });
        }
      }
    }
  }

  // Merge enrichment data onto address rows
  const merged = addrNorm.map(r => {
    const assess = r.pin ? assessMap.get(r.pin) : null;
    const bldg   = r.pin ? bldgMap.get(r.pin)   : null;
    const sale   = r.pin ? saleMap.get(r.pin)   : null;
    return {
      ...r,
      year          : r.year  || bldg?.year   || "",
      value         : r.value || assess?.value || "",
      cls           : r.cls   || assess?.cls   || bldg?.cls || "",
      roofMaterial  : (r.pin && roofMap.get(r.pin))   || "",
      lastPermitYear: (r.pin && permitMap.get(r.pin))  || "",
      saleDate      : sale?.saleDate || "",
      salePrice     : sale?.salePrice || 0,
      buyerName     : sale?.buyerName || "",
    };
  });

  return {
    merged,
    matchCount : merged.filter(r => r.year || r.value || r.cls).length,
    roofCount  : merged.filter(r => r.roofMaterial).length,
    permitCount: merged.filter(r => r.lastPermitYear).length,
    saleCount  : merged.filter(r => r.saleDate).length,
  };
}

// ── Motivation Classifier ─────────────────────────────────────────────────────
export function classifyMotivation(row) {
  const reasons = [];
  let tier = "STANDARD";
  let label = "";

  const ownerName = row.ownerName || "";
  const saleDate = row.saleDate || "";
  const salePrice = parseFloat(row.salePrice) || 0;
  const value = parseFloat(row.value) || 0;
  const city = (row.city || "").toUpperCase();

  const now = new Date();
  const saleDateObj = saleDate ? new Date(saleDate) : null;
  const monthsSinceSale = saleDateObj ? (now - saleDateObj) / (1000 * 60 * 60 * 24 * 30.44) : 999;

  // 1. INVESTOR
  const investorKeywords = ["LLC", "CORP", "INC", "TRUST", "HOLDINGS", "REIT", "PROPERTIES", "INVESTMENTS", "REALTY", "PARTNERS", "VENTURES"];
  const isInvestor = investorKeywords.some(k => ownerName.toUpperCase().includes(k));

  // 2. FLIPPER — purchased within last 6 months and not already an investor entity.
  // Price-discount check removed: sale_price is often absent in the dataset, and
  // in practice any sub-6-month owner needs the roof fixed before they can resell.
  const isFlipper = monthsSinceSale <= 6;

  // 3. RECENT_BUYER — purchased 6–18 months ago (not a flipper, not an investor)
  const isRecentBuyer = monthsSinceSale > 6 && monthsSinceSale <= 18;

  // 4. ABSENTEE
  // ownerName is present but doesn't match any word in the property's city name, AND saleDate is not recent
  const cityWords = city.split(/[\s,]+/).filter(w => w.length > 2);
  const ownerMatchesCity = cityWords.length > 0 && cityWords.some(w => ownerName.toUpperCase().includes(w));
  const isAbsentee = ownerName && !ownerMatchesCity && monthsSinceSale > 18;

  if (isInvestor) {
    tier = "INVESTOR";
    label = "Investor / LLC";
    reasons.push(`Owner: ${ownerName}`);
  } else if (isFlipper) {
    tier = "FLIPPER";
    label = "Recent Flip";
    const mo = Math.round(monthsSinceSale);
    reasons.push(`Purchased ${mo <= 1 ? "within the last month" : `${mo} months ago`} — on a tight resale clock`);
    if (salePrice > 0) reasons.push(`Sale price: $${salePrice.toLocaleString()}`);
  } else if (isRecentBuyer) {
    tier = "RECENT_BUYER";
    label = "New Owner";
    const mo = Math.round(monthsSinceSale);
    reasons.push(`Purchased ${mo} months ago`);
    if (salePrice > 0) reasons.push(`Sale price: $${salePrice.toLocaleString()}`);
  } else if (isAbsentee) {
    tier = "ABSENTEE";
    label = "Absentee Owner";
    reasons.push("Mailing address differs from property city");
  }

  return { tier, label, reasons };
}
