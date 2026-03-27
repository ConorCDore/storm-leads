import { useState, useMemo } from "react";
import LeadCard from "./LeadCard";

// ── LeadsGrid ─────────────────────────────────────────────────────────────────
// Renders the full scored lead list with stats, sort/export controls, and
// expandable LeadCard rows. CSV export downloads a proper .csv file.
// Props:
//   leads        – all scored leads (for stats, tier grouping, export)
//   displayLeads – route-sorted copy (used in route mode)
//   sortMode / setSortMode
//   selectedArea – used in CSV filename and header stat
//   pulledPins / setPulledPins – for "Clear History" button
export default function LeadsGrid({
  leads, displayLeads, sortMode, setSortMode,
  selectedArea, pulledPins, setPulledPins,
}) {
  const hi = leads.filter(l => l.tier === "HIGH");
  const md = leads.filter(l => l.tier === "MEDIUM");
  const lo = leads.filter(l => l.tier === "LOW");
  const motivatedCount = leads.filter(l => l.motivation?.tier !== "STANDARD").length;

  const [mFilter, setMFilter] = useState("All");
  const [sortBy, setSortBy] = useState("score");    // score | value-desc | value-asc | age-desc | age-asc | year-asc

  // Filter logic
  const filteredLeads = useMemo(() => {
    if (mFilter === "All") return leads;
    return leads.filter(l => l.motivation?.tier === mFilter);
  }, [leads, mFilter]);

  const filteredDisplay = useMemo(() => {
    if (mFilter === "All") return displayLeads;
    return displayLeads.filter(l => l.motivation?.tier === mFilter);
  }, [displayLeads, mFilter]);

  // ── Secondary sort (within tiers, or flat if non-score sort) ─────────────
  const applySortFn = (list) => {
    if (sortBy === "score") return [...list].sort((a, b) => b.score - a.score);
    if (sortBy === "value-desc") return [...list].sort((a, b) => b.estValue - a.estValue);
    if (sortBy === "value-asc") return [...list].sort((a, b) => a.estValue - b.estValue);
    if (sortBy === "age-desc") return [...list].sort((a, b) => b.roofAge - a.roofAge);
    if (sortBy === "age-asc") return [...list].sort((a, b) => a.roofAge - b.roofAge);
    if (sortBy === "year-asc") return [...list].sort((a, b) => (a.yearBuilt || 9999) - (b.yearBuilt || 9999));
    return list;
  };

  // When using a non-score sort, flatten the list (no tier grouping) so the sort is seamless
  const isScoreSort = sortBy === "score";

  const sortedFiltered = useMemo(() => applySortFn(filteredLeads), [filteredLeads, sortBy]);

  const fHi = isScoreSort ? applySortFn(filteredLeads.filter(l => l.tier === "HIGH")) : [];
  const fMd = isScoreSort ? applySortFn(filteredLeads.filter(l => l.tier === "MEDIUM")) : [];
  const fLo = isScoreSort ? applySortFn(filteredLeads.filter(l => l.tier === "LOW")) : [];

  // Motivation pill stats
  const mStats = useMemo(() => {
    const counts = {
      ELITE_FLIPPER: leads.filter(l => l.motivation?.tier === "ELITE_FLIPPER").length,
      INVESTOR: leads.filter(l => l.motivation?.tier === "INVESTOR").length,
      FLIPPER: leads.filter(l => l.motivation?.tier === "FLIPPER").length,
      DISTRESSED_BUYER: leads.filter(l => l.motivation?.tier === "DISTRESSED_BUYER").length,
      RECENT_BUYER: leads.filter(l => l.motivation?.tier === "RECENT_BUYER").length,
      ABSENTEE: leads.filter(l => l.motivation?.tier === "ABSENTEE").length,
    };
    return counts;
  }, [leads]);

  // ── CSV download ─────────────────────────────────────────────────────────────
  const esc = v => `"${String(v || "").replace(/"/g, '""')}"`;
  const exportCSV = () => {
    const header = "Address,PIN,Score,Tier,Est. Value,Year Built,Roof Age,Motivation,Owner,Summary,Reason\n";
    const rows   = leads.map(l => [
      esc(l.address),
      esc(l.pin),
      l.score,
      l.tier,
      l.estValue || "",
      l.yearBuilt || "",
      l.roofAge || "",
      l.motivation?.tier || "STANDARD",
      esc(l.ownerName || ""),
      esc(l.summary),
      esc(l.reason),
    ].join(",")).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url,
      download: `storm-leads-${(selectedArea || "export").replace(/\s+/g, "-").toLowerCase()}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* ── Stats row ── */}
      <div className="stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat">
          <div className="stat-n" style={{ color: "#ef4444" }}>{hi.length}</div>
          <div className="stat-l">High</div>
        </div>
        <div className="stat">
          <div className="stat-n">{md.length}</div>
          <div className="stat-l">Medium</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ color: "#4b5563" }}>{lo.length}</div>
          <div className="stat-l">Low</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ color: "#fbbf24" }}>{motivatedCount}</div>
          <div className="stat-l">Motivated</div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="res-hd">
        <div className="res-stat">{selectedArea} · {leads.length} leads</div>
        <div className="row" style={{ gap: 6 }}>

          {/* Sort toggle — Score vs Route */}
          <div style={{
            display: "flex", border: "1px solid rgba(251,146,60,.25)",
            borderRadius: 3, overflow: "hidden"
          }}>
            {[["score", "Score"], ["route", "Route"]].map(([m, l]) => (
              <button key={m} onClick={() => setSortMode(m)} style={{
                padding: "5px 10px", fontSize: ".7rem",
                fontFamily: "'Bebas Neue',sans-serif", letterSpacing: ".06em",
                border: "none", cursor: "pointer",
                background: sortMode === m ? "#fb923c" : "transparent",
                color:      sortMode === m ? "#080c10" : "#fb923c",
              }}>
                {l}
              </button>
            ))}
          </div>

          {/* Sort-by dropdown (visible in score mode) */}
          {sortMode === "score" && (
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                padding: "4px 6px", fontSize: ".65rem",
                fontFamily: "'Bebas Neue',sans-serif", letterSpacing: ".06em",
                background: "#131920", color: "#fb923c",
                border: "1px solid rgba(251,146,60,.25)", borderRadius: 3,
                cursor: "pointer",
              }}
            >
              <option value="score">Sort: Score ↓</option>
              <option value="value-desc">Sort: Value ↓</option>
              <option value="value-asc">Sort: Value ↑</option>
              <option value="age-desc">Sort: Roof Age ↓</option>
              <option value="age-asc">Sort: Roof Age ↑</option>
              <option value="year-asc">Sort: Oldest Built</option>
            </select>
          )}

          {pulledPins.size > 0 && (
            <button
              className="btn sm outline"
              title="Reset duplicate suppression — next pull will re-fetch all properties"
              onClick={() => setPulledPins(new Set())}
            >
              Clear History
            </button>
          )}

          <button className="btn sm" onClick={exportCSV} title="Download lead list as CSV">
            ↓ CSV
          </button>
        </div>
      </div>

      {/* ── Motivation Filter row ── */}
      <div className="row" style={{ marginBottom: 14, gap: 5 }}>
        <button 
          onClick={() => setMFilter("All")}
          style={{
            padding: "4px 10px", fontSize: ".65rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)",
            background: mFilter === "All" ? "rgba(255,255,255,.1)" : "transparent",
            color: mFilter === "All" ? "#fff" : "#6b7280", cursor: "pointer"
          }}
        >
          All
        </button>
        {[
          ["ELITE_FLIPPER", "🔥 Elite Flip"],
          ["INVESTOR", "🏢 Investor"],
          ["FLIPPER", "🔄 Flipper"],
          ["DISTRESSED_BUYER", "📉 Distressed"],
          ["RECENT_BUYER", "🔑 New Owner"],
          ["ABSENTEE", "📬 Absentee"]
        ].map(([tier, label]) => (
          mStats[tier] > 0 && (
            <button 
              key={tier}
              onClick={() => setMFilter(tier)}
              style={{
                padding: "4px 10px", fontSize: ".65rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)",
                background: mFilter === tier ? "rgba(251,146,60,.12)" : "transparent",
                color: mFilter === tier ? "#fb923c" : "#6b7280", cursor: "pointer"
              }}
            >
              {label} ({mStats[tier]})
            </button>
          )
        ))}
      </div>

      {/* Route mode hint */}
      {sortMode === "route" && (
        <div style={{
          fontSize: ".62rem", color: "#6b7280", marginBottom: 8,
          padding: "6px 10px",
          background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 3
        }}>
          Route order: sorted by zip → street → house number for efficient canvassing. Tier color preserved.
        </div>
      )}

      {/* ── Lead list ── */}
      {sortMode === "route" ? (
        <div className="lead-grid">
          {filteredDisplay.map((l, i) => <LeadCard key={i} lead={l} />)}
        </div>
      ) : isScoreSort ? (
        [["HIGH", fHi, "hi", "🔴"], ["MEDIUM", fMd, "md", "🟡"], ["LOW", fLo, "lo", "🟢"]].map(
          ([tier, list, cls, ico]) =>
            list.length > 0 && (
              <div key={tier}>
                <div className={`tier-h ${cls}`}>{ico} {tier} — {list.length}</div>
                <div className="lead-grid">
                  {list.map((l, i) => <LeadCard key={i} lead={l} />)}
                </div>
              </div>
            )
        )
      ) : (
        /* Flat sorted list (non-score sort — no tier grouping) */
        <div className="lead-grid">
          {sortedFiltered.map((l, i) => <LeadCard key={i} lead={l} />)}
        </div>
      )}
    </>
  );
}
