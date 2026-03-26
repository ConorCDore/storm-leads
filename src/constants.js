// ── StormLeads Constants ──────────────────────────────────────────────────────

export const AREA_MAP = [
  { label: "Arlington Heights",  township: "Wheeling",       city: "ARLINGTON HEIGHTS"  },
  { label: "Mount Prospect",     township: "Wheeling",       city: "MOUNT PROSPECT"     },
  { label: "Des Plaines",        township: "Maine",          city: "DES PLAINES"        },
  { label: "Park Ridge",         township: "Maine",          city: "PARK RIDGE"         },
  { label: "Elk Grove Village",  township: "Elk Grove",      city: "ELK GROVE VILLAGE"  },
  { label: "Schaumburg",         township: "Schaumburg",     city: "SCHAUMBURG"         },
  { label: "Niles",              township: "Niles",          city: "NILES"              },
  { label: "Skokie",             township: "Niles",          city: "SKOKIE"             },
  { label: "Evanston",           township: "Evanston",       city: "EVANSTON"           },
  { label: "Wilmette",           township: "New Trier",      city: "WILMETTE"           },
  { label: "Winnetka",           township: "New Trier",      city: "WINNETKA"           },
  { label: "Glenview",           township: "Northfield",     city: "GLENVIEW"           },
  { label: "Northbrook",         township: "Northfield",     city: "NORTHBROOK"         },
  { label: "Highland Park",      township: "Ela",            city: "HIGHLAND PARK"      },
  { label: "Deerfield",          township: "West Deerfield", city: "DEERFIELD"          },
  { label: "Lake Zurich",        township: "Ela",            city: "LAKE ZURICH"        },
  { label: "Libertyville",       township: null,             city: null                 },
  { label: "Kildeer",            township: null,             city: null                 },
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
