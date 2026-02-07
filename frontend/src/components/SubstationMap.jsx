
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import { Settings, X, RefreshCw } from 'lucide-react';

// Helper component to add the heatmap layer
const HeatmapLayer = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        if (!points || points.length === 0) return;

        const heat = L.heatLayer(points, {
            radius: 35,
            blur: 25,
            maxZoom: 17,
            max: 1.0,
            gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
        }).addTo(map);

        return () => {
            map.removeLayer(heat);
        };
    }, [points, map]);

    return null;
};

// Default thresholds configuration
const DEFAULT_THRESHOLDS = [
    { max: 30, color: '#3b82f6', label: '< 30 MW (Blue)' },
    { max: 50, color: '#22c55e', label: '30-50 MW (Green)' },
    { max: 80, color: '#eab308', label: '50-80 MW (Yellow)' },
    { max: 100, color: '#f97316', label: '80-100 MW (Orange)' },
    { max: Infinity, color: '#ef4444', label: '> 100 MW (Red)' },
];

const SubstationMap = ({ data }) => {
    const defaultCenter = [4.2105, 101.9758];
    const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
    const [showSettings, setShowSettings] = useState(false);

    const getColor = (load) => {
        const val = load || 0;
        for (const t of thresholds) {
            if (val < t.max) return t.color;
        }
        return thresholds[thresholds.length - 1].color;
    };

    const maxLoad = Math.max(...data.map(d => d.load_mw || 0), 100);
    const heatPoints = data
        .filter(d => d.latitude && d.longitude)
        .map(d => [
            d.latitude,
            d.longitude,
            (d.load_mw || 0) / maxLoad
        ]);

    return (
        <div style={{
            height: '600px',
            width: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(0,229,255,0.2)',
            zIndex: 1,
            position: 'relative'
        }}>
            {/* Map Settings Button (Bottom Left) */}
            <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    zIndex: 1000,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
            >
                <Settings size={18} />
            </button>

            {/* Settings Panel */}
            {showSettings && (
                <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    left: '10px',
                    zIndex: 1001,
                    width: '320px',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0,229,255,0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, color: '#00e5ff', fontSize: '0.9rem' }}>Legend & Thresholds</h4>
                        <X size={16} style={{ cursor: 'pointer', color: '#fff' }} onClick={() => setShowSettings(false)} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {thresholds.map((t, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fff' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.color, flexShrink: 0 }}></div>
                                <div style={{ flex: 1 }}>
                                    {idx === 0 ? `< ${t.max}` :
                                        idx === thresholds.length - 1 ? `> ${thresholds[idx - 1].max}` :
                                            `${thresholds[idx - 1].max} - ${t.max}`} MW
                                </div>
                                <input
                                    type="color"
                                    value={t.color}
                                    onChange={(e) => {
                                        const newThresholds = [...thresholds];
                                        newThresholds[idx].color = e.target.value;
                                        setThresholds(newThresholds);
                                    }}
                                    style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }}
                                />
                                {idx < thresholds.length - 1 && (
                                    <input
                                        type="number"
                                        value={t.max === Infinity ? '' : t.max}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            const newThresholds = [...thresholds];
                                            newThresholds[idx].max = val;
                                            setThresholds(newThresholds);
                                        }}
                                        style={{ width: '50px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', padding: '2px 4px' }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#aaa',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <RefreshCw size={12} /> Reset to Defaults
                        </button>
                    </div>
                </div>
            )}

            <MapContainer
                center={defaultCenter}
                zoom={7}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
            >
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="OpenStreetMap (Light)">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Dark Matter (High Contrast)">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satellite">
                        <TileLayer
                            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                <HeatmapLayer points={heatPoints} />

                {data.map(d => {
                    if (!d.latitude || !d.longitude) return null;
                    const color = getColor(d.load_mw);
                    const radius = Math.max(4, Math.sqrt(d.load_mw || 0) * 0.8);

                    return (
                        <React.Fragment key={d.substation_id}>
                            <CircleMarker
                                center={[d.latitude, d.longitude]}
                                radius={radius * 3.5}
                                pathOptions={{
                                    color: color,
                                    fillColor: color,
                                    fillOpacity: 0.1,
                                    stroke: false
                                }}
                                interactive={false}
                            />
                            <CircleMarker
                                center={[d.latitude, d.longitude]}
                                radius={radius * 2}
                                pathOptions={{
                                    color: color,
                                    fillColor: color,
                                    fillOpacity: 0.3,
                                    stroke: false
                                }}
                                interactive={false}
                            />
                            <CircleMarker
                                center={[d.latitude, d.longitude]}
                                radius={radius}
                                pathOptions={{
                                    color: '#fff',
                                    weight: 1,
                                    fillColor: color,
                                    fillOpacity: 0.9
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <div style={{ textAlign: 'center', minWidth: '120px' }}>
                                        <h4 style={{ margin: '0 0 4px 0', color: color }}>{d.name || d.substation_id}</h4>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            Load: <strong>{d.load_mw ? d.load_mw.toFixed(2) : '0.00'} MW</strong>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                            {d.state}
                                        </div>
                                    </div>
                                </Tooltip>
                            </CircleMarker>
                        </React.Fragment>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default SubstationMap;
