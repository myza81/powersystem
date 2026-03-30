import React, { useState, useEffect, useMemo } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Search,
    RefreshCw,
    Download,
    X,
    Calendar,
    Hash,
    Users,
    Table,
    FileText,
    Unlock,
    TriangleAlert,
    FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FaBolt, FaCodeBranch, FaShieldHalved, FaLayerGroup, FaCircleNodes, FaTableList } from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import CompactRegionalMetrics from './CompactRegionalMetrics';

// ==========================================
// HELPERS
// ==========================================
const formatMW = (val, decimals = 1) => {
    if (val == null || isNaN(val)) return '0.0';
    return Number(val).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const formatDate = (ds) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });
};

const getVersionDisplayLabel = (v) => {
    if (!v) return '';
    return `${v.scheme_type} ${v.review_year} v${v.version}`;
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

const StatusBadge = ({ status, isActive }) => {
    const config = isActive
        ? { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399', label: 'Active' }
        : status === 'deactivated'
            ? { bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.25)', color: '#fbbf24', label: 'Deactivated' }
            : { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', label: status };

    return (
        <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '3px 10px',
            borderRadius: '999px',
            background: config.bg,
            border: `1px solid ${config.border}`,
            color: config.color,
            lineHeight: 1,
            whiteSpace: 'nowrap',
        }}>
            {config.label}
        </span>
    );
};

const MetricPill = ({ icon, label, value, unit, color = 'var(--accent-cyan)' }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.6rem 1rem',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        minWidth: '140px',
    }}>
        <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: `${color}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: color,
            flexShrink: 0,
        }}>
            {icon}
        </div>
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {value} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{unit}</span>
            </div>
        </div>
    </div>
);

// ==========================================
// MAIN COMPONENT
// ==========================================
const LoadSheddingViewer = () => {
    const [allVersions, setAllVersions] = useState([]);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [stageDetails, setStageDetails] = useState([]);
    const [substations, setSubstations] = useState([]);
    const [relays, setRelays] = useState([]);
    const [gridData, setGridData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingStages, setLoadingStages] = useState(false);
    const [filters, setFilters] = useState({ region: 'All', grid: 'All', state: 'All' });
    const [search, setSearch] = useState('');
    const [expandedStages, setExpandedStages] = useState({});
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showUnpublishModal, setShowUnpublishModal] = useState(false);
    const [unpublishing, setUnpublishing] = useState(false);

    // Only show published versions (active + deactivated)
    const publishedVersions = useMemo(() =>
        allVersions.filter(v => v.status === 'active' || v.status === 'deactivated'),
        [allVersions]
    );

    // ==========================================
    // DATA FETCHING
    // ==========================================
    const fetchVersions = async () => {
        try {
            const [vRes, sRes, rRes, aRes] = await Promise.all([
                api.get('/load-shedding-versions/'),
                api.get('/substations/'),
                api.get('/load-shedding-relays/'),
                api.get('/load-analytics/aggregate/?level=grid')
            ]);
            
            setAllVersions(vRes.data);
            setSubstations(sRes.data);
            setRelays(rRes.data);
            setGridData(aRes.data);

            const published = vRes.data.filter(v => v.status === 'active' || v.status === 'deactivated');
            const active = published.find(v => v.is_active);
            if (active) handleSelectScheme(active);
            else if (published.length > 0) handleSelectScheme(published[0]);
        } catch (err) {
            console.error('Failed to fetch versions or master data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectScheme = async (scheme) => {
        setSelectedScheme(scheme);
        if (!scheme) return;
        setLoadingStages(true);
        try {
            const res = await api.get(`/load-shedding-stages/?version=${scheme.id}&include_bays=true`);
            setStageDetails(res.data || []);
            // Auto-expand the first stage
            if (res.data?.length > 0) {
                setExpandedStages({ [res.data[0].id]: true });
            }
        } catch (err) {
            console.error('Failed to fetch stage details', err);
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


    // ==========================================
    // COMPUTED METRICS
    // ==========================================
    const schemeMetrics = useMemo(() => {
        let totalMW = 0;
        let totalPockets = 0;
        const substationSet = new Set();
        const regionalAssigned = {}; // region -> mw

        stageDetails.forEach(stage => {
            (stage.transformer_bays || []).forEach(bay => {
                const mw = bay.mw_cache?.mw || 0;
                totalMW += mw;
                if (bay.relay_substation_id) substationSet.add(bay.relay_substation_id);
                
                // Track regional for charts
                const sub = substations.find(s => s.substation_id === bay.relay_substation_id);
                if (sub) {
                    regionalAssigned[sub.region] = (regionalAssigned[sub.region] || 0) + mw;
                }
            });
            (stage.pocket_bays || []).forEach(pocket => {
                const mw = pocket.topology_cache?.mw || 0;
                const subMWMap = pocket.topology_cache?.substation_mw || {};
                totalMW += mw;
                totalPockets++;
                
                (pocket.topology_cache?.isolated_substations || []).forEach(subId => {
                    substationSet.add(subId);
                    const sub = substations.find(s => s.substation_id === subId);
                    if (sub) {
                        // Use per-substation MW if available in cache, otherwise distribute proportionally to total substation load
                        let assignedToSub = 0;
                        if (subMWMap[subId]?.total_p_mw != null) {
                            assignedToSub = subMWMap[subId].total_p_mw;
                        } else {
                            // FALLBACK: Proportional distribution based on total_pload_mw of substations in the pocket
                            const totalLoadInPocket = (pocket.topology_cache?.isolated_substations || []).reduce((sum, sId) => {
                                const s = substations.find(srv => srv.substation_id === sId);
                                return sum + (parseFloat(s?.total_pload_mw) || 0);
                            }, 0);
                            
                            if (totalLoadInPocket > 0) {
                                assignedToSub = ((parseFloat(sub.total_pload_mw) || 0) / totalLoadInPocket) * mw;
                            } else {
                                assignedToSub = mw / (pocket.topology_cache?.isolated_substations?.length || 1);
                            }
                        }
                        regionalAssigned[sub.region] = (regionalAssigned[sub.region] || 0) + assignedToSub;
                    }
                });
            });
        });

        return {
            totalMW,
            stageCount: stageDetails.length,
            substationCount: substationSet.size,
            pocketCount: totalPockets,
            regionalAssigned,
        };
    }, [stageDetails, substations]);

    const regionalSpiralData = useMemo(() => {
        if (!gridData?.regional_breakdown) return [];
        const targetPercent = selectedScheme?.target_percentage != null 
            ? parseFloat(selectedScheme.target_percentage) 
            : (selectedScheme?.scheme_type === 'UVLS' ? 15 : 60);
        return gridData.regional_breakdown.map(reg => ({
            region: reg.region,
            target_mw: (targetPercent / 100) * reg.total_pload_mw,
            assigned_mw: schemeMetrics.regionalAssigned[reg.region] || 0
        }));
    }, [gridData, schemeMetrics, selectedScheme]);

    const getSummaryRows = () => {
        const rows = [];
        stageDetails.forEach(stage => {
            const settingCells = {
                threshold1: stage.settings?.[0]?.threshold ?? 'n/a',
                delay1: stage.settings?.[0]?.time_delay ?? 'n/a',
                threshold2: stage.settings?.[1]?.threshold ?? 'n/a',
                delay2: stage.settings?.[1]?.time_delay ?? 'n/a',
            };

            // Transformer Bays
            (stage.transformer_bays || []).forEach(bay => {
                const sub = substations.find(s => s.substation_id === bay.relay_substation_id);
                const relay = relays.find(r => r.id === bay.relay);
                const selectedIds = (bay.transformers || []).map(t => typeof t === 'object' ? t.id : t);
                const selectedTransformers = (relay?.load_transformers || []).filter(t => selectedIds.includes(typeof t === 'object' ? t.id : t));

                const assignedFeeder = selectedTransformers.length > 0
                    ? selectedTransformers.map(t => `T${t.transformer_no}`).join(' & ')
                    : (bay.transformers || []).map(t => typeof t === 'object' ? `T${t.id}` : `T${t}`).join(' & ');

                const breakerNumber = selectedTransformers
                    .map(t => t.lv_breaker_number)
                    .filter(Boolean)
                    .join(' & ') || 'n/a';

                const voltageRaw = selectedTransformers.map(t => t.lv_voltage).filter(Boolean);
                const voltage = voltageRaw.length > 0 ? [...new Set(voltageRaw)].join(' & ') : '';

                rows.push({
                    stageLabel: stage.label,
                    grid: sub?.grid || '',
                    substationName: sub?.name || bay.relay_substation_name || '',
                    substationId: sub?.substation_id || bay.relay_substation_id || '',
                    voltage: voltage || sub?.voltage || '',
                    assignedFeeder: assignedFeeder || 'n/a',
                    breakerNumber,
                    ...settingCells,
                });
            });
            // Pocket Bays
            (stage.pocket_bays || []).forEach(pocket => {
                (pocket.boundaries || []).forEach(boundary => {
                    const sub = substations.find(s => s.substation_id === boundary.relay_substation_id);
                    rows.push({
                        stageLabel: stage.label,
                        grid: sub?.grid || '',
                        substationName: sub?.name || boundary.relay_substation_name || '',
                        substationId: sub?.substation_id || boundary.relay_substation_id || '',
                        voltage: sub?.voltage || '',
                        assignedFeeder: `Boundary: ${boundary.relay_name}`,
                        breakerNumber: 'n/a',
                        ...settingCells,
                    });
                });
            });
        });
        return rows;
    };

    const handleUnpublish = async () => {
        if (!selectedScheme) return;
        setUnpublishing(true);
        try {
            await api.post(`/load-shedding-versions/${selectedScheme.id}/unpublish/`);
            setShowUnpublishModal(false);
            window.dispatchEvent(new CustomEvent('load-shedding-published'));
            await fetchVersions();
        } catch (err) {
            console.error('Failed to unpublish', err);
            alert(`Failed to unpublish: ${err?.response?.data?.error || err.message}`);
        } finally {
            setUnpublishing(false);
        }
    };

    const handleExportCSV = () => {
        const rows = getSummaryRows();
        if (rows.length === 0) return;
        const schemeType = selectedScheme?.scheme_type || 'LoadShedding';
        const fileName = `${schemeType}_${selectedScheme?.review_year}_v${selectedScheme?.version}`;
        const headers = ['Stage', 'Grid', 'Substation', 'Substation ID', 'Voltage', 'Assigned feeder', 'Breaker number', 'Threshold Setting 1', 'Time Delay 1', 'Threshold Setting 2', 'Time Delay 2'];
        const csvContent = [
            headers.join(','),
            ...rows.map(r => [
                r.stageLabel, r.grid, `"${r.substationName}"`, r.substationId, r.voltage, `"${r.assignedFeeder}"`, r.breakerNumber, r.threshold1, r.delay1, r.threshold2, r.delay2
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportExcel = () => {
        const rows = getSummaryRows();
        if (rows.length === 0) return;
        
        const schemeType = selectedScheme?.scheme_type || 'LoadShedding';
        const fileName = `${schemeType}_${selectedScheme?.review_year}_v${selectedScheme?.version}`;
        
        const disclaimer = `⚠ UNCONTROLLED COPY - For internal use only. Verify against the published system before acting.`;
        const versionInfo = `${schemeType} Scheme: ${selectedScheme?.review_year} v${selectedScheme?.version} | Exported: ${new Date().toLocaleString()}`;
        const headers = ['Stage', 'Grid', 'Substation', 'Substation ID', 'Voltage', 'Assigned feeder', 'Breaker number', 'Threshold Setting 1', 'Time Delay 1', 'Threshold Setting 2', 'Time Delay 2'];
        const data = rows.map(r => [
            r.stageLabel, r.grid, r.substationName, r.substationId, r.voltage, r.assignedFeeder, r.breakerNumber, r.threshold1, r.delay1, r.threshold2, r.delay2
        ]);
        
        const ws = XLSX.utils.aoa_to_sheet([[disclaimer], [versionInfo], headers, ...data]);
        
        // Style the disclaimer rows
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, schemeType);
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    const getStageMW = (stage) => {
        const txMW = (stage.transformer_bays || []).reduce((acc, b) => acc + (b.mw_cache?.mw || 0), 0);
        const pocketMW = (stage.pocket_bays || []).reduce((acc, b) => acc + (b.topology_cache?.mw || 0), 0);
        return txMW + pocketMW;
    };

    // ==========================================
    // FILTERING
    // ==========================================
    const getFilteredBays = (stage) => {
        const txBays = (stage.transformer_bays || []).filter(bay => {
            if (search) {
                const q = search.toLowerCase();
                const matchName = (bay.relay_substation_name || '').toLowerCase().includes(q);
                const matchId = (bay.relay_substation_id || '').toLowerCase().includes(q);
                const matchRelay = (bay.relay_name || '').toLowerCase().includes(q);
                if (!matchName && !matchId && !matchRelay) return false;
            }
            return true;
        });

        const pocketBays = (stage.pocket_bays || []).filter(pocket => {
            if (search) {
                const q = search.toLowerCase();
                const matchBoundary = (pocket.boundaries || []).some(b =>
                    (b.relay_substation_name || '').toLowerCase().includes(q) ||
                    (b.relay_substation_id || '').toLowerCase().includes(q)
                );
                const matchIsolated = (pocket.topology_cache?.isolated_substations || []).some(subId =>
                    String(subId).toLowerCase().includes(q)
                );
                if (!matchBoundary && !matchIsolated) return false;
            }
            return true;
        });

        return { txBays, pocketBays };
    };

    // ==========================================
    // RENDER
    // ==========================================
    if (loading) {
        return (
            <div style={{ display: 'flex', height: '16rem', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw className="animate-spin" style={{ color: 'var(--accent-cyan)' }} size={32} />
            </div>
        );
    }

    if (publishedVersions.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '24rem', gap: '1rem', fontFamily: "'Inter', sans-serif" }}>
                <FaShieldHalved size={48} style={{ color: 'rgba(255,255,255,0.1)' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No Published Schemes</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', maxWidth: '400px', textAlign: 'center' }}>
                    No load shedding schemes have been published yet. Use the Stage Designer to create and publish a scheme.
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem', fontFamily: "'Inter', sans-serif" }}>

            {/* ======================================== */}
            {/* HEADER: Version Selector + Scheme Info   */}
            {/* ======================================== */}
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* Left: Scheme Identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(0, 229, 255, 0.05) 100%)',
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <FaShieldHalved size={18} style={{ color: 'var(--accent-cyan)' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                                    {selectedScheme ? getVersionDisplayLabel(selectedScheme) : 'Select Scheme'}
                                </span>
                                {selectedScheme && <StatusBadge status={selectedScheme.status} isActive={selectedScheme.is_active} />}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {selectedScheme?.notes && <span>{selectedScheme.notes}</span>}
                                {selectedScheme?.published_at && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={10} /> Published {formatDate(selectedScheme.published_at)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Version Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select
                            className="input-field"
                            value={selectedScheme?.id || ''}
                            onChange={(e) => {
                                const v = publishedVersions.find(s => s.id === e.target.value);
                                if (v) handleSelectScheme(v);
                            }}
                            style={{ padding: '8px 12px', fontSize: '0.8rem', minWidth: '220px', borderRadius: '8px', height: '38px' }}
                        >
                            {publishedVersions.map(v => (
                                <option key={v.id} value={v.id}>
                                    {getVersionDisplayLabel(v)} {v.is_active ? '✓' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Metrics & Charts Row */}
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                    {/* Left: Metric Pills */}
                    <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <MetricPill
                                icon={<FaBolt size={15} />}
                                label="Total Scheme MW"
                                value={formatMW(schemeMetrics.totalMW)}
                                unit="MW"
                                color="#34d399"
                            />
                            <MetricPill
                                icon={<FaLayerGroup size={14} />}
                                label="Stages"
                                value={schemeMetrics.stageCount}
                                unit=""
                                color="var(--accent-cyan)"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <MetricPill
                                icon={<FaCircleNodes size={14} />}
                                label="Substations"
                                value={schemeMetrics.substationCount}
                                unit=""
                                color="var(--accent-blue)"
                            />
                            <MetricPill
                                icon={<FaCodeBranch size={14} />}
                                label="Network Pockets"
                                value={schemeMetrics.pocketCount}
                                unit=""
                                color="#a78bfa"
                            />
                        </div>
                    </div>

                    {/* Right: Regional Target Chart */}
                    {gridData && (
                        <div style={{ flex: '3 1 400px', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '2rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '0.5rem' }}>Regional Target vs Assigned</div>
                            <CompactRegionalMetrics 
                                data={regionalSpiralData}
                                labelKey="region"
                                valueKey="assigned_mw"
                                targetKey="target_mw"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ======================================== */}
            {/* FILTER BAR                               */}
            {/* ======================================== */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
                    <Search size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        className="input-field"
                        placeholder="Search substation or relay..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            paddingLeft: '2.2rem',
                            paddingRight: search ? '2.2rem' : '0.75rem',
                            width: '100%',
                            height: '36px',
                            fontSize: '0.8rem',
                            borderRadius: '8px',
                        }}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            type="button"
                            style={{
                                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                width: '22px', height: '22px', borderRadius: '999px',
                                border: 'none', background: 'rgba(255,255,255,0.06)',
                                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', padding: 0, transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Region Filter */}
                <select
                    className="input-field"
                    value={filters.region}
                    onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                    style={{ padding: '8px 12px', fontSize: '0.8rem', height: '36px', borderRadius: '8px', width: '140px', flex: '0 0 auto' }}
                >
                    {['All', 'North', 'Central', 'South', 'East'].map(r => (
                        <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
                    ))}
                </select>

                {/* Grid Filter */}
                <select
                    className="input-field"
                    value={filters.grid}
                    onChange={(e) => setFilters(prev => ({ ...prev, grid: e.target.value }))}
                    style={{ padding: '8px 12px', fontSize: '0.8rem', height: '36px', borderRadius: '8px', width: '140px', flex: '0 0 auto' }}
                >
                    {['All', 'National Grid', 'Islanding'].map(g => (
                        <option key={g} value={g}>{g === 'All' ? 'All Grids' : g}</option>
                    ))}
                </select>

                {/* State Filter */}
                <select
                    className="input-field"
                    value={filters.state}
                    onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                    style={{ padding: '8px 12px', fontSize: '0.8rem', height: '36px', borderRadius: '8px', width: '140px', flex: '0 0 auto' }}
                >
                    {['All', 'Kuala Lumpur', 'Selangor', 'Johor', 'Penang', 'Perak', 'Pahang', 'Sabah', 'Sarawak'].map(s => (
                        <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>
                    ))}
                </select>

                <div style={{ flex: 1 }} />

                <button
                    onClick={() => setShowSummaryModal(true)}
                    style={{ 
                        background: 'rgba(0, 229, 255, 0.08)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(0, 229, 255, 0.25)',
                        color: 'var(--accent-cyan)',
                        padding: '6px 14px', 
                        borderRadius: '8px', 
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        whiteSpace: 'nowrap',
                        height: '36px',
                    }}
                    onMouseEnter={(e) => { 
                        e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)'; 
                        e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.5)';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.2)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => { 
                        e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)'; 
                        e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.25)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <FaTableList size={13} style={{ opacity: 0.9 }} />
                    <span>Table View</span>
                </button>

                {selectedScheme?.is_active && (
                    <button
                        className="unpublish-btn"
                        onClick={() => setShowUnpublishModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            borderRadius: '8px', padding: '0 14px', fontSize: '0.8rem', height: '36px',
                        }}
                    >
                        <Unlock size={14} /> Unpublish
                    </button>
                )}
            </div>

            {/* ======================================== */}
            {/* STAGE CONTENT                            */}
            {/* ======================================== */}
            {loadingStages ? (
                <div style={{ display: 'flex', height: '10rem', alignItems: 'center', justifyContent: 'center' }}>
                    <RefreshCw className="animate-spin" style={{ color: 'var(--accent-cyan)' }} size={24} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {stageDetails.map((stage, idx) => {
                        const isExpanded = expandedStages[stage.id];
                        const stageMW = getStageMW(stage);
                        const { txBays, pocketBays } = getFilteredBays(stage);
                        const txCount = txBays.length;
                        const pocketCount = pocketBays.length;

                        return (
                            <div key={stage.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Stage Header */}
                                <div
                                    onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: !prev[stage.id] }))}
                                    style={{
                                        padding: '0.85rem 1.25rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        background: isExpanded ? 'rgba(0, 229, 255, 0.03)' : 'transparent',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ color: 'var(--accent-cyan)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                            <ChevronRight size={16} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{stage.label}</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '4px' }}>
                                                {stage.settings?.length > 0 ? stage.settings.map(s => (
                                                    <span key={s.id} style={{
                                                        fontSize: '0.6rem',
                                                        background: 'rgba(0, 229, 255, 0.08)',
                                                        border: '1px solid rgba(0, 229, 255, 0.15)',
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        color: 'var(--accent-cyan)',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {s.label?.replace(', ', ' | ')}
                                                    </span>
                                                )) : (
                                                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>No threshold settings</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>TX Bays</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{txCount}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Pockets</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{pocketCount}</div>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '4px 12px', borderRadius: '8px',
                                            background: 'rgba(52, 211, 153, 0.08)',
                                            border: '1px solid rgba(52, 211, 153, 0.15)',
                                        }}>
                                            <div style={{ fontSize: '0.55rem', color: 'rgba(52, 211, 153, 0.7)', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#34d399' }}>{formatMW(stageMW)} MW</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: 'auto' }}
                                            exit={{ height: 0 }}
                                            style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                                        >
                                            <div style={{ background: 'rgba(0,0,0,0.15)' }}>
                                                {/* Unified Table */}
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                        <thead>
                                                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Substation ID</th>
                                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Substation Name</th>
                                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Relay / Boundary</th>
                                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MW</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {/* Transformer Bays */}
                                                            {txBays.map(bay => (
                                                                <tr key={bay.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    <td style={{ padding: '0.65rem 1rem' }}>
                                                                        <div style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                            padding: '2px 8px', borderRadius: '999px',
                                                                            background: 'rgba(0, 229, 255, 0.08)',
                                                                            border: '1px solid rgba(0, 229, 255, 0.15)',
                                                                            fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-cyan)',
                                                                        }}>
                                                                            <FaBolt size={9} /> TX
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent-cyan)', opacity: 0.8 }}>
                                                                        {bay.relay_substation_id || '—'}
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', fontWeight: 500 }}>
                                                                        {bay.relay_substation_name || '—'}
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                                        {bay.relay_name || '—'}
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                                                        {formatMW(bay.mw_cache?.mw || 0)}
                                                                    </td>
                                                                </tr>
                                                            ))}

                                                            {/* Pocket Bays */}
                                                            {pocketBays.map(pocket => (
                                                                <tr key={pocket.id} style={{
                                                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                                    background: 'rgba(167, 139, 250, 0.02)',
                                                                    transition: 'background 0.15s',
                                                                }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(167, 139, 250, 0.05)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(167, 139, 250, 0.02)'}
                                                                >
                                                                    <td style={{ padding: '0.65rem 1rem' }}>
                                                                        <div style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                            padding: '2px 8px', borderRadius: '999px',
                                                                            background: 'rgba(167, 139, 250, 0.1)',
                                                                            border: '1px solid rgba(167, 139, 250, 0.2)',
                                                                            fontSize: '0.65rem', fontWeight: 700, color: '#a78bfa',
                                                                        }}>
                                                                            <FaCodeBranch size={9} /> Pocket
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#a78bfa', opacity: 0.8 }}>
                                                                        {(pocket.topology_cache?.isolated_substations || []).join(', ') || '—'}
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', fontWeight: 500 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            Pocket Isolation
                                                                            <span style={{
                                                                                fontSize: '0.6rem',
                                                                                padding: '1px 6px', borderRadius: '4px',
                                                                                background: pocket.topology_valid ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                                color: pocket.topology_valid ? '#34d399' : '#f87171',
                                                                                border: `1px solid ${pocket.topology_valid ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                                                                fontWeight: 600,
                                                                            }}>
                                                                                {pocket.topology_valid ? 'Valid' : 'Error'}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            {(pocket.boundaries || []).map(b => (
                                                                                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />
                                                                                    <span>{b.relay_substation_id} {b.relay_name ? `(${b.relay_name})` : ''} — {b.branches?.length || 0} ckt</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#a78bfa' }}>
                                                                        {formatMW(pocket.topology_cache?.mw || 0)}
                                                                    </td>
                                                                </tr>
                                                            ))}

                                                            {/* Empty state */}
                                                            {txBays.length === 0 && pocketBays.length === 0 && (
                                                                <tr>
                                                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                                        {search ? 'No results match your search.' : 'No assignments in this stage.'}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}

                    {stageDetails.length === 0 && !loadingStages && (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No stages found for this scheme version.
                        </div>
                    )}
                </div>
            )}

            {/* ======================================== */}
            {/* SUMMARY MODAL                            */}
            {/* ======================================== */}
            <AnimatePresence>
                {showSummaryModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '2rem',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="glass-card"
                            style={{
                                width: '100%', maxWidth: '1200px', maxHeight: '90vh',
                                display: 'flex', flexDirection: 'column', padding: 0,
                                background: 'rgba(20, 24, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)',
                            }}
                        >
                            {/* Modal Header */}
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Assignment Summary</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Workbook-style view of all {getVersionDisplayLabel(selectedScheme)} assignments.</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={handleExportCSV}
                                            className="btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', fontSize: '0.8rem' }}
                                        >
                                            <FileText size={14} /> Export CSV
                                        </button>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={handleExportExcel}
                                            className="btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', fontSize: '0.8rem' }}
                                        >
                                            <FileSpreadsheet size={14} /> Export Excel
                                        </button>
                                    </div>
                                    <button onClick={() => setShowSummaryModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content: Table */}
                            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                                            <th style={{ padding: '0.75rem' }}>Stage</th>
                                            <th style={{ padding: '0.75rem' }}>Grid</th>
                                            <th style={{ padding: '0.75rem' }}>Substation</th>
                                            <th style={{ padding: '0.75rem' }}>Substation ID</th>
                                            <th style={{ padding: '0.75rem' }}>Voltage</th>
                                            <th style={{ padding: '0.75rem' }}>Assigned feeder</th>
                                            <th style={{ padding: '0.75rem' }}>Breaker number</th>
                                            <th style={{ padding: '0.75rem' }}>Threshold Setting 1</th>
                                            <th style={{ padding: '0.75rem' }}>Time Delay 1</th>
                                            <th style={{ padding: '0.75rem' }}>Threshold Setting 2</th>
                                            <th style={{ padding: '0.75rem' }}>Time Delay 2</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getSummaryRows().length === 0 ? (
                                            <tr>
                                                <td colSpan="11" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No assignments found.</td>
                                            </tr>
                                        ) : getSummaryRows().map((row, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{row.stageLabel}</td>
                                                <td style={{ padding: '0.75rem' }}>{row.grid}</td>
                                                <td style={{ padding: '0.75rem' }}>{row.substationName}</td>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{row.substationId}</td>
                                                <td style={{ padding: '0.75rem' }}>{row.voltage}</td>
                                                <td style={{ padding: '0.75rem' }}>{row.assignedFeeder}</td>
                                                <td style={{ padding: '0.75rem' }}>{row.breakerNumber}</td>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{row.threshold1}</td>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{row.delay1}</td>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{row.threshold2}</td>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{row.delay2}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ======================================== */}
            {/* UNPUBLISH CONFIRMATION MODAL             */}
            {/* ======================================== */}
            <AnimatePresence>
                {showUnpublishModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '2rem',
                        }}
                        onClick={() => !unpublishing && setShowUnpublishModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 16 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'rgba(20, 24, 30, 0.98)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '16px',
                                padding: '2rem',
                                maxWidth: '460px',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.5rem',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                            }}
                        >
                            {/* Icon + Title */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '10px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, color: '#f87171',
                                }}>
                                    <TriangleAlert size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Unpublish Active Scheme?</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        This will revert <strong style={{ color: '#fff' }}>{getVersionDisplayLabel(selectedScheme)}</strong> back to a draft,
                                        removing it from the active system. The previous published version (if any) will be automatically restored.
                                    </div>
                                </div>
                            </div>

                            {/* Warning Banner */}
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '8px',
                                padding: '0.75rem 1rem',
                                fontSize: '0.8rem',
                                color: '#fca5a5',
                                lineHeight: 1.5,
                            }}>
                                ⚠ The unpublished version will appear as a new draft in the Stage Designer, where it can be edited or discarded.
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowUnpublishModal(false)}
                                    disabled={unpublishing}
                                    style={{
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'var(--text-secondary)', padding: '0.6rem 1.25rem',
                                        borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUnpublish}
                                    disabled={unpublishing}
                                    style={{
                                        background: unpublishing ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.85)',
                                        border: '1px solid rgba(239, 68, 68, 0.5)',
                                        color: '#fff', padding: '0.6rem 1.5rem',
                                        borderRadius: '8px', cursor: unpublishing ? 'not-allowed' : 'pointer',
                                        fontSize: '0.875rem', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        fontFamily: 'inherit', transition: 'all 0.2s',
                                    }}
                                >
                                    {unpublishing ? (
                                        <><RefreshCw size={14} className="animate-spin" /> Unpublishing...</>
                                    ) : (
                                        <><Unlock size={14} /> Confirm Unpublish</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LoadSheddingViewer;
