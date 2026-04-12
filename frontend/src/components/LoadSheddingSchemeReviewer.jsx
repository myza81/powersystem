import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, X, Download, RefreshCw, BarChart2, Filter, RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FaBolt, FaLayerGroup, FaCircleNodes, FaCodeBranch, FaTableList } from 'react-icons/fa6';
import { normalisePocketBay, computeSchemeMetrics } from '../utils/loadSheddingUtils';
import api from '../api';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatMW = (val, decimals = 1) => {
    if (val == null || isNaN(val)) return '0.0';
    return Number(val).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const formatDate = (ds) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getVersionLabel = (v) => {
    if (!v) return '';
    return `${v.scheme_type} ${v.review_year} v${v.version}`;
};

const STAGE_COLORS = [
    '#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ef4444', '#eab308', '#ec4899', '#06b6d4'
];

const compactMnemonic = (subId) => String(subId || '').replace(/\d+$/, '');

// Build flat row list from stage details
const buildRows = (stageDetails, substations, relays) => {
    const subLookup = {};
    substations.forEach(s => { subLookup[s.substation_id] = s; });
    const relayLookup = {};
    relays.forEach(r => { relayLookup[r.id] = r; });

    const rows = [];

    stageDetails.forEach((stage, stageIdx) => {
        const stageColor = STAGE_COLORS[stageIdx % STAGE_COLORS.length];
        const settings = stage.settings || [];
        const threshold1 = settings[0]?.threshold ?? '—';
        const delay1 = settings[0]?.time_delay ?? '—';
        const threshold2 = settings[1]?.threshold ?? '—';
        const delay2 = settings[1]?.time_delay ?? '—';

        // Transformer bays
        (stage.transformer_bays || []).forEach(bay => {
            const sub = subLookup[bay.relay_substation_id];
            const relay = relayLookup[bay.relay];
            const selectedIds = (bay.transformers || []).map(t => typeof t === 'object' ? t.id : t);
            const selectedTxs = (relay?.load_transformers || []).filter(t =>
                selectedIds.includes(typeof t === 'object' ? t.id : t)
            );

            const feeder = selectedTxs.length > 0
                ? selectedTxs.map(t => `T${t.transformer_no}`).join(' & ')
                : (bay.transformers || []).map(t => typeof t === 'object' ? `T${t.id}` : `T${t}`).join(' & ') || '—';

            const breakerNumber = selectedTxs.map(t => t.lv_breaker_number).filter(Boolean).join(' & ') || '—';
            const voltageRaw = selectedTxs.map(t => t.lv_voltage).filter(Boolean);
            const voltage = voltageRaw.length > 0 ? [...new Set(voltageRaw)].join(' & ') : (sub?.voltage || '—');
            const mw = bay.mw_cache?.mw ?? null;

            rows.push({
                stageId: stage.id,
                stageLabel: stage.label,
                stageColor,
                stageOrder: stageIdx,
                type: 'transformer',
                substationName: sub?.name || bay.relay_substation_name || bay.relay_substation_id || 'Unknown',
                substationId: sub?.substation_id || bay.relay_substation_id || '',
                region: sub?.region || '—',
                grid: sub?.grid || '—',
                state: sub?.state || '—',
                voltage,
                feeder,
                breakerNumber,
                mw,
                threshold1, delay1, threshold2, delay2,
            });
        });

        // Pocket bays — one row per boundary
        (stage.pocket_bays || []).forEach((pocket, pocketIdx) => {
            const pocketMW = pocket.topology_cache?.mw ?? null;
            (pocket.boundaries || []).forEach((boundary, bIdx) => {
                const sub = subLookup[boundary.relay_substation_id];
                const relay = relayLookup[boundary.relay];
                const selectedIds = (boundary.branches || []).map(b => typeof b === 'object' ? b.id : b);
                const branchObjects = (relay?.incoming_branches || []).filter(b =>
                    selectedIds.includes(typeof b === 'object' ? b.id : b)
                );

                const feeder = branchObjects.length > 0
                    ? branchObjects.map(b => `${compactMnemonic(b.to_substation)} ${b.ckt_id}`).join(' & ')
                    : (boundary.frozen_assets || []).map(a => `${compactMnemonic(a.to_sub)} ${a.ckt_id}`).join(' & ')
                    || `Boundary: ${boundary.relay_name || '—'}`;

                const breakerNumber = branchObjects.map(b => b.breaker_number).filter(Boolean).join(' & ') || '—';

                rows.push({
                    stageId: stage.id,
                    stageLabel: stage.label,
                    stageColor,
                    stageOrder: stageIdx,
                    type: 'pocket',
                    pocketLabel: `Pocket ${pocketIdx + 1}`,
                    substationName: sub?.name || boundary.relay_substation_name || boundary.relay_substation_id || 'Unknown',
                    substationId: sub?.substation_id || boundary.relay_substation_id || '',
                    region: sub?.region || '—',
                    grid: sub?.grid || '—',
                    state: sub?.state || '—',
                    voltage: sub?.voltage || '—',
                    feeder,
                    breakerNumber,
                    mw: bIdx === 0 ? pocketMW : null, // show MW only on first boundary
                    threshold1, delay1, threshold2, delay2,
                });
            });
        });
    });

    return rows;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge = ({ scheme }) => {
    if (!scheme) return null;
    const isActive = scheme.is_active || scheme.status === 'active';
    const config = isActive
        ? { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', color: '#059669', label: 'Active' }
        : { bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)', color: '#64748b', label: 'Deactivated' };

    return (
        <span style={{
            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
            padding: '3px 10px', borderRadius: '999px',
            background: config.bg, border: `1px solid ${config.border}`, color: config.color,
            lineHeight: 1, whiteSpace: 'nowrap',
        }}>
            {config.label}
        </span>
    );
};


const StatPill = ({ label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{value}</span>
    </div>
);

const FilterDropdown = ({ label, value, onChange, options }) => (
    <div>
        <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '4px', fontFamily: "'Poppins', sans-serif" }}>
            {label}
        </label>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
                width: '100%',
                padding: '8px',
                fontSize: '0.75rem',
                fontFamily: "'Poppins', sans-serif",
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                color: '#0f172a',
                cursor: 'pointer',
                outline: 'none',
            }}
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

// Table column definitions
const COL_TEMPLATE = '2.7fr 0.6fr 0.7fr 0.6fr 0.4fr 2.0fr 1fr 0.5fr';
const COL_HEADERS = [
    { label: 'Substation', align: 'left' },
    { label: 'Sub ID', align: 'left' },
    { label: 'Region', align: 'left' },
    { label: 'Grid', align: 'left' },
    { label: 'kV', align: 'left' },
    { label: 'Feeder Bay', align: 'left' },
    { label: 'Breaker', align: 'left' },
    { label: 'MW', align: 'right' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

const LoadSheddingSchemeReviewer = () => {
    const [allVersions, setAllVersions] = useState([]);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [stageDetails, setStageDetails] = useState([]);
    const [substations, setSubstations] = useState([]);
    const [criticalAssets, setCriticalAssets] = useState([]);
    const [relays, setRelays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingStages, setLoadingStages] = useState(false);
    const [activeTab, setActiveTab] = useState('assignments');

    // Filters
    const [search, setSearch] = useState('');
    const [filterStage, setFilterStage] = useState('All');
    const [filterRegion, setFilterRegion] = useState('All');
    const [filterGrid, setFilterGrid] = useState('All');
    const [filterType, setFilterType] = useState('All');

    // Only show published versions
    const publishedVersions = useMemo(() =>
        allVersions.filter(v => v.status === 'active' || v.status === 'deactivated'),
        [allVersions]
    );

    // ── Data fetching ────────────────────────────────────────────────────────

    const fetchVersions = async () => {
        try {
            const [vRes, sRes, rRes, cRes] = await Promise.all([
                api.get('/load-shedding-versions/'),
                api.get('/substations/'),
                api.get('/load-shedding-relays/'),
                api.get('/critical-assets/'),
            ]);
            setAllVersions(vRes.data);
            setSubstations(sRes.data);
            setRelays(rRes.data);
            setCriticalAssets(cRes.data);

            const published = vRes.data.filter(v => v.status === 'active' || v.status === 'deactivated');
            const active = published.find(v => v.is_active || v.status === 'active');
            const initial = active || published[0] || null;
            if (initial) fetchStages(initial);
            else setSelectedScheme(null);
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStages = async (scheme) => {
        setSelectedScheme(scheme);
        if (!scheme) { setStageDetails([]); return; }
        setLoadingStages(true);
        try {
            const res = await api.get(`/load-shedding-stages/?version=${scheme.id}&include_bays=true`);
            setStageDetails(res.data || []);
        } catch (err) {
            console.error('Failed to fetch stages', err);
            setStageDetails([]);
        } finally {
            setLoadingStages(false);
        }
    };

    useEffect(() => { fetchVersions(); }, []);

    useEffect(() => {
        const handler = () => fetchVersions();
        window.addEventListener('load-shedding-published', handler);
        return () => window.removeEventListener('load-shedding-published', handler);
    }, []);

    // ── Computed data ────────────────────────────────────────────────────────

    const allRows = useMemo(
        () => buildRows(stageDetails, substations, relays),
        [stageDetails, substations, relays]
    );

    const schemeMetrics = useMemo(() => computeSchemeMetrics(
        stageDetails,
        substations,
        (stage) => (stage.pocket_bays || []).map(normalisePocketBay),
        (bay) => bay.mw_cache?.mw || 0,
        (bay) => {
            const txs = bay.transformers || [];
            return txs.some(tObj => {
                const tIdVal = typeof tObj === 'object' ? tObj.id : tObj;
                return (criticalAssets || []).some(ca => (ca.load_transformers || []).includes(Number(tIdVal)));
            });
        },
        criticalAssets
    ), [stageDetails, substations, criticalAssets]);

    // Filter options derived from rows
    const stageOptions = useMemo(() => {
        const stages = [...new Map(allRows.map(r => [r.stageId, r.stageLabel])).entries()];
        return [{ value: 'All', label: 'All Stages' }, ...stages.map(([id, label]) => ({ value: id, label }))];
    }, [allRows]);

    const regionOptions = useMemo(() => {
        const regions = [...new Set(allRows.map(r => r.region).filter(r => r && r !== '—'))].sort();
        return [{ value: 'All', label: 'All Regions' }, ...regions.map(r => ({ value: r, label: r }))];
    }, [allRows]);

    const gridOptions = useMemo(() => {
        const grids = [...new Set(allRows.map(r => r.grid).filter(g => g && g !== '—'))].sort();
        return [{ value: 'All', label: 'All Grids' }, ...grids.map(g => ({ value: g, label: g }))];
    }, [allRows]);

    const typeOptions = [
        { value: 'All', label: 'All Types' },
        { value: 'transformer', label: 'TX Bay' },
        { value: 'pocket', label: 'Network Pocket' },
    ];

    // Apply filters
    const filteredRows = useMemo(() => {
        return allRows.filter(row => {
            if (filterStage !== 'All' && row.stageId !== filterStage) return false;
            if (filterRegion !== 'All' && row.region !== filterRegion) return false;
            if (filterGrid !== 'All' && row.grid !== filterGrid) return false;
            if (filterType !== 'All' && row.type !== filterType) return false;
            if (search) {
                const q = search.toLowerCase();
                if (
                    !row.substationName.toLowerCase().includes(q) &&
                    !row.substationId.toLowerCase().includes(q) &&
                    !row.feeder.toLowerCase().includes(q) &&
                    !row.region.toLowerCase().includes(q)
                ) return false;
            }
            return true;
        });
    }, [allRows, filterStage, filterRegion, filterGrid, filterType, search]);

    // Group filtered rows by stage for display
    const groupedRows = useMemo(() => {
        const groups = [];
        let currentStageId = null;
        filteredRows.forEach(row => {
            if (row.stageId !== currentStageId) {
                currentStageId = row.stageId;
                groups.push({ stageId: row.stageId, stageLabel: row.stageLabel, stageColor: row.stageColor, rows: [] });
            }
            groups[groups.length - 1].rows.push(row);
        });
        return groups;
    }, [filteredRows]);

    // ── Export ───────────────────────────────────────────────────────────────

    const handleExportExcel = () => {
        if (!filteredRows.length) return;
        const schemeType = selectedScheme?.scheme_type || 'LoadShedding';
        const fileName = `${schemeType}_${selectedScheme?.review_year}_v${selectedScheme?.version}_Assignments`;
        const disclaimer = '⚠ UNCONTROLLED COPY — For internal use only. Verify against the published system.';
        const versionInfo = `${schemeType} ${selectedScheme?.review_year} v${selectedScheme?.version} | Exported: ${new Date().toLocaleString()}`;
        const headers = ['Stage', 'Substation', 'Substation ID', 'Type', 'Region', 'Grid', 'Voltage (kV)', 'Feeder / Asset', 'MW', 'Breaker No.', 'Threshold 1 (Hz)', 'Delay 1 (s)', 'Threshold 2 (Hz)', 'Delay 2 (s)'];
        const data = filteredRows.map(r => [
            r.stageLabel, r.substationName, r.substationId,
            r.type === 'transformer' ? 'TX Bay' : 'Network Pocket',
            r.region, r.grid, r.voltage, r.feeder,
            r.mw != null ? r.mw : '',
            r.breakerNumber, r.threshold1, r.delay1, r.threshold2, r.delay2,
        ]);
        const ws = XLSX.utils.aoa_to_sheet([[disclaimer], [versionInfo], headers, ...data]);
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, schemeType);
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    // ── Tab config ───────────────────────────────────────────────────────────

    const tabList = [
        {
            id: 'assignments',
            label: 'Load Shedding Assignments',
            icon: <FaTableList size={15} />,
        },
        {
            id: 'analytics',
            label: 'Analytics',
            icon: <BarChart2 size={16} />,
        },
    ];

    const tabButtonStyle = (isActive) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0.75rem 1.5rem',
        background: isActive ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
        border: 'none',
        borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
        color: isActive ? 'var(--accent-blue)' : '#64748b',
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 400,
        fontSize: '0.82rem',
        fontFamily: "'Poppins', sans-serif",
        transition: 'all 0.2s ease',
        borderRadius: '8px 8px 0 0',
        whiteSpace: 'nowrap',
    });

    // ── Loading / empty states ───────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '16rem', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins', sans-serif" }}>
                <RefreshCw className="animate-spin" size={28} style={{ color: '#94a3b8' }} />
            </div>
        );
    }

    if (publishedVersions.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '24rem', gap: '1rem', fontFamily: "'Poppins', sans-serif" }}>
                <FaLayerGroup size={48} style={{ color: '#e2e8f0' }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8' }}>No Published Schemes</div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', maxWidth: '380px', textAlign: 'center', lineHeight: 1.6 }}>
                    No load shedding schemes have been published yet. Use the Stage Designer to create and publish a scheme.
                </div>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif", background: '#fff' }}>

            {/* ── ROW 1: Tab navigation ─────────────────────────────────── */}
            <div style={{
                display: 'flex',
                gap: '0.25rem',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
                background: '#fff',
                padding: '0 2rem',
                zIndex: 20,
            }}>
                {tabList.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={tabButtonStyle(activeTab === tab.id)}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── ROW 2: Header ─────────────────────────────────────────── */}
            <div style={{ flexShrink: 0, zIndex: 10, padding: '1.25rem 2rem 0', background: '#fff' }}>

                {/* Title */}
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(30, 41, 59, 0.5)', marginBottom: '0.5rem' }}>
                        Load Shedding Registry
                    </div>
                    <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                        Scheme Assignments
                    </h1>
                </div>

                {/* Scheme selector card */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                }}>
                    {/* Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                            Viewing Scheme
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <select
                                value={selectedScheme?.id || ''}
                                onChange={e => {
                                    const v = publishedVersions.find(s => s.id === e.target.value);
                                    if (v) fetchStages(v);
                                }}
                                style={{
                                    height: '36px',
                                    padding: '0 32px 0 10px',
                                    fontSize: '0.82rem',
                                    fontFamily: "'Poppins', sans-serif",
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    background: '#fff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    minWidth: '200px',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 10px center',
                                }}
                            >
                                {publishedVersions.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {getVersionLabel(v)}
                                    </option>
                                ))}
                            </select>
                            <StatusBadge scheme={selectedScheme} />
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: '1px', height: '36px', background: '#e2e8f0', flexShrink: 0 }} />

                    {/* Stats pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {loadingStages ? (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Loading…</span>
                        ) : (
                            <>
                                <StatPill label="Assignments" value={allRows.length} />
                                <StatPill label="Stages" value={stageDetails.length} />
                                <StatPill label="Total MW" value={`${formatMW(schemeMetrics.totalMW)} MW`} />
                                {selectedScheme?.published_at && (
                                    <StatPill label="Published" value={formatDate(selectedScheme.published_at)} />
                                )}
                            </>
                        )}
                    </div>

                    {/* Export — pushed to far right */}
                    <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                                Export
                            </span>
                        </div>
                        <button
                            onClick={handleExportExcel}
                            disabled={!filteredRows.length}
                            style={{
                                height: '36px',
                                padding: '0 14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                fontFamily: "'Poppins', sans-serif",
                                fontWeight: 600,
                                color: filteredRows.length ? '#334155' : '#94a3b8',
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                cursor: filteredRows.length ? 'pointer' : 'not-allowed',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => { if (filteredRows.length) { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; } }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                            <Download size={14} />
                            Export to Excel
                        </button>
                    </div>
                </div>

                {/* Filter card */}
                {activeTab === 'assignments' && (
                    <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(34, 211, 238, 0.2)', marginBottom: '1.5rem', padding: '1.25rem', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                        {/* Top row: label + search + reset */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e' }}>
                                <Filter size={18} />
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: "'Poppins', sans-serif" }}>Filter Assignments</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                                {/* Search */}
                                <div style={{ position: 'relative', minWidth: '200px', flex: '0 1 350px' }}>
                                    <Search size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        placeholder="Search substation, feeder…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        style={{
                                            paddingLeft: '2.2rem',
                                            paddingRight: search ? '2rem' : '0.75rem',
                                            width: '100%',
                                            height: '36px',
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            color: '#0f172a',
                                            outline: 'none',
                                            fontFamily: "'Poppins', sans-serif",
                                            fontSize: '0.82rem',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                    {search && (
                                        <X size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#64748b' }} onClick={() => setSearch('')} />
                                    )}
                                </div>

                                {/* Reset */}
                                {(search || filterStage !== 'All' || filterRegion !== 'All' || filterGrid !== 'All' || filterType !== 'All') && (
                                    <button
                                        onClick={() => { setSearch(''); setFilterStage('All'); setFilterRegion('All'); setFilterGrid('All'); setFilterType('All'); }}
                                        style={{
                                            background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b',
                                            padding: '0 12px', height: '36px', borderRadius: '6px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif",
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                    >
                                        <RotateCcw size={13} />
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Dropdown filters grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                            <FilterDropdown label="Stage" value={filterStage} onChange={setFilterStage} options={stageOptions} />
                            <FilterDropdown label="Region" value={filterRegion} onChange={setFilterRegion} options={regionOptions} />
                            <FilterDropdown label="Grid" value={filterGrid} onChange={setFilterGrid} options={gridOptions} />
                            <FilterDropdown label="Assignment Type" value={filterType} onChange={setFilterType} options={typeOptions} />
                        </div>
                    </div>
                )}

            </div>

            {/* ── ROW 3: Scrollable content ──────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 2rem 2rem' }} className="custom-scrollbar">

                {/* ── ASSIGNMENTS TAB ──────────────────────────────────── */}
                {activeTab === 'assignments' && (
                    <>
                        {loadingStages ? (
                            <div style={{ display: 'flex', height: '12rem', alignItems: 'center', justifyContent: 'center' }}>
                                <RefreshCw className="animate-spin" size={24} style={{ color: '#94a3b8' }} />
                            </div>
                        ) : filteredRows.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '12rem', gap: '0.75rem' }}>
                                <FaTableList size={40} style={{ color: '#e2e8f0' }} />
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>No assignments found</div>
                                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Try adjusting your filters</div>
                            </div>
                        ) : (
                            <div>
                                {/* Sticky table header */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: COL_TEMPLATE,
                                    gap: '0.75rem',
                                    padding: '0.6rem 1rem',
                                    background: '#fff',
                                    borderBottom: '2px solid #f1f5f9',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 10,
                                    alignItems: 'center',
                                }}>
                                    {COL_HEADERS.map((col, i) => (
                                        <div key={i} style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            color: '#94a3b8',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            textAlign: col.align,
                                        }}>
                                            {col.label}
                                        </div>
                                    ))}
                                </div>

                                {/* Stage groups */}
                                {groupedRows.map((group) => (
                                    <div key={group.stageId}>
                                        {/* Stage divider */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.55rem 1rem',
                                            background: '#f8fafc',
                                            borderTop: '1px solid #f1f5f9',
                                            borderBottom: '1px solid #f1f5f9',
                                            marginTop: '0.25rem',
                                        }}>
                                            <span style={{
                                                display: 'inline-block',
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                background: group.stageColor,
                                                flexShrink: 0,
                                            }} />
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                color: '#334155',
                                                letterSpacing: '0.04em',
                                                textTransform: 'uppercase',
                                            }}>
                                                {group.stageLabel}
                                            </span>
                                            {/* Settings inline */}
                                            {(() => {
                                                const r = group.rows[0];
                                                if (!r || r.threshold1 === '—') return null;
                                                const settings = [
                                                    `${r.threshold1} Hz ${r.delay1 !== '—' ? `${r.delay1}s` : ''} delay`,
                                                    ...(r.threshold2 && r.threshold2 !== '—' ? [`${r.threshold2} Hz ${r.delay2 !== '—' ? `${r.delay2}s` : ''} delay`] : []),
                                                ];
                                                return settings.map((s, i) => (
                                                    <React.Fragment key={i}>
                                                        <span style={{ fontSize: '0.62rem', color: '#cbd5e1', fontWeight: 400, userSelect: 'none' }}>|</span>
                                                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500, fontFamily: 'monospace' }}>{s}</span>
                                                    </React.Fragment>
                                                ));
                                            })()}
                                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                                                <span style={{ fontSize: '0.62rem', color: '#cbd5e1', marginRight: '0.5rem', userSelect: 'none' }}>|</span>
                                                {group.rows.length} assignment{group.rows.length !== 1 ? 's' : ''}
                                            </span>
                                            {(() => {
                                                const totalMW = group.rows.reduce((sum, r) => sum + (r.mw != null ? Number(r.mw) : 0), 0);
                                                if (!totalMW) return null;
                                                return (
                                                    <>
                                                        <span style={{ fontSize: '0.62rem', color: '#cbd5e1', userSelect: 'none' }}>|</span>
                                                        <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>{formatMW(totalMW)} MW</span>
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Assignment rows */}
                                        <AnimatePresence>
                                            {group.rows.map((row, rowIdx) => (
                                                <motion.div
                                                    key={`${row.stageId}-${rowIdx}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15, delay: rowIdx * 0.02 }}
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: COL_TEMPLATE,
                                                        gap: '0.75rem',
                                                        padding: '0.65rem 1rem',
                                                        borderBottom: '1px solid #f8fafc',
                                                        alignItems: 'center',
                                                        cursor: 'default',
                                                        transition: 'background 0.1s',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    {/* Substation name */}
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {row.substationName}
                                                        </div>
                                                        {row.state && row.state !== '—' && (
                                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '1px' }}>{row.state}</div>
                                                        )}
                                                    </div>

                                                    {/* Substation ID */}
                                                    <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#475569', fontWeight: 500 }}>
                                                        {row.substationId || '—'}
                                                    </div>

                                                    {/* Region */}
                                                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>{row.region}</div>

                                                    {/* Grid */}
                                                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>{row.grid}</div>

                                                    {/* Voltage */}
                                                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                                                        {row.voltage && row.voltage !== '—' ? `${row.voltage}` : '—'}
                                                    </div>

                                                    {/* Feeder */}
                                                    <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 500, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {row.feeder}
                                                    </div>

                                                    {/* Breaker */}
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                                        {row.breakerNumber}
                                                    </div>

                                                    {/* MW */}
                                                    <div style={{ textAlign: 'right' }}>
                                                        {row.mw != null ? (
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#10b981' }}>
                                                                {formatMW(row.mw)}
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>—</span>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── ANALYTICS TAB (placeholder) ──────────────────────── */}
                {activeTab === 'analytics' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '16rem', gap: '1rem' }}>
                        <BarChart2 size={48} style={{ color: '#e2e8f0' }} />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8' }}>Analytics Coming Soon</div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6 }}>
                            Scheme analytics and metrics will be available here.
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default LoadSheddingSchemeReviewer;
