import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
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

const StormMap = ({ stormPolygon, selectedZips = [], onZipToggle, onFetch }) => {
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
    return {
      fillColor:   isSelected ? '#fb923c' : '#1f2937',
      fillOpacity: isSelected ? 0.7 : 0.35,
      color:       '#374151',
      weight:      1.5,
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
        @keyframes sl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default StormMap;
