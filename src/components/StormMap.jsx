import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Illinois statewide zip GeoJSON (Census TIGER via OpenDataDE)
// Filtered client-side to Cook County area zips (600xx–608xx)
const ZIP_GEOJSON_URL =
  "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/il_illinois_zip_codes_geo.min.json";

// Cook County and immediate suburb zip prefix filter
const isCookAreaZip = zip => {
  const n = parseInt(zip, 10);
  return n >= 60004 && n <= 60828;
};

// Census TIGER property name for zip code
const getZip = feature =>
  String(
    feature.properties.ZCTA5CE10 ||
    feature.properties.GEOID10 ||
    feature.properties.zip ||
    feature.properties.ZIP ||
    ""
  );

// ── Custom Map Pins ────────────────────────────────────────────────────────
const createLeadIcon = (color) => L.divIcon({
  className: 'sl-lead-pin',
  html: `<div style="background:${color}; width:10px; height:10px; border-radius:50%; border:2px solid #fff; box-shadow: 0 0 6px ${color}"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

const reportIcon = L.divIcon({
  className: 'sl-report-pin',
  html: `<div style="font-size:14px; filter: drop-shadow(0 0 4px #fb923c)">🌩</div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const StormMap = ({ stormPolygon, selectedZips = [], leads = [], stormReports = [], onZipToggle, onFetch, areaSeverity = {} }) => {
  const [zipData, setZipData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(ZIP_GEOJSON_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        // Filter to Cook County area only to keep the layer fast
        const filtered = {
          ...data,
          features: (data.features || []).filter(f => isCookAreaZip(getZip(f))),
        };
        setZipData(filtered);
      })
      .catch(err => { console.error("StormMap GeoJSON error:", err); setError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  const zipStyle = feature => {
    const zip = getZip(feature);
    const isSelected = selectedZips.includes(zip);
    
    // Check if this zip corresponds to any hit areas in areaSeverity
    // (Simplified: we check if any hit area label matches the zip tooltip if we had a mapping)
    // For now, if the user focuses on a city, we'll highight that zone
    
    return {
      fillColor:   isSelected ? '#fb923c' : '#1f2937',
      fillOpacity: isSelected ? 0.7 : 0.45,
      color:       isSelected ? '#fb923c' : '#374151',
      weight:      isSelected ? 2 : 1.5,
      opacity:     1,
    };
  };

  const stormStyle = {
    fillColor:   '#fb923c',
    fillOpacity: 0.25,
    color:       '#f97316',
    weight:      2,
    opacity:     0.9,
    dashArray:   '4 4',
  };

  const onEachZip = (feature, layer) => {
    const zip = getZip(feature);

    layer.bindTooltip(`ZIP ${zip}`, {
      sticky:    true,
      className: 'sl-zip-tooltip',
      direction: 'top',
      offset:    [0, -8],
    });

    layer.on({
      click: () => onZipToggle && onZipToggle(zip),
      mouseover: e => {
        e.target.setStyle({ fillOpacity: 0.85, weight: 2.5, color: '#fb923c' });
      },
      mouseout: e => {
        const sel = selectedZips.includes(zip);
        e.target.setStyle({
          fillOpacity: sel ? 0.7 : 0.35,
          weight:      1.5,
          color:       '#374151',
        });
      },
    });
  };

  return (
    <div style={{
      position: 'relative',
      height: '520px',
      width: '100%',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid rgba(251,146,60,0.2)',
      background: '#080c10',
      marginTop: '12px',
    }}>

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, background: '#080c10',
          zIndex: 2000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fb923c', fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '1.1rem', letterSpacing: '0.1em', gap: '12px',
        }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid rgba(251,146,60,0.15)',
            borderTopColor: '#fb923c', borderRadius: '50%',
            animation: 'sl-spin .8s linear infinite',
          }} />
          Loading Cook County ZIP Boundaries…
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{
          position: 'absolute', inset: 0, background: '#080c10',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ef4444', fontFamily: "'DM Mono', monospace", fontSize: '.75rem', padding: '20px',
          textAlign: 'center',
        }}>
          Failed to load ZIP boundaries: {error}
        </div>
      )}

      <MapContainer
        center={[42.0, -87.9]}
        zoom={10}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {zipData && (
          <GeoJSON
            key={selectedZips.join(',')}
            data={zipData}
            style={zipStyle}
            onEachFeature={onEachZip}
          />
        )}

        {stormPolygon && (
          <GeoJSON
            key={`storm-${JSON.stringify(stormPolygon).length}`}
            data={stormPolygon}
            style={stormStyle}
          />
        )}

        {/* Individual Storm Reports (precise damage locations) */}
        {stormReports.map((r, i) => (
          r.lat && r.lon && (
            <Marker key={`rep-${i}`} position={[r.lat, r.lon]} icon={reportIcon}>
              <Popup className="sl-popup">
                <div style={{color:"#fb923c", fontWeight:"bold", fontSize:".8rem"}}>{r.event}</div>
                <div style={{color:"#9ca3af", fontSize:".7rem"}}>{r.desc}</div>
              </Popup>
            </Marker>
          )
        ))}

        {/* Individual Lead Pins */}
        {leads.map((l, i) => (
          l.lat && l.lon && (
            <Marker key={`lead-${i}`} position={[l.lat, l.lon]} icon={createLeadIcon(l.tier === 'HIGH' ? '#ef4444' : '#fb923c')}>
               <Popup className="sl-popup">
                  <div style={{color:"#fff", fontWeight:"bold", fontSize:".8rem"}}>{l.address}</div>
                  <div style={{fontSize:".7rem", color: l.tier==='HIGH'?'#ef4444':'#fb923c', fontFamily:"'Bebas Neue',sans-serif"}}>
                    Score: {l.score}/10 · {l.motivation?.label || 'Prospect'}
                  </div>
                  <div style={{color:"#6b7280", marginTop:4, fontSize:".65rem", fontStyle:"italic"}}>{l.summary}</div>
               </Popup>
            </Marker>
          )
        ))}
      </MapContainer>

      {/* Fetch button — floats over map, only visible when zips are selected */}
      {selectedZips.length > 0 && (
        <button
          onClick={() => onFetch && onFetch(selectedZips)}
          style={{
            position: 'absolute', bottom: 20, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#fb923c', color: '#080c10',
            border: 'none', borderRadius: '3px',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1rem', letterSpacing: '0.08em',
            padding: '10px 24px', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.target.style.background = '#f97316'; }}
          onMouseLeave={e => { e.target.style.background = '#fb923c'; }}
        >
          Fetch Properties for {selectedZips.length} ZIP{selectedZips.length > 1 ? 's' : ''}
        </button>
      )}

      <style>{`
        .sl-zip-tooltip {
          background: #111827 !important;
          border: 1px solid rgba(251,146,60,0.5) !important;
          color: #fb923c !important;
          font-family: 'DM Mono', monospace !important;
          font-size: 11px !important;
          border-radius: 3px !important;
          padding: 3px 7px !important;
          box-shadow: none !important;
        }
        .sl-zip-tooltip::before { display: none !important; }
        .leaflet-container { background: #080c10 !important; }
        .sl-popup .leaflet-popup-content-wrapper {
          background: #080c10 !important;
          border: 1px solid rgba(251,146,60,0.3) !important;
          color: #d4cfc8 !important;
          font-family: 'DM Mono', monospace !important;
          border-radius: 4px !important;
          padding: 0 !important;
        }
        .sl-popup .leaflet-popup-tip { background: #080c10 !important; border: 1px solid rgba(251,146,60,0.3); }
        .sl-popup .leaflet-popup-content { margin: 8px 12px 10px !important; width: auto !important; min-width: 140px; }
        @keyframes sl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default StormMap;
