import React, { useState, useEffect } from 'react';
import { Search, Zap, TrendingUp, MapPin, Building2, Database, Loader2, BarChart3, AlertCircle, AlertTriangle, CheckCircle2, FileText, ZoomIn, ZoomOut, X, Edit3, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SldViewer from './SldViewer';
import BayIdEditor from './BayIdEditor';
import SubstationMap from './SubstationMap';
import { useRealtimeTelemetry } from '../hooks/useRealtimeTelemetry';

const api = axios.create({ baseURL: '/api/v1' });

const LoadDashboard = ({ substations = [] }) => {
    const [loading, setLoading] = useState(true);
    const [gridData, setGridData] = useState(null);
    const [viewingSld, setViewingSld] = useState(null); // SLD Viewer State
    const [showBayEditor, setShowBayEditor] = useState(false);
    const [mapData, setMapData] = useState([]);
    const [realtimeEnabled, setRealtimeEnabled] = useState(false);

    // Subscribe to real-time telemetry (modular service)
    const { loads: liveLoads, aggregates: liveAggregates, isLive } = useRealtimeTelemetry({
        enabled: realtimeEnabled,
        interval: 5000,
        includeAggregates: true
    });


    // Update map data whenever substations prop or live loads change
    useEffect(() => {
        if (substations) {
            const mappedData = substations.map(s => ({
                ...s,
                // Prefer live telemetry data if available, otherwise use static data
                load_mw: (realtimeEnabled && liveLoads[s.substation_id])
                    ? liveLoads[s.substation_id].mw
                    : (s.total_pload_mw || s.current_load_mw || (s.load_mw || 0)),
                bays: (realtimeEnabled && liveLoads[s.substation_id]) ? liveLoads[s.substation_id].bays : null
            }));
            setMapData(mappedData);
        }
    }, [substations, liveLoads, realtimeEnabled]);

    // Fetch grid overview on mount or when substations change
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch V2 aggregates from NetworkLoad model
                const gridRes = await api.get('/load-analytics/aggregate/?level=grid');
                setGridData(gridRes.data);
            } catch (err) {
                console.error('Failed to fetch data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [substations]);

    // Merge live telemetry aggregates when real-time mode is enabled
    useEffect(() => {
        if (realtimeEnabled && liveAggregates && gridData) {
            // Transform live aggregates to match gridData structure
            const liveGridData = {
                ...gridData,
                // Grid totals
                total_pload_mw: liveAggregates.grid?.mw || gridData.total_pload_mw,
                total_qload_mvar: liveAggregates.grid?.mvar || gridData.total_qload_mvar,

                // Regional breakdown
                regional_breakdown: liveAggregates.regions
                    ? Object.entries(liveAggregates.regions).map(([region, data]) => ({
                        region,
                        total_pload_mw: data.mw,
                        total_qload_mvar: data.mvar
                    }))
                    : gridData.regional_breakdown,

                // State breakdown
                state_breakdown: liveAggregates.states
                    ? Object.entries(liveAggregates.states).map(([state, data]) => ({
                        state,
                        total_pload_mw: data.mw,
                        total_qload_mvar: data.mvar
                    }))
                    : gridData.state_breakdown,

                // Ownership breakdown
                ownership_breakdown: liveAggregates.ownership
                    ? Object.entries(liveAggregates.ownership).map(([ownership, data]) => ({
                        ownership,
                        total_pload_mw: data.mw,
                        total_qload_mvar: data.mvar
                    }))
                    : gridData.ownership_breakdown
            };

            setGridData(liveGridData);
        }
    }, [realtimeEnabled, liveAggregates]);



    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)'
            }}>
                <Loader2 size={48} className="animate-spin" style={{ color: '#00e5ff' }} />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            padding: '2rem',
            background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)'
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* SLD Viewer Overlay */}
                <AnimatePresence>
                    {viewingSld && (
                        <SldViewer
                            substation={viewingSld}
                            onClose={() => setViewingSld(null)}
                        />
                    )}
                </AnimatePresence>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '2rem' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: 'linear-gradient(135deg, #00e5ff 0%, #00a8ff 100%)',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(0, 229, 255, 0.3)'
                        }}>
                            <BarChart3 size={28} color="#000" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 style={{
                                fontSize: '2.25rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #fff 0%, #00e5ff 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                margin: 0
                            }}>
                                Load Analytics Dashboard
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>
                                Grid Demand Analytics
                            </p>
                        </div>

                        {/* Real-Time Mode Toggle */}
                        <button
                            onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                background: realtimeEnabled ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255,255,255,0.1)',
                                border: realtimeEnabled ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '8px',
                                color: realtimeEnabled ? '#00e5ff' : '#fff',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Radio size={16} style={{
                                animation: isLive ? 'pulse 2s infinite' : 'none'
                            }} />
                            {realtimeEnabled ? 'Live Mode' : 'Static Mode'}
                        </button>
                    </div>
                </motion.div>

                {gridData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Section 1: Global KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <MetricCard
                                icon={<Zap size={24} />}
                                label="Total Internal Demand"
                                value={`${gridData.total_pload_mw.toFixed(1)} MW`}
                                subValue="Internal Active Load"
                                color="#00e5ff"
                            //progress={75} // Simulated usage
                            //trend="+2.3% vs yesterday"
                            />
                            <MetricCard
                                icon={<TrendingUp size={24} />}
                                label="Total Internal Reactive"
                                value={`${gridData.total_qload_mvar.toFixed(1)} MVAr`}
                                subValue="Internal Reactive Load"
                                color="#ff9500"
                            />
                            <MetricCard
                                icon={<Zap size={24} />}
                                label="System Power Factor"
                                value={
                                    (gridData.total_pload_mw / Math.sqrt(Math.pow(gridData.total_pload_mw, 2) + Math.pow(gridData.total_qload_mvar, 2))).toFixed(3)
                                }
                                subValue="Grid Efficiency"
                                color="#34c759"
                            />
                        </div>

                        {/* 3-Column Layout: Ownership, Regional, State */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'stretch' }}>

                            {/* Ownership Breakdown */}
                            {gridData.ownership_breakdown && gridData.ownership_breakdown.length > 0 && (
                                <div style={{
                                    background: 'rgba(0,0,0,0.3)',
                                    backdropFilter: 'blur(20px)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(0,229,255,0.2)',
                                    padding: '1.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: '380px' // Compact height
                                }}>
                                    <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Building2 size={18} color="#00e5ff" /> Ownership
                                    </h3>

                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <SpiralChart
                                            data={gridData.ownership_breakdown || []}
                                            labelKey="ownership"
                                            valueKey="total_pload_mw"
                                            colorFunction={(item) => item.ownership === 'TNB' ? '#ef4444' : item.ownership === 'LPC' ? '#f59e0b' : '#3b82f6'}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Regional Analysis */}
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '16px',
                                border: '1px solid rgba(0,229,255,0.2)',
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '380px'
                            }}>
                                <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin size={18} color="#00e5ff" /> Regional Load
                                </h3>

                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    alignItems: 'center',
                                    justifyContent: 'space-around'
                                }}>
                                    <SpiralChart
                                        data={gridData.regional_breakdown || []}
                                        labelKey="region"
                                        valueKey="total_pload_mw"
                                    />
                                </div>
                            </div>

                            {/* State Analysis (Vertical List) */}
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '16px',
                                border: '1px solid rgba(255, 149, 0, 0.2)', // Orange tint border
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '380px',
                                maxHeight: '380px' // constrain height
                            }}>
                                <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin size={18} color="#ff9500" /> State Load
                                </h3>

                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <ProgressBarChart
                                        data={gridData.state_breakdown || []}
                                        labelKey="state"
                                        valueKey="total_pload_mw"
                                        unit="MW"
                                    />
                                </div>
                            </div>

                        </div>

                        {/* Map Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            style={{
                                marginTop: '2rem',
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '16px',
                                border: '1px solid rgba(0,229,255,0.2)',
                                padding: '1.5rem'
                            }}
                        >
                            <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPin size={20} color="#00e5ff" />
                                Geospatial Load Distribution
                            </h3>
                            <SubstationMap data={mapData} />
                        </motion.div>

                    </div>
                )}




            </div>

            {/* Bay ID Editor Overlay */}
            <AnimatePresence>
                {showBayEditor && (
                    <BayIdEditor
                        substation={null}
                        onClose={() => setShowBayEditor(false)}
                        onSuccess={() => {
                            setShowBayEditor(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Bay ID Editor Overlay */}
            <AnimatePresence>
                {showBayEditor && (
                    <BayIdEditor
                        substation={null}
                        onClose={() => setShowBayEditor(false)}
                        onSuccess={() => {
                            setShowBayEditor(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// Metric Card Component
const MetricCard = ({ icon, label, value, subValue, color, trend, progress }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
            padding: '1.5rem',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: `1px solid ${color}33`,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px'
        }}
    >
        <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ color: color, padding: '10px', background: `${color}15`, borderRadius: '10px' }}>
                {icon}
            </div>
            {trend && (
                <div style={{
                    fontSize: '0.75rem',
                    color: trend.includes('+') ? '#34c759' : '#ff3b30',
                    fontWeight: 600,
                    background: 'rgba(255,255,255,0.1)',
                    padding: '4px 8px',
                    borderRadius: '20px'
                }}>
                    {trend}
                </div>
            )}
        </div>

        <div>
            <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.6)',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                {label}
            </div>
            <div style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '0.25rem',
                fontFamily: 'monospace'
            }}>
                {value}
            </div>
            <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.5)'
            }}>
                {subValue}
            </div>
        </div>

        {/* Micro-Visualization: Progress Bar */}
        {progress !== undefined && (
            <div style={{ marginTop: '1rem', width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    style={{ height: '100%', background: color }}
                />
            </div>
        )}
    </motion.div>
);

// Spiral Chart Component (Generic)
const SpiralChart = ({ data, labelKey = 'region', valueKey = 'total_pload_mw', colorFunction }) => {
    // Robust Parsing: Handle potential strings or nulls
    const parseVal = (v) => {
        const p = parseFloat(v);
        return isNaN(p) ? 0 : p;
    };

    const totalLoad = data.reduce((acc, curr) => acc + parseVal(curr[valueKey]), 0);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Sort data by value (descending)
    const sortedData = [...data].sort((a, b) => parseVal(b[valueKey]) - parseVal(a[valueKey]));

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto', aspectRatio: '500/340', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 500 340" style={{ overflow: 'visible' }}>
                {sortedData.map((item, idx) => {
                    const value = parseVal(item[valueKey]);
                    const percent = totalLoad > 0 ? (value / totalLoad) : 0;
                    const label = item[labelKey];

                    // Track config
                    const center = { x: 300, y: 190 };
                    const maxRadius = 160;
                    const trackWidth = 16;
                    const gap = 12;
                    const radius = maxRadius - (idx * (trackWidth + gap));

                    const getCoords = (angleInDegrees) => {
                        const angleInRad = (angleInDegrees * Math.PI) / 180;
                        return {
                            x: center.x + radius * Math.cos(angleInRad),
                            y: center.y + radius * Math.sin(angleInRad)
                        };
                    };

                    const startDeg = -90;
                    const fullSweep = 270;
                    const endDeg = startDeg + fullSweep;

                    const bgStart = getCoords(startDeg);
                    const bgEnd = getCoords(endDeg);
                    const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

                    const percentDeg = startDeg + (percent * fullSweep);
                    const fgEnd = getCoords(percentDeg);
                    const largeArcFlag = (percent * fullSweep) > 180 ? 1 : 0;
                    const fgPath = percent > 0
                        ? `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${fgEnd.x} ${fgEnd.y}`
                        : '';

                    // Default color logic or custom function
                    const color = colorFunction
                        ? colorFunction(item, idx)
                        : `hsl(${190 + (idx * 30)}, 90%, 50%)`;

                    const isHovered = hoveredIndex === idx;

                    return (
                        <g key={idx}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            <text
                                x={bgStart.x - 12}
                                y={bgStart.y + 5}
                                textAnchor="end"
                                style={{
                                    fill: isHovered ? '#fff' : 'rgba(255,255,255,0.7)',
                                    fontSize: '0.85rem',
                                    fontWeight: isHovered ? 600 : 400,
                                    fontFamily: 'monospace',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <tspan style={{ fontWeight: 700, fill: color }}>{label}</tspan>
                                <tspan dx="8">{value.toFixed(1)}MW</tspan>
                                <tspan dx="8" style={{ fill: 'rgba(255,255,255,0.5)' }}>{(percent * 100).toFixed(1)}%</tspan>
                            </text>

                            <path
                                d={bgPath}
                                fill="none"
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth={trackWidth}
                                strokeLinecap="round"
                            />

                            <motion.path
                                d={fgPath}
                                fill="none"
                                stroke={color}
                                strokeWidth={trackWidth}
                                strokeLinecap="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 1, delay: idx * 0.1, ease: 'easeOut' }}
                                style={{
                                    filter: isHovered ? `drop-shadow(0 0 8px ${color})` : 'none'
                                }}
                            />
                        </g>
                    );
                })}
            </svg>

            <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none', top: '50%', transform: 'translateY(-20%)' }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Total System Load</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                    {totalLoad.toFixed(0)} MW
                </div>
            </div>

            <AnimatePresence>
                {hoveredIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            x: '-50%',
                            marginBottom: '10px',
                            background: 'rgba(10, 12, 16, 0.95)',
                            border: `1px solid ${colorFunction ? colorFunction(sortedData[hoveredIndex], hoveredIndex) : `hsl(${190 + (hoveredIndex * 30)}, 90%, 50%)`}`,
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            zIndex: 40,
                            backdropFilter: 'blur(12px)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            textAlign: 'center',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                            {sortedData[hoveredIndex][labelKey]}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                                color: colorFunction ? colorFunction(sortedData[hoveredIndex], hoveredIndex) : `hsl(${190 + (hoveredIndex * 30)}, 90%, 50%)`,
                                fontWeight: 700,
                                fontSize: '1rem',
                                fontFamily: 'monospace'
                            }}>
                                {sortedData[hoveredIndex][valueKey].toFixed(1)} MW
                            </span>
                            <span style={{
                                fontSize: '0.8rem',
                                color: 'rgba(255,255,255,0.5)'
                            }}>
                                ({((sortedData[hoveredIndex][valueKey] / totalLoad) * 100).toFixed(1)}%)
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};



// Regions View Component
const RegionsView = ({ breakdown }) => (
    <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem'
    }}>
        {breakdown.map((region, idx) => (
            <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                style={{
                    padding: '1.5rem',
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(0,229,255,0.2)'
                }}
            >
                <h4 style={{
                    fontSize: '1.1rem',
                    color: '#00e5ff',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <MapPin size={18} />
                    {region.region || 'Unknown Region'}
                </h4>
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        Active Power
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                        {region.total_pload_mw.toFixed(1)} <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>MW</span>
                    </div>
                </div>
                <div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        Reactive Power
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                        {region.total_qload_mvar.toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>MVAr</span>
                    </div>
                </div>
            </motion.div>
        ))}
    </div>
);

// Progress Bar Chart Component (Generic)
const ProgressBarChart = ({ data, labelKey = 'label', valueKey = 'value', unit = '', colorFunction }) => {
    const maxVal = Math.max(...data.map(r => r[valueKey] || 0));
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Sort by value descending
    const sortedData = [...data].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflowY: 'auto',
            paddingRight: '0.5rem',
            gap: '0.75rem'
        }}>
            {sortedData.map((item, idx) => {
                const val = item[valueKey] || 0;
                const widthPercentage = maxVal > 0 ? (val / maxVal) * 100 : 0;
                const isHovered = hoveredIndex === idx;
                const label = item[labelKey] || 'Unknown';

                return (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            background: isHovered ? 'rgba(255, 149, 0, 0.1)' : 'transparent',
                            transition: 'background 0.2s',
                            cursor: 'default'
                        }}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        {/* Label */}
                        <div style={{
                            width: '40px',
                            fontSize: '0.75rem',
                            color: isHovered ? '#fff' : 'rgba(255,255,255,0.7)',
                            fontWeight: isHovered ? 600 : 400,
                            textAlign: 'right',
                            flexShrink: 0
                        }}>
                            {label}
                        </div>

                        {/* Bar Container */}
                        <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPercentage}%` }}
                                transition={{ duration: 1, delay: idx * 0.05 }}
                                style={{
                                    height: '100%',
                                    background: colorFunction ? colorFunction(item, idx) : 'linear-gradient(90deg, #ff9500 0%, #ff5e3a 100%)',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>

                        {/* Value */}
                        <div style={{
                            minWidth: '70px',
                            textAlign: 'right',
                            fontSize: '0.8rem',
                            fontFamily: 'monospace',
                            color: '#fff',
                            fontWeight: 500
                        }}>
                            {val.toFixed(1)} <span style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 400 }}>{unit}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Substation Search Card
const SubstationSearchCard = ({ substation, onClick, url, onViewSld, isSelected }) => {
    // Check for LV configuration issues
    const hasConfigIssue = substation.transformers?.some(t => {
        const v = Number(t.lv_voltage);
        // If lv_voltage is set (not 0/null) and not in standard values
        return v && ![11, 22, 33].includes(v);
    });

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={onClick}
            style={{
                padding: '1rem',
                background: isSelected ? 'rgba(0,229,255,0.1)' : 'rgba(0,0,0,0.2)',
                border: isSelected ? '1px solid #00e5ff' : (hasConfigIssue ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'),
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {substation.name}
                        {hasConfigIssue && (
                            <div title="Non-standard LV Voltage detected" style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <AlertTriangle size={14} color="#ef4444" />
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                        {substation.substation_id} • {substation.state || 'N/A'}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewSld(substation);
                        }}
                        title="View Single Line Diagram"
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px',
                            color: '#00e5ff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <FileText size={16} />
                    </button>
                    <Building2 size={20} color={isSelected ? '#00e5ff' : 'rgba(255,255,255,0.3)'} />
                </div>
            </div>
        </motion.div>
    );
};

// Substation Details Panel
const SubstationDetailsPanel = ({ substation, details, onClose, onViewSld, onEditBayIds }) => (
    <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        style={{
            marginTop: '1.5rem',
            padding: '2rem',
            background: 'rgba(0,229,255,0.05)',
            border: '2px solid rgba(0,229,255,0.3)',
            borderRadius: '16px'
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1.5rem', color: '#fff', margin: 0 }}>
                        {substation.name}
                    </h4>
                    <button
                        onClick={() => onViewSld(substation)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.25rem 0.75rem',
                            background: 'rgba(0, 229, 255, 0.1)',
                            border: '1px solid rgba(0, 229, 255, 0.3)',
                            borderRadius: '6px',
                            color: '#00e5ff',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        <FileText size={14} /> View SLD
                    </button>
                    <button
                        onClick={onEditBayIds}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.25rem 0.75rem',
                            background: 'rgba(237, 137, 54, 0.1)', // Orange tint
                            border: '1px solid rgba(237, 137, 54, 0.3)',
                            borderRadius: '6px',
                            color: '#ed8936',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        <Edit3 size={14} /> Edit Bay IDs
                    </button>

                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                    {substation.substation_id} • {substation.state}
                </p>
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                }}
            >
                Close
            </button>
        </div>

        {/* Aggregate Load */}
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginBottom: '2rem'
        }}>
            <div style={{
                padding: '1rem',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px'
            }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Total Active Load
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00e5ff', fontFamily: 'monospace' }}>
                    {details.total_pload_mw.toFixed(2)} MW
                </div>
            </div>
            <div style={{
                padding: '1rem',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px'
            }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Total Reactive Load
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff9500', fontFamily: 'monospace' }}>
                    {details.total_qload_mvar.toFixed(2)} MVAr
                </div>
            </div>
        </div>

        {/* Individual Bay Loads */}
        {details.breakdown && details.breakdown.length > 0 && (
            <>
                <h5 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>
                    Individual Bay Loads
                </h5>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {[...details.breakdown].sort((a, b) =>
                        a.bay_name.localeCompare(b.bay_name, undefined, { numeric: true, sensitivity: 'base' })
                    ).map((bay, idx) => (
                        <div
                            key={idx}
                            style={{
                                padding: '1rem',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr',
                                gap: '1rem',
                                alignItems: 'center'
                            }}
                        >
                            <div>
                                <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                                    {bay.bay_name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                    {bay.type === 'transformer' ? 'Transformer' : 'Incoming Bay'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>P-Load</div>
                                <div style={{ color: '#00e5ff', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {bay.pload_mw.toFixed(2)} MW
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Q-Load</div>
                                <div style={{ color: '#ff9500', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {bay.qload_mvar.toFixed(2)} MVAr
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}

        {(!details.breakdown || details.breakdown.length === 0) && (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)'
            }}>
                No load data available for this substation
            </div>
        )}
    </motion.div>
);



export default LoadDashboard;
