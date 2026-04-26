import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, X, Download, RefreshCw, BarChart2, Filter, RotateCcw, AlertCircle, TriangleAlert, CheckCircle2, GripVertical, ChevronDown, ChevronUp, Maximize2, Minimize2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FaBolt, FaLayerGroup, FaCircleNodes, FaCodeBranch, FaTableList, FaShieldHalved } from 'react-icons/fa6';
import { normalisePocketBay, computeSchemeMetrics } from '../utils/loadSheddingUtils';
import SchemeAnalytics from './SchemeAnalytics';
import api from '../api';
import { CardLoader } from './Loader';

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
            const bayTransformers = bay.transformers || [];
            const selectedIds = bayTransformers.map(t => typeof t === 'object' ? t.id : t);

            // Debug: Log if relay not found or transformers don't match
            if (stage.label === 'Stage 3 AHTM132') {
                console.log('=== DEBUG Stage 3 AHTM132 ===');
                console.log('bay.relay:', bay.relay);
                console.log('relay found:', !!relay);
                console.log('relay.load_transformers:', relay?.load_transformers);
                console.log('bay.transformers:', bayTransformers);
                console.log('selectedIds:', selectedIds);
            }

            const selectedTxs = (relay?.load_transformers || []).filter(t =>
                selectedIds.includes(typeof t === 'object' ? t.id : t)
            );

            const feeder = selectedTxs.length > 0
                ? selectedTxs.map(t => `T${t.transformer_no}`).join(' & ')
                : bayTransformers.map(t => typeof t === 'object' ? `T${t.id}` : `T${t}`).join(' & ') || '—';

            const breakerNumber = selectedTxs.length > 0
                ? selectedTxs.map(t => t.lv_breaker_number).filter(Boolean).join(' & ') || '—'
                : '—';
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

        // Pocket bays
        (stage.pocket_bays || []).forEach((pocket, pocketIdx) => {
            const pocketMW = pocket.topology_cache?.mw ?? null;
            const pocketLabel = `Pocket ${pocketIdx + 1}`;
            const boundaries = pocket.boundaries || [];
            const isMultiBoundary = boundaries.length > 1;
            const pocketId = `${stage.id}-pocket-${pocketIdx}`;

            if (isMultiBoundary) {
                // Emit a header row for the pocket (carries the MW)
                rows.push({
                    stageId: stage.id,
                    stageLabel: stage.label,
                    stageColor,
                    stageOrder: stageIdx,
                    type: 'pocket_header',
                    pocketId,
                    pocketLabel,
                    boundaryCount: boundaries.length,
                    boundarySubstationIds: boundaries.map(b => b.relay_substation_id).filter(Boolean),
                    mw: pocketMW,
                    threshold1, delay1, threshold2, delay2,
                    // neutral values so filter pass-throughs work
                    substationName: '', substationId: '', region: '—', grid: '—', state: '—', voltage: '—', feeder: '', breakerNumber: '',
                });
            }

            boundaries.forEach((boundary) => {
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
                    type: isMultiBoundary ? 'pocket_boundary' : 'pocket',
                    pocketId: isMultiBoundary ? pocketId : undefined,
                    pocketLabel,
                    substationName: sub?.name || boundary.relay_substation_name || boundary.relay_substation_id || 'Unknown',
                    substationId: sub?.substation_id || boundary.relay_substation_id || '',
                    region: sub?.region || '—',
                    grid: sub?.grid || '—',
                    state: sub?.state || '—',
                    voltage: sub?.voltage || '—',
                    feeder,
                    breakerNumber,
                    mw: isMultiBoundary ? null : pocketMW,
                    threshold1, delay1, threshold2, delay2,
                });
            });
        });
    });

    return rows;
};

// ─── Comparison helpers ───────────────────────────────────────────────────────

const CHANGE_META = {
    new: { label: 'New Assignment', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    revised: { label: 'Revised', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    defeated: { label: 'Defeated', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    unchanged: { label: 'Unchanged', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const buildComparisonRows = (rowsA, rowsB) => {
    const keyOf = r => `${r.substationId}||${r.feeder}||${r.type === 'pocket_boundary' ? 'pocket' : r.type}`;
    const mapA = new Map();
    rowsA.filter(r => r.type !== 'pocket_header').forEach(r => mapA.set(keyOf(r), r));
    const mapB = new Map();
    rowsB.filter(r => r.type !== 'pocket_header').forEach(r => mapB.set(keyOf(r), r));

    const results = [];
    mapA.forEach((rowA, key) => {
        const rowB = mapB.get(key);
        if (!rowB) {
            results.push({ ...rowA, changeType: 'new', oldStageLabel: '—', oldStageColor: null });
        } else if (rowA.stageLabel !== rowB.stageLabel) {
            results.push({ ...rowA, changeType: 'revised', oldStageLabel: rowB.stageLabel, oldStageColor: rowB.stageColor });
        } else {
            results.push({ ...rowA, changeType: 'unchanged', oldStageLabel: rowB.stageLabel, oldStageColor: rowB.stageColor });
        }
    });
    mapB.forEach((rowB, key) => {
        if (!mapA.has(key)) {
            results.push({ ...rowB, changeType: 'defeated', oldStageLabel: rowB.stageLabel, oldStageColor: rowB.stageColor, stageLabel: '—' });
        }
    });
    return results;
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

const CriticalBadge = ({ label = 'Critical Substation', style: extraStyle = {} }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...extraStyle }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <AlertCircle size={13} style={{ color: '#ef4444' }} />
            <AnimatePresence>
                {hovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '5px',
                            background: 'rgba(10, 12, 16, 0.92)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            color: '#fca5a5',
                            zIndex: 999,
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                    >
                        {label}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Export column definitions — each entry drives both the modal checkboxes and the xlsx output
const EXPORT_COLUMNS = [
    { key: 'stage', label: 'Stage', defaultOn: true, getValue: r => r.stageLabel },
    { key: 'substation', label: 'Substation', defaultOn: true, getValue: r => r.substationName },
    { key: 'substId', label: 'Substation ID', defaultOn: true, getValue: r => r.substationId },
    { key: 'region', label: 'Region', defaultOn: true, getValue: r => r.region },
    { key: 'grid', label: 'Grid', defaultOn: true, getValue: r => r.grid },
    { key: 'voltage', label: 'Voltage (kV)', defaultOn: true, getValue: r => r.voltage },
    { key: 'feeder', label: 'Feeder Bay', defaultOn: true, getValue: r => r.feeder },
    { key: 'breaker', label: 'Breaker No.', defaultOn: true, getValue: r => r.breakerNumber },
    { key: 'mw', label: 'MW', defaultOn: true, getValue: r => r.mw != null ? Math.round(r.mw) : '' },
    { key: 'type', label: 'Type', defaultOn: false, getValue: r => r.type === 'transformer' ? 'TX Bay' : 'Network Pocket' },
    { key: 'thresh1', label: 'Threshold 1 (Hz)', defaultOn: true, getValue: r => r.threshold1 },
    { key: 'delay1', label: 'Delay 1 (s)', defaultOn: true, getValue: r => r.delay1 },
    { key: 'thresh2', label: 'Threshold 2 (Hz)', defaultOn: false, getValue: r => r.threshold2 },
    { key: 'delay2', label: 'Delay 2 (s)', defaultOn: false, getValue: r => r.delay2 },
    { key: 'critical', label: 'Critical Subs', defaultOn: false, getValue: r => r.isCritical ? 'Yes' : '' },
    { key: 'comparison', label: 'Comparison', defaultOn: false, getValue: r => r._compRow ? `${CHANGE_META[r._compRow.changeType]?.label || r._compRow.changeType}: ${r._compRow.oldStageLabel || '—'} --> ${r._compRow.changeType === 'defeated' ? '—' : r._compRow.stageLabel}` : '—' },
];


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

const ComparisonRow = ({ row, meta }) => (
    <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 220px', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid #f8fafc', alignItems: 'center', transition: 'background 0.1s' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.substationName}</div>
        <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#475569', fontWeight: 500 }}>{row.substationId || '—'}</div>
        <div style={{ fontSize: '0.75rem', color: '#475569' }}>{row.region}</div>
        <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.feeder}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {meta.label}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                {row.oldStageLabel || '—'} → {row.changeType === 'defeated' ? '—' : row.stageLabel}
            </span>
        </div>
    </div>
);

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
    const [complianceReport, setComplianceReport] = useState(null);
    const [loadingCompliance, setLoadingCompliance] = useState(false);

    // Comparison tab state
    const [compSchemeType, setCompSchemeType] = useState(null);
    const [compVersionA, setCompVersionA] = useState(null);
    const [compVersionB, setCompVersionB] = useState(null);
    const [compStagesA, setCompStagesA] = useState([]);
    const [compStagesB, setCompStagesB] = useState([]);
    const [loadingComp, setLoadingComp] = useState(false);
    const [compGroupBy, setCompGroupBy] = useState('change-type');

    // Export comparison state (selected scheme vs latest deactivated published version)
    const [prevSchemeStages, setPrevSchemeStages] = useState([]);
    const [loadingPrevScheme, setLoadingPrevScheme] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [filterStage, setFilterStage] = useState('All');
    const [filterRegion, setFilterRegion] = useState('All');
    const [filterGrid, setFilterGrid] = useState('All');
    const [filterType, setFilterType] = useState('All');
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedExportCols, setSelectedExportCols] = useState(
        () => new Set(EXPORT_COLUMNS.filter(c => c.defaultOn).map(c => c.key))
    );
    const [exportColOrder, setExportColOrder] = useState(() => EXPORT_COLUMNS.map(c => c.key));
    const dragIdx = React.useRef(null);

    const [isFilterCollapsed, setIsFilterCollapsed] = useState(window.innerWidth < 1024);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isTableFullscreen, setIsTableFullscreen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (!mobile) setIsFilterCollapsed(false);
            else setIsFilterCollapsed(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const fetchComplianceReport = async (schemeType) => {
        const type = schemeType || selectedScheme?.scheme_type;
        if (!type) return;
        setLoadingCompliance(true);
        try {
            const res = await api.get(`/load-shedding-versions/compliance-report/?scheme_type=${type}`);
            setComplianceReport(res.data);
        } catch (err) {
            console.error('Failed to fetch compliance report', err);
        } finally {
            setLoadingCompliance(false);
        }
    };

    const fetchComparisonStages = async (vA, vB) => {
        if (!vA || !vB) return;
        setLoadingComp(true);
        try {
            const [resA, resB] = await Promise.all([
                api.get(`/load-shedding-stages/?version=${vA.id}&include_bays=true`),
                api.get(`/load-shedding-stages/?version=${vB.id}&include_bays=true`),
            ]);
            setCompStagesA(resA.data || []);
            setCompStagesB(resB.data || []);
        } catch (err) {
            console.error('Failed to fetch comparison stages', err);
        } finally {
            setLoadingComp(false);
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

    useEffect(() => {
        if (activeTab === 'alert-report' && !complianceReport) fetchComplianceReport();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'alert-report' && selectedScheme) {
            fetchComplianceReport(selectedScheme.scheme_type);
        } else {
            setComplianceReport(null);
        }
    }, [selectedScheme]);

    useEffect(() => {
        if (activeTab !== 'comparison') return;
        const schemeType = compSchemeType || selectedScheme?.scheme_type || availableSchemeTypes[0];
        if (!schemeType) return;
        if (compSchemeType !== schemeType) setCompSchemeType(schemeType);
        const sameType = publishedVersions.filter(v => v.scheme_type === schemeType);
        if (sameType.length >= 2 && !compVersionA && !compVersionB) {
            setCompVersionA(sameType[0]);
            setCompVersionB(sameType[1]);
            fetchComparisonStages(sameType[0], sameType[1]);
        }
    }, [activeTab]);

    // ── Computed data ────────────────────────────────────────────────────────

    const criticalSubIds = useMemo(
        () => new Set((criticalAssets || []).map(ca => ca.substation).filter(Boolean)),
        [criticalAssets]
    );

    const allRows = useMemo(() => {
        const rows = buildRows(stageDetails, substations, relays);
        return rows.map(r => ({
            ...r,
            isCritical: r.substationId ? criticalSubIds.has(r.substationId) : false,
        }));
    }, [stageDetails, substations, relays, criticalSubIds]);

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

    // Comparison computed data
    const availableSchemeTypes = useMemo(() =>
        [...new Set(publishedVersions.map(v => v.scheme_type))].sort(),
        [publishedVersions]
    );

    const compVersionsForType = useMemo(() =>
        publishedVersions.filter(v => v.scheme_type === compSchemeType),
        [publishedVersions, compSchemeType]
    );

    // Latest deactivated published version of the same scheme type (for export comparison)
    const prevPublishedScheme = useMemo(() => {
        if (!selectedScheme) return null;
        const parseVer = v => {
            const parts = String(v || '0').split('.').map(Number);
            return (parts[0] || 0) * 1000 + (parts[1] || 0);
        };
        const candidates = publishedVersions.filter(v =>
            v.scheme_type === selectedScheme.scheme_type &&
            v.id !== selectedScheme.id &&
            v.status === 'deactivated'
        );
        if (!candidates.length) return null;
        return candidates.sort((a, b) =>
            (b.review_year - a.review_year) || (parseVer(b.version) - parseVer(a.version))
        )[0];
    }, [selectedScheme, publishedVersions]);

    useEffect(() => {
        if (!prevPublishedScheme) {
            setPrevSchemeStages([]);
            setSelectedExportCols(prev => { const next = new Set(prev); next.delete('comparison'); return next; });
            return;
        }
        setLoadingPrevScheme(true);
        api.get(`/load-shedding-stages/?version=${prevPublishedScheme.id}&include_bays=true`)
            .then(res => setPrevSchemeStages(res.data || []))
            .catch(() => setPrevSchemeStages([]))
            .finally(() => setLoadingPrevScheme(false));
    }, [prevPublishedScheme?.id]);

    const compRowsA = useMemo(() => buildRows(compStagesA, substations, relays), [compStagesA, substations, relays]);
    const compRowsB = useMemo(() => buildRows(compStagesB, substations, relays), [compStagesB, substations, relays]);
    const comparisonRows = useMemo(() => buildComparisonRows(compRowsA, compRowsB), [compRowsA, compRowsB]);

    // Comparison rows for export: current selected scheme vs latest previous deactivated published
    const exportCompRows = useMemo(() => {
        if (!prevPublishedScheme || !prevSchemeStages.length) return [];
        const prevRows = buildRows(prevSchemeStages, substations, relays);
        return buildComparisonRows(allRows, prevRows);
    }, [allRows, prevSchemeStages, substations, relays, prevPublishedScheme]);

    const compSummary = useMemo(() => ({
        new: comparisonRows.filter(r => r.changeType === 'new').length,
        revised: comparisonRows.filter(r => r.changeType === 'revised').length,
        defeated: comparisonRows.filter(r => r.changeType === 'defeated').length,
        unchanged: comparisonRows.filter(r => r.changeType === 'unchanged').length,
    }), [comparisonRows]);

    const typeOptions = [
        { value: 'All', label: 'All Types' },
        { value: 'transformer', label: 'TX Bay' },
        { value: 'pocket', label: 'Network Pocket' },
    ];

    // Apply filters
    const filteredRows = useMemo(() => {
        // First pass: filter all non-header rows normally
        const survivingPocketIds = new Set();
        const firstPass = allRows.filter(row => {
            if (row.type === 'pocket_header') return false; // handled in second pass

            if (filterStage !== 'All' && row.stageId !== filterStage) return false;
            if (filterRegion !== 'All' && row.region !== filterRegion) return false;
            if (filterGrid !== 'All' && row.grid !== filterGrid) return false;
            if (filterType !== 'All') {
                // treat pocket_boundary as 'pocket' for type filter
                const effectiveType = row.type === 'pocket_boundary' ? 'pocket' : row.type;
                if (effectiveType !== filterType) return false;
            }
            if (search) {
                const q = search.toLowerCase();
                if (
                    !row.substationName.toLowerCase().includes(q) &&
                    !row.substationId.toLowerCase().includes(q) &&
                    !row.feeder.toLowerCase().includes(q) &&
                    !row.region.toLowerCase().includes(q)
                ) return false;
            }

            if (row.pocketId) survivingPocketIds.add(row.pocketId);
            return true;
        });

        // Second pass: insert pocket_header rows before their first surviving boundary
        const result = [];
        const injectedHeaders = new Set();
        firstPass.forEach(row => {
            if (row.pocketId && !injectedHeaders.has(row.pocketId)) {
                const header = allRows.find(r => r.type === 'pocket_header' && r.pocketId === row.pocketId);
                if (header && survivingPocketIds.has(row.pocketId)) {
                    result.push(header);
                    injectedHeaders.add(row.pocketId);
                }
            }
            result.push(row);
        });

        return result;
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
        const colMap = Object.fromEntries(EXPORT_COLUMNS.map(c => [c.key, c]));
        const cols = exportColOrder.filter(k => selectedExportCols.has(k)).map(k => colMap[k]);
        const schemeType = selectedScheme?.scheme_type || 'LoadShedding';
        const fileName = `${schemeType}_${selectedScheme?.review_year}_v${selectedScheme?.version}_Assignments`;
        const disclaimer = '⚠ UNCONTROLLED COPY — For internal use only. Verify against the published system.';
        const compRef = prevPublishedScheme ? ` | Compared to: ${getVersionLabel(prevPublishedScheme)}` : '';
        const versionInfo = `${schemeType} ${selectedScheme?.review_year} v${selectedScheme?.version}${compRef} | Exported: ${new Date().toLocaleString()}`;

        const compMap = new Map();
        exportCompRows.forEach(r => {
            compMap.set(`${r.substationId}||${r.feeder}||${r.type === 'pocket_boundary' ? 'pocket' : r.type}`, r);
        });

        const headers = cols.map(c => c.label);
        const data = filteredRows
            .filter(r => r.type !== 'pocket_header')
            .map(r => {
                const enriched = { ...r, _compRow: compMap.get(`${r.substationId}||${r.feeder}||${r.type === 'pocket_boundary' ? 'pocket' : r.type}`) || null };
                return cols.map(c => c.getValue(enriched));
            });

        const includeComp = selectedExportCols.has('comparison');
        const defeatedRows = includeComp ? exportCompRows.filter(r => r.changeType === 'defeated') : [];
        if (defeatedRows.length) {
            data.push(new Array(cols.length).fill(''));
            data.push([`DEFEATED — Removed in current scheme (${defeatedRows.length} entr${defeatedRows.length === 1 ? 'y' : 'ies'})`]);
            data.push(headers);
            defeatedRows.forEach(r => data.push(cols.map(c => c.getValue({ ...r, _compRow: r }))));
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([[disclaimer], [versionInfo], headers, ...data]);
        const lastCol = Math.max(headers.length - 1, 0);
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
        if (defeatedRows.length) {
            const sectionHeaderRow = 2 + filteredRows.filter(r => r.type !== 'pocket_header').length + 2;
            ws['!merges'].push({ s: { r: sectionHeaderRow, c: 0 }, e: { r: sectionHeaderRow, c: lastCol } });
        }
        XLSX.utils.book_append_sheet(wb, ws, schemeType);
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        setShowExportModal(false);
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
        {
            id: 'alert-report',
            label: 'Alert Report',
            icon: <FaShieldHalved size={15} />,
            badge: complianceReport?.summary?.total,
        },
        {
            id: 'comparison',
            label: 'Comparison',
            icon: <FaCodeBranch size={15} />,
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
            <div style={{ height: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardLoader show={true} message="Loading scheme reviewer..." />
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
        <>
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
                            {tab.badge > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '999px', background: '#ef4444', color: '#fff', fontSize: '0.58rem', fontWeight: 700, marginLeft: '2px' }}>
                                    {tab.badge}
                                </span>
                            )}
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
                    {/* Scheme selector card */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '0.75rem 1.25rem',
                        marginBottom: '1rem',
                        flexWrap: 'wrap',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                            {/* Selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
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
                                            height: '34px',
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
                                            minWidth: '180px',
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
                            <div style={{ width: '1px', height: '32px', background: '#e2e8f0', flexShrink: 0 }} />

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
                        </div>

                        {/* Export and Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: 'auto' }}>
                            {activeTab === 'assignments' && (
                                <button
                                    onClick={() => setIsTableFullscreen(true)}
                                    style={{
                                        height: '34px',
                                        padding: '0 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.78rem',
                                        fontFamily: "'Poppins', sans-serif",
                                        fontWeight: 600,
                                        color: '#334155',
                                        background: '#fff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                    <Maximize2 size={14} /> Fullscreen Table
                                </button>
                            )}
                            <button
                                onClick={() => setShowExportModal(true)}
                                disabled={!filteredRows.length}
                                style={{
                                    height: '34px',
                                    padding: '0 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.78rem',
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
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isFilterCollapsed ? 0 : '1rem', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }}
                                onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e' }}>
                                    <Filter size={18} />
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: "'Poppins', sans-serif" }}>Filter Assignments</span>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {!isFilterCollapsed && (
                                        <>
                                            {/* Search */}
                                            <div style={{ position: 'relative', minWidth: '200px', flex: '0 1 350px' }} onClick={e => e.stopPropagation()}>
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
                                                    onClick={(e) => { e.stopPropagation(); setSearch(''); setFilterStage('All'); setFilterRegion('All'); setFilterGrid('All'); setFilterType('All'); }}
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
                                        </>
                                    )}
                                    {isFilterCollapsed ? <ChevronDown size={18} color="#64748b" /> : <ChevronUp size={18} color="#64748b" />}
                                </div>
                            </div>

                            {/* Dropdown filters grid */}
                            <AnimatePresence>
                                {!isFilterCollapsed && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                                            <FilterDropdown label="Stage" value={filterStage} onChange={setFilterStage} options={stageOptions} />
                                            <FilterDropdown label="Region" value={filterRegion} onChange={setFilterRegion} options={regionOptions} />
                                            <FilterDropdown label="Grid" value={filterGrid} onChange={setFilterGrid} options={gridOptions} />
                                            <FilterDropdown label="Assignment Type" value={filterType} onChange={setFilterType} options={typeOptions} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                </div>

                {/* ── ROW 3: Scrollable content ──────────────────────────────── */}
                <div style={isTableFullscreen && activeTab === 'assignments' ? {
                    position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                } : { flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 2rem 2rem' }} className="custom-scrollbar">

                    {/* ── ASSIGNMENTS TAB ──────────────────────────────────── */}
                    {activeTab === 'assignments' && (
                        <>
                            {isTableFullscreen && (
                                <div style={{ padding: '1rem 2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{ fontSize: '1.24rem', fontWeight: 700, color: '#0f172a' }}>Assignments — {getVersionLabel(selectedScheme)}</div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            onClick={() => setShowExportModal(true)}
                                            disabled={!filteredRows.length}
                                            style={{ height: '36px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif", fontWeight: 600, color: filteredRows.length ? '#334155' : '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: filteredRows.length ? 'pointer' : 'not-allowed' }}
                                        >
                                            <Download size={14} /> Export
                                        </button>
                                        <button
                                            onClick={() => setIsTableFullscreen(false)}
                                            style={{ height: '36px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif", fontWeight: 600, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                        >
                                            <Minimize2 size={14} /> Close Fullscreen
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div style={isTableFullscreen ? { flex: 1, overflowY: 'auto', padding: '2rem' } : {}}>
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
                                                        {(() => { const n = group.rows.filter(r => r.type !== 'pocket_boundary').length; return `${n} assignment${n !== 1 ? 's' : ''}`; })()}
                                                    </span>
                                                    {(() => {
                                                        const totalMW = group.rows.filter(r => r.type !== 'pocket_boundary').reduce((sum, r) => sum + (r.mw != null ? Number(r.mw) : 0), 0);
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
                                                    {group.rows.map((row, rowIdx) => {
                                                        // ── Pocket header row ──────────────────────────────
                                                        if (row.type === 'pocket_header') {
                                                            return (
                                                                <motion.div
                                                                    key={`${row.stageId}-ph-${row.pocketId}`}
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    transition={{ duration: 0.15 }}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.6rem',
                                                                        padding: '0.4rem 1rem 0.4rem 1.5rem',
                                                                        background: 'rgba(14, 165, 233, 0.04)',
                                                                        borderBottom: '1px solid #f1f5f9',
                                                                        borderLeft: '3px solid rgba(14, 165, 233, 0.35)',
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0ea5e9', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                                                                        {row.pocketLabel}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.62rem', color: '#cbd5e1', userSelect: 'none' }}>|</span>
                                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                                                        {row.boundaryCount} boundaries
                                                                    </span>
                                                                    {row.mw != null && (
                                                                        <>
                                                                            <span style={{ fontSize: '0.62rem', color: '#cbd5e1', userSelect: 'none' }}>|</span>
                                                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>
                                                                                {formatMW(row.mw)} MW
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    {(row.boundarySubstationIds || []).some(id => criticalSubIds.has(id)) && (
                                                                        <CriticalBadge label="Contains critical substation" style={{ marginLeft: '2px' }} />
                                                                    )}
                                                                </motion.div>
                                                            );
                                                        }

                                                        // ── Regular / pocket_boundary row ─────────────────
                                                        const isBoundary = row.type === 'pocket_boundary';
                                                        return (
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
                                                                    paddingLeft: isBoundary ? '1.5rem' : '1rem',
                                                                    borderBottom: '1px solid #f8fafc',
                                                                    borderLeft: isBoundary ? '3px solid rgba(14, 165, 233, 0.2)' : 'none',
                                                                    alignItems: 'center',
                                                                    cursor: 'default',
                                                                    transition: 'background 0.1s',
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                {/* Substation name */}
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {row.substationName}
                                                                        </span>
                                                                        {criticalSubIds.has(row.substationId) && (
                                                                            <CriticalBadge label="Critical Substation" />
                                                                        )}
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
                                                                        <span style={{ fontSize: '0.75rem', color: isBoundary ? 'transparent' : '#cbd5e1' }}>—</span>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── ANALYTICS TAB ────────────────────────────────────── */}
                    {activeTab === 'analytics' && (
                        <SchemeAnalytics
                            allRows={allRows}
                            substations={substations}
                            schemeMetrics={schemeMetrics}
                            stageDetails={stageDetails}
                        />
                    )}

                    {/* ── ALERT REPORT TAB ─────────────────────────────────── */}
                    {activeTab === 'alert-report' && (
                        <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Context bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                    Subject:{' '}
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                        {complianceReport?.active_versions?.[complianceReport.subject]?.label || selectedScheme?.scheme_type || '—'}
                                    </span>
                                    {complianceReport && Object.keys(complianceReport.active_versions || {}).length > 1 && (
                                        <>
                                            {' · Compared against: '}
                                            <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                                {Object.entries(complianceReport.active_versions)
                                                    .filter(([s]) => s !== complianceReport.subject)
                                                    .map(([, v]) => v.label).join(' · ')}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => fetchComplianceReport()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '8px', padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                                >
                                    <RefreshCw size={12} className={loadingCompliance ? 'animate-spin' : ''} /> Refresh
                                </button>
                            </div>

                            {loadingCompliance ? (
                                <div style={{ display: 'flex', height: '10rem', alignItems: 'center', justifyContent: 'center' }}>
                                    <RefreshCw size={24} style={{ color: '#94a3b8' }} className="animate-spin" />
                                </div>
                            ) : !complianceReport ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                    No report available. Click Refresh to load.
                                </div>
                            ) : (
                                <>
                                    {/* Summary cards */}
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        {[
                                            { label: 'Rule 1 Violations', desc: 'Cross-scheme overlap', count: complianceReport.summary.rule1_count, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
                                            { label: 'Rule 2 Violations', desc: 'Critical in restricted stage', count: complianceReport.summary.rule2_count, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
                                            { label: 'Total Violations', desc: 'All rules combined', count: complianceReport.summary.total, color: complianceReport.summary.total === 0 ? '#22c55e' : '#ef4444', bg: complianceReport.summary.total === 0 ? '#f0fdf4' : '#fef2f2', border: complianceReport.summary.total === 0 ? '#bbf7d0' : '#fecaca' },
                                        ].map(({ label, desc, count, color, bg, border }) => (
                                            <div key={label} style={{ flex: '1 1 160px', padding: '1rem 1.25rem', borderRadius: '10px', background: bg, border: `1px solid ${border}` }}>
                                                <div style={{ fontSize: '0.62rem', color: '#64748b', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{desc}</div>
                                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>{label}</div>
                                            </div>
                                        ))}
                                        {complianceReport.summary.total === 0 && (
                                            <div style={{ flex: '1 1 260px', padding: '1rem 1.25rem', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <CheckCircle2 size={22} color="#22c55e" />
                                                <div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>All rules satisfied</div>
                                                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>No design rule violations across active published schemes.</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Rule 1 table */}
                                    <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#f8fafc' }}>
                                            <FaShieldHalved size={13} color="#ef4444" />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Rule 1 — Cross-Scheme Overlap</span>
                                            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#64748b' }}>
                                                UFLS protected stages: {complianceReport.protected_stage_numbers?.map(n => `S${n}`).join(', ') || '—'}
                                            </span>
                                        </div>
                                        {complianceReport.rule1_violations.length === 0 ? (
                                            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>No violations</div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc' }}>
                                                        {['Substation', `${complianceReport.subject} Stage(s)`, 'Conflicting Scheme', 'Conflicting Stage(s)'].map(h => (
                                                            <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {complianceReport.rule1_violations.flatMap(v =>
                                                        Object.entries(v.conflicting_schemes).map(([scheme, schemeInfo], si) => (
                                                            <tr key={`${v.substation_id}-${scheme}`} style={{ borderBottom: '1px solid #f1f5f9' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                {si === 0 && (
                                                                    <td rowSpan={Object.keys(v.conflicting_schemes).length} style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#0f172a', verticalAlign: 'middle' }}>{v.substation_id}</td>
                                                                )}
                                                                {si === 0 && (
                                                                    <td rowSpan={Object.keys(v.conflicting_schemes).length} style={{ padding: '0.65rem 1rem', color: '#0369a1', verticalAlign: 'middle' }}>{(v.subject_stages || []).map(s => s.stage_label).join(', ')}</td>
                                                                )}
                                                                <td style={{ padding: '0.65rem 1rem' }}>
                                                                    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, background: scheme === 'UVLS' ? 'rgba(139,92,246,0.1)' : scheme === 'EMLS' ? 'rgba(249,115,22,0.1)' : '#eff6ff', color: scheme === 'UVLS' ? '#7c3aed' : scheme === 'EMLS' ? '#ea580c' : '#1d4ed8', border: `1px solid ${scheme === 'UVLS' ? 'rgba(139,92,246,0.25)' : scheme === 'EMLS' ? 'rgba(249,115,22,0.25)' : '#bfdbfe'}` }}>
                                                                        {scheme}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.65rem 1rem', color: '#475569' }}>{(schemeInfo.stages || []).map(s => s.stage_label).join(', ')}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>

                                    {/* Rule 2 table */}
                                    <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#f8fafc' }}>
                                            <FaShieldHalved size={13} color="#f59e0b" />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Rule 2 — Critical Substations in Restricted Stages</span>
                                        </div>
                                        {complianceReport.rule2_violations.length === 0 ? (
                                            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>No violations</div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc' }}>
                                                        {['Substation', 'Restricted Stage(s)'].map(h => (
                                                            <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {complianceReport.rule2_violations.map((v, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#0f172a' }}>{v.substation_id}</td>
                                                            <td style={{ padding: '0.65rem 1rem', color: '#b45309' }}>{v.stages.map(s => s.stage_label).join(', ')}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── COMPARISON TAB ───────────────────────────────────── */}
                    {activeTab === 'comparison' && (
                        <div style={{ padding: '0rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Version selector card */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1.5rem',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '0.75rem 1.25rem',
                                flexWrap: 'wrap'
                            }}>
                                {/* Scheme type setup group */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                                        Scheme Type
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        {availableSchemeTypes.map(type => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setCompSchemeType(type);
                                                    setCompVersionA(null); setCompVersionB(null);
                                                    setCompStagesA([]); setCompStagesB([]);
                                                }}
                                                style={{
                                                    padding: '4px 14px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                                                    border: compSchemeType === type ? 'none' : '1px solid #e2e8f0',
                                                    background: compSchemeType === type ? 'linear-gradient(135deg, #047d60, #059669)' : '#fff',
                                                    color: compSchemeType === type ? '#fff' : '#475569',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                    fontFamily: "'Poppins', sans-serif",
                                                }}
                                            >{type}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div style={{ width: '1px', height: '32px', background: '#e2e8f0', flexShrink: 0 }} />

                                {/* Version dropdowns */}
                                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {[
                                        { label: 'Newer Version (Subject)', val: compVersionA, setter: setCompVersionA, other: compVersionB },
                                        { label: 'Compare Against (Baseline)', val: compVersionB, setter: setCompVersionB, other: compVersionA },
                                    ].map(({ label, val, setter, other }) => (
                                        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{label}</span>
                                            <select
                                                value={val?.id || ''}
                                                onChange={e => {
                                                    const chosen = compVersionsForType.find(v => v.id === e.target.value);
                                                    setter(chosen || null);
                                                    const newA = label.startsWith('Newer') ? chosen : compVersionA;
                                                    const newB = label.startsWith('Compare') ? chosen : compVersionB;
                                                    if (newA && newB && newA.id !== newB.id) fetchComparisonStages(newA, newB);
                                                }}
                                                style={{
                                                    height: '34px', padding: '0 32px 0 10px', fontSize: '0.82rem',
                                                    fontFamily: "'Poppins', sans-serif", fontWeight: 600, color: '#0f172a',
                                                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                                                    cursor: 'pointer', outline: 'none', minWidth: '200px', appearance: 'none',
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                                                }}
                                            >
                                                <option value="">— Select version —</option>
                                                {compVersionsForType.map(v => (
                                                    <option key={v.id} value={v.id} disabled={v.id === other?.id}>
                                                        {getVersionLabel(v)} {v.is_active ? '(Active)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary + view toggle */}
                            {comparisonRows.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    {Object.entries(CHANGE_META).map(([type, meta]) => (
                                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', background: meta.bg, border: `1px solid ${meta.border}` }}>
                                            <span style={{ fontSize: '1rem', fontWeight: 700, color: meta.color, lineHeight: 1 }}>{compSummary[type]}</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                        {[{ id: 'change-type', label: 'By Change Type' }, { id: 'stage', label: 'By Stage' }].map(opt => (
                                            <button key={opt.id} onClick={() => setCompGroupBy(opt.id)} style={{
                                                padding: '6px 14px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                                                fontFamily: "'Poppins', sans-serif", cursor: 'pointer', transition: 'all 0.15s',
                                                background: compGroupBy === opt.id ? '#0f172a' : '#f8fafc',
                                                color: compGroupBy === opt.id ? '#fff' : '#64748b',
                                                border: compGroupBy === opt.id ? 'none' : '1px solid #e2e8f0',
                                            }}>{opt.label}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            {loadingComp ? (
                                <div style={{ display: 'flex', height: '12rem', alignItems: 'center', justifyContent: 'center' }}>
                                    <RefreshCw size={24} style={{ color: '#94a3b8' }} className="animate-spin" />
                                </div>
                            ) : !compVersionA || !compVersionB ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '10rem', gap: '0.75rem' }}>
                                    <FaCodeBranch size={36} style={{ color: '#e2e8f0' }} />
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Select two versions to compare</div>
                                </div>
                            ) : comparisonRows.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem' }}>
                                    No data to compare. Ensure both versions have bay assignments.
                                </div>
                            ) : (
                                <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    {/* Table header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 220px', gap: '0.75rem', padding: '0.6rem 1rem', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
                                        {['Substation', 'ID', 'Region', 'Feeder', 'Change'].map((h, i) => (
                                            <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                                        ))}
                                    </div>

                                    {/* Rows grouped */}
                                    <div style={{ overflowY: 'auto', maxHeight: '520px' }}>
                                        {compGroupBy === 'change-type' ? (
                                            // Group by change type: New → Revised → Defeated → Unchanged
                                            ['new', 'revised', 'defeated', 'unchanged'].map(ct => {
                                                const rows = comparisonRows
                                                    .filter(r => r.changeType === ct)
                                                    .sort((a, b) =>
                                                        (a.region || '').localeCompare(b.region || '') ||
                                                        (a.substationId || '').localeCompare(b.substationId || '')
                                                    );
                                                if (rows.length === 0) return null;
                                                const meta = CHANGE_META[ct];
                                                return (
                                                    <div key={ct}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: meta.bg, borderBottom: `1px solid ${meta.border}`, borderTop: '1px solid #f1f5f9' }}>
                                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{meta.label}</span>
                                                            <span style={{ fontSize: '0.62rem', color: meta.color, opacity: 0.7 }}>{rows.length} assignment{rows.length !== 1 ? 's' : ''}</span>
                                                        </div>
                                                        {rows.map((row, i) => (
                                                            <ComparisonRow key={i} row={row} meta={meta} />
                                                        ))}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            // Group by newer version's stage
                                            (() => {
                                                const CT_ORDER = { new: 0, revised: 1, defeated: 2, unchanged: 3 };
                                                const stageGroups = new Map();
                                                comparisonRows.forEach(row => {
                                                    const key = row.changeType === 'defeated' ? '__defeated__' : row.stageLabel;
                                                    if (!stageGroups.has(key)) stageGroups.set(key, { label: key, color: row.stageColor, rows: [] });
                                                    stageGroups.get(key).rows.push(row);
                                                });
                                                return [...stageGroups.entries()].map(([key, group]) => {
                                                    group.rows.sort((a, b) =>
                                                        (CT_ORDER[a.changeType] ?? 9) - (CT_ORDER[b.changeType] ?? 9) ||
                                                        (a.region || '').localeCompare(b.region || '') ||
                                                        (a.substationId || '').localeCompare(b.substationId || '')
                                                    );
                                                    return (
                                                        <div key={key}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', borderTop: '1px solid #f1f5f9' }}>
                                                                {key !== '__defeated__' && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: group.color, flexShrink: 0 }} />}
                                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: key === '__defeated__' ? '#dc2626' : '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                                    {key === '__defeated__' ? 'Defeated (Removed from newer version)' : group.label}
                                                                </span>
                                                                <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{group.rows.length} assignment{group.rows.length !== 1 ? 's' : ''}</span>
                                                            </div>
                                                            {group.rows.map((row, i) => (
                                                                <ComparisonRow key={i} row={row} meta={CHANGE_META[row.changeType]} />
                                                            ))}
                                                        </div>
                                                    );
                                                });
                                            })()
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* ── Export column picker modal ──────────────────────────────────── */}
            {showExportModal && (() => {
                const colMap = Object.fromEntries(EXPORT_COLUMNS.map(c => [c.key, c]));
                const activeCols = exportColOrder.filter(k => selectedExportCols.has(k)).map(k => colMap[k]);
                const previewRows = filteredRows.filter(r => r.type !== 'pocket_header').slice(0, 5);
                const totalRows = filteredRows.filter(r => r.type !== 'pocket_header').length;
                const compMap = new Map();
                exportCompRows.forEach(r => {
                    compMap.set(`${r.substationId}||${r.feeder}||${r.type === 'pocket_boundary' ? 'pocket' : r.type}`, r);
                });
                const defeatedPreviewRows = selectedExportCols.has('comparison')
                    ? exportCompRows.filter(r => r.changeType === 'defeated')
                    : [];

                return (
                    <div
                        onClick={() => setShowExportModal(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'rgba(15, 23, 42, 0.45)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '1rem',
                        }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#fff', borderRadius: '14px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                                display: 'flex', flexDirection: 'column',
                                width: 'min(92vw, 1000px)', maxHeight: '88vh',
                                overflow: 'hidden',
                            }}
                        >
                            {/* ── Modal header ─────────────────────────────── */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                <div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Export to Excel</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                        {totalRows} row{totalRows !== 1 ? 's' : ''} · {activeCols.length} column{activeCols.length !== 1 ? 's' : ''} selected
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* ── Two-panel body ───────────────────────────── */}
                            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                                {/* Left panel — column picker */}
                                <div style={{ width: '240px', flexShrink: 0, borderRight: '1px solid #f1f5f9', padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {/* Select all / none */}
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        {[['All', true], ['None', false]].map(([label, all]) => (
                                            <button
                                                key={label}
                                                onClick={() => setSelectedExportCols(
                                                    all ? new Set(EXPORT_COLUMNS.filter(c => c.key !== 'comparison' || !!prevPublishedScheme).map(c => c.key)) : new Set()
                                                )}
                                                style={{
                                                    fontSize: '0.7rem', fontWeight: 600, padding: '3px 9px',
                                                    background: '#f8fafc', border: '1px solid #e2e8f0',
                                                    borderRadius: '5px', cursor: 'pointer', color: '#475569',
                                                    fontFamily: "'Poppins', sans-serif",
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Assignment columns — drag to reorder */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        {exportColOrder.map((key, idx) => {
                                            const col = colMap[key];
                                            if (!col) return null;
                                            const isCompCol = col.key === 'comparison';
                                            const disabled = isCompCol && !prevPublishedScheme;
                                            const checked = !disabled && selectedExportCols.has(col.key);
                                            return (
                                                <div
                                                    key={col.key}
                                                    draggable
                                                    onDragStart={() => { dragIdx.current = idx; }}
                                                    onDragOver={e => e.preventDefault()}
                                                    onDrop={() => {
                                                        const from = dragIdx.current;
                                                        if (from === null || from === idx) return;
                                                        const next = [...exportColOrder];
                                                        next.splice(idx, 0, next.splice(from, 1)[0]);
                                                        setExportColOrder(next);
                                                        dragIdx.current = null;
                                                    }}
                                                    onDragEnd={() => { dragIdx.current = null; }}
                                                    title={disabled ? 'No previous published version available' : 'Drag to reorder'}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        padding: '0.45rem 0.65rem',
                                                        borderRadius: '7px',
                                                        background: disabled ? '#f1f5f9' : checked ? 'rgba(4, 125, 96, 0.06)' : '#f8fafc',
                                                        border: `1px solid ${disabled ? '#e2e8f0' : checked ? 'rgba(4, 125, 96, 0.25)' : '#e2e8f0'}`,
                                                        opacity: disabled ? 0.5 : 1,
                                                        transition: 'all 0.12s',
                                                        cursor: 'grab',
                                                        userSelect: 'none',
                                                    }}
                                                >
                                                    <GripVertical size={12} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                                    <label
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', flex: 1, minWidth: 0 }}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={disabled}
                                                            onChange={() => {
                                                                if (disabled) return;
                                                                const next = new Set(selectedExportCols);
                                                                checked ? next.delete(col.key) : next.add(col.key);
                                                                setSelectedExportCols(next);
                                                            }}
                                                            style={{ accentColor: '#047d60', width: '13px', height: '13px', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                                                        />
                                                        <span style={{ fontSize: '0.76rem', fontWeight: 500, color: disabled ? '#94a3b8' : checked ? '#047d60' : '#64748b' }}>
                                                            {col.label}
                                                            {isCompCol && prevPublishedScheme && (
                                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 400, display: 'block', lineHeight: 1.2 }}>
                                                                    vs {getVersionLabel(prevPublishedScheme)}
                                                                </span>
                                                            )}
                                                            {isCompCol && !prevPublishedScheme && (
                                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 400, display: 'block', lineHeight: 1.2 }}>
                                                                    No prev. version
                                                                </span>
                                                            )}
                                                        </span>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>

                                </div>

                                {/* Right panel — live preview */}
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '0.6rem', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                                            Preview
                                        </span>
                                        <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                                            (first {Math.min(5, totalRows)} of {totalRows} rows)
                                        </span>
                                    </div>

                                    {activeCols.length === 0 ? (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '0.8rem' }}>
                                            Select at least one column
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: "'Poppins', sans-serif" }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                                        {activeCols.map(col => (
                                                            <th key={col.key} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                {col.label}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {previewRows.map((row, i) => {
                                                        const enriched = { ...row, _compRow: compMap.get(`${row.substationId}||${row.feeder}||${row.type === 'pocket_boundary' ? 'pocket' : row.type}`) || null };
                                                        return (
                                                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                                {activeCols.map(col => {
                                                                    const val = col.getValue(enriched);
                                                                    return (
                                                                        <td key={col.key} style={{ padding: '0.45rem 0.75rem', color: val !== '' && val != null ? '#0f172a' : '#cbd5e1', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {val !== '' && val != null ? String(val) : '—'}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {defeatedPreviewRows.length > 0 && (
                                        <div style={{ flexShrink: 0, padding: '0.5rem 0.75rem', borderRadius: '7px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', fontSize: '0.72rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontWeight: 700 }}>{defeatedPreviewRows.length}</span>
                                            defeated entr{defeatedPreviewRows.length === 1 ? 'y' : 'ies'} (removed from current scheme) will appear at the bottom of the sheet.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Footer actions ───────────────────────────── */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    style={{
                                        padding: '0 16px', height: '36px', borderRadius: '8px',
                                        background: '#f8fafc', border: '1px solid #e2e8f0',
                                        fontSize: '0.8rem', fontWeight: 600, color: '#64748b',
                                        cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    disabled={activeCols.length === 0}
                                    style={{
                                        padding: '0 16px', height: '36px', borderRadius: '8px',
                                        background: activeCols.length > 0 ? 'linear-gradient(135deg, #047d60, #059669)' : '#e2e8f0',
                                        border: 'none',
                                        fontSize: '0.8rem', fontWeight: 600,
                                        color: activeCols.length > 0 ? '#fff' : '#94a3b8',
                                        cursor: activeCols.length > 0 ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        fontFamily: "'Poppins', sans-serif",
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <Download size={14} />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
};

export default LoadSheddingSchemeReviewer;
