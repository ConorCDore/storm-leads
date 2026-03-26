import { useState } from "react";

// ── LeadCard ──────────────────────────────────────────────────────────────────
// Single scored lead row. Click to expand the per-factor score breakdown.
// Props: lead { address, score, tier, summary, reason, breakdown[] }
export default function LeadCard({ lead }) {
  const [open, setOpen] = useState(false);

  const tierCls  = lead.tier === "HIGH" ? "hi" : lead.tier === "MEDIUM" ? "md" : "lo";
  const tierColor= lead.tier === "HIGH" ? "#ef4444" : lead.tier === "MEDIUM" ? "#fb923c" : "#4b5563";

  // Storm type badges — inferred from the reason string
  const reason  = (lead.reason || "").toLowerCase();
  const hasHail = reason.includes("hail");
  const hasWind = reason.includes("wind") || reason.includes("tornado");

  return (
    <div
      className={`lead ${tierCls}`}
      style={{ flexDirection: "column", gap: 0, cursor: "pointer", marginBottom: 7 }}
      onClick={() => setOpen(o => !o)}
    >
      {/* ── Main row ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lead-addr" title={lead.address}>{lead.address}</div>

          {/* Badge row */}
          {(hasHail || hasWind || lead.motivation?.tier !== "STANDARD") && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {hasHail && <span className="storm-badge hail">🌨 HAIL</span>}
              {hasWind && <span className="storm-badge wind">💨 HIGH WIND</span>}
              
              {lead.motivation?.tier === "ELITE_FLIPPER" && <span className="motiv-badge flipper">🔥 ELITE FLIP</span>}
              {lead.motivation?.tier === "INVESTOR" && <span className="motiv-badge investor">🏢 INVESTOR</span>}
              {lead.motivation?.tier === "FLIPPER" && <span className="motiv-badge flipper">🔄 FLIPPER</span>}
              {lead.motivation?.tier === "DISTRESSED_BUYER" && <span className="motiv-badge distressed">📉 DISTRESSED</span>}
              {lead.motivation?.tier === "RECENT_BUYER" && <span className="motiv-badge recent">🔑 NEW OWNER</span>}
              {lead.motivation?.tier === "ABSENTEE" && <span className="motiv-badge absentee">📬 ABSENTEE</span>}
            </div>
          )}

          {lead.summary && (
            <div className="lead-sum" style={{ marginTop: 4 }}>{lead.summary}</div>
          )}
        </div>

        {/* Score + tier + expand indicator */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <div className="score-box">
            <div className="score-n">{lead.score}</div>
            <div className="score-s">/10</div>
          </div>
          <span style={{
            fontSize: ".52rem", fontFamily: "'Bebas Neue',sans-serif",
            letterSpacing: ".07em", color: tierColor
          }}>
            {lead.tier}
          </span>
          <span style={{ fontSize: ".55rem", color: "#374151" }}>{open ? "▴" : "▾"}</span>
        </div>
      </div>

      {/* ── Expanded breakdown ── */}
      {open && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: "1px solid rgba(255,255,255,.06)"
        }}>
          {lead.breakdown?.length ? (
            <div style={{ display: "grid", gap: 7 }}>
              {lead.breakdown.map(b => {
                const barPct  = `${Math.round((b.raw / 3) * 100)}%`;
                const barColor= b.raw >= 3 ? "#ef4444" : b.raw >= 2 ? "#fb923c" : b.raw === 1 ? "#d97706" : "#374151";
                const dimmed  = b.weight === 0;
                return (
                  <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 8, opacity: dimmed ? 0.35 : 1 }}>
                    <span style={{
                      fontSize: ".6rem", color: "#6b7280",
                      minWidth: 98, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: ".04em"
                    }}>
                      {b.label}
                    </span>
                    {/* Bar */}
                    <div style={{
                      flex: 1, height: 4, background: "rgba(255,255,255,.07)",
                      borderRadius: 2, overflow: "hidden"
                    }}>
                      <div style={{
                        width: barPct, height: "100%",
                        background: barColor, borderRadius: 2,
                        transition: "width .25s"
                      }} />
                    </div>
                    <span style={{
                      fontSize: ".6rem", color: "#fb923c",
                      fontFamily: "'Bebas Neue',sans-serif", minWidth: 22, textAlign: "right"
                    }}>
                      {b.raw}/3
                    </span>
                    <span style={{ fontSize: ".55rem", color: "#4b5563", minWidth: 22 }}>
                      ×{b.weight}
                    </span>
                    <span style={{ fontSize: ".58rem", color: "#6b7280", flex: 1, minWidth: 0, textAlign: "right" }}
                      title={b.detail}>
                      {b.detail.length > 28 ? b.detail.slice(0, 26) + "…" : b.detail}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: ".63rem", color: "#6b7280", lineHeight: 1.6 }}>
              {lead.reason}
            </div>
          )}

          {/* Motivation reasons */}
          {lead.motivation?.reasons?.length > 0 && (
            <div style={{ 
              marginTop: 8, paddingTop: 8, 
              borderTop: "1px solid rgba(255,255,255,.03)",
              fontSize: ".62rem", color: "#6b7280", fontStyle: "italic" 
            }}>
              {lead.motivation.reasons.join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
