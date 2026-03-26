import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Cook County Zip Codes GeoJSON (from TIGER source)
const ZIP_GEOJSON_URL = "https://raw.githubusercontent.com/OpenDataCookCounty/Boundaries-Zip-Codes/master/ZIP_Codes.geojson";

const StormMap = ({ stormPolygon, selectedZips, onZipToggle, onFetch }) => {
  const [zipData, setZipData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchZipCodes = async () => {
      try {
        const response = await fetch(ZIP_GEOJSON_URL);
        if (!response.ok) throw new Error("Failed to fetch ZIP boundaries");
        const data = await response.json();
        setZipData(data);
      } catch (err) {
        console.error("Map Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchZipCodes();
  }, []);

  const zipStyle = (feature) => {
    const zip = String(feature.properties.zip || feature.properties.ZIP);
    const isSelected = selectedZips.includes(zip);
    return {
      fillColor: isSelected ? '#fb923c' : '#1f2937', 
      weight: 1.5,
      opacity: 1,
      color: '#374151',
      fillOpacity: isSelected ? 0.7 : 0.4,
    };
  };

  const stormStyle = {
    fillColor: '#fb923c',
    weight: 2,
    opacity: 1,
    color: '#f97316',
    fillOpacity: 0.3,
  };

  const onEachZip = (feature, layer) => {
    const zip = String(feature.properties.zip || feature.properties.ZIP);
    
    // Bind tooltip for hover
    layer.bindTooltip(`ZIP: ${zip}`, { 
      sticky: true, 
      className: 'zip-tooltip',
      direction: 'top',
      offset: [0, -10]
    });

    layer.on({
      click: () => {
        if (onZipToggle) onZipToggle(zip);
      },
      mouseover: (e) => {
        const lyr = e.target;
        lyr.setStyle({
          fillOpacity: 0.8,
          weight: 2,
          color: '#fb923c',
        });
      },
      mouseout: (e) => {
        const lyr = e.target;
        // The GeoJSON component will handle the base style when selectedZips changes,
        // but for mouseout we want to revert to the current 'base' style (selected or not)
        const isSelected = selectedZips.includes(zip);
        lyr.setStyle({
          fillOpacity: isSelected ? 0.7 : 0.4,
          weight: 1.5,
          color: '#374151',
        });
      }
    });
  };

  const containerStyle = {
    height: '600px',
    width: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(251, 146, 60, 0.2)',
    position: 'relative',
    background: '#080c10',
    marginTop: '20px',
  };

  const buttonStyle = {
    position: 'absolute',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    background: '#fb923c',
    color: '#080c10',
    border: 'none',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '1.2rem',
    letterSpacing: '0.08em',
    padding: '14px 28px',
    borderRadius: '6px',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    fontWeight: 'bold',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <div style={containerStyle}>
      {loading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: '#080c10', zIndex: 2000,
          display: 'flex', flexFlow: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fb923c', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.1em'
        }}>
          <div className="spinner" style={{
            width: '40px', height: '40px', border: '4px solid rgba(251,146,60,0.1)',
            borderTopColor: '#fb923c', borderRadius: '50%', marginBottom: '15px'
          }} />
          LOADING COOK COUNTY ZIP DATA...
        </div>
      )}
      
      <MapContainer 
        center={[41.8781, -87.85]} 
        zoom={10} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {zipData && (
          <GeoJSON 
            key={selectedZips.join(',')} // Force redraw when selection changes to update styles
            data={zipData} 
            style={zipStyle}
            onEachFeature={onEachZip}
          />
        )}

        {stormPolygon && (
          <GeoJSON 
            data={stormPolygon} 
            style={stormStyle} 
          />
        )}
      </MapContainer>

      {selectedZips.length > 0 && (
        <button 
          style={buttonStyle} 
          onClick={() => onFetch(selectedZips)}
          onMouseEnter={(e) => {
            e.target.style.background = '#f97316';
            e.target.style.transform = 'translateX(-50%) scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#fb923c';
            e.target.style.transform = 'translateX(-50%) scale(1)';
          }}
        >
          FETCH PROPERTIES ({selectedZips.length})
        </button>
      )}

      <style>{`
        .zip-tooltip {
          background: #111827 !important;
          border: 1px solid #fb923c !important;
          color: #fb923c !important;
          font-family: 'DM Mono', monospace !important;
          font-size: 12px !important;
          border-radius: 4px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          padding: 4px 8px !important;
        }
        .leaflet-container {
          background: #080c10 !important;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default StormMap;
