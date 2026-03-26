import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { AREA_MAP, COOK_AREAS, OTHER_AREAS, STORM_EVENTS, DEFAULT_WEIGHTS, WEIGHT_LABELS, CITY_ZIPS } from "./constants";
import { parseCSV, normaliseRow } from "./utils/parsers";
import { scoreProperty, filterByValue } from "./utils/scoring";
import { fetchHistoricalAlerts, fetchLiveAlerts, fetchHWO, fetchStormHistory as fetchStormHistoryApi } from "./utils/stormApi";
import { fetchAddressesByCity, fetchAddressesByZip, enrichAddresses, classifyMotivation } from "./utils/cookCountyApi";
import Dashboard  from "./components/Dashboard";
import Settings   from "./components/Settings";
import LeadsGrid  from "./components/LeadsGrid";
const StormMap = lazy(() => import("./components/StormMap"));

// ── Styles ────────────────────────────────────────────────────────────────────
// Fonts loaded via <link> in index.html (preconnect + non-blocking)
const CSS = `
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  .app { min-height:100vh; background:#080c10; color:#d4cfc8; font-family:'DM Mono',monospace; font-size:13px; padding:20px 16px 40px; background-image:radial-gradient(ellipse 80% 40% at 50% -10%, rgba(251,146,60,.07) 0%, transparent 70%); }
  .wrap { max-width:600px; margin:0 auto; }

  /* Header */
  .hd { text-align:center; margin-bottom:22px; }
  .logo { font-family:'Bebas Neue',sans-serif; font-size:3rem; letter-spacing:.06em; color:#fb923c; line-height:1; }
  .logo span { color:#fff; }
  .sub { font-size:.63rem; letter-spacing:.22em; text-transform:uppercase; color:#374151; margin-top:4px; }
  .badge { display:inline-block; background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.25); color:#10b981; font-size:.6rem; letter-spacing:.12em; text-transform:uppercase; padding:2px 7px; border-radius:2px; margin-top:5px; }

  /* Progress */
  .prog { display:flex; gap:4px; margin-bottom:16px; }
  .prog-seg { height:2px; flex:1; background:rgba(251,146,60,.1); border-radius:2px; transition:background .3s; }
  .prog-seg.on { background:#fb923c; }

  /* Tabs */
  .tabs { display:flex; gap:2px; background:rgba(255,255,255,.03); border:1px solid rgba(251,146,60,.13); border-radius:3px; padding:3px; margin-bottom:14px; }
  .tab { flex:1; padding:7px 4px; background:transparent; border:none; color:#4b5563; font-family:'Bebas Neue',sans-serif; font-size:.95rem; letter-spacing:.08em; cursor:pointer; border-radius:2px; transition:all .15s; }
  .tab.on { background:#fb923c; color:#080c10; }
  .tab:hover:not(.on) { color:#fb923c; }

  /* Cards */
  .card { background:rgba(255,255,255,.025); border:1px solid rgba(251,146,60,.12); border-radius:4px; padding:16px; margin-bottom:12px; }
  .lbl { font-family:'Bebas Neue',sans-serif; font-size:.8rem; letter-spacing:.18em; color:#fb923c; margin-bottom:10px; }

  /* Buttons */
  .btn { display:inline-flex; align-items:center; gap:5px; background:#fb923c; color:#080c10; border:none; font-family:'Bebas Neue',sans-serif; font-size:.95rem; letter-spacing:.08em; padding:9px 18px; border-radius:3px; cursor:pointer; transition:background .15s; white-space:nowrap; }
  .btn:hover { background:#f97316; }
  .btn:disabled { background:#1f2937; color:#374151; cursor:not-allowed; }
  .btn.green { background:#10b981; }
  .btn.full { width:100%; justify-content:center; }
  .btn.sm { padding:6px 12px; font-size:.8rem; }
  .btn.outline { background:transparent; border:1px solid rgba(251,146,60,.35); color:#fb923c; }
  .btn.outline:hover { background:rgba(251,146,60,.08); }

  /* Form controls */
  select, input[type=number], input[type=date] { background:rgba(255,255,255,.04); border:1px solid rgba(251,146,60,.25); color:#d4cfc8; font-family:'DM Mono',monospace; font-size:.8rem; padding:7px 10px; border-radius:3px; outline:none; }
  select:focus, input[type=number]:focus, input[type=date]:focus { border-color:#fb923c; }
  input[type=date] { color-scheme:dark; }
  input[type=date]::-webkit-calendar-picker-indicator { filter:invert(.4) sepia(1) saturate(3) hue-rotate(10deg); cursor:pointer; }
  .field { display:flex; flex-direction:column; gap:3px; }
  .field-lbl { font-size:.62rem; color:#4b5563; text-transform:uppercase; letter-spacing:.1em; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }

  /* Alerts */
  .al { padding:10px 12px; border-radius:3px; margin-bottom:7px; border-left:3px solid; }
  .al.ex { border-color:#ef4444; background:rgba(239,68,68,.07); }
  .al.sv { border-color:#f97316; background:rgba(249,115,22,.07); }
  .al.md { border-color:#fb923c; background:rgba(251,146,60,.07); }
  .al.mn { border-color:#84cc16; background:rgba(132,204,18,.07); }
  .al-t { font-family:'Bebas Neue',sans-serif; font-size:.9rem; letter-spacing:.05em; display:flex; align-items:center; gap:6px; }
  .al-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; animation:blink 1.6s ease-in-out infinite; }
  .al-m { font-size:.66rem; color:#6b7280; margin-top:3px; line-height:1.4; }
  @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:.3;} }

  /* Filter pill */
  .filter-pill { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
  .pill { font-size:.63rem; background:rgba(251,146,60,.1); border:1px solid rgba(251,146,60,.2); color:#fb923c; padding:3px 8px; border-radius:2px; font-family:'Bebas Neue',sans-serif; letter-spacing:.05em; }

  /* Warning */
  .warn { background:rgba(251,146,60,.06); border:1px solid rgba(251,146,60,.25); border-radius:3px; padding:10px 12px; font-size:.67rem; color:#d97706; line-height:1.6; margin-top:8px; }

  /* Upload zone */
  .upz { border:2px dashed rgba(251,146,60,.2); border-radius:4px; padding:24px 16px; text-align:center; cursor:pointer; transition:border-color .15s; }
  .upz:hover { border-color:#fb923c; }
  .upz-ico { font-size:2rem; margin-bottom:6px; }
  .upz-main { font-size:.78rem; color:#d4cfc8; margin-bottom:3px; }
  .upz-sub { font-size:.63rem; color:#374151; }

  /* Property preview */
  .pg { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:10px; }
  .pg-item { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:3px; padding:7px 9px; }
  .pg-addr { font-size:.66rem; color:#d4cfc8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pg-meta { font-size:.58rem; color:#4b5563; margin-top:2px; }

  /* Leads */
  .lead { display:flex; gap:10px; padding:11px 12px; border-radius:3px; margin-bottom:7px; border-left:3px solid; }
  .lead.hi { border-color:#ef4444; background:rgba(239,68,68,.05); }
  .lead.md { border-color:#fb923c; background:rgba(251,146,60,.05); }
  .lead.lo { border-color:#374151; background:rgba(55,65,81,.08); }
  .lead-body { flex:1; min-width:0; }
  .lead-addr { font-family:'Bebas Neue',sans-serif; font-size:.95rem; letter-spacing:.03em; color:#f3ede5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .lead-why { font-size:.67rem; color:#9ca3af; margin-top:3px; line-height:1.4; }
  .score-box { text-align:center; flex-shrink:0; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:3px; padding:4px 8px; min-width:42px; }
  .score-n { font-family:'Bebas Neue',sans-serif; font-size:1.4rem; color:#fb923c; line-height:1; }
  .score-s { font-size:.58rem; color:#374151; }
  .tier-h { font-family:'Bebas Neue',sans-serif; font-size:.8rem; letter-spacing:.15em; margin:14px 0 7px; }
  .tier-h.hi { color:#ef4444; } .tier-h.md { color:#fb923c; } .tier-h.lo { color:#4b5563; }

  /* Stats */
  .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
  .stat { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:3px; padding:10px; text-align:center; }
  .stat-n { font-family:'Bebas Neue',sans-serif; font-size:1.5rem; color:#fb923c; }
  .stat-l { font-size:.6rem; color:#4b5563; text-transform:uppercase; letter-spacing:.1em; }
  .res-hd { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
  .res-stat { font-family:'Bebas Neue',sans-serif; font-size:1.1rem; letter-spacing:.05em; }

  /* Misc */
  .empty { text-align:center; padding:32px 20px; color:#374151; }
  .empty-ico { font-size:2.5rem; margin-bottom:10px; }
  .note { font-size:.65rem; color:#4b5563; border:1px solid rgba(255,255,255,.04); border-radius:3px; padding:10px 12px; line-height:1.7; margin-top:8px; }
  .note b { color:#6b7280; }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .ok { font-size:.7rem; color:#10b981; margin-bottom:8px; }
  .sp { display:inline-block; width:12px; height:12px; border:2px solid rgba(8,12,16,.3); border-top-color:#080c10; border-radius:50%; animation:spin .65s linear infinite; }
  .sp-or { border-color:rgba(251,146,60,.15); border-top-color:#fb923c; }
  @keyframes spin { to{transform:rotate(360deg);} }

  /* Weight sliders */
  .wt-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .wt-lbl { font-size:.65rem; color:#6b7280; min-width:100px; }
  .wt-val { font-family:'Bebas Neue',sans-serif; font-size:.9rem; color:#fb923c; min-width:18px; text-align:center; }
  input[type=range] { flex:1; -webkit-appearance:none; appearance:none; height:4px; background:rgba(251,146,60,.15); border-radius:2px; outline:none; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#fb923c; cursor:pointer; border:2px solid #080c10; }
  .wt-reset { font-size:.58rem; color:#374151; cursor:pointer; text-decoration:underline; margin-top:2px; }
  .wt-reset:hover { color:#fb923c; }

  /* Lead summary */
  .lead-sum { font-size:.62rem; color:#fb923c; margin-top:4px; font-style:italic; line-height:1.4; opacity:.85; }

  /* Storm event badges on lead cards */
  .storm-badge, .motiv-badge { font-family:'Bebas Neue',sans-serif; font-size:.58rem; letter-spacing:.06em; padding:2px 6px; border-radius:2px; }
  .storm-badge.hail { background:rgba(99,179,237,.12); color:#63b3ed; border:1px solid rgba(99,179,237,.2); }
  .storm-badge.wind { background:rgba(167,139,250,.12); color:#a78bfa; border:1px solid rgba(167,139,250,.2); }

  /* Motivation badges */
  .motiv-badge.investor { background:rgba(251,191,36,.12); color:#fbbf24; border:1px solid rgba(251,191,36,.25); }
  .motiv-badge.flipper { background:rgba(239,68,68,.12); color:#ef4444; border:1px solid rgba(239,68,68,.25); }
  .motiv-badge.recent { background:rgba(20,184,166,.12); color:#14b8a6; border:1px solid rgba(20,184,166,.25); }
  .motiv-badge.absentee { background:rgba(139,92,246,.12); color:#8b5cf6; border:1px solid rgba(139,92,246,.25); }

  /* HWO Pre-Storm banner */
  .hwo-banner { background:rgba(251,146,60,.07); border:1px solid rgba(251,146,60,.3); border-radius:4px; padding:12px 14px; margin-top:10px; }
  .hwo-title { font-family:'Bebas Neue',sans-serif; font-size:.85rem; letter-spacing:.1em; color:#fb923c; margin-bottom:5px; display:flex; align-items:center; gap:6px; }
  .hwo-text { font-size:.65rem; color:#9ca3af; line-height:1.6; margin-bottom:8px; }

  /* Severity heat map */
  .sev-grid { display:grid; gap:4px; margin-top:10px; }
  .sev-row { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:3px; border-left:3px solid; }
  .sev-row.s3 { border-color:#ef4444; background:rgba(239,68,68,.06); }
  .sev-row.s2 { border-color:#fb923c; background:rgba(251,146,60,.06); }
  .sev-row.s1 { border-color:#84cc16; background:rgba(132,204,18,.06); }
  .sev-name { font-family:'Bebas Neue',sans-serif; font-size:.8rem; letter-spacing:.04em; flex:1; }
  .sev-detail { font-size:.58rem; color:#6b7280; }
  .sev-badge { font-family:'Bebas Neue',sans-serif; font-size:.7rem; padding:2px 6px; border-radius:2px; letter-spacing:.04em; }
  .sev-badge.s3 { background:rgba(239,68,68,.15); color:#ef4444; }
  .sev-badge.s2 { background:rgba(251,146,60,.15); color:#fb923c; }
  .sev-badge.s1 { background:rgba(132,204,22,.15); color:#84cc16; }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function StormLeads() {
  const [tab,            setTab]            = useState("dashboard");
  const [alerts,         setAlerts]         = useState([]);
  const [fetchingAlerts, setFetchingAlerts] = useState(false);
  const [alertsDone,     setAlertsDone]     = useState(false);
  const [selectedArea,   setSelectedArea]   = useState(COOK_AREAS[0].label);
  const [maxYear,        setMaxYear]        = useState(2010);
  const [limit,          setLimit]          = useState(100);
  const [minValue,       setMinValue]       = useState(0);      // min market value filter (0 = no min)
  const [maxValue,       setMaxValue]       = useState(0);      // max market value filter (0 = no max)
  const [rows,           setRows]           = useState([]);   // normalised CSV rows (merged)
  const [leads,          setLeads]          = useState([]);
  const [pulling,        setPulling]        = useState(false); // fetching from Socrata
  const [pullStatus,     setPullStatus]     = useState("");    // progress text
  const [pullError,      setPullError]      = useState("");
  const [weights,        setWeights]        = useState({...DEFAULT_WEIGHTS});
  const [pulledPins,     setPulledPins]     = useState(new Set());
  const [globalLeads,    setGlobalLeads]    = useState([]); // Cross-area top prospects
  const [isScouting,     setIsScouting]     = useState(false);
  const [hwo,            setHwo]            = useState(null); // { hailMentioned, severeMentioned, summary }
  const [dateMode,       setDateMode]       = useState("live");  // "live" | "quick" | "range"
  const [quickDays,      setQuickDays]      = useState(1);       // 1 = yesterday, 3, 7
  const [dateFrom,       setDateFrom]       = useState("");      // "YYYY-MM-DD" range start
  const [dateTo,         setDateTo]         = useState("");      // "YYYY-MM-DD" range end
  const [hardHitOnly,    setHardHitOnly]    = useState(false);   // filter dropdown to MODERATE/SEVERE areas
  const [stormHistory,   setStormHistory]   = useState({});  // area label → storm day count (5yr)
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [minHailSize,    setMinHailSize]    = useState(0);   // 0 = no filter
  const [sortMode,       setSortMode]       = useState("score"); // "score" | "route"
  const [selectedZips,   setSelectedZips]   = useState([]);  // ZIP codes chosen on map
  const [showMap,        setShowMap]        = useState(false);
  const fileRef = useRef();

  // Inject CSS once (avoids React diffing ~6KB string every render)
  useEffect(() => {
    const id = "sl-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  // Derived
  const isHistorical   = dateMode !== "live";
  const today          = new Date().toISOString().slice(0, 10);
  const stormDateLabel = dateMode === "live"  ? ""
    : dateMode === "quick" ? (quickDays === 1 ? "Yesterday" : `Past ${quickDays} Days`)
    : (dateFrom && dateTo  ? `${dateFrom} – ${dateTo}` : dateFrom || "");
  const area = AREA_MAP.find(a => a.label === selectedArea);

  // ── Storm history wrapper — delegates to util, manages loading state ──────────
  const fetchStormHistory = async () => {
    setLoadingHistory(true);
    try {
      const result = await fetchStormHistoryApi();
      setStormHistory(result);
    } catch { /* silent — history is supplemental */ }
    setLoadingHistory(false);
  };

  // ── Alert fetching — delegates to stormApi utils ───────────────────────────


  const fetchAlerts = async () => {
    setFetchingAlerts(true);
    setAlerts([]);
    try {
      if (dateMode === "live") {
        const [liveAlerts, hwoResult] = await Promise.all([fetchLiveAlerts(), fetchHWO()]);
        setAlerts(liveAlerts);
        setHwo(hwoResult);
      } else {
        // Compute from/to dates for quick or range modes
        let from, to;
        if (dateMode === "quick") {
          const todayD = new Date();
          to   = new Date(todayD); to.setDate(to.getDate() - 1);                    // yesterday
          from = new Date(to);    from.setDate(from.getDate() - (quickDays - 1));   // e.g. 3 days back
        } else {
          from = new Date(dateFrom + "T12:00:00");
          to   = new Date(dateTo   + "T12:00:00");
        }
        const fmt = d => d.toISOString().slice(0, 10);
        setAlerts(await fetchHistoricalAlerts(fmt(from), fmt(to)));
      }
    } catch { setAlerts([]); }
    setAlertsDone(true);
    setFetchingAlerts(false);
  };

  // ── Shared enrichment + scoring step ─────────────────────────────────────────
  // Called by both pullAndScore (city-based) and pullByZips (map-based).
  const finishPull = async (addrNorm) => {
    const { merged, matchCount, roofCount, permitCount } =
      await enrichAddresses(addrNorm, setPullStatus);
    const roofEst   = merged.length - roofCount;
    const newMerged = merged.filter(r => !r.pin || !pulledPins.has(r.pin));
    const dupCount  = merged.length - newMerged.length;
    const filtered  = filterByValue(newMerged, minValue, maxValue);
    setPullStatus(
      `Enriched ${matchCount}/${addrNorm.length} · ` +
      `Roof: ${roofCount} verified, ${roofEst} estimated · ${permitCount} permits` +
      `${dupCount ? ` · ${dupCount} dup suppressed` : ""}` +
      `${filtered.length < newMerged.length ? ` · ${newMerged.length - filtered.length} filtered by value` : ""}. Scoring…`
    );
    setRows(filtered);
    const alertInfo = getAlertScore();
    const scored = filtered.map(r => {
      const motivation = classifyMotivation(r);
      const scoredRow = scoreProperty(r, alertInfo, weights, maxYear, motivation);
      return { ...scoredRow, motivation };
    }).sort((a, b) => b.score - a.score);
    setLeads(scored);
    setPulledPins(prev => new Set([...prev, ...newMerged.map(r => r.pin).filter(Boolean)]));
    setPullStatus(
      `Done — ${scored.length} leads scored` +
      `${dupCount ? ` · ${dupCount} dup suppressed` : ""}` +
      `${filtered.length < newMerged.length ? ` · ${newMerged.length - filtered.length} filtered by value` : ""}`
    );
    setTab("leads");
  };

  // ── City-based pull (dropdown selection) ──────────────────────────────────────
  const pullAndScore = async () => {
    if (!area?.township) return;
    setPulling(true); setPullError(""); setPullStatus("Fetching addresses…"); setRows([]); setLeads([]);
    try {
      const addrJson = await fetchAddressesByCity(area.city, limit);
      if (!addrJson.length) throw new Error(`No properties found for ${area.city}. Try a different area or increase the limit.`);
      const addrNorm = addrJson.map(normaliseRow).filter(r => r.address || r.pin);
      setPullStatus(`Got ${addrNorm.length} addresses. Fetching assessments, building, roof & permit data…`);
      await finishPull(addrNorm);
    } catch (e) {
      console.error("Pull error:", e);
      setPullError(e.message || "Failed to fetch data from Cook County API.");
    }
    setPulling(false);
  };

  // ── ZIP-based pull (map selection) ────────────────────────────────────────────
  const pullByZips = async (zips) => {
    if (!zips.length) return;
    setPulling(true); setPullError(""); setPullStatus(`Fetching addresses for ${zips.length} ZIP${zips.length > 1 ? "s" : ""}…`); setRows([]); setLeads([]);
    try {
      const addrJson = await fetchAddressesByZip(zips, limit);
      if (!addrJson.length) throw new Error(`No properties found in ZIP${zips.length > 1 ? "s" : ""}: ${zips.join(", ")}`);
      const addrNorm = addrJson.map(normaliseRow).filter(r => r.address || r.pin);
      setPullStatus(`Got ${addrNorm.length} addresses from map selection. Fetching enrichment data…`);
      setSelectedArea(`${zips.length} ZIP${zips.length > 1 ? "s" : ""} (map)`);
      await finishPull(addrNorm);
    } catch (e) {
      console.error("Map pull error:", e);
      setPullError(e.message || "Failed to fetch data from Cook County API.");
    }
    setPulling(false);
  };



  // ── Map zip toggle ────────────────────────────────────────────────────────────
  const onZipToggle = zip =>
    setSelectedZips(prev => prev.includes(zip) ? prev.filter(z => z !== zip) : [...prev, zip]);

  // ── Manual CSV upload (fallback for Lake County / custom data) ──────────────
  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const raw = parseCSV(ev.target.result).map(normaliseRow).filter(r => r.address || r.pin);
      setRows(raw);
      setLeads([]);
      setPullError("");
    };
    reader.readAsText(file);
  };

  // ── Area-level storm severity — scores each service area independently ──────
  const sevPts = s => { s = (s||"").toLowerCase(); return s==="extreme"?3:s==="severe"?3:s==="moderate"?2:1; };

  // Build a map: area label → { pts, label, events[], hail, wind }
  const areaSeverity = useMemo(() => {
    const map = {};
    AREA_MAP.forEach(a => { map[a.label] = { pts: 0, label: "No alerts", events: [], hail: "", wind: "" }; });
    if (!alerts.length) return map;

    for (const a of alerts) {
      const p = a.properties || {};
      const desc = (p.areaDesc || "").toLowerCase();
      const sev = sevPts(p.severity);
      const hail = (p.parameters?.hailSize?.[0]) || "";
      const wind = (p.parameters?.windGust?.[0] || p.parameters?.windSpeed?.[0]) || "";

      // Match alert to specific areas by name
      for (const area of AREA_MAP) {
        if (!desc.includes(area.label.toLowerCase())) continue;
        const entry = map[area.label];
        if (sev > entry.pts) {
          entry.pts = sev;
          entry.label = `${p.severity} — ${p.event}`;
        }
        if (!entry.events.includes(p.event)) entry.events.push(p.event);
        if (hail && (!entry.hail || parseFloat(hail) > parseFloat(entry.hail))) entry.hail = hail;
        if (wind && (!entry.wind || parseFloat(wind) > parseFloat(entry.wind))) entry.wind = wind;
      }

      // Also match by county name (affects all areas in that county)
      const counties = ["cook","dupage","lake","will"];
      for (const c of counties) {
        if (!desc.includes(c)) continue;
        // County-wide alert applies to all areas
        for (const area of AREA_MAP) {
          const entry = map[area.label];
          if (sev > entry.pts) {
            entry.pts = sev;
            entry.label = `${p.severity} — ${p.event}`;
          }
          if (!entry.events.includes(p.event)) entry.events.push(p.event);
          if (hail && (!entry.hail || parseFloat(hail) > parseFloat(entry.hail))) entry.hail = hail;
          if (wind && (!entry.wind || parseFloat(wind) > parseFloat(entry.wind))) entry.wind = wind;
        }
      }
    }
    return map;
  }, [alerts]);

  // Get the score for the currently selected area (used in property scoring)
  const getAlertScore = () => {
    const entry = areaSeverity[selectedArea];
    if (!entry || entry.pts === 0) return { pts: 0, label: "No alerts" };
    return { pts: entry.pts, label: entry.label };
  };

  // Sorted areas by severity for the heat map display
  const areaRanking = useMemo(() => {
    return Object.entries(areaSeverity)
      .map(([name, data]) => ({ name, ...data }))
      .filter(a => a.pts > 0)
      .sort((a, b) => b.pts - a.pts || b.events.length - a.events.length);
  }, [areaSeverity]);

  // Route-sorted leads — groups by zip then street for efficient canvassing
  const displayLeads = useMemo(() => {
    if (sortMode !== "route") return leads;
    return [...leads].sort((a, b) => {
      const parse = addr => {
        const m = addr.match(/^(\d+)\s+(.+?),\s*.+?,.*?(\d{5})?/i);
        if (!m) return { num: 0, street: addr.toUpperCase(), zip: "" };
        return { num: parseInt(m[1]) || 0, street: m[2].trim().toUpperCase(), zip: m[3] || "" };
      };
      const pa = parse(a.address), pb = parse(b.address);
      if (pa.zip !== pb.zip) return pa.zip.localeCompare(pb.zip);
      if (pa.street !== pb.street) return pa.street.localeCompare(pb.street);
      return pa.num - pb.num;
    });
  }, [leads, sortMode]);

  const scoreLeads = (switchTab = true) => {
    if (!rows.length) return;
    const filtered = filterByValue(rows, minValue, maxValue);
    const alertInfo = getAlertScore();
    const scored = filtered.map(r => {
      const motivation = classifyMotivation(r);
      const scoredRow = scoreProperty(r, alertInfo, weights, maxYear, motivation);
      return { ...scoredRow, motivation };
    }).sort((a, b) => b.score - a.score);
    setLeads(scored);
    if (switchTab) setTab("leads");
  };


  // ── Helpers ─────────────────────────────────────────────────────────────────
  const sevCls   = s => s==="Extreme"?"ex":s==="Severe"?"sv":s==="Moderate"?"md":"mn";
  const sevColor = s => s==="Extreme"?"#ef4444":s==="Severe"?"#f97316":"#fb923c";

  // Compound exposure badge — requires both current hit AND storm history
  const getExposureBadge = (areaName, pts) => {
    const hist = stormHistory[areaName] || 0;
    if (pts === 3 && hist >= 3) return { label: "🔥 High Exposure", color: "#ef4444", bg: "rgba(239,68,68,.12)" };
    if (pts >= 2 && hist >= 2) return { label: "⚡ Repeat Target", color: "#fb923c", bg: "rgba(251,146,60,.12)" };
    return null;
  };

  // ── Global Storm Scout ────────────────────────────────────────────────────────
  const scoutStormPath = async () => {
    const hitAreas = areaRanking.filter(a => a.pts >= 2).map(a => a.name);
    if (!hitAreas.length) {
      setPullError("No 'Moderate' or 'Severe' storm areas detected in current alerts.");
      return;
    }

    setIsScouting(true); setPullError(""); setPullStatus(`Scouting storm path across ${hitAreas.length} areas…`);
    try {
      const raw = await fetchGlobalMotivatedLeads(hitAreas, 300);
      if (!raw.length) throw new Error("No highly motivated leads found in the storm path.");
      
      const addrNorm = raw.map(normaliseRow).filter(r => r.address || r.pin);
      const { merged } = await enrichAddresses(addrNorm, setPullStatus);
      
      const scored = merged.map(r => {
        const areaName = AREA_MAP.find(a => a.city === r.city)?.label || selectedArea;
        const alertInfo = areaSeverity[areaName] || { pts: 0, label: "No alerts" };
        const motivation = classifyMotivation(r);
        return scoreProperty(r, alertInfo, weights, maxYear, motivation);
      }).sort((a, b) => b.score - a.score);

      setGlobalLeads(scored);
      setTab("dashboard"); 
      setPullStatus(`Scout complete: Found ${scored.length} motivated prospects in the storm path.`);
    } catch (e) {
      console.error("Scout error:", e);
      setPullError(e.message);
    }
    setIsScouting(false);
  };

  useEffect(() => {
    if (alertsDone && areaRanking.length > 0 && !isScouting) {
      // 1. Auto-select Zips for the map based on hit areas
      const hitZips = new Set();
      areaRanking.filter(a => a.pts >= 2).forEach(a => {
        const zips = CITY_ZIPS[a.name.toUpperCase()] || [];
        zips.forEach(z => hitZips.add(z));
      });
      if (hitZips.size > 0 && selectedZips.length === 0) {
        setSelectedZips(Array.from(hitZips));
      }

      // 2. Auto-scout only if we haven't already
      if (globalLeads.length === 0) {
        scoutStormPath();
      }
    }
  }, [alertsDone, areaRanking, isScouting, globalLeads.length, selectedZips.length]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
      <div className="app">
        <div className="wrap">

          {/* Header */}
          <div className="hd">
            <div className="logo">⛈ Storm<span>Leads</span></div>
            <div className="sub">Chicago Suburbs · Storm Damage Lead Scoring</div>
            <span className="badge">✓ 100% Free Data Sources</span>
          </div>

          {/* Progress */}
          <div className="prog">
            <div className={`prog-seg${alertsDone?" on":""}`}/>
            <div className={`prog-seg${rows.length?" on":""}`}/>
            <div className={`prog-seg${leads.length?" on":""}`}/>
          </div>

          {/* Tabs */}
          <div className="tabs">
            {[["dashboard","⚡ Dash"],["storm","🗺 Storm"],["leads","📋 Leads"],["settings","⚙ Settings"]].map(([k,l])=>(
              <button key={k} className={`tab${tab===k?" on":""}`} onClick={()=>setTab(k)}>{l}</button>
            ))}
          </div>

          {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
          {tab==="dashboard" && (
            <Dashboard
              alerts={alerts}
              alertsDone={alertsDone}
              hwo={hwo}
              areaRanking={areaRanking}
              leads={leads}
              globalLeads={globalLeads}
              isScouting={isScouting}
              scoutStormPath={scoutStormPath}
              pullStatus={pullStatus}
              stormHistory={stormHistory}
              isHistorical={isHistorical}
              stormDate={stormDateLabel}
              setTab={setTab}
            />
          )}

          {/* ── STORM TAB ─────────────────────────────────────────────────── */}
          {tab==="storm" && <>
            <div className="card">
              <div className="lbl">{isHistorical ? `Ground Reports — ${stormDateLabel}` : "NWS Active Alerts — Illinois"}</div>

              {/* Mode toggle — Live / Quick / Range */}
              <div style={{display:"flex",gap:4,marginBottom:8}}>
                {[["live","⚡ Live"],["quick","⏱ Quick"],["range","📅 Range"]].map(([m,l])=>(
                  <button key={m}
                    onClick={()=>{setDateMode(m);setAlerts([]);setAlertsDone(false);setSelectedZips([]);}}
                    style={{
                      flex:1, padding:"5px 8px", fontSize:".7rem",
                      fontFamily:"'Bebas Neue',sans-serif", letterSpacing:".06em",
                      border:"1px solid rgba(251,146,60,.25)", borderRadius:3, cursor:"pointer",
                      background: dateMode===m ? "#fb923c" : "transparent",
                      color:      dateMode===m ? "#080c10" : "#fb923c",
                    }}>{l}
                  </button>
                ))}
              </div>

              {/* Quick — preset day windows */}
              {dateMode==="quick" && (
                <div style={{display:"flex",gap:4,marginBottom:8}}>
                  {[[1,"Yesterday"],[3,"Past 3 Days"],[7,"Past 7 Days"]].map(([d,l])=>(
                    <button key={d} onClick={()=>setQuickDays(d)} style={{
                      flex:1, padding:"4px 6px", fontSize:".68rem",
                      fontFamily:"'Bebas Neue',sans-serif", letterSpacing:".05em",
                      border:"1px solid rgba(251,146,60,.2)", borderRadius:3, cursor:"pointer",
                      background: quickDays===d ? "rgba(251,146,60,.15)" : "transparent",
                      color:      quickDays===d ? "#fb923c" : "#6b7280",
                    }}>{l}</button>
                  ))}
                </div>
              )}

              {/* Range — custom From / To date inputs */}
              {dateMode==="range" && (
                <div className="grid2" style={{marginBottom:8}}>
                  <div className="field">
                    <div className="field-lbl">From</div>
                    <input type="date" value={dateFrom} max={today}
                      onChange={e=>{setDateFrom(e.target.value);setAlerts([]);setAlertsDone(false);}}
                      style={{width:"100%"}}/>
                  </div>
                  <div className="field">
                    <div className="field-lbl">To</div>
                    <input type="date" value={dateTo} max={today} min={dateFrom||undefined}
                      onChange={e=>{setDateTo(e.target.value);setAlerts([]);setAlertsDone(false);}}
                      style={{width:"100%"}}/>
                  </div>
                </div>
              )}

              {/* Fetch button */}
              <div className="row" style={{marginBottom:12,gap:8}}>
                <button className="btn" style={{flex:1,justifyContent:"center"}} onClick={fetchAlerts}
                  disabled={fetchingAlerts || (dateMode==="range" && (!dateFrom || !dateTo))}>
                  {fetchingAlerts ? <><span className="sp"/>Fetching…</>
                    : dateMode==="live"  ? "Fetch Live Alerts"
                    : dateMode==="quick" ? `Fetch ${quickDays===1 ? "Yesterday" : `Past ${quickDays} Days`}`
                    : "Fetch Date Range"}
                </button>
              </div>

              {!alertsDone && (
                <div style={{fontSize:".68rem",color:"#374151",lineHeight:1.6}}>
                  {dateMode==="live"
                    ? "Pulls live NWS watches and warnings filtered to your 18 service areas. Severity feeds into lead scoring."
                    : dateMode==="quick"
                    ? `Historical mode — pulls NOAA-verified spotter reports (hail size, wind, tornadoes) from the IEM archive for the ${quickDays===1?"day":"last "+quickDays+" days"} prior to today.`
                    : (dateFrom && dateTo)
                    ? `Historical mode — ${dateFrom} through ${dateTo} from the IEM archive.`
                    : "Select a From and To date to pull a custom storm window from the IEM archive."}
                </div>
              )}

              {alertsDone && alerts.length===0 && (
                <div className="empty" style={{padding:"18px 0"}}>
                  <div className="empty-ico">{isHistorical ? "📅" : "🌤"}</div>
                  {isHistorical
                    ? <>No storm reports found for {stormDateLabel}.<br/><span style={{fontSize:".66rem",color:"#374151"}}>Try an adjacent date — overnight events may fall on the next day.</span></>
                    : <>No active alerts for your service area.<br/><span style={{fontSize:".66rem",color:"#374151"}}>Pre-storm scoring still works.</span></>
                  }
                </div>
              )}

              {/* HWO Pre-Storm banner — live mode only */}
              {alertsDone && !isHistorical && hwo?.hailMentioned && (
                <div className="hwo-banner">
                  <div className="hwo-title">⚠ Pre-Storm Scout</div>
                  <div className="hwo-text">
                    NWS Hazardous Weather Outlook mentions{" "}
                    <b style={{color:"#fb923c"}}>{hwo.severeMentioned ? "hail and severe weather" : "hail"}</b>
                    {" "}for the Chicago area.
                    No active warnings yet — get your leads scored and route planned tonight.
                    {hwo.summary && <div style={{color:"#6b7280",fontSize:".62rem",marginTop:4}}>{hwo.summary}</div>}
                  </div>
                  <button className="btn sm" onClick={()=>document.getElementById("pull-card")?.scrollIntoView({behavior:"smooth"})}>↓ Pull Properties</button>
                </div>
              )}

              {/* Historical mode: summary count instead of individual cards */}
              {isHistorical && alerts.length > 0 && (
                <div style={{fontSize:".7rem",color:"#10b981",marginBottom:8,padding:"8px 10px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:3}}>
                  ✓ {alerts.length} verified storm reports for {stormDateLabel}
                  {alerts.filter(a=>a.properties.parameters?.hailSize).length > 0 &&
                    ` · ${alerts.filter(a=>a.properties.parameters?.hailSize).length} hail reports`}
                  {alerts.filter(a=>a.properties.event==="Tornado").length > 0 &&
                    ` · ${alerts.filter(a=>a.properties.event==="Tornado").length} tornadoes`}
                  {" — source: NOAA/IEM spotter network"}
                </div>
              )}

              {/* Live mode: individual alert cards */}
              {!isHistorical && alerts.map((a,i)=>(
                <div key={i} className={`al ${sevCls(a.properties.severity)}`}>
                  <div className="al-t">
                    <span className="al-dot" style={{background:sevColor(a.properties.severity)}}/>
                    {a.properties.event}
                    <span style={{marginLeft:"auto",fontSize:".6rem",color:sevColor(a.properties.severity)}}>{a.properties.severity}</span>
                  </div>
                  <div className="al-m">{(a.properties.areaDesc||"").split(";").slice(0,5).map(s=>s.trim()).filter(Boolean).join(" · ")}</div>
                </div>
              ))}
              {alertsDone && areaRanking.length > 0 && (
                <div style={{marginTop:12}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <div className="lbl" style={{marginBottom:0}}>Area Severity Ranking</div>
                    <button className="btn sm outline" onClick={fetchStormHistory} disabled={loadingHistory}
                      title="Load 5-year storm hit counts for all service areas from NOAA/IEM archive">
                      {loadingHistory ? <><span className="sp sp-or"/>Loading…</> : Object.keys(stormHistory).length ? "↻ Refresh History" : "Load 5yr History"}
                    </button>
                  </div>
                  <div className="sev-grid">
                    {areaRanking.map(a => {
                      const hits    = stormHistory[a.name];
                      const expoBdg = getExposureBadge(a.name, a.pts);
                      return (
                        <div key={a.name} className={`sev-row s${a.pts}`}>
                          <span className="sev-name">{a.name}</span>
                          <span className="sev-detail">
                            {a.events.join(", ")}
                            {a.hail ? ` · ${a.hail}" hail` : ""}
                            {a.wind ? ` · ${a.wind} mph` : ""}
                          </span>
                          {expoBdg && (
                            <span style={{
                              fontSize:".58rem", color: expoBdg.color, background: expoBdg.bg,
                              border:"1px solid currentColor", borderRadius:2, padding:"1px 6px",
                              marginRight:4, whiteSpace:"nowrap", fontFamily:"'Bebas Neue',sans-serif",
                              letterSpacing:".04em",
                            }}>
                              {expoBdg.label}
                            </span>
                          )}
                          {!expoBdg && hits > 0 && (
                            <span style={{fontSize:".58rem",color: hits >= 4 ? "#ef4444" : hits >= 2 ? "#fb923c" : "#6b7280",
                              background: hits >= 4 ? "rgba(239,68,68,.1)" : hits >= 2 ? "rgba(251,146,60,.1)" : "rgba(255,255,255,.04)",
                              border:"1px solid currentColor",borderRadius:2,padding:"1px 5px",marginRight:4,whiteSpace:"nowrap"}}>
                              {hits}× / 5yr
                            </span>
                          )}
                          <span className={`sev-badge s${a.pts}`}>
                            {a.pts === 3 ? "SEVERE" : a.pts === 2 ? "MODERATE" : "MINOR"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Not-impacted areas — show history counts if loaded */}
                  {AREA_MAP.filter(a => a.township && areaSeverity[a.label]?.pts === 0).length > 0 && (
                    <div style={{marginTop:8}}>
                      {Object.keys(stormHistory).length > 0 ? (
                        <div className="sev-grid">
                          {AREA_MAP.filter(a => a.township && areaSeverity[a.label]?.pts === 0 && stormHistory[a.label] > 0)
                            .sort((a,b) => (stormHistory[b.label]||0) - (stormHistory[a.label]||0))
                            .map(a => (
                              <div key={a.label} className="sev-row s1" style={{opacity:.7}}>
                                <span className="sev-name">{a.label}</span>
                                <span className="sev-detail">No current alert</span>
                                <span style={{fontSize:".58rem",color:"#6b7280",border:"1px solid rgba(255,255,255,.1)",borderRadius:2,padding:"1px 5px"}}>
                                  {stormHistory[a.label]}× / 5yr
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div style={{fontSize:".58rem",color:"#374151",marginTop:4}}>
                          Not impacted: {AREA_MAP.filter(a => a.township && areaSeverity[a.label]?.pts === 0).map(a => a.label).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {alertsDone && <button className="btn full" style={{marginTop:10}} onClick={()=>document.getElementById("pull-card")?.scrollIntoView({behavior:"smooth"})}>↓ Pull Properties Below</button>}
            </div>
            {/* Simulate storm for testing */}
            <div className="card" style={{borderColor:"rgba(239,68,68,.2)"}}>
              <div className="lbl" style={{color:"#ef4444"}}>Simulate Storm (Testing)</div>
              <div style={{fontSize:".66rem",color:"#6b7280",marginBottom:10,lineHeight:1.5}}>
                Inject fake NWS alerts to test how severity affects lead scores. Area names in the description determine which suburbs are impacted.<br/>
                {alerts.length > 0 && <span style={{color:"#10b981"}}>Active: {alerts.length} alert(s)</span>}
              </div>
              <div className="row">
                {[
                  ["Severe Thunderstorm","Severe","Arlington Heights; Mount Prospect; Des Plaines",{hailSize:["1.75"]}],
                  ["Tornado Warning","Extreme","Schaumburg; Elk Grove Village; Des Plaines",{windGust:["80"]}],
                  ["Hail","Moderate","Glenview; Northbrook; Winnetka; Wilmette",{hailSize:["1.00"]}],
                ].map(([event,severity,areaDesc,parameters])=>(
                  <button key={event} className="btn sm outline" style={{borderColor: sevColor(severity), color: sevColor(severity)}}
                    onClick={()=>{
                      setAlerts(prev => [...prev, { properties: { event, severity, areaDesc, parameters } }]);
                      setAlertsDone(true);
                    }}>
                    + {event}
                  </button>
                ))}
                {alerts.length > 0 && (
                  <button className="btn sm outline" style={{borderColor:"#374151",color:"#6b7280"}}
                    onClick={()=>{setAlerts([]);setAlertsDone(true);}}>
                    Clear All
                  </button>
                )}
              </div>
            </div>
            <div className="note">
              <b>Live mode:</b> NOAA / National Weather Service — real-time warnings, no key required.<br/>
              <b>Historical mode:</b> Iowa Environmental Mesonet archive — NOAA-verified spotter reports with exact hail size and wind speed. Use <b>Quick</b> for recent days or <b>Range</b> for a custom window (e.g. Feb 1 – Mar 15).
            </div>
          </>}

          {/* ── Pull Properties — merged into Storm tab ───────────────────── */}
          {tab==="storm" && <>

            {/* ── Map view card ── */}
            <div className="card" style={{padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div className="lbl" style={{marginBottom:0}}>🗺 Map View</div>
                <div className="row" style={{gap:6}}>
                  {selectedZips.length > 0 && <>
                    <span style={{fontSize:".65rem",color:"#fb923c",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:".06em"}}>
                      {selectedZips.length} ZIP{selectedZips.length>1?"s":""} selected
                    </span>
                    <button className="btn sm outline" onClick={()=>setSelectedZips([])}>Clear</button>
                  </>}
                  <button className="btn sm outline" onClick={()=>setShowMap(!showMap)}>
                    {showMap ? "✕ Hide" : "Open Map"}
                  </button>
                </div>
              </div>
              {!showMap && (
                <div style={{fontSize:".63rem",color:"#374151",marginTop:6,lineHeight:1.5}}>
                  Click zip polygons to select storm-hit zones, then pull & score all properties within them — no dropdown needed.
                </div>
              )}
              {showMap && (
                <Suspense fallback={<div style={{padding:"24px",textAlign:"center",color:"#fb923c",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:".1em"}}>Loading Map…</div>}>
                  <StormMap
                    selectedZips={selectedZips}
                    onZipToggle={onZipToggle}
                    onFetch={pullByZips}
                    leads={leads.length > 0 ? leads : globalLeads}
                    stormReports={alerts.map(a => ({
                      lat: a.geometry?.type === "Point" ? a.geometry.coordinates[1] : null,
                      lon: a.geometry?.type === "Point" ? a.geometry.coordinates[0] : null,
                      event: a.properties.event,
                      desc: a.properties.parameters?.hailSize ? `Hail: ${a.properties.parameters.hailSize}"` : a.properties.event
                    })).filter(r => r.lat && r.lon)}
                    areaSeverity={areaSeverity}
                    stormPolygon={alerts.find(a => a.geometry?.type === "Polygon" || a.geometry?.type === "MultiPolygon")?.geometry}
                  />
                </Suspense>
              )}
            </div>

            {/* Configure + Pull */}
            <div className="card" id="pull-card">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div className="lbl" style={{marginBottom:0}}>Pull Properties</div>
                {areaRanking.length > 0 && (
                  <button
                    onClick={()=>setHardHitOnly(h=>!h)}
                    title="Show only areas with MODERATE or SEVERE current alerts"
                    style={{
                      padding:"4px 10px", fontSize:".65rem", borderRadius:3, cursor:"pointer",
                      fontFamily:"'Bebas Neue',sans-serif", letterSpacing:".06em",
                      border:"1px solid rgba(239,68,68,.35)",
                      background: hardHitOnly ? "rgba(239,68,68,.15)" : "transparent",
                      color: hardHitOnly ? "#ef4444" : "#6b7280",
                    }}>
                    🔥 {hardHitOnly ? "Hard Hit Only ✓" : "Hard Hit Only"}
                  </button>
                )}
              </div>
              <div className="grid2" style={{marginBottom:8}}>
                <div className="field">
                  <span className="field-lbl">Service Area</span>
                  <select value={selectedArea} onChange={e=>{setSelectedArea(e.target.value);setRows([]);setLeads([]);setPullError("");}}>
                    <optgroup label="Cook County (auto-pull)">
                      {COOK_AREAS
                        .filter(a => !hardHitOnly || (areaSeverity[a.label]?.pts ?? 0) >= 2)
                        .map(a => {
                          const pts = areaSeverity[a.label]?.pts ?? 0;
                          const suffix = pts === 3 ? " 🔴" : pts === 2 ? " 🟡" : "";
                          return <option key={a.label} value={a.label}>{a.label}{suffix}</option>;
                        })}
                    </optgroup>
                    <optgroup label="Lake County (upload CSV)">
                      {OTHER_AREAS
                        .filter(a => !hardHitOnly || (areaSeverity[a.label]?.pts ?? 0) >= 2)
                        .map(a => <option key={a.label}>{a.label}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div className="field">
                  <span className="field-lbl">Built Before</span>
                  <input type="number" value={maxYear} min={1900} max={2023} onChange={e=>setMaxYear(+e.target.value||2010)}/>
                </div>
                <div className="field">
                  <span className="field-lbl">Max Results</span>
                  <select value={limit} onChange={e=>setLimit(+e.target.value)}>
                    {[50,100,200,500].map(n=><option key={n} value={n}>{n} properties</option>)}
                  </select>
                </div>
              </div>
              <div className="grid2" style={{marginBottom:12}}>
                <div className="field">
                  <span className="field-lbl">Min Home Value</span>
                  <select data-field="min-value" value={minValue} onChange={e=>setMinValue(+e.target.value)}>
                    {[
                      [0,"No minimum"],
                      [150000,"$150k+"],
                      [250000,"$250k+"],
                      [350000,"$350k+"],
                      [500000,"$500k+"],
                      [750000,"$750k+"],
                    ].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <span className="field-lbl">Max Home Value</span>
                  <select data-field="max-value" value={maxValue} onChange={e=>setMaxValue(+e.target.value)}>
                    {[
                      [0,"No maximum"],
                      [300000,"Up to $300k"],
                      [500000,"Up to $500k"],
                      [750000,"Up to $750k"],
                      [1000000,"Up to $1M"],
                      [2000000,"Up to $2M"],
                    ].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid2" style={{marginBottom:12}}>
                <div className="field">
                  <span className="field-lbl">Min Hail Size</span>
                  <select value={minHailSize} onChange={e=>setMinHailSize(+e.target.value)}>
                    {[[0,"No minimum"],[0.75,'≥ 0.75"'],[1.0,'≥ 1.0"'],[1.25,'≥ 1.25"'],[1.5,'≥ 1.5"'],[1.75,'≥ 1.75"'],[2.0,'≥ 2.0" (baseball)']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

            {area?.township ? (
                <>
                  {/* Hail threshold warning */}
                  {minHailSize > 0 && (() => {
                    const areaHail = parseFloat(areaSeverity[selectedArea]?.hail || 0);
                    const hasData  = areaSeverity[selectedArea]?.hail;
                    if (!alertsDone) return null;
                    if (hasData && areaHail < minHailSize) return (
                      <div style={{fontSize:".67rem",color:"#f97316",background:"rgba(249,115,22,.08)",border:"1px solid rgba(249,115,22,.25)",borderRadius:3,padding:"8px 10px",marginBottom:8}}>
                        ⚠ {selectedArea} reported {areaHail}" hail — below your {minHailSize}" threshold. Pull anyway or choose a harder-hit area.
                      </div>
                    );
                    if (!hasData) return (
                      <div style={{fontSize:".67rem",color:"#6b7280",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:3,padding:"8px 10px",marginBottom:8}}>
                        No hail size data for {selectedArea}. Fetch alerts first to validate against your {minHailSize}" threshold.
                      </div>
                    );
                    return (
                      <div style={{fontSize:".67rem",color:"#10b981",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:3,padding:"8px 10px",marginBottom:8}}>
                        ✓ {selectedArea} reported {areaHail}" hail — meets {minHailSize}" threshold.
                      </div>
                    );
                  })()}
                  <div className="filter-pill" style={{marginBottom:10}}>
                    <span className="pill">{selectedArea}</span>
                    <span className="pill">Township: {area.township}</span>
                    <span className="pill">Built ≤ {maxYear}</span>
                    <span className="pill">{limit} max</span>
                    {minValue > 0 && <span className="pill">${(minValue/1000)}k+</span>}
                    {maxValue > 0 && <span className="pill">≤ ${maxValue >= 1000000 ? (maxValue/1000000)+"M" : (maxValue/1000)+"k"}</span>}
                    {minHailSize > 0 && <span className="pill">Hail ≥ {minHailSize}"</span>}
                  </div>
                  <button className="btn full" onClick={pullAndScore} disabled={pulling}>
                    {pulling ? <><span className="sp sp-or"/> Pulling…</> : `Pull & Score ${selectedArea} →`}
                  </button>
                  {pullStatus && !pullError && (
                    <div style={{fontSize:".63rem",color:"#10b981",marginTop:8}}>{pullStatus}</div>
                  )}
                  {pullError && (
                    <div style={{fontSize:".68rem",color:"#ef4444",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:3,padding:"8px 10px",marginTop:8}}>
                      {pullError}
                    </div>
                  )}
                </>
              ) : (
                <div className="warn">
                  <b>{selectedArea}</b> is in Lake County — no free API available.<br/>
                  Upload a CSV below from <b>lakecountyil.gov/assessor</b> or PropStream.
                </div>
              )}
            </div>

            {/* Manual upload fallback */}
            <div className="card" style={{opacity: area?.township && !pullError ? 0.5 : 1}}>
              <div className="lbl">{area?.township ? "Or Upload CSV Manually" : "Upload CSV"}</div>
              {!rows.length ? (
                <>
                  <div className="upz" onClick={()=>fileRef.current?.click()}>
                    <div className="upz-ico">📂</div>
                    <div className="upz-main">Click to upload CSV</div>
                    <div className="upz-sub">Cook County · Lake County · PropStream · ATTOM · any assessor export</div>
                  </div>
                  <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={handleFile}/>
                </>
              ) : (
                <>
                  <div className="ok">{rows.length} properties loaded from CSV</div>
                  <div className="pg">
                    {rows.slice(0,4).map((r,i)=>{
                      const addr = [r.address,r.city].filter(Boolean).join(", ") || r.pin || "—";
                      const meta = [r.owner&&`Owner: ${r.owner}`, r.year&&`Built ${r.year}`, r.value&&`AV $${parseInt(r.value).toLocaleString()}`].filter(Boolean).join(" · ") || "no metadata";
                      return (
                        <div key={i} className="pg-item">
                          <div className="pg-addr" title={addr}>{addr}</div>
                          <div className="pg-meta">{meta}</div>
                        </div>
                      );
                    })}
                  </div>
                  {rows.length>4 && <div style={{fontSize:".63rem",color:"#374151",marginBottom:8}}>+{rows.length-4} more</div>}
                  <div className="row">
                    <button className="btn outline sm" onClick={()=>{setRows([]);setLeads([]);if(fileRef.current)fileRef.current.value="";}}>Clear</button>
                    <button className="btn" style={{flex:1,justifyContent:"center"}} onClick={scoreLeads}>
                      Score {rows.length} Properties →
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={handleFile}/>
                </>
              )}
            </div>

            <div className="note">
              <b>Source:</b> Cook County Assessor open data — free, no account or API key needed.<br/>
              <b>AV note:</b> Cook County assessed value ≈ 10% of market value. Values shown as "~$Xk est." on leads are rough estimates (AV × 3.3) — not appraisals.<br/>
              <b>Roof material:</b> Verified data from county inspection records (~11% coverage). All others estimated from build year and flagged "(est.)" on lead cards.
            </div>
          </>}

          {/* ── LEADS TAB ─────────────────────────────────────────────────── */}
          {tab==="leads" && (
            !leads.length ? (
              <div className="empty">
                <div className="empty-ico">📋</div>
                No leads scored yet.<br/>
                <span style={{fontSize:".7rem",color:"#374151"}}>Go to Storm tab and hit Pull & Score.</span>
              </div>
            ) : (
              <LeadsGrid
                leads={leads}
                displayLeads={displayLeads}
                sortMode={sortMode}
                setSortMode={setSortMode}
                selectedArea={selectedArea}
                pulledPins={pulledPins}
                setPulledPins={setPulledPins}
              />
            )
          )}

          {/* ── SETTINGS TAB ──────────────────────────────────────────────── */}
          {tab==="settings" && (
            <Settings
              weights={weights}
              setWeights={setWeights}
              leads={leads}
              scoreLeads={scoreLeads}
            />
          )}

        </div>
      </div>
  );
}
