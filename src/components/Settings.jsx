import { useState } from "react";
import { DEFAULT_WEIGHTS, WEIGHT_LABELS } from "../constants";

export default function Settings({ weights, setWeights, leads, scoreLeads }) {
  const [propStreamKey, setPropStreamKey] = useState("");
  const [keySaved, setKeySaved]           = useState(false);

  const saveKey = () => {
    // Placeholder — wire to enrichment layer in future sprint
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <>
      {/* Scoring weights */}
      <div className="card">
        <div className="lbl">Scoring Weights</div>
        <div style={{fontSize:".65rem",color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
          Each factor is scored 0–3 internally. Your weight (0–5) controls how much it influences
          the final 0–10 score. Set a weight to 0 to exclude a factor entirely.
        </div>

        {Object.entries(WEIGHT_LABELS).map(([key, label]) => (
          <div key={key} className="wt-row">
            <span className="wt-lbl">{label}</span>
            <input
              type="range" min={0} max={5} value={weights[key]}
              onChange={e => setWeights(w => ({...w, [key]: +e.target.value}))}
            />
            <span className="wt-val">{weights[key]}</span>
          </div>
        ))}

        <div className="row" style={{marginTop:12,gap:12}}>
          <button
            className="btn sm"
            onClick={() => scoreLeads(false)}
            disabled={!leads.length}
            title={!leads.length ? "Pull and score properties first" : "Re-rank current leads with updated weights"}
          >
            Re-Score {leads.length ? `${leads.length} Leads` : "Leads"}
          </button>
          <span className="wt-reset" onClick={() => setWeights({...DEFAULT_WEIGHTS})}>
            Reset defaults
          </span>
        </div>

        <div style={{fontSize:".6rem",color:"#374151",marginTop:10,lineHeight:1.6}}>
          Default weights: Roof Age 3 · Property Value 2 · Storm Severity 4 · Roof Material 3 · Permit History 2
        </div>
      </div>

      {/* Integrations */}
      <div className="card">
        <div className="lbl">Integrations</div>

        <div className="field" style={{marginBottom:10}}>
          <span className="field-lbl">PropStream API Key</span>
          <div className="row" style={{gap:6,flexWrap:"nowrap"}}>
            <input
              type="password"
              value={propStreamKey}
              placeholder="Paste key to enable contact enrichment"
              onChange={e => setPropStreamKey(e.target.value)}
              style={{flex:1}}
            />
            <button
              className={`btn sm${keySaved ? " green" : ""}`}
              onClick={saveKey}
              disabled={!propStreamKey}
            >
              {keySaved ? "✓ Saved" : "Save"}
            </button>
          </div>
        </div>

        <div style={{fontSize:".63rem",color:"#374151",lineHeight:1.7}}>
          When a PropStream key is active, an <b style={{color:"#6b7280"}}>Enrich</b> button
          appears on the Leads tab to append owner name, phone, and email to scored leads.
          PropStream charges ~$0.12/skip trace. Leave blank to use free Cook County data only.
        </div>
      </div>

      {/* Data sources */}
      <div className="note">
        <b>Active data sources:</b><br/>
        Cook County Assessor API (addresses, AV, building chars, roof, permits)<br/>
        NOAA / NWS (live alerts, Hazardous Weather Outlook)<br/>
        Iowa Environmental Mesonet (historical storm reports, 5yr archive)<br/><br/>
        <b>Version:</b> StormLeads v2 · 100% free unless PropStream enrichment enabled
      </div>
    </>
  );
}
