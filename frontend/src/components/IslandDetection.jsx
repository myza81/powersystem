
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Network, Zap, AlertTriangle, Activity, Search, MapPin, Layers, ArrowRight, AlertCircle, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/IslandDetection.css';

const IslandDetection = ({ snapshotId }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIsland, setExpandedIsland] = useState(null);
    const [missingData, setMissingData] = useState(null);

    // Deletion State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteType, setDeleteType] = useState('island'); // 'island' or 'missing_bus'
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (snapshotId) {
            fetchAnalysis();
        }
    }, [snapshotId]);

    const fetchAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const [topologyRes, missingRes] = await Promise.all([
                axios.get(`/api/v1/topology/islands/?snapshot_id=${snapshotId}`),
                axios.get(`/api/v1/load-analytics/missing-substations/?snapshot_id=${snapshotId}`)
            ]);
            setData(topologyRes.data);
            setMissingData(missingRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch analysis data');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (target, type = 'island') => {
        setDeleteTarget(target);
        setDeleteType(type);
        setShowDeleteModal(true);
    };

    const executeDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            // Determine API payload based on type
            const busIds = deleteType === 'island'
                ? deleteTarget.bus_ids
                : (Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget.id]); // Handle group or single bus

            await axios.post('/api/v1/topology/cleanup/', {
                snapshot_id: snapshotId,
                bus_ids: busIds
            });
            setShowDeleteModal(false);
            setDeleteTarget(null);
            fetchAnalysis(); // Refresh all data
        } catch (err) {
            alert('Failed to delete: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredIslands = useMemo(() => {
        if (!data) return [];
        if (!searchTerm) return data.islands;
        const lower = searchTerm.toLowerCase();
        return data.islands.filter(island =>
            island.id.toString().includes(lower) ||
            island.status.toLowerCase().includes(lower) ||
            island.substations?.some(sub => sub.name.toLowerCase().includes(lower))
        );
    }, [data, searchTerm]);

    // Statistics
    const stats = useMemo(() => {
        if (!data) return null;
        const totalIslands = data.island_count;
        const mainGrid = data.islands.find(i => i.status === 'Main Grid');
        const energizedIslands = data.islands.filter(i => i.status === 'Energized').length;
        const deenergizedIslands = data.islands.filter(i => i.status === 'De-energized').length;
        return { totalIslands, mainGridBusCount: mainGrid?.bus_count || 0, energizedIslands, deenergizedIslands };
    }, [data]);

    if (!snapshotId) {
        return (
            <div className="init-state">
                <div className="init-icon-wrapper">
                    <Network size={64} style={{ opacity: 0.5, color: 'var(--accent-cyan)' }} />
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: 500, letterSpacing: '0.025em' }}>
                    SELECT A SNAPSHOT TO INITIALIZE TOPOLOGY ENGINE
                </p>
            </div>
        );
    }

    return (
        <div className="island-dashboard">
            {/* Header & Stats */}
            <div className="dashboard-header">
                {/* Title Card */}
                <div className="title-card">
                    <div className="title-content">
                        <Activity size={24} />
                        <span style={{ letterSpacing: '-0.025em' }}>GRID TOPOLOGY</span>
                    </div>
                    <p className="snapshot-name">
                        {data ? data.snapshot : 'Initializing...'}
                    </p>
                </div>

                {/* Stat Cards */}
                <StatCard
                    label="Total Islands"
                    value={stats?.totalIslands || '-'}
                    icon={Layers}
                    color="var(--accent-blue)"
                    subLabel="Disjoint Components"
                />
                <StatCard
                    label="Main Grid Size"
                    value={stats?.mainGridBusCount || '-'}
                    icon={Network}
                    color="#10b981" /* Emerald */
                    subLabel="Connected Buses"
                />
                <StatCard
                    label="De-energized"
                    value={stats?.deenergizedIslands || '-'}
                    icon={AlertTriangle}
                    color="#fb7185" /* Rose */
                    subLabel="Risk Areas"
                />
            </div>

            {/* Controls */}
            <div className="controls-bar">
                <div className="search-wrapper">
                    <Search className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search islands, substations..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div>
                    <button
                        onClick={fetchAnalysis}
                        disabled={loading}
                        className="refresh-btn"
                    >
                        {loading ? <Activity className="animate-spin" size={16} /> : <Network size={16} />}
                        {loading ? 'Scanning...' : 'Rescan Topology'}
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="error-banner">
                    <AlertTriangle size={20} />
                    <p>{error}</p>
                </div>
            )}

            {/* Missing Substation Alert Section */}
            {missingData && missingData.has_missing && (
                <MissingDataSection
                    data={missingData}
                    onDelete={(target) => confirmDelete(target, 'missing_bus')}
                />
            )}

            {/* Main Grid Layout */}
            <div className="islands-container custom-scrollbar">
                <div className="islands-grid">
                    <AnimatePresence mode='popLayout'>
                        {filteredIslands?.map((island) => (
                            <IslandCard
                                key={island.id}
                                island={island}
                                isExpanded={expandedIsland === island.id}
                                onToggle={() => setExpandedIsland(expandedIsland === island.id ? null : island.id)}
                                onDelete={() => confirmDelete(island, 'island')}
                            />
                        ))}
                    </AnimatePresence>

                    {!loading && filteredIslands?.length === 0 && (
                        <div className="empty-state">
                            <p>No islands found matching your criteria</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && (
                <DeleteConfirmationModal
                    target={deleteTarget}
                    type={deleteType}
                    onConfirm={executeDelete}
                    onCancel={() => setShowDeleteModal(false)}
                    processing={isDeleting}
                />
            )}
        </div>
    );
};

// ... existing StatCard and IslandCard ...

// New Missing Data Section Component (Premium Design)
const MissingDataSection = ({ data, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                background: 'rgba(20, 20, 25, 0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '16px',
                marginBottom: '2rem',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(249, 115, 22, 0.1)'
            }}
        >
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.1) 0%, transparent 100%)',
                    borderBottom: isExpanded ? '1px solid rgba(249, 115, 22, 0.2)' : 'none',
                    transition: 'all 0.3s ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        padding: '10px',
                        borderRadius: '12px',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)'
                    }}>
                        <AlertTriangle size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            letterSpacing: '0.025em',
                            color: '#ffedd5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            DATA INTEGRITY ALERT
                            <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(249, 115, 22, 0.2)',
                                color: '#fb923c',
                                border: '1px solid rgba(249, 115, 22, 0.3)'
                            }}>
                                ACTION REQUIRED
                            </span>
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#fed7aa', opacity: 0.8 }}>
                            Found <strong>{data.missing_count} unmapped bus groups</strong> that are not linked to any substation master data.
                        </p>
                    </div>
                </div>

                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ color: '#fb923c' }}
                >
                    <ChevronDown size={24} />
                </motion.div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)' }}>
                            <div className="missing-list" style={{
                                display: 'grid',
                                gap: '1rem',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
                            }}>
                                {data.missing_mnemonics.map((group, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        style={{
                                            background: 'rgba(20, 20, 25, 0.8)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            padding: '1.25rem',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between'
                                        }}
                                        className="group-card-hover"
                                    >
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
                                            background: '#f97316', opacity: 0.8
                                        }} />

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'flex-start' }}>
                                                <div>
                                                    <span style={{
                                                        color: '#fdba74', fontWeight: 700, fontFamily: 'monospace',
                                                        fontSize: '1.1rem', letterSpacing: '0.05em'
                                                    }}>
                                                        {group.mnemonic}
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                                        UNKNOWN SOURCE
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                                                        {group.bus_count}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                                                        Buses
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex', gap: '8px', marginBottom: '1.25rem',
                                                background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px'
                                            }}>
                                                <div style={{ flex: 1, textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TOTAL LOAD</div>
                                                    <div style={{ color: group.total_load_mw > 0 ? '#f97316' : '#94a3b8', fontWeight: 600 }}>
                                                        {group.total_load_mw.toFixed(1)} MW
                                                    </div>
                                                </div>
                                                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                                                <div style={{ flex: 1, textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>STATUS</div>
                                                    <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <AlertCircle size={10} /> UNMAPPED
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(group.buses.map(b => b.id));
                                            }}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#f87171',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                            className="delete-group-btn"
                                        >
                                            <Trash2 size={14} /> Remove Group Artifacts
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <style>{`
                .group-card-hover:hover {
                    background: rgba(30, 30, 35, 0.9) !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                }
                .delete-group-btn:hover {
                    background: #ef4444 !important;
                    color: white !important;
                    border-color: #ef4444 !important;
                }
            `}</style>
        </motion.div>
    );
};

const StatCard = ({ label, value, icon: Icon, color, subLabel }) => (
    <div className="stat-card">
        <div className="stat-card-icon-bg" style={{ color: color }}>
            <Icon size={96} strokeWidth={1} />
        </div>
        <div className="stat-card-content">
            <div>
                <p className="stat-label">{label}</p>
                <p className="stat-value" style={{ color: color }}>{value}</p>
            </div>
            <div className="stat-icon-wrapper" style={{ borderColor: color }}>
                <Icon size={20} style={{ color: color }} />
            </div>
        </div>
        <p className="stat-sublabel">{subLabel}</p>
    </div>
);

const IslandCard = ({ island, isExpanded, onToggle, onDelete }) => {
    const isMainGrid = island.status === 'Main Grid';
    const isDeenergized = island.status === 'De-energized';

    // Status color mapping
    const statusColor = isMainGrid ? '#10b981' : isDeenergized ? '#fb7185' : '#fbbf24'; // Emerald, Rose, Amber
    const borderColor = isMainGrid ? 'rgba(16, 185, 129, 0.2)' : isDeenergized ? 'rgba(251, 113, 133, 0.2)' : 'rgba(251, 191, 36, 0.2)';
    const bgGradientStart = isMainGrid ? 'rgba(6, 78, 59, 0.2)' : isDeenergized ? 'rgba(136, 19, 55, 0.2)' : 'rgba(120, 53, 15, 0.2)';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="island-card"
            style={{
                borderColor: borderColor
            }}
        >
            {/* Card Header */}
            <div
                onClick={onToggle}
                className="island-card-header"
                style={{
                    '--card-gradient-start': bgGradientStart
                }}
            >
                <div className="island-header-row">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span
                                className="status-badge"
                                style={{
                                    color: statusColor,
                                    borderColor: borderColor
                                }}
                            >
                                {island.status.toUpperCase()}
                            </span>
                            <span className="island-id">ID: {island.id}</span>
                        </div>
                        <h3 className="island-title">
                            {isMainGrid ? 'Main Interconnected System' : `Island Cluster #${island.id}`}
                        </h3>
                    </div>
                    <div className="island-stats-right">
                        <div className="substat-count" style={{ color: '#e2e8f0' }}>
                            {island.substation_count || 0}
                            <span className="substat-label">Subs</span>
                        </div>
                        <div className="bus-count-label">{island.bus_count} Buses</div>
                    </div>
                </div>
            </div>

            {/* Expanded Content or Preview */}
            <AnimatePresence>
                {(isExpanded || !isMainGrid) && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="island-details"
                    >
                        <div className="details-content">
                            <h4 className="details-title">
                                <MapPin size={12} /> Affected Substations
                            </h4>

                            {isMainGrid && !isExpanded ? (
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    Click to view {island.substation_count} connected substations...
                                </p>
                            ) : (
                                <div className="substations-list custom-scrollbar">
                                    {island.substations && island.substations.map(sub => (
                                        <div key={sub.id} className="substation-item group">
                                            <span className="substation-name">
                                                {sub.name}
                                            </span>
                                            <span className="substation-buses-badge">
                                                {sub.bus_count} Buses
                                            </span>
                                        </div>
                                    ))}

                                    {/* Orphan Buses Section */}
                                    {island.orphan_buses && island.orphan_buses.length > 0 && (
                                        <div style={{ marginTop: '1rem', borderTop: '1px dashed rgba(51, 65, 85, 0.5)', paddingTop: '0.5rem' }}>
                                            <h5 style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                                Unmapped Buses (No Substation)
                                            </h5>
                                            {island.orphan_buses.map(bus => (
                                                <div key={bus.pk} className="substation-item group" style={{ background: 'rgba(50, 20, 20, 0.3)' }}>
                                                    <span className="substation-name" style={{ color: '#fda4af' }}>
                                                        Bus {bus.id} <span style={{ opacity: 0.5 }}>|</span> {bus.name || 'Unknown'}
                                                    </span>
                                                    <span className="substation-buses-badge" style={{ borderColor: '#881337', color: '#fb7185' }}>
                                                        {bus.kv} kV
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {(!island.substations || island.substations.length === 0) && (!island.orphan_buses || island.orphan_buses.length === 0) && (
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No substation mapping available.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer Action */}
            <div className="card-footer" style={{ justifyContent: 'space-between', display: 'flex' }}>
                {!isMainGrid && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(island); }}
                        className="action-btn"
                        style={{ color: '#ef4444' }}
                    >
                        <AlertTriangle size={12} /> MARK INVALID / DELETE
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className="action-btn"
                    style={{ color: 'var(--accent-blue)', marginLeft: !isMainGrid ? '0' : 'auto' }}
                >
                    {isExpanded ? 'COLLAPSE DETAILS' : 'VIEW ANALYSIS'} <ArrowRight size={12} />
                </button>
            </div>
        </motion.div>
    );
};

// Confirmation Modal
const DeleteConfirmationModal = ({ target, type, onConfirm, onCancel, processing }) => {
    if (!target) return null;

    const isIsland = type === 'island';
    const title = isIsland ? `Island Cluster #${target.id}` : 'Selected Bus Group';
    const count = isIsland ? target.bus_count : (Array.isArray(target) ? target.length : 1);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            <div className="glass-card" style={{ maxWidth: '400px', width: '100%', border: '1px solid #ef4444' }}>
                <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
                    <AlertTriangle /> CONFIRM DELETION
                </h3>
                <p style={{ marginTop: '1rem', color: '#cbd5e1' }}>
                    Are you sure you want to delete <strong>{title}</strong>?
                </p>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                        This will permanently remove <strong>{count} buses</strong> and all connected lines from the snapshot database.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                        onClick={onCancel}
                        disabled={processing}
                        style={{ background: 'transparent', color: '#cbd5e1', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={processing}
                        style={{
                            background: '#ef4444', color: 'white', border: 'none',
                            padding: '0.5rem 1rem', borderRadius: '0.25rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'
                        }}
                    >
                        {processing ? <Activity className="animate-spin" size={16} /> : 'CONFIRM DELETE'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IslandDetection;
