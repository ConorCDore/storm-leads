// Dashboard — at-a-glance overview: storm status, HWO banner, top leads
export default function Dashboard({ 
  alerts, alertsDone, hwo, areaRanking, leads, globalLeads = [], 
  isScouting, scoutStormPath, pullStatus,
  stormHistory, isHistorical, stormDate, setTab 
}) {
  const topLeads  = leads.length > 0 ? leads.slice(0, 3) : globalLeads.slice(0, 5);
  const highCount = (leads.length > 0 ? leads : globalLeads).filter(l => l.tier === "HIGH").length;

  return (
    <>
      {/* Status row */}
      <div className="stats" style={{marginBottom:12}}>
        <div className="stat">
          <div className="stat-n" style={{color: areaRanking.length > 0 ? "#ef4444" : "#10b981"}}>
            {alertsDone ? areaRanking.length : "—"}
          </div>
          <div className="stat-l">Areas Hit</div>
        </div>
        <div className="stat">
          <div className="stat-n">{leads.length || "—"}</div>
          <div className="stat-l">Leads</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{color: highCount > 0 ? "#ef4444" : undefined}}>
            {leads.length ? highCount : "—"}
          </div>
          <div className="stat-l">High Priority</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card" style={{padding:"12px 14px"}}>
        <div className="lbl" style={{marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
          Quick Actions
          {isScouting && <span className="sp sp-or" style={{fontSize:".6rem", color:"#fb923c"}}> scouting storm path…</span>}
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn sm outline" style={{flex:1,justifyContent:"center"}} 
            onClick={alertsDone && areaRanking.some(a => a.pts >= 2) ? scoutStormPath : () => setTab("storm")} 
            disabled={isScouting}>
            {isScouting ? "Scouting…" : alertsDone && areaRanking.some(a => a.pts >= 2) ? "🔥 Scout Storm Path" : "⚡ Fetch Alerts"}
          </button>
          <button className="btn sm" style={{flex:1,justifyContent:"center"}} onClick={() => setTab("storm")} disabled={isScouting}>
            🏠 Pull Area →
          </button>
        </div>
        {pullStatus && isScouting && (
          <div style={{fontSize:".6rem",color:"#10b981",marginTop:6}}>{pullStatus}</div>
        )}
        {alertsDone && !isScouting && !globalLeads.length && areaRanking.some(a => a.pts >= 2) && (
          <div style={{fontSize:".6rem",color:"#6b7280",marginTop:6,lineHeight:1.4}}>
            Strategic Tip: Use <b>Scout Storm Path</b> to automatically find the most motivated flippers and institutional prospects across all hit areas simultaneously.
          </div>
        )}
      </div>

      {/* HWO Pre-Storm banner */}
      {hwo?.hailMentioned && !isHistorical && (
        <div className="hwo-banner">
          <div className="hwo-title">⚠ Pre-Storm Scout</div>
          <div className="hwo-text">
            NWS Hazardous Weather Outlook mentions{" "}
            <b style={{color:"#fb923c"}}>{hwo.severeMentioned ? "hail and severe weather" : "hail"}</b>
            {" "}for the Chicago area. No active warnings yet — pre-rank leads now.
            {hwo.summary && (
              <div style={{color:"#6b7280",fontSize:".62rem",marginTop:4}}>{hwo.summary}</div>
            )}
          </div>
          <button className="btn sm" onClick={() => setTab("storm")}>Pre-Rank Leads →</button>
        </div>
      )}

      {/* Active storm areas */}
      {alertsDone && areaRanking.length > 0 && (
        <div className="card">
          <div className="lbl">
            {isHistorical ? `Storm Areas — ${stormDate}` : "Active Storm Areas"}
          </div>
          <div className="sev-grid">
            {areaRanking.slice(0, 6).map(a => (
              <div key={a.name} className={`sev-row s${a.pts}`}>
                <span className="sev-name">{a.name}</span>
                <span className="sev-detail">
                  {a.hail ? `${a.hail}" hail` : ""}
                  {a.wind ? `${a.hail ? " · " : ""}${a.wind} mph` : ""}
                </span>
                {stormHistory[a.name] > 0 && (
                  <span style={{
                    fontSize:".57rem", color:"#6b7280",
                    border:"1px solid rgba(255,255,255,.08)", borderRadius:2,
                    padding:"1px 5px", marginRight:4, whiteSpace:"nowrap"
                  }}>
                    {stormHistory[a.name]}×/5yr
                  </span>
                )}
                <span className={`sev-badge s${a.pts}`}>
                  {a.pts === 3 ? "SEVERE" : a.pts === 2 ? "MODERATE" : "MINOR"}
                </span>
              </div>
            ))}
          </div>
          {areaRanking.length > 6 && (
            <div style={{fontSize:".6rem",color:"#374151",marginTop:6,cursor:"pointer"}}
              onClick={() => setTab("storm")}>
              +{areaRanking.length - 6} more areas — view in Storm tab
            </div>
          )}
          <button className="btn sm outline" style={{marginTop:10,width:"100%",justifyContent:"center"}}
            onClick={() => setTab("storm")}>
            Pull Properties for These Areas →
          </button>
        </div>
      )}

      {/* Top leads preview */}
      {(topLeads.length > 0) && (
        <div className="card">
          <div className="lbl">{leads.length > 0 ? "Top Leads (Current Area)" : "Top Motivated Leads (Storm Path)"}</div>
          {topLeads.map((l, i) => (
            <div key={i} className={`lead ${l.tier==="HIGH"?"hi":l.tier==="MEDIUM"?"md":"lo"}`}
              style={{marginBottom: i < topLeads.length - 1 ? 6 : 0}}>
              <div className="lead-body">
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                   <div className="lead-addr" title={l.address}>{l.address}</div>
                   {l.motivation?.label && (
                      <span style={{
                        fontSize:".55rem", color:"#fb923c", border:"1px solid rgba(251,146,60,.3)", 
                        borderRadius:2, padding:"0 4px", marginLeft:6, fontFamily:"sans-serif", fontWeight:"bold"
                      }}>
                        {l.motivation.label}
                      </span>
                   )}
                </div>
                {l.summary && <div className="lead-sum" style={{fontSize:".62rem", color:"#6b7280", marginTop:2}}>{l.summary}</div>}
              </div>
              <div className="score-box">
                <div className="score-n">{l.score}</div>
                <div className="score-s">/10</div>
              </div>
            </div>
          ))}
          <button className="btn sm outline"
            style={{marginTop:10,width:"100%",justifyContent:"center"}}
            onClick={() => setTab(leads.length > 0 ? "leads" : "storm")}>
            {leads.length > 0 ? `View All ${leads.length} Leads →` : "Scouting found motivated prospects — Go to Leads tab"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!alertsDone && !leads.length && (
        <div className="empty">
          <div className="empty-ico">⛈</div>
          <div>No storm data yet</div>
          <div style={{fontSize:".68rem",color:"#374151",marginTop:6,marginBottom:16}}>
            Fetch alerts to see which areas were hit, then pull and score properties.
          </div>
          <button className="btn" onClick={() => setTab("storm")}>Get Started →</button>
        </div>
      )}
    </>
  );
}
