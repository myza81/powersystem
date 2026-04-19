
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Tooltip, useMap, useMapEvents, LayersControl, LayerGroup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import { Settings, X, RefreshCw, Search, MapPin, Loader2 } from 'lucide-react';
import axios from 'axios';

import api from '../api';

// Helper to handle map clicks
const MapClickHandler = ({ onMapClick }) => {
    useMapEvents({
        click: () => {
            onMapClick();
        },
    });
    return null;
};

// Helper component to add the heatmap layer
const HeatmapLayer = ({ points, gradient }) => {
    const map = useMap();

    useEffect(() => {
        if (!points || points.length === 0) return;

        let heat = null;

        const addHeat = () => {
            const size = map.getSize();
            if (size.y === 0) return;
            heat = L.heatLayer(points, {
                radius: 35,
                blur: 25,
                maxZoom: 17,
                max: 1.0,
                gradient: gradient || { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
            }).addTo(map);
        };

        // If map is already sized, add immediately; otherwise wait for resize
        if (map.getSize().y > 0) {
            addHeat();
        } else {
            map.once('resize', addHeat);
        }

        return () => {
            map.off('resize', addHeat);
            if (heat) map.removeLayer(heat);
        };
    }, [points, map, gradient]);

    return null;
};

// Helper component to control map zoom/pan
const MapController = ({ center, zoom }) => {
    const map = useMap();

    useEffect(() => {
        if (center && zoom) {
            map.setView(center, zoom, { animate: true, duration: 1 });
        }
    }, [center, zoom, map]);

    return null;
};

// Default thresholds configuration
const DEFAULT_THRESHOLDS = [
    { max: 1, color: '#3b82f6', label: '< 1 MW (Blue)' },
    { max: 30, color: '#3bf7ea', label: '1-30 MW (Cyan)' },
    { max: 50, color: '#22c55e', label: '30-50 MW (Green)' },
    { max: 80, color: '#eab308', label: '50-80 MW (Yellow)' },
    { max: 100, color: '#f97316', label: '80-100 MW (Orange)' },
    { max: Infinity, color: '#ef4444', label: '> 100 MW (Red)' },
];

const BayBreakdown = ({ bays, transformers, incoming_bays, color = '#333' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasRealtime = bays && bays.length > 0;
    const hasStatic = (transformers && transformers.length > 0) || (incoming_bays && incoming_bays.length > 0);

    if (!hasRealtime && !hasStatic) return null;

    return (
        <div style={{ marginTop: '4px', borderTop: '1px solid #eee', paddingTop: '4px' }}>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                }}
                style={{
                    cursor: 'pointer',
                    color: '#00e5ff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <span>Bay Breakdown</span>
                <span>{isExpanded ? '▼' : '▶'}</span>
            </div>

            {isExpanded && (
                <div style={{ maxHeight: '150px', overflowY: 'auto', textAlign: 'left', marginTop: '4px' }}>
                    {/* Real-time Bays */}
                    {hasRealtime ? (
                        bays.map((bay, idx) => (
                            <div key={idx} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', color: '#ccc', padding: '2px 0' }}>
                                <span>{bay.name}:</span>
                                <strong>{bay.mw.toFixed(1)} MW</strong>
                            </div>
                        ))
                    ) : (
                        /* Static Transformers & Bays */
                        <>
                            {transformers && transformers.map((t, idx) => (
                                <div key={`t-${idx}`} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', color: '#ccc', padding: '2px 0' }}>
                                    <span>{t.bay_name || t.bay_id || 'Tx'}:</span>
                                    <strong>{t.load_data ? t.load_data.pload_mw.toFixed(1) : '0.0'} MW</strong>
                                </div>
                            ))}
                            {incoming_bays && incoming_bays.map((b, idx) => (
                                <div key={`b-${idx}`} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', color: '#ccc', padding: '2px 0' }}>
                                    <span>{b.bay_name || b.bay_id || 'Bay'}:</span>
                                    <strong>{b.load_data ? b.load_data.pload_mw.toFixed(1) : '0.0'} MW</strong>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const RADIUS_COLORS = ['#00e5ff', '#f97316', '#a855f7', '#22c55e', '#eab308', '#f43f5e'];

// Geographic destination point given distance (km) and bearing (degrees from North)
const destinationPoint = (lat, lng, distKm, bearingDeg) => {
    const R = 6371;
    const d = distKm / R;
    const φ1 = lat * Math.PI / 180;
    const λ1 = lng * Math.PI / 180;
    const θ = bearingDeg * Math.PI / 180;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    return [φ2 * 180 / Math.PI, λ2 * 180 / Math.PI];
};

// Linear interpolation between two lat/lng points
const lerpPoint = (p1, p2, t) => [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t,
];

const SubstationMap = ({ data, focusLocation, fuiMode = false, networkLinks = [], showNetworkLines = false, circuitDisplayMode = 'thickness', radiusConfig = null }) => {
    const defaultCenter = [4.2105, 101.9758];
    const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState('layers');
    const [activeLayer, setActiveLayer] = useState(fuiMode ? 'dark' : 'light');
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showMarkers, setShowMarkers] = useState(true);

    // Auto-hide heatmap when network lines are enabled
    useEffect(() => {
        if (showNetworkLines) {
            setShowHeatmap(false);
        } else {
            setShowHeatmap(true);
        }
    }, [showNetworkLines]);

    // Search functionality state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedResult, setSelectedResult] = useState(null);
    const [mapCenter, setMapCenter] = useState(null);
    const [mapZoom, setMapZoom] = useState(null);

    // Handle external focus requests
    useEffect(() => {
        if (focusLocation && focusLocation.latitude && focusLocation.longitude) {
            setMapCenter([focusLocation.latitude, focusLocation.longitude]);
            setMapZoom(15);
            // Auto-select to show tooltip
            setSelectedResult({ ...focusLocation, type: 'substation' });
        }
    }, [focusLocation]);

    // Geocoding fallback using Nominatim (OpenStreetMap)
    const geocodeLocation = async (query) => {
        try {
            const response = await axios.get(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=my&limit=5`
            );
            return response.data.map(result => ({
                type: 'location',
                name: result.display_name,
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon)
            }));
        } catch (error) {
            console.error('Geocoding failed:', error);
            return [];
        }
    };

    // Search handler with fallback
    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // First, try substation search
            const substationResponse = await api.get(`/substations/?search=${query}`);
            const substations = substationResponse.data.results || substationResponse.data || [];

            if (substations.length > 0) {
                // Found substations
                setSearchResults(substations.map(s => ({ ...s, type: 'substation' })));
            } else {
                // Fallback to geocoding
                const locations = await geocodeLocation(query);
                setSearchResults(locations);
            }
        } catch (error) {
            console.error('Search failed:', error);
            // Try geocoding as fallback even on API error
            const locations = await geocodeLocation(query);
            setSearchResults(locations);
        } finally {
            setIsSearching(false);
        }
    };

    // Handle result selection
    const handleSelectResult = (result) => {
        setSelectedResult(result);
        setSearchResults([]);
        // Search query is maintained

        if (result.latitude && result.longitude) {
            setMapCenter([result.latitude, result.longitude]);
            setMapZoom(15); // Zoom level for selected location
        }
    };

    const getColor = (load) => {
        const val = load || 0;
        for (const t of thresholds) {
            if (val < t.max) return t.color;
        }
        return thresholds[thresholds.length - 1].color;
    };

    const getLoad = (d) => parseFloat(d.total_pload_mw || d.load_mw) || 0;
    const maxLoad = Math.max(...data.map(d => getLoad(d)), 100);

    const heatPoints = data
        .map(d => {
            const lat = parseFloat(d.latitude);
            const lng = parseFloat(d.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;
            return [lat, lng, getLoad(d) / maxLoad];
        })
        .filter(p => p !== null);

    return (
        <div style={{
            height: '100%',
            width: '100%',
            borderRadius: fuiMode ? '0' : '16px',
            overflow: 'hidden',
            border: fuiMode ? 'none' : '1px solid rgba(0,229,255,0.2)',
            zIndex: 1,
            position: 'relative',
            background: fuiMode ? '#020617' : 'inherit'
        }}>
            {/* Search Input (Top) */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '50px',
                zIndex: 1000,
                width: '450px',
                maxWidth: 'calc(100% - 60px)'
            }}>
                <div style={{ position: 'relative' }}>
                    <Search
                        size={18}
                        style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'rgba(255,255,255,0.5)',
                            zIndex: 1
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Find substation, e.g., KPAR or Kapar"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 40px 12px 40px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(0,229,255,0.3)',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '0.8rem',
                            outline: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                    />
                    {isSearching && (
                        <Loader2
                            size={18}
                            className="animate-spin"
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#00e5ff'
                            }}
                        />
                    )}
                    {searchQuery && !isSearching && (
                        <X
                            size={18}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer'
                            }}
                            onClick={() => {
                                setSearchQuery('');
                                setSearchResults([]);
                                setSelectedResult(null);
                            }}
                        />
                    )}
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                    <div style={{
                        marginTop: '8px',
                        background: 'rgba(15, 23, 42, 0.98)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(0,229,255,0.3)',
                        borderRadius: '12px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                    }}>
                        {searchResults.map((result, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSelectResult(result)}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: idx < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0,229,255,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <MapPin size={16} color={result.type === 'substation' ? '#00e5ff' : '#ff9500'} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                                        {result.type === 'substation' ? result.name : result.name}
                                    </div>
                                    {result.type === 'substation' && result.substation_id && (
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                                            {result.substation_id} • {result.state}
                                        </div>
                                    )}
                                    {result.type === 'location' && (
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                                            Location Search Result
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
                    minHeight: '380px',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0,229,255,0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={() => setActiveTab('layers')} style={{ background: 'none', border: 'none', padding: 0, color: activeTab === 'layers' ? '#00e5ff' : '#aaa', cursor: 'pointer', fontWeight: activeTab === 'layers' ? 600 : 400, borderBottom: activeTab === 'layers' ? '2px solid #00e5ff' : 'none', paddingBottom: '4px' }}>Map Settings</button>
                            <button onClick={() => setActiveTab('thresholds')} style={{ background: 'none', border: 'none', padding: 0, color: activeTab === 'thresholds' ? '#00e5ff' : '#aaa', cursor: 'pointer', fontWeight: activeTab === 'thresholds' ? 600 : 400, borderBottom: activeTab === 'thresholds' ? '2px solid #00e5ff' : 'none', paddingBottom: '4px' }}>Thresholds</button>
                        </div>
                        <X size={16} style={{ cursor: 'pointer', color: '#fff', marginTop: '2px' }} onClick={() => setShowSettings(false)} />
                    </div>

                    {activeTab === 'layers' && (
                        <div>
                            <h5 style={{ margin: '0 0 8px 0', color: '#00e5ff', fontSize: '0.8rem' }}>Base Map</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                <label style={{ color: '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="radio" value="light" checked={activeLayer === 'light'} onChange={() => setActiveLayer('light')} style={{ accentColor: '#00e5ff' }} /> OpenStreetMap (Light)
                                </label>
                                <label style={{ color: '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="radio" value="dark" checked={activeLayer === 'dark'} onChange={() => setActiveLayer('dark')} style={{ accentColor: '#00e5ff' }} /> Dark Matter (High Contrast)
                                </label>
                                <label style={{ color: '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="radio" value="satellite" checked={activeLayer === 'satellite'} onChange={() => setActiveLayer('satellite')} style={{ accentColor: '#00e5ff' }} /> Satellite Imagery
                                </label>
                            </div>

                            <h5 style={{ margin: '0 0 8px 0', color: '#00e5ff', fontSize: '0.8rem' }}>Overlays</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ color: '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={showHeatmap} onChange={() => setShowHeatmap(!showHeatmap)} style={{ accentColor: '#00e5ff' }} /> Load Heatmap
                                </label>
                                <label style={{ color: '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={showMarkers} onChange={() => setShowMarkers(!showMarkers)} style={{ accentColor: '#00e5ff' }} /> Substation Status Markers
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'thresholds' && (
                        <div>
                            <h5 style={{ margin: '0 0 8px 0', color: '#00e5ff', fontSize: '0.8rem' }}>Marker Thresholds</h5>
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
                </div>
            )}

            <MapContainer
                center={defaultCenter}
                zoom={7}
                style={{ height: '100%', width: '100%', background: fuiMode ? '#020617' : '#fff' }}
                scrollWheelZoom={true}
                zoomControl={!fuiMode}
            >
                {activeLayer === 'light' && (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                )}
                {activeLayer === 'dark' && (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                )}
                {activeLayer === 'satellite' && (
                    <TileLayer
                        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                )}

                {/* Overlays for Heatmap and Markers */}
                {showHeatmap && (
                    <HeatmapLayer 
                        points={heatPoints} 
                        gradient={fuiMode ? { 0.4: '#f97316', 0.7: '#ef4444', 1: '#7f1d1d' } : null}
                    />
                )}

                {showMarkers && (
                    <LayerGroup>
                        {data.map(d => {
                            if (!d.latitude || !d.longitude) return null;
                            const rawLoad = d.total_pload_mw || d.load_mw;
                            const load = parseFloat(rawLoad) || 0;
                            const color = getColor(load);
                            // Ensure load is non-negative for sqrt
                            const radius = Math.max(4, Math.sqrt(Math.max(0, load)) * 0.8);
                            const lat = parseFloat(d.latitude);
                            const lng = parseFloat(d.longitude);

                            if (isNaN(lat) || isNaN(lng)) return null;

                            return (
                                <React.Fragment key={d.substation_id}>
                                    <CircleMarker
                                        center={[lat, lng]}
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
                                        center={[lat, lng]}
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
                                        center={[lat, lng]}
                                        radius={radius}
                                        pathOptions={{
                                            color: '#fff',
                                            weight: 1,
                                            fillColor: color,
                                            fillOpacity: 0.9
                                        }}
                                    >
                                        <Tooltip direction="top" offset={[0, -10]} opacity={1} interactive={true}>
                                            <div style={{ textAlign: 'center', minWidth: '150px' }}>
                                                <h4 style={{ margin: '0 0 4px 0', color: color }}>
                                                    {d.name || d.substation_id}
                                                    <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'normal', marginTop: '2px' }}>
                                                        {d.substation_id}
                                                    </div>
                                                </h4>
                                                <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                                                    Total: <strong>{(d.total_pload_mw || d.load_mw || 0).toFixed(2)} MW</strong>
                                                </div>

                                                <BayBreakdown
                                                    bays={d.bays}
                                                    transformers={d.transformers}
                                                    incoming_bays={d.incoming_bays}
                                                    color={color}
                                                />

                                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                                                    {d.state}
                                                </div>
                                            </div>
                                        </Tooltip>
                                    </CircleMarker>
                                </React.Fragment>
                            );
                        })}
                    </LayerGroup>
                )}

                {/* ── GRID NETWORK DIAGRAM LAYER ── */}
                {showNetworkLines && networkLinks.length > 0 && (
                    <LayerGroup>
                        {networkLinks.map((link, idx) => {
                            const sub1 = data.find(s => s.substation_id === link.from_substation_id);
                            const sub2 = data.find(s => s.substation_id === link.to_substation_id);
                            
                            // Only draw if both substations exist and have coordinates, and are currently in 'data' (filtered)
                            if (!sub1 || !sub2 || !sub1.latitude || !sub1.longitude || !sub2.latitude || !sub2.longitude) return null;
                            
                            const latlng1 = [parseFloat(sub1.latitude), parseFloat(sub1.longitude)];
                            const latlng2 = [parseFloat(sub2.latitude), parseFloat(sub2.longitude)];
                            
                            if (isNaN(latlng1[0]) || isNaN(latlng1[1]) || isNaN(latlng2[0]) || isNaN(latlng2[1])) {
                                return null;
                            }
                            
                            let color = '#ffffff'; // unknown
                            if (link.voltage_kv >= 500) color = '#facc15'; // gold
                            else if (link.voltage_kv >= 275) color = '#22d3ee'; // cyan
                            else if (link.voltage_kv >= 132) color = '#4ade80'; // lime green
                            
                            // Rendering strategy based on circuitDisplayMode
                            if (circuitDisplayMode === 'multiple' && link.circuit_count > 1) {
                                // Calculate perpendicular offset for parallel lines
                                const dx = latlng2[0] - latlng1[0];
                                const dy = latlng2[1] - latlng1[1];
                                const length = Math.sqrt(dx * dx + dy * dy);
                                
                                if (length === 0) return null; // avoid division by zero NaN
                                
                                // Normal vector
                                const nx = -dy / length;
                                const ny = dx / length;
                                
                                const lines = [];
                                const offsetStep = 0.005; // degree offset
                                const startOffset = -((link.circuit_count - 1) * offsetStep) / 2;
                                
                                for (let i = 0; i < link.circuit_count; i++) {
                                    const offset = startOffset + i * offsetStep;
                                    const p1 = [latlng1[0] + nx * offset, latlng1[1] + ny * offset];
                                    const p2 = [latlng2[0] + nx * offset, latlng2[1] + ny * offset];
                                    lines.push(
                                        <Polyline 
                                            key={`${link.from_substation_id}-${link.to_substation_id}-${i}`}
                                            positions={[p1, p2]}
                                            pathOptions={{
                                                color: color, 
                                                weight: 1.5,
                                                opacity: 0.8
                                            }}
                                        />
                                    );
                                }
                                return lines;
                            } else {
                                // Default thickness mode
                                const weight = circuitDisplayMode === 'thickness' 
                                    ? 1.5 + (link.circuit_count - 1) * 1.5 
                                    : 1.5;
                                
                                return (
                                    <Polyline 
                                        key={`${link.from_substation_id}-${link.to_substation_id}-single`}
                                        positions={[latlng1, latlng2]}
                                        pathOptions={{
                                            color: color, 
                                            weight: weight,
                                            opacity: 0.8
                                        }}
                                    >
                                        <Tooltip direction="center" sticky>
                                            <div style={{ fontSize: '0.75rem' }}>
                                                <strong>{sub1.name} &harr; {sub2.name}</strong><br/>
                                                {link.voltage_kv} kV &bull; {link.circuit_count} Circuit{link.circuit_count !== 1 ? 's' : ''}
                                            </div>
                                        </Tooltip>
                                    </Polyline>
                                );
                            }
                        })}
                    </LayerGroup>
                )}

                {/* ── RADIUS CIRCLES LAYER ── */}
                {radiusConfig?.anchor && (() => {
                    const anchorLat = parseFloat(radiusConfig.anchor.latitude);
                    const anchorLng = parseFloat(radiusConfig.anchor.longitude);
                    if (isNaN(anchorLat) || isNaN(anchorLng)) return null;

                    return (
                        <LayerGroup>
                            {(radiusConfig.layers || []).map((layer, idx) => {
                                const km = layer.km ?? layer;
                                const angle = layer.angle ?? 45;
                                const labelPos = layer.labelPos ?? 0.5;
                                const color = layer.color ?? RADIUS_COLORS[idx % RADIUS_COLORS.length];
                                if (!km) return null;

                                const endpoint = destinationPoint(anchorLat, anchorLng, km, angle);
                                const labelPoint = lerpPoint([anchorLat, anchorLng], endpoint, labelPos);

                                // Arrowhead: two wings from the endpoint angled back
                                const wingLen = Math.min(km * 0.14, 1.2);
                                const reversedAngle = (angle + 180) % 360;
                                const wing1 = destinationPoint(endpoint[0], endpoint[1], wingLen, (reversedAngle + 28) % 360);
                                const wing2 = destinationPoint(endpoint[0], endpoint[1], wingLen, (reversedAngle - 28 + 360) % 360);

                                const labelIcon = L.divIcon({
                                    html: `<div style="display:inline-block;background:rgba(255,255,255,0.82);color:${color};padding:2px 8px;border-radius:4px;font-size:0.68rem;font-weight:800;white-space:nowrap;transform:translate(-50%,-50%);font-family:monospace;">${km} km</div>`,
                                    className: '',
                                    iconSize: [0, 0],
                                    iconAnchor: [0, 0],
                                });

                                return (
                                    <React.Fragment key={idx}>
                                        {/* Circle */}
                                        <Circle
                                            center={[anchorLat, anchorLng]}
                                            radius={km * 1000}
                                            pathOptions={{
                                                color,
                                                fillColor: color,
                                                fillOpacity: 0.04,
                                                weight: 1.5,
                                                dashArray: '6 4',
                                                opacity: 0.8,
                                            }}
                                        />
                                        {/* Arrow shaft */}
                                        <Polyline
                                            positions={[[anchorLat, anchorLng], endpoint]}
                                            pathOptions={{ color, weight: 1.8, opacity: 0.9 }}
                                        />
                                        {/* Arrowhead */}
                                        <Polyline
                                            positions={[wing1, endpoint, wing2]}
                                            pathOptions={{ color, weight: 2, opacity: 0.9 }}
                                        />
                                        {/* Distance label */}
                                        <Marker position={labelPoint} icon={labelIcon} interactive={false} />
                                    </React.Fragment>
                                );
                            })}
                            {/* Anchor pin */}
                            <CircleMarker
                                center={[anchorLat, anchorLng]}
                                radius={7}
                                pathOptions={{ color: '#fff', weight: 2, fillColor: '#00e5ff', fillOpacity: 1 }}
                            >
                                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                        {radiusConfig.anchor.name || radiusConfig.anchor.substation_id} (anchor)
                                    </span>
                                </Tooltip>
                            </CircleMarker>
                        </LayerGroup>
                    );
                })()}

                {/* Map Controller for programmatic zoom/pan */}
                <MapController center={mapCenter} zoom={mapZoom} />

                {/* Click handler to clear selection */}
                <MapClickHandler onMapClick={() => setSelectedResult(null)} />

                {/* Selected Result Marker (Highlighted) - Always visible if selected */}
                {selectedResult && selectedResult.latitude && selectedResult.longitude && (
                    <React.Fragment>
                        {/* Pulsing outer ring */}
                        <CircleMarker
                            center={[parseFloat(selectedResult.latitude), parseFloat(selectedResult.longitude)]}
                            radius={25}
                            pathOptions={{
                                color: '#00e5ff',
                                fillColor: '#00e5ff',
                                fillOpacity: 0.1,
                                weight: 2,
                                dashArray: '5, 5'
                            }}
                        />
                        {/* Inner marker */}
                        <CircleMarker
                            center={[parseFloat(selectedResult.latitude), parseFloat(selectedResult.longitude)]}
                            radius={10}
                            pathOptions={{
                                color: '#fff',
                                weight: 2,
                                fillColor: '#00e5ff',
                                fillOpacity: 0.8
                            }}
                        >
                            <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent interactive={true}>
                                <div style={{ textAlign: 'center', minWidth: '200px', position: 'relative' }}>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#00e5ff', paddingRight: '20px' }}>
                                        {selectedResult.name || selectedResult.substation_id}
                                        <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'normal', marginTop: '2px' }}>
                                            {selectedResult.substation_id}
                                        </div>
                                    </h4>
                                    <X
                                        size={14}
                                        style={{
                                            position: 'absolute',
                                            top: '-2px',
                                            right: '-2px',
                                            cursor: 'pointer',
                                            color: '#666',
                                            zIndex: 9999
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation(); // Stop event bubbling to map
                                            setSelectedResult(null);
                                        }}
                                        onMouseEnter={(e) => { e.target.style.color = '#fff'; }}
                                        onMouseLeave={(e) => { e.target.style.color = '#666'; }}
                                    />
                                    {selectedResult.type === 'substation' && (
                                        <>
                                            <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                                                Total: <strong>{(selectedResult.total_pload_mw || selectedResult.load_mw || 0).toFixed(2)} MW</strong>
                                            </div>

                                            <BayBreakdown
                                                bays={selectedResult.bays}
                                                transformers={selectedResult.transformers}
                                                incoming_bays={selectedResult.incoming_bays}
                                                color="#00e5ff"
                                            />

                                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                                                {selectedResult.state}
                                            </div>
                                        </>
                                    )}
                                    {selectedResult.type === 'location' && (
                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                            Location
                                        </div>
                                    )}
                                </div>
                            </Tooltip>
                        </CircleMarker>
                    </React.Fragment>
                )}
            </MapContainer>
        </div>
    );
};

export default SubstationMap;
