import React, { useState, useEffect, useMemo } from 'react';
import { Search, Zap, TrendingUp, MapPin, Building2, Database, Loader2, BarChart3, AlertCircle, AlertTriangle, CheckCircle2, FileText, ZoomIn, ZoomOut, X, Edit3, Radar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SldViewer from './SldViewer';
import SubstationMap from './SubstationMap';

import api from '../api';
import AuroraRingChart from './AuroraRingChart';

const LoadDashboard = ({ substations = [] }) => {
    const [loading, setLoading] = useState(true);
    const [gridData, setGridData] = useState(null);
    const [viewingSld, setViewingSld] = useState(null); // SLD Viewer State


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

    // Live telemetry removed
    const metrics = gridData ? [
        {
            label: 'Total Internal Demand',
            value: `${gridData.total_pload_mw.toFixed(1)} MW`,
            detail: 'Active load captured in the export',
            accent: 'linear-gradient(135deg,#f4f1ff,#e1d3ff)'
        },
        {
            label: 'Catalogued Substations',
            value: `${substations.length}`,
            detail: 'Assets included in this summary',
            accent: 'linear-gradient(135deg,#e8f6ff,#c7e9ff)'
        }
    ] : [];

    const regionalHighlights = gridData?.regional_breakdown
        ? [...gridData.regional_breakdown].sort((a, b) => (b.total_pload_mw || 0) - (a.total_pload_mw || 0)).slice(0, 4)
        : [];

    const mapPoints = useMemo(() => (
        (substations || []).map((s) => ({
            ...s,
            load_mw: s.total_pload_mw || s.current_load_mw || s.load_mw || 0,
            bays: null
        }))
    ), [substations]);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020617'
            }}>
                <Loader2 size={48} className="animate-spin" style={{ color: '#22d3ee' }} />
            </div>
        );
    }

    return (
        <div className="fui-dashboard-container">
            <div className="fui-scanline" />
            
            {/* Layer 0: Geospatial Backdrop */}
            <div className="fui-backdrop-map">
                <SubstationMap data={mapPoints} fuiMode={true} />
            </div>

            {/* Layer 1: Data Overlays */}
            <div style={{ position: 'relative', zIndex: 10, height: '100vh', padding: '1.5rem', pointerEvents: 'none' }}>
                <AnimatePresence>
                    {viewingSld && (
                        <div style={{ pointerEvents: 'auto' }}>
                            <SldViewer
                                substation={viewingSld}
                                onClose={() => setViewingSld(null)}
                            />
                        </div>
                    )}
                </AnimatePresence>

                {gridData && (
                    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 380px', height: '100%', gap: '1.5rem' }}>
                        
                        {/* LEFT COLUMN: Metrics & Regional Intensity */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', pointerEvents: 'auto' }}>
                            {/* Demand Metrics */}
                            <div className="fui-glass-card">
                                <div className="fui-corner-br fui-corner-tl" />
                                <div className="fui-corner-br fui-corner-tr" />
                                <header style={{ marginBottom: '1.5rem' }}>
                                    <div className="fui-stat-label">Grid Stability Sentinel</div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>TOTAL DEMAND ANALYSIS</h3>
                                </header>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <div className="fui-stat-label">Active Power</div>
                                        <div className="fui-stat-value">{gridData.total_pload_mw.toFixed(1)} <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>MW</span></div>
                                    </div>
                                    <div>
                                        <div className="fui-stat-label">Reactive Power</div>
                                        <div className="fui-stat-value" style={{ color: '#fb923c' }}>{gridData.total_qload_mvar.toFixed(1)} <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>MVAr</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Regional Intensity */}
                            <div className="fui-glass-card" style={{ flex: 1 }}>
                                <div className="fui-corner-br fui-corner-tl" />
                                <div className="fui-corner-br fui-corner-bl" />
                                <header style={{ marginBottom: '1rem' }}>
                                    <div className="fui-stat-label">Spatial Distribution</div>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>REGIONAL LOAD INTENSITY</h3>
                                </header>
                                <div style={{ height: 'calc(100% - 40px)', overflowY: 'auto' }}>
                                    <ProgressBarChart
                                        data={gridData.regional_breakdown || []}
                                        labelKey="region"
                                        valueKey="total_pload_mw"
                                        unit="MW"
                                        fuiMode={true}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* CENTER COLUMN: Branding / Empty for Map visibility */}
                        <div style={{ position: 'relative' }}>
                            <div style={{ 
                                position: 'absolute', 
                                top: '50%', 
                                left: '50%', 
                                transform: 'translate(-50%, -50%)', 
                                textAlign: 'center',
                                opacity: 0.3,
                                pointerEvents: 'none'
                             }}>
                                <Radar size={120} color="var(--fui-cyan)" style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                <div className="fui-stat-label" style={{ fontSize: '1.5rem', letterSpacing: '0.4em' }}>GRID DEFENCE</div>
                                <div className="fui-stat-label" style={{ fontSize: '0.6rem', marginTop: '0.5rem' }}>MALAYSIA POWER SYSTEM INTELLIGENCE</div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Hotspots & Ownership */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', pointerEvents: 'auto' }}>
                            {/* Hotspot Substations */}
                            <div className="fui-glass-card" style={{ flex: 1 }}>
                                <div className="fui-corner-br fui-corner-tr" />
                                <div className="fui-corner-br-item fui-corner-br" />
                                <header style={{ marginBottom: '1rem' }}>
                                    <div className="fui-stat-label" style={{ color: 'var(--fui-red)' }}>Critical Load Alerts</div>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>TOP HOTSPOT NODES</h3>
                                </header>
                                <table className="fui-table">
                                    <thead>
                                        <tr>
                                            <th>Node ID</th>
                                            <th>Location</th>
                                            <th style={{ textAlign: 'right' }}>Load</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...mapPoints]
                                            .sort((a, b) => b.load_mw - a.load_mw)
                                            .slice(0, 8)
                                            .map((p, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ color: 'var(--fui-cyan)', fontWeight: 600 }}>{p.substation_id}</td>
                                                    <td style={{ opacity: 0.7 }}>{p.name}</td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                                        {p.load_mw.toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Ownership Blend */}
                            <div className="fui-glass-card">
                                <div className="fui-corner-br-item fui-corner-br" />
                                <div className="fui-corner-br fui-corner-bl" />
                                <header style={{ marginBottom: '1rem' }}>
                                    <div className="fui-stat-label">Asset Intelligence</div>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>CONTROL BLOCKS</h3>
                                </header>
                                <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left' }}>
                                    <AuroraRingChart
                                        data={gridData.ownership_breakdown || []}
                                        labelKey="ownership"
                                        valueKey="total_pload_mw"
                                        fuiMode={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Progress Bar Chart Component (Generic)
const ProgressBarChart = ({ data, labelKey = 'label', valueKey = 'value', unit = '', colorFunction, fuiMode = false }) => {
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
            gap: '0.85rem'
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
                            padding: fuiMode ? '0.4rem 0.5rem' : '0.65rem 0.75rem',
                            borderRadius: fuiMode ? '0' : '12px',
                            background: isHovered ? (fuiMode ? 'rgba(34, 211, 238, 0.1)' : 'rgba(4, 125, 96, 0.08)') : (fuiMode ? 'transparent' : 'rgba(15,23,42,0.02)'),
                            borderBottom: fuiMode ? '1px solid rgba(34, 211, 238, 0.1)' : 'none',
                            transition: 'background 0.2s',
                            cursor: 'default'
                        }}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        {/* Label */}
                        <div style={{
                            width: '80px',
                            fontSize: '0.7rem',
                            color: isHovered ? (fuiMode ? '#fff' : '#0f172a') : (fuiMode ? 'rgba(255,255,255,0.6)' : '#64748b'),
                            fontWeight: isHovered ? 600 : 400,
                            textAlign: 'right',
                            flexShrink: 0,
                            fontFamily: fuiMode ? 'JetBrains Mono, monospace' : 'inherit'
                        }}>
                            {label}
                        </div>

                        {/* Bar Container */}
                        <div style={{ flex: 1, height: fuiMode ? '4px' : '10px', background: fuiMode ? 'rgba(34, 211, 238, 0.05)' : 'rgba(15,23,42,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPercentage}%` }}
                                transition={{ duration: 1, delay: idx * 0.05 }}
                                style={{
                                    height: '100%',
                                    background: colorFunction ? colorFunction(item, idx) : (fuiMode ? 'var(--fui-cyan)' : 'linear-gradient(90deg,#0f766e,#22d3ee)'),
                                    boxShadow: fuiMode ? '0 0 8px var(--fui-cyan-glow)' : 'none',
                                    borderRadius: '999px'
                                }}
                            />
                        </div>

                        {/* Value */}
                        <div style={{
                            minWidth: '70px',
                            textAlign: 'right',
                            fontSize: '0.8rem',
                            fontFamily: 'monospace',
                            color: fuiMode ? '#fff' : '#0f172a',
                            fontWeight: 600
                        }}>
                            {val.toFixed(1)} <span style={{ fontSize: '0.65rem', color: fuiMode ? 'rgba(34, 211, 238, 0.6)' : '#94a3b8', fontWeight: 400 }}>{unit}</span>
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
                background: isSelected ? 'rgba(4, 125, 96, 0.08)' : '#fff',
                border: isSelected ? '1px solid #047d60' : (hasConfigIssue ? '1px solid #ef4444' : '1px solid rgba(15,23,42,0.08)'),
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {substation.name}
                        {hasConfigIssue && (
                            <div title="Non-standard LV Voltage detected" style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <AlertTriangle size={14} color="#ef4444" />
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
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
                            background: 'rgba(4,125,96,0.08)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px',
                            color: '#047d60',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <FileText size={16} />
                    </button>
                    <Building2 size={20} color={isSelected ? '#047d60' : 'rgba(15,23,42,0.3)'} />
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
            background: '#fff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: '16px',
            boxShadow: '0 15px 35px rgba(15,23,42,0.08)'
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>
                        {substation.name}
                    </h4>
                    <button
                        onClick={() => onViewSld(substation)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.25rem 0.75rem',
                            background: 'rgba(4,125,96,0.08)',
                            border: '1px solid rgba(4,125,96,0.3)',
                            borderRadius: '6px',
                            color: '#047d60',
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
                            background: 'rgba(237, 137, 54, 0.1)',
                            border: '1px solid rgba(237, 137, 54, 0.3)',
                            borderRadius: '6px',
                            color: '#b45309',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        <Edit3 size={14} /> Edit Bay IDs
                    </button>

                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {substation.substation_id} • {substation.state}
                </p>
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'transparent',
                    border: '1px solid rgba(15,23,42,0.1)',
                    color: 'var(--text-secondary)',
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
