// ── StormLeads Constants ──────────────────────────────────────────────────────

export const AREA_MAP = [
  { label: "Arlington Heights",  township: "Wheeling",       city: "ARLINGTON HEIGHTS",  lat: 42.0884, lon: -87.9806 },
  { label: "Mount Prospect",     township: "Wheeling",       city: "MOUNT PROSPECT",     lat: 42.0664, lon: -87.9373 },
  { label: "Des Plaines",        township: "Maine",          city: "DES PLAINES",        lat: 42.0334, lon: -87.8834 },
  { label: "Park Ridge",         township: "Maine",          city: "PARK RIDGE",         lat: 42.0111, lon: -87.8445 },
  { label: "Elk Grove Village",  township: "Elk Grove",      city: "ELK GROVE VILLAGE",  lat: 42.0039, lon: -87.9959 },
  { label: "Schaumburg",         township: "Schaumburg",     city: "SCHAUMBURG",         lat: 42.0334, lon: -88.0834 },
  { label: "Niles",              township: "Niles",          city: "NILES",              lat: 42.0309, lon: -87.8028 },
  { label: "Skokie",             township: "Niles",          city: "SKOKIE",             lat: 42.0324, lon: -87.7416 },
  { label: "Evanston",           township: "Evanston",       city: "EVANSTON",           lat: 42.0451, lon: -87.6877 },
  { label: "Wilmette",           township: "New Trier",      city: "WILMETTE",           lat: 42.0723, lon: -87.7228 },
  { label: "Winnetka",           township: "New Trier",      city: "WINNETKA",           lat: 42.1081, lon: -87.7359 },
  { label: "Glenview",           township: "Northfield",     city: "GLENVIEW",           lat: 42.0697, lon: -87.8284 },
  { label: "Northbrook",         township: "Northfield",     city: "NORTHBROOK",         lat: 42.1275, lon: -87.8289 },
  { label: "Highland Park",      township: "Ela",            city: "HIGHLAND PARK",      lat: 42.1817, lon: -87.8003 },
  { label: "Deerfield",          township: "West Deerfield", city: "DEERFIELD",          lat: 42.1711, lon: -87.8445 },
  { label: "Lake Zurich",        township: "Ela",            city: "LAKE ZURICH",        lat: 42.1969, lon: -88.0934 },
  { label: "Libertyville",       township: null,             city: null,                 lat: 42.2831, lon: -87.9531 },
  { label: "Kildeer",            township: null,             city: null,                 lat: 42.1695, lon: -88.0493 },
];

export const COOK_AREAS  = AREA_MAP.filter(a =>  a.township);
export const OTHER_AREAS = AREA_MAP.filter(a => !a.township);

export const STORM_EVENTS = [
  "Severe Thunderstorm", "Tornado", "Hail",
  "Flash Flood", "Special Weather Statement", "Winter Storm",
];

export const ROOF_VULN = {
  shingle: 3, asphalt: 3, wood: 2, shake: 2,
  tar: 2, gravel: 2, slate: 0, tile: 0, metal: 0, copper: 0,
};

export const DEFAULT_WEIGHTS = {
  roofAge: 3, propertyValue: 2, stormSeverity: 4, roofMaterial: 3, permitAge: 2,
};

export const WEIGHT_LABELS = {
  roofAge: "Roof Age",
  propertyValue: "Property Value",
  stormSeverity: "Storm Severity",
  roofMaterial: "Roof Material",
  permitAge: "Permit History",
};
