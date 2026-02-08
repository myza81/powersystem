
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import { Settings, X, RefreshCw, Search, MapPin, Loader2 } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

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

    // Search functionality state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedResult, setSelectedResult] = useState(null);
    const [mapCenter, setMapCenter] = useState(null);
    const [mapZoom, setMapZoom] = useState(null);

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
        setSearchQuery('');

        if (result.latitude && result.longitude) {
            setMapCenter([result.latitude, result.longitude]);
            setMapZoom(13); // Zoom level for selected location
        }
    };

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
            {/* Search Input (Top) */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '50px',
                zIndex: 1000,
                maxWidth: '400px'
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
                                    {result.type === 'substation' && result.mnemonic && (
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                                            {result.mnemonic} • {result.state}
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

                {/* Map Controller for programmatic zoom/pan */}
                <MapController center={mapCenter} zoom={mapZoom} />

                <HeatmapLayer points={heatPoints} />

                {/* Selected Result Marker (Highlighted) */}
                {selectedResult && selectedResult.latitude && selectedResult.longitude && (
                    <React.Fragment>
                        {/* Pulsing outer ring */}
                        <CircleMarker
                            center={[selectedResult.latitude, selectedResult.longitude]}
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
                            center={[selectedResult.latitude, selectedResult.longitude]}
                            radius={10}
                            pathOptions={{
                                color: '#fff',
                                weight: 2,
                                fillColor: '#00e5ff',
                                fillOpacity: 0.8
                            }}
                        >
                            <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                                <div style={{ textAlign: 'center', minWidth: '120px' }}>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#00e5ff' }}>
                                        {selectedResult.name || selectedResult.substation_id}
                                    </h4>
                                    {selectedResult.type === 'substation' && (
                                        <>
                                            <div style={{ fontSize: '0.85rem' }}>
                                                Load: <strong>{selectedResult.load_mw ? selectedResult.load_mw.toFixed(2) : 'N/A'} MW</strong>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#666' }}>
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
