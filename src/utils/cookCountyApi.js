// ── Cook County Assessor Socrata API helpers ──────────────────────────────────
// Keeps all direct API calls in one place so StormLeads stays lean.
// Datasets used:
//   3723-97qp  Addresses     — pin, address, city, zip, owner
//   uzyt-m557  Assessments   — pin, class, certified_tot (AV)
//   bcnq-qi2z  Building      — pin, class, age (years old), bldg_sf
//   x54s-btds  Chars (roof)  — pin, char_roof_cnst (material code)
//   6yjf-dfxs  Permits       — pin, date_issued, work_description

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

  // Build parallel fetches — 4 requests per PIN batch
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
    );
  }

  onStatus(`Fetching details for ${pins.length} properties (4 datasets)…`);
  const results = await Promise.all(fetches);

  // Process results — 4 per batch group: assess[0] bldg[1] roof[2] permit[3]
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (!res?.ok) continue;
    const data = await res.json();
    const idx  = i % 4;
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
    } else {
      for (const r of data) {
        if (!permitMap.has(r.pin) && r.date_issued) {
          const yr = new Date(r.date_issued).getFullYear();
          if (yr > 1900) permitMap.set(r.pin, yr);
        }
      }
    }
  }

  // Merge enrichment data onto address rows
  const merged = addrNorm.map(r => {
    const assess = r.pin ? assessMap.get(r.pin) : null;
    const bldg   = r.pin ? bldgMap.get(r.pin)   : null;
    return {
      ...r,
      year          : r.year  || bldg?.year   || "",
      value         : r.value || assess?.value || "",
      cls           : r.cls   || assess?.cls   || bldg?.cls || "",
      roofMaterial  : (r.pin && roofMap.get(r.pin))   || "",
      lastPermitYear: (r.pin && permitMap.get(r.pin))  || "",
    };
  });

  return {
    merged,
    matchCount : merged.filter(r => r.year || r.value || r.cls).length,
    roofCount  : merged.filter(r => r.roofMaterial).length,
    permitCount: merged.filter(r => r.lastPermitYear).length,
  };
}
