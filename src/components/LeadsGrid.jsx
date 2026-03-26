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

  // ── CSV download ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = "Address,Score,Tier,Summary,Reason\n";
    const rows   = leads.map(l => [
      `"${(l.address || "").replace(/"/g, '""')}"`,
      l.score,
      l.tier,
      `"${(l.summary  || "").replace(/"/g, '""')}"`,
      `"${(l.reason   || "").replace(/"/g, '""')}"`,
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
      <div className="stats">
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
      </div>

      {/* ── Toolbar ── */}
      <div className="res-hd">
        <div className="res-stat">{selectedArea} · {leads.length} leads</div>
        <div className="row" style={{ gap: 6 }}>

          {/* Sort toggle */}
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
        displayLeads.map((l, i) => <LeadCard key={i} lead={l} />)
      ) : (
        [["HIGH", hi, "hi", "🔴"], ["MEDIUM", md, "md", "🟡"], ["LOW", lo, "lo", "🟢"]].map(
          ([tier, list, cls, ico]) =>
            list.length > 0 && (
              <div key={tier}>
                <div className={`tier-h ${cls}`}>{ico} {tier} — {list.length}</div>
                {list.map((l, i) => <LeadCard key={i} lead={l} />)}
              </div>
            )
        )
      )}
    </>
  );
}
