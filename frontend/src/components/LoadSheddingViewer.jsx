import React, { useState, useEffect } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Filter,
    Shield,
    Zap,
    Activity,
    ArrowRight,
    Search,
    RefreshCw,
    Download,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

const StatCard = ({ label, value, subLabel, color, isAccent }) => (
    <div style={{
        background: isAccent ? `${color}10` : 'rgba(255, 255, 255, 0.03)',
        borderLeft: `4px solid ${color}`,
        borderRadius: '4px',
        padding: '1rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>{value}</div>
        {subLabel && <div style={{ color, fontSize: '0.65rem', marginTop: '4px' }}>{subLabel}</div>}
    </div>
);

const LoadSheddingViewer = () => {
    const [schemes, setSchemes] = useState([]);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        region: 'All',
        grid: 'All',
        state: 'All'
    });
    const [search, setSearch] = useState('');
    const [expandedStages, setExpandedStages] = useState({});

    // Fetch schemes (versions) on mount
    const fetchSchemes = async () => {
        try {
            const res = await api.get('/load-shedding-versions/');
            setSchemes(res.data);
            // Auto-select the active scheme if one exists
            const active = res.data.find(s => s.is_active);
            if (active) handleSelectScheme(active);
            else if (res.data.length > 0) handleSelectScheme(res.data[0]);
        } catch (err) {
            console.error("Failed to fetch schemes", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchemes();
    }, []);

    const handleSelectScheme = async (scheme) => {
        setSelectedScheme(scheme);
        if (!scheme) return;

        // Fetch stage details for the selected scheme
        try {
            const res = await api.get(`/load-shedding-stages/?version=${scheme.id}&include_bays=true`);
            // Update the selected scheme with detailed stages
            setSelectedScheme(prev => prev && prev.id === scheme.id ? { ...prev, stages: res.data } : prev);
        } catch (err) {
            console.error("Failed to fetch stage details", err);
        }
    };

    const toggleStage = (stageId) => {
        setExpandedStages(prev => ({
            ...prev,
            [stageId]: !prev[stageId]
        }));
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '16rem', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw className="animate-spin" style={{ color: 'var(--accent-cyan)' }} size={32} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem', fontFamily: "'Inter', sans-serif" }}>
            {/* Header / Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <StatCard
                    label="Active Scheme"
                    value={selectedScheme?.version_label || 'None'}
                    subLabel={`${selectedScheme?.scheme_type || '-'} Type`}
                    color="var(--accent-cyan)"
                    isAccent
                />
                <StatCard
                    label="Total Availability"
                    value="1,240.5 MW"
                    subLabel="+2.4 MW vs yesterday"
                    color="#34d399"
                    isAccent
                />
                <StatCard
                    label="Stages Configured"
                    value={selectedScheme?.stages?.length || 0}
                    subLabel="Automatic Trip Enabled"
                    color="var(--accent-blue)"
                    isAccent
                />
                <StatCard
                    label="System Version"
                    value={`v${selectedScheme?.id?.slice(0, 4).toUpperCase() || '---'}`}
                    subLabel={`Status: ${selectedScheme?.status || '-'}`}
                    color="#fbbf24"
                    isAccent
                />
            </div>

            {/* Controls Bar */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
                {/* Top Row: Search and Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                        <Filter size={18} />
                        <span style={{ fontWeight: 600 }}>Scheme Controls</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
                        {/* Search Bar */}
                        <div style={{ position: 'relative', minWidth: '250px', flex: '0 1 400px' }}>
                            <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                className="input-field"
                                placeholder="Search substation or bay..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ paddingLeft: '2.2rem', paddingRight: '2rem', width: '100%', height: '36px' }}
                            />
                            {search && (
                                <X
                                    size={16}
                                    title="Clear search"
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        cursor: 'pointer',
                                        color: '#fff',
                                        zIndex: 10,
                                        transition: 'opacity 0.2s',
                                        opacity: 0.7
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                                    onClick={() => setSearch('')}
                                />
                            )}
                        </div>

                        <button
                            className="btn-secondary"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                borderRadius: '6px', padding: '0 12px',
                                fontSize: '0.8rem', height: '36px'
                            }}
                        >
                            <Download size={14} /> Export
                        </button>
                    </div>
                </div>

                {/* Filter Dropdowns Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Scheme Version</label>
                        <select
                            className="input-field"
                            value={selectedScheme?.id || ''}
                            onChange={(e) => handleSelectScheme(schemes.find(s => s.id === e.target.value))}
                            style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                        >
                            {schemes.map(s => (
                                <option key={s.id} value={s.id}>{s.scheme_type} - {s.version_label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Region</label>
                        <select
                            className="input-field"
                            value={filters.region}
                            onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                            style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                        >
                            {['All', 'North', 'Central', 'South', 'East'].map(r => (
                                <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Grid</label>
                        <select
                            className="input-field"
                            value={filters.grid}
                            onChange={(e) => setFilters(prev => ({ ...prev, grid: e.target.value }))}
                            style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                        >
                            {['All', 'National Grid', 'Islanding'].map(g => (
                                <option key={g} value={g}>{g === 'All' ? 'All Grids' : g}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>State</label>
                        <select
                            className="input-field"
                            value={filters.state}
                            onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                            style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                        >
                            {['All', 'Kuala Lumpur', 'Selangor', 'Johor', 'Penang', 'Perak', 'Pahang'].map(s => (
                                <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Version Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedScheme?.stages?.map((stage, idx) => (
                    <div key={stage.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div
                            style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: expandedStages[stage.id] ? 'rgba(255,255,255,0.02)' : 'transparent', transition: 'background 0.2s' }}
                            onClick={() => toggleStage(stage.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{stage.label}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '6px', alignItems: 'center' }}>
                                        {stage.settings?.length > 0 ? stage.settings.map(s => (
                                            <span key={s.id} style={{
                                                fontSize: '10px',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                color: 'var(--text-secondary)',
                                                fontWeight: 500
                                            }}>
                                                {s.label?.replace('_', ', ')}
                                            </span>
                                        )) : (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.5 }}>No threshold settings</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>MW Quantum</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#34d399' }}>
                                        {((stage.transformer_bays?.reduce((acc, b) => acc + (b.mw_cache?.mw || 0), 0) || 0) +
                                            (stage.pocket_bays?.reduce((acc, b) => acc + (b.topology_cache?.mw || 0), 0) || 0)).toFixed(1)} MW
                                    </div>
                                </div>
                                <div style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                                    {expandedStages[stage.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {expandedStages[stage.id] && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}
                                >
                                    <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', background: 'rgba(0,0,0,0.2)' }}>
                                        {/* Transformer Bays Section */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                                                <Zap size={14} style={{ color: 'var(--accent-cyan)' }} /> Transformer Assets
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                {stage.transformer_bays?.length === 0 ? (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>No transformer assets assigned.</div>
                                                ) : stage.transformer_bays?.map(bay => (
                                                    <div key={bay.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'default' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-cyan)', opacity: 0.6 }}>{bay.relay_substation_id || 'UNK'}</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{bay.relay_substation_name || 'Generic TX Bay'}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{bay.mw_cache?.mw?.toFixed(1) || '0.0'} MW</div>
                                                            <ArrowRight size={14} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Pocket Bays Section */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                                                <Shield size={14} style={{ color: 'var(--accent-blue)' }} /> Network Pockets
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {stage.pocket_bays?.length === 0 ? (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>No network pockets assigned.</div>
                                                ) : stage.pocket_bays?.map(pocket => (
                                                    <div key={pocket.id} style={{ padding: '0.75rem', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                Pocket Isolation
                                                                <div style={{
                                                                    fontSize: '10px',
                                                                    background: pocket.topology_valid ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                    color: pocket.topology_valid ? '#34d399' : '#f87171',
                                                                    padding: '2px 6px', borderRadius: '4px',
                                                                    border: `1px solid ${pocket.topology_valid ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                                                }}>
                                                                    {pocket.topology_valid ? 'Valid' : 'Topology Error'}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{pocket.topology_cache?.mw?.toFixed(1) || '0.0'} MW</div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                                            {pocket.boundaries?.map(b => (
                                                                <div key={b.id} style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
                                                                    Boundary: {b.relay_substation_id} ({b.branches?.length} circuits)
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LoadSheddingViewer;
