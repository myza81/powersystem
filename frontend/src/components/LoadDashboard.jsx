import React, { useState, useEffect, useMemo } from 'react';
import { Search, Zap, TrendingUp, MapPin, Building2, Database, Loader2, BarChart3, AlertCircle, AlertTriangle, CheckCircle2, FileText, ZoomIn, ZoomOut, X, Edit3, Radar, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SldViewer from './SldViewer';
import SubstationMap from './SubstationMap';
import SubstationSelectionPanel from './SubstationSelectionPanel';
import useNetworkLinks from '../hooks/useNetworkLinks';
import { CardLoader } from './Loader';

import api from '../api';
import SpiralChart from './SpiralChart';

const LoadDashboard = ({ substations = [] }) => {
    const [loading, setLoading] = useState(true);
    const [gridData, setGridData] = useState(null);
    const [viewingSld, setViewingSld] = useState(null); // SLD Viewer State
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [topCount, setTopCount] = useState(5);
    const [selectedSubstationIds, setSelectedSubstationIds] = useState(null); // null = show all; Set = active filter
    const [showNetworkLines, setShowNetworkLines] = useState(false);
    const [circuitDisplayMode, setCircuitDisplayMode] = useState('thickness');
    const [radiusConfig, setRadiusConfig] = useState({ anchor: null, layers: [{ km: 3, angle: 45, labelPos: 0.5, color: '#00e5ff' }] });

    // Fetch network links if viewing the dashboard
    const { links: networkLinks } = useNetworkLinks();


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

    // Derive filtered map points based on selection (null = show all)
    const filteredMapPoints = useMemo(() =>
        selectedSubstationIds === null
            ? mapPoints
            : mapPoints.filter(p => selectedSubstationIds.has(p.substation_id)),
        [mapPoints, selectedSubstationIds]);

    if (loading) {
        return <CardLoader show={true} message="Loading dashboard data..." />;
    }

    return (
        <div className="fui-dashboard-container">
            
            {/* Layer 0: Geospatial Backdrop */}
            <div className="fui-backdrop-map">
                <SubstationMap
                    data={filteredMapPoints}
                    fuiMode={true}
                    networkLinks={networkLinks}
                    showNetworkLines={showNetworkLines}
                    circuitDisplayMode={circuitDisplayMode}
                    radiusConfig={radiusConfig}
                />
            </div>


            {/* Layer 2: Interactive Modals & Sidebar */}
            <div style={{ position: 'relative', zIndex: 10, height: '100vh', pointerEvents: 'none', overflow: 'hidden' }}>
                {/* Substation Selection Panel — bottom-center of map */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
                    <div style={{ pointerEvents: 'auto' }}>
                    <SubstationSelectionPanel
                        substations={substations}
                        selectedIds={selectedSubstationIds}
                        onChangeIds={setSelectedSubstationIds}
                        showNetworkLines={showNetworkLines}
                        onToggleNetworkLines={setShowNetworkLines}
                        circuitDisplayMode={circuitDisplayMode}
                        onChangeCircuitDisplayMode={setCircuitDisplayMode}
                        radiusConfig={radiusConfig}
                        onChangeRadiusConfig={setRadiusConfig}
                    />
                    </div>
                </div>
                <AnimatePresence>
                    {viewingSld && (
                        <div style={{ pointerEvents: 'auto', padding: '1.5rem', position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%' }}>
                            <SldViewer
                                substation={viewingSld}
                                onClose={() => setViewingSld(null)}
                            />
                        </div>
                    )}
                </AnimatePresence>

                {gridData && (
                    <motion.div
                        initial={false}
                        animate={{ x: sidebarCollapsed ? 'calc(100% - 1.5rem)' : '0%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: '420px',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            pointerEvents: 'none'
                        }}
                    >
                        {/* Sidebar Toggle Tab */}
                        <div style={{ position: 'absolute', left: '-10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'auto', zIndex: 20 }}>
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                style={{
                                    background: 'var(--fui-glass-bg)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(34, 211, 238, 0.2)',
                                    borderRight: 'none',
                                    color: 'var(--fui-cyan)',
                                    borderRadius: '8px 0 0 8px',
                                    padding: '1rem 0.25rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '-4px 0 15px rgba(34, 211, 238, 0.05)',
                                    transition: 'background 0.2s, color 0.2s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,211,238,0.2)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--fui-glass-bg)'; e.currentTarget.style.color = 'var(--fui-cyan)'; }}
                            >
                                {sidebarCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                            </button>
                        </div>

                        {/* Sidebar Content Panel */}
                        <div className="fui-glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', pointerEvents: 'auto', overflow: 'hidden' }}>
                            <div className="fui-corner-br fui-corner-tl" />
                            <div className="fui-corner-br fui-corner-tr" />
                            <div className="fui-corner-br fui-corner-bl" />
                            <div className="fui-corner-br-item fui-corner-br" />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(34,211,238,0.1)', paddingBottom: '0.75rem' }}>
                                <div>
                                    <div className="fui-stat-label">System Snapshot</div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', letterSpacing: '0.05em' }}>DATA ANALYTICS</h3>
                                </div>
                                <BarChart3 size={20} color="var(--fui-cyan)" style={{ opacity: 0.6 }} />
                            </div>

                            {/* Scrollable interior */}
                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                
                                {/* Metrics */}
                                <div>
                                    <div className="fui-stat-label" style={{ marginBottom: '0.75rem' }}>Overview</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div>
                                            <div className="fui-stat-label" style={{ fontSize: '0.55rem' }}>Active Power</div>
                                            <div className="fui-stat-value" style={{ fontSize: '1.4rem' }}>{gridData.total_pload_mw.toFixed(1)} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>MW</span></div>
                                        </div>
                                        <div>
                                            <div className="fui-stat-label" style={{ fontSize: '0.55rem' }}>Total Substations</div>
                                            <div className="fui-stat-value" style={{ fontSize: '1.4rem', color: 'var(--fui-cyan)' }}>{mapPoints.length} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Nodes</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Regional Distribution */}
                                <div>
                                    <div className="fui-stat-label" style={{ marginBottom: '0.75rem' }}>Regional Load Distribution</div>
                                    <div style={{ transform: 'scale(1)', transformOrigin: 'top center' }}>
                                        <SpiralChart
                                            data={gridData.regional_breakdown || []}
                                            labelKey="region"
                                            valueKey="total_pload_mw"
                                            totalValue={gridData.total_pload_mw}
                                            fuiMode={true}
                                        />
                                    </div>
                                </div>

                                {/* Asset Intelligence */}
                                <div>
                                    <div className="fui-stat-label" style={{ marginBottom: '0.25rem' }}>Asset Distribution</div>
                                    <div style={{ transform: 'scale(1)', transformOrigin: 'top center' }}>
                                        <SpiralChart
                                            data={gridData.ownership_breakdown || []}
                                            labelKey="ownership"
                                            valueKey="total_pload_mw"
                                            totalValue={gridData.total_pload_mw}
                                            fuiMode={true}
                                        />
                                    </div>
                                </div>

                                {/* Top Highest Load Substations */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <div className="fui-stat-label" style={{ color: 'var(--fui-cyan)', margin: 0 }}>Top Highest Load Substations</div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {[5, 10, 15, 20].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setTopCount(n)}
                                                    style={{
                                                        background: topCount === n ? 'var(--fui-cyan)' : 'rgba(34, 211, 238, 0.1)',
                                                        border: `1px solid ${topCount === n ? 'var(--fui-cyan)' : 'rgba(34, 211, 238, 0.2)'}`,
                                                        color: topCount === n ? '#000' : 'var(--fui-cyan)',
                                                        fontSize: '0.6rem',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ border: '1px solid rgba(34, 211, 238, 0.2)', borderRadius: '8px', overflow: 'hidden', maxHeight: '250px', overflowY: 'auto' }}>
                                        <table className="fui-table" style={{ margin: 0, fontSize: '0.7rem' }}>
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                                <tr>
                                                    <th style={{ color: '#fff', background: 'rgba(15, 23, 42, 0.95)', borderBottom: 'none', padding: '0.5rem 0.75rem' }}>Substation</th>
                                                    <th style={{ color: '#fff', background: 'rgba(15, 23, 42, 0.95)', borderBottom: 'none', padding: '0.5rem 0.75rem', textAlign: 'right' }}>Load (MW)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...mapPoints]
                                                    .sort((a, b) => b.load_mw - a.load_mw)
                                                    .slice(0, topCount)
                                                    .map((p, idx) => (
                                                        <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'transparent' }}>
                                                            <td style={{ padding: '0.5rem 0.75rem' }}>{p.name} ({p.substation_id})</td>
                                                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, padding: '0.5rem 0.75rem' }}>
                                                                {p.load_mw.toFixed(1)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    </motion.div>
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
