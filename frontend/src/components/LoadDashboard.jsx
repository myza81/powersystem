import React, { useState, useEffect } from 'react';
import { Search, Zap, TrendingUp, MapPin, Building2, Database, Loader2, BarChart3, AlertCircle, AlertTriangle, CheckCircle2, FileText, ZoomIn, ZoomOut, X, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SldViewer from './SldViewer';
import BayIdEditor from './BayIdEditor';

const api = axios.create({ baseURL: '/api/v1' });

const LoadDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [gridData, setGridData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedSubstation, setSelectedSubstation] = useState(null);
    const [substationDetails, setSubstationDetails] = useState(null);
    const [viewingSld, setViewingSld] = useState(null); // SLD Viewer State
    const [showBayEditor, setShowBayEditor] = useState(false);

    // Fetch grid overview on mount
    useEffect(() => {
        const fetchGridData = async () => {
            try {
                const response = await api.get('/load-profiles/aggregate/?level=grid');
                setGridData(response.data);
            } catch (err) {
                console.error('Failed to fetch grid data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchGridData();
    }, []);

    // Search substations
    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            const response = await api.get(`/substations/?search=${query}`);
            setSearchResults(response.data.results || response.data || []);
        } catch (err) {
            console.error('Search failed:', err);
            setSearchResults([]);
        }
    };

    // Fetch substation details
    const handleSelectSubstation = async (substation) => {
        setSelectedSubstation(substation);
        try {
            const response = await api.get(`/load-profiles/aggregate/?level=substation&key=${substation.substation_id}`);
            setSubstationDetails(response.data);
        } catch (err) {
            console.error('Failed to fetch substation details:', err);
            setSubstationDetails(null);
        }
    };

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
                                Real-time grid demand monitoring & substation analytics
                            </p>
                        </div>
                    </div>
                </motion.div>

                {gridData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Section 1: Global KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <MetricCard
                                icon={<Zap size={24} />}
                                label="Total System Demand"
                                value={`${gridData.total_pload_mw.toFixed(1)} MW`}
                                subValue={`${gridData.total_qload_mvar.toFixed(1)} MVAr (Reactive)`}
                                color="#00e5ff"
                                progress={75} // Simulated usage
                                trend="+2.3% vs yesterday"
                            />
                            <MetricCard
                                icon={<TrendingUp size={24} />}
                                label="System Peak Demand"
                                value={`${Math.max(...(gridData.breakdown || []).map(r => r.total_pload_mw || 0)).toFixed(1)} MW`}
                                subValue="Highest recorded regional load"
                                color="#ff9500"
                                progress={90}
                            />
                            <MetricCard
                                icon={<Database size={24} />}
                                label="Active Regions"
                                value={gridData.breakdown?.length || 0}
                                subValue="Monitoring points active"
                                color="#34c759"
                                progress={100}
                            />
                        </div>

                        {/* Section 2: Ownership Breakdown */}
                        {gridData.ownership_breakdown && gridData.ownership_breakdown.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Building2 size={20} color="#00e5ff" /> Ownership Load Distribution
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    {gridData.ownership_breakdown.map((owner, idx) => {
                                        const totalLoad = gridData.total_pload_mw || 1;
                                        const share = (owner.total_pload_mw / totalLoad) * 100;
                                        const color = owner.type === 'TNB' ? '#ef4444' : owner.type === 'LPC' ? '#f59e0b' : '#3b82f6'; // Red, Amber, Blue

                                        return (
                                            <MetricCard
                                                key={idx}
                                                icon={<Building2 size={24} />}
                                                label={`${owner.type} Consumption`}
                                                value={`${owner.total_pload_mw.toFixed(1)} MW`}
                                                subValue={`${share.toFixed(1)}% of Total System Load`}
                                                color={color}
                                                progress={share}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Analysis Grid: Regional & State */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '2rem' }}>

                            {/* Regional Analysis */}
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '16px',
                                border: '1px solid rgba(0,229,255,0.2)',
                                padding: '2rem'
                            }}>
                                <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin size={20} color="#00e5ff" /> Regional Load Breakdown
                                </h3>

                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '2rem',
                                    alignItems: 'center',
                                    justifyContent: 'space-around'
                                }}>
                                    <RegionPieChart breakdown={gridData.breakdown || []} />
                                    <RegionBarChart breakdown={gridData.breakdown || []} />
                                </div>
                            </div>

                            {/* State Analysis */}
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '16px',
                                border: '1px solid rgba(255, 149, 0, 0.2)', // Orange tint border
                                padding: '2rem'
                            }}>
                                <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin size={20} color="#ff9500" /> State Consumption
                                </h3>

                                <StateBarChart breakdown={gridData.state_breakdown || []} />
                            </div>

                        </div>

                    </div>
                )}



                {/* Search Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        border: '1px solid rgba(0,229,255,0.2)',
                        padding: '2rem',
                        marginTop: '2rem'
                    }}
                >
                    <h3 style={{
                        fontSize: '1.25rem',
                        color: '#fff',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <Search size={20} color="#00e5ff" />
                        Substation Load Lookup
                    </h3>

                    {/* Search Input */}
                    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                        <Search
                            size={20}
                            style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(255,255,255,0.5)'
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Search by name or mnemonic (e.g., ABBA, Butterworth)"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '1rem 1rem 1rem 3rem',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(0,229,255,0.3)',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gap: '0.75rem',
                            marginBottom: '2rem',
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            {searchResults.map(sub => (
                                <SubstationSearchCard
                                    key={sub.substation_id}
                                    substation={sub}
                                    onClick={() => handleSelectSubstation(sub)}
                                    isSelected={selectedSubstation?.substation_id === sub.substation_id}
                                    onViewSld={setViewingSld}
                                />
                            ))}
                        </div>
                    )}

                    {/* Substation Details */}
                    {substationDetails && selectedSubstation && (
                        <SubstationDetailsPanel
                            substation={selectedSubstation}
                            details={substationDetails}
                            onClose={() => {
                                setSelectedSubstation(null);
                                setSubstationDetails(null);
                            }}
                            onViewSld={setViewingSld}
                            onEditBayIds={() => setShowBayEditor(true)}
                        />
                    )}
                </motion.div>
            </div>

            {/* Bay ID Editor Overlay */}
            <AnimatePresence>
                {showBayEditor && selectedSubstation && (
                    <BayIdEditor
                        substation={selectedSubstation}
                        onClose={() => setShowBayEditor(false)}
                        onSuccess={() => {
                            handleSelectSubstation(selectedSubstation); // Refresh details
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

// Region Pie Chart Component
const RegionPieChart = ({ breakdown }) => {
    const totalLoad = breakdown.reduce((acc, curr) => acc + curr.total_pload_mw, 0);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Sort breakdown by load (descending) to determine track order
    // Largest load = Outer track
    const sortedBreakdown = [...breakdown].sort((a, b) => b.total_pload_mw - a.total_pload_mw);

    return (
        <div style={{ position: 'relative', width: '500px', height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 500 340" style={{ overflow: 'visible' }}>
                {sortedBreakdown.map((region, idx) => {
                    const percent = totalLoad > 0 ? (region.total_pload_mw / totalLoad) : 0;

                    // Track config
                    const center = { x: 300, y: 190 }; // Shifted right to make room for text on left
                    const maxRadius = 160;
                    const trackWidth = 16;
                    const gap = 12; // Increased gap slightly for text readability
                    const radius = maxRadius - (idx * (trackWidth + gap));

                    // Helper to calculation coordinates
                    const getCoords = (angleInDegrees) => {
                        const angleInRad = (angleInDegrees * Math.PI) / 180;
                        return {
                            x: center.x + radius * Math.cos(angleInRad),
                            y: center.y + radius * Math.sin(angleInRad)
                        };
                    };

                    // 270 Degree Sweep
                    // Start: -90 degrees (12 o'clock)
                    // End: 180 degrees (9 o'clock)
                    // 0 degrees is 3 o'clock. 
                    const startDeg = -90;
                    const fullSweep = 270;
                    const endDeg = startDeg + fullSweep;

                    const bgStart = getCoords(startDeg);
                    const bgEnd = getCoords(endDeg);

                    // Path for background track (full 270)
                    const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

                    // Path for foreground (percentage)
                    const percentDeg = startDeg + (percent * fullSweep);
                    const fgEnd = getCoords(percentDeg);

                    const largeArcFlag = (percent * fullSweep) > 180 ? 1 : 0;

                    const fgPath = percent > 0
                        ? `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${fgEnd.x} ${fgEnd.y}`
                        : '';

                    const color = `hsl(${190 + (idx * 30)}, 90%, 50%)`;
                    const isHovered = hoveredIndex === idx;

                    return (
                        <g key={idx}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Legend Text at Start (Left Side) */}
                            <text
                                x={bgStart.x - 12} // 12px gap from start of bar
                                y={bgStart.y + 5}  // Vertically centered relative to stroke
                                textAnchor="end"   // Align to the right (end at the bar start)
                                style={{
                                    fill: isHovered ? '#fff' : 'rgba(255,255,255,0.7)',
                                    fontSize: '0.85rem',
                                    fontWeight: isHovered ? 600 : 400,
                                    fontFamily: 'monospace',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <tspan style={{ fontWeight: 700, fill: color }}>{region.region}</tspan>
                                <tspan dx="8">{region.total_pload_mw.toFixed(1)}MW</tspan>
                                <tspan dx="8" style={{ fill: 'rgba(255,255,255,0.5)' }}>{(percent * 100).toFixed(1)}%</tspan>
                            </text>

                            {/* Background Track */}
                            <path
                                d={bgPath}
                                fill="none"
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth={trackWidth}
                                strokeLinecap="round"
                            />

                            {/* Foreground Progress */}
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

            {/* Center Summary */}
            <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none', top: '50%', transform: 'translateY(-20%)' }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Total System Load</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                    {totalLoad.toFixed(0)} MW
                </div>
            </div>

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        style={{
                            position: 'absolute',
                            bottom: '100%', // Position above the chart
                            left: '50%',
                            x: '-50%',
                            marginBottom: '20px',
                            background: 'rgba(10, 12, 16, 0.95)',
                            border: `1px solid ${`hsl(${190 + (hoveredIndex * 30)}, 90%, 50%)`}`,
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            zIndex: 40,
                            backdropFilter: 'blur(12px)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            textAlign: 'center',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                            {sortedBreakdown[hoveredIndex].region}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                color: `hsl(${190 + (hoveredIndex * 30)}, 90%, 50%)`,
                                fontWeight: 700,
                                fontSize: '1.2rem',
                                fontFamily: 'monospace'
                            }}>
                                {sortedBreakdown[hoveredIndex].total_pload_mw.toFixed(1)} MW
                            </span>
                            <span style={{
                                background: 'rgba(255,255,255,0.1)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                color: '#aaa'
                            }}>
                                {((sortedBreakdown[hoveredIndex].total_pload_mw / totalLoad) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Region Vertical Bar Chart Component
const RegionBarChart = ({ breakdown }) => {
    const maxLoad = Math.max(...breakdown.map(r => r.total_pload_mw));
    const [hoveredRegion, setHoveredRegion] = useState(null);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: '300px',
            gap: '1.5rem',
            padding: '1rem 0 2rem 0',
            position: 'relative'
        }}>
            {breakdown.map((region, idx) => {
                const heightPercentage = (region.total_pload_mw / maxLoad) * 100;
                const isHovered = hoveredRegion === idx;

                return (
                    <div
                        key={idx}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                            position: 'relative'
                        }}
                        onMouseEnter={() => setHoveredRegion(idx)}
                        onMouseLeave={() => setHoveredRegion(null)}
                    >
                        {/* Tooltip */}
                        <AnimatePresence>
                            {isHovered && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: -10, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                    style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        marginBottom: '6px',
                                        background: 'rgba(10, 12, 16, 0.95)',
                                        border: '1px solid rgba(0, 229, 255, 0.3)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        zIndex: 20,
                                        backdropFilter: 'blur(12px)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                        minWidth: '160px',
                                        textAlign: 'center',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    <div style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                                        {region.region}
                                    </div>
                                    <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '1.25rem', fontFamily: 'monospace' }}>
                                        {region.total_pload_mw.toFixed(1)} MW
                                    </div>
                                    <div style={{ color: '#ff9500', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                        {region.total_qload_mvar.toFixed(1)} MVAr
                                    </div>
                                    {/* Arrow */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-6px',
                                        left: '50%',
                                        transform: 'translateX(-50%) rotate(45deg)',
                                        width: '12px',
                                        height: '12px',
                                        background: 'rgba(10, 12, 16, 0.95)',
                                        borderRight: '1px solid rgba(0, 229, 255, 0.3)',
                                        borderBottom: '1px solid rgba(0, 229, 255, 0.3)',
                                    }} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Bar */}
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercentage}%` }}
                            transition={{ duration: 1, delay: idx * 0.1, type: "spring", stiffness: 100 }}
                            style={{
                                width: '100%',
                                maxWidth: '60px',
                                background: isHovered
                                    ? 'linear-gradient(180deg, #00e5ff 0%, #00a8ff 100%)'
                                    : 'linear-gradient(180deg, rgba(0, 229, 255, 0.6) 0%, rgba(0, 168, 255, 0.4) 100%)',
                                borderRadius: '30px', // Fully rounded pill
                                position: 'relative',
                                boxShadow: isHovered ? '0 0 20px rgba(0, 229, 255, 0.4)' : 'none',
                                transition: 'background 0.3s, box-shadow 0.3s'
                            }}
                        />

                        {/* Label */}
                        <div style={{
                            marginTop: '1rem',
                            fontSize: '0.85rem',
                            color: isHovered ? '#fff' : 'rgba(255,255,255,0.6)',
                            fontWeight: isHovered ? 600 : 400,
                            textAlign: 'center',
                            transition: 'color 0.3s'
                        }}>
                            {region.region}
                        </div>
                    </div>
                );
            })}
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

// State Vertical Bar Chart Component
const StateBarChart = ({ breakdown }) => {
    const maxLoad = Math.max(...breakdown.map(r => r.total_pload_mw));
    const [hoveredState, setHoveredState] = useState(null);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: '400px', // Increased height
            gap: '1rem',
            padding: '100px 0 2rem 0', // Increased top padding for tooltip space
            position: 'relative',
            overflowX: 'auto', // Allow scrolling if many states
            minWidth: '100%'
        }}>
            {breakdown.map((item, idx) => {
                const heightPercentage = (item.total_pload_mw / maxLoad) * 100;
                const isHovered = hoveredState === idx;

                return (
                    <div
                        key={idx}
                        style={{
                            flex: 1,
                            minWidth: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                            position: 'relative'
                        }}
                        onMouseEnter={() => setHoveredState(idx)}
                        onMouseLeave={() => setHoveredState(null)}
                    >
                        {/* Tooltip */}
                        <AnimatePresence>
                            {isHovered && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: -10, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                    style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        marginBottom: '6px',
                                        background: 'rgba(10, 12, 16, 0.95)',
                                        border: '1px solid rgba(255, 149, 0, 0.3)', // Orange tint
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        zIndex: 20,
                                        backdropFilter: 'blur(12px)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                        minWidth: '140px',
                                        textAlign: 'center',
                                        pointerEvents: 'none',
                                        left: '50%',
                                        x: '-50%'
                                    }}
                                >
                                    <div style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                                        {item.state}
                                    </div>
                                    <div style={{ color: '#ff9500', fontWeight: 700, fontSize: '1.25rem', fontFamily: 'monospace' }}>
                                        {item.total_pload_mw.toFixed(1)} MW
                                    </div>
                                    {/* Arrow */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-6px',
                                        left: '50%',
                                        transform: 'translateX(-50%) rotate(45deg)',
                                        width: '12px',
                                        height: '12px',
                                        background: 'rgba(10, 12, 16, 0.95)',
                                        borderRight: '1px solid rgba(255, 149, 0, 0.3)',
                                        borderBottom: '1px solid rgba(255, 149, 0, 0.3)',
                                    }} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Bar */}
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercentage}%` }}
                            transition={{ duration: 1, delay: idx * 0.1, type: "spring", stiffness: 100 }}
                            style={{
                                width: '100%',
                                maxWidth: '30px',
                                background: isHovered
                                    ? 'linear-gradient(180deg, #ff9500 0%, #ff5e3a 100%)' // Orange gradient
                                    : 'linear-gradient(180deg, rgba(255, 149, 0, 0.6) 0%, rgba(255, 94, 58, 0.4) 100%)',
                                borderRadius: '30px',
                                position: 'relative',
                                boxShadow: isHovered ? '0 0 20px rgba(255, 149, 0, 0.4)' : 'none',
                                transition: 'background 0.3s, box-shadow 0.3s'
                            }}
                        />

                        {/* Label */}
                        <div style={{
                            marginTop: '1rem',
                            fontSize: '0.75rem',
                            color: isHovered ? '#fff' : 'rgba(255,255,255,0.6)',
                            fontWeight: isHovered ? 600 : 400,
                            textAlign: 'center',
                            transition: 'color 0.3s',
                            transform: 'rotate(-45deg)',
                            transformOrigin: 'top center',
                            whiteSpace: 'nowrap',
                            height: '20px'
                        }}>
                            {item.state}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Substation Search Card
const SubstationSearchCard = ({ substation, onClick, url, onViewSld, isSelected }) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
        style={{
            padding: '1rem',
            background: isSelected ? 'rgba(0,229,255,0.1)' : 'rgba(0,0,0,0.2)',
            border: isSelected ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s'
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {substation.name}
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
