
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Network, Zap, AlertTriangle, Activity, Search, MapPin, Layers, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/IslandDetection.css';

const IslandDetection = ({ snapshotId }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIsland, setExpandedIsland] = useState(null);

    // Deletion State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
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
            const response = await axios.get(`/api/v1/topology/islands/?snapshot_id=${snapshotId}`);
            setData(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch island analysis');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (island) => {
        setDeleteTarget(island);
        setShowDeleteModal(true);
    };

    const executeDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await axios.post('/api/v1/topology/cleanup/', {
                snapshot_id: snapshotId,
                bus_ids: deleteTarget.bus_ids
            });
            setShowDeleteModal(false);
            setDeleteTarget(null);
            fetchAnalysis(); // Refresh data
        } catch (err) {
            alert('Failed to delete island: ' + (err.response?.data?.error || err.message));
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
                                onDelete={confirmDelete}
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
                    island={deleteTarget}
                    onConfirm={executeDelete}
                    onCancel={() => setShowDeleteModal(false)}
                    processing={isDeleting}
                />
            )}
        </div>
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
const DeleteConfirmationModal = ({ island, onConfirm, onCancel, processing }) => {
    if (!island) return null;

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
                    Are you sure you want to delete <strong>Island Cluster #{island.id}</strong>?
                </p>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                        This will permanently remove <strong>{island.bus_count} buses</strong> and all connected lines from the snapshot database.
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
