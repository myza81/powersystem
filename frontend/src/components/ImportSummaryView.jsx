import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, AlertTriangle, Zap, Grid, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Search
} from 'lucide-react';

// --- Reusable Components ---

const TabButton = ({ active, onClick, icon: Icon, label, color }) => (
    <button
        onClick={onClick}
        style={{
            background: active ? `${color}20` : 'transparent',
            color: active ? color : '#94a3b8',
            border: active ? `1px solid ${color}40` : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontWeight: 600,
            fontSize: '0.9rem'
        }}
    >
        <Icon size={16} />
        {label}
    </button>
);

const DataTable = ({ columns, data, keyField = 'id' }) => (
    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                    {columns.map((col, i) => (
                        <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>{col.header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {!Array.isArray(data) || data.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            No data available
                        </td>
                    </tr>
                ) : (
                    data.map((row, i) => (
                        <tr key={`${row[keyField] || 'row'}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            {columns.map((col, j) => (
                                <td key={j} style={{ padding: '10px 16px', color: '#94a3b8' }}>
                                    {col.render ? col.render(row) : row[col.field]}
                                </td>
                            ))}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

// --- Main View Component ---

const ImportSummaryView = ({ summary }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSubstations, setExpandedSubstations] = useState(() => new Set());
    const [expandedBuses, setExpandedBuses] = useState(() => new Set());
    const [expandedLoads, setExpandedLoads] = useState(() => new Set());

    if (!summary) return null;

    const { missing_substations, islands, network_topology } = summary;

    // Helper data prep
    const missingCount = missing_substations?.bus_count || 0;
    const islandCount = islands?.island_count || (Array.isArray(islands?.islands) ? islands.islands.length : 0);

    const topologySubstations = Object.values(network_topology?.substations || {});

    const toggleSubstation = (id) => {
        setExpandedSubstations(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleBus = (id) => {
        setExpandedBuses(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleLoad = (id) => {
        setExpandedLoads(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'missing':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={20} /> Unmapped Buses ({missingCount})
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                Total Load: <span style={{ color: '#f59e0b' }}>{missing_substations?.total_load_mw} MW / {missing_substations?.total_load_mvar} MVar</span>
                            </div>
                        </div>
                        <DataTable
                            columns={[
                                { header: 'Bus No.', field: 'bus_number' },
                                { header: 'Name', field: 'bus_name' },
                                { header: 'Substation', field: 'substation_name' },
                                { header: 'Base kV', field: 'base_kv' },
                                { header: 'Load (MW)', field: 'load_p_mw' },
                                { header: 'Load (MVar)', field: 'load_q_mvar' },
                            ]}
                            data={missing_substations?.buses || []}
                            keyField="bus_id"
                        />
                    </div>
                );
            case 'islands':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={20} /> Detected Islands ({islandCount})
                            </h3>
                        </div>
                        <DataTable
                            columns={[
                                { header: 'Island ID', render: row => <span style={{ fontFamily: 'monospace' }}>#{row.id}</span> },
                                { header: 'Buses', field: 'bus_count' },
                                { header: 'Substations', field: 'substation_count' },
                                { header: 'Load (MW)', field: 'total_load_mw' },
                                { header: 'Load (MVar)', field: 'total_load_mvar' },
                                {
                                    header: 'Status', render: row => {
                                        const color = row.status === 'Main Grid' ? '#10b981' : (row.status === 'Energized' ? '#22d3ee' : '#ef4444');
                                        return <span style={{ color }}>{row.status}</span>;
                                    }
                                }
                            ]}
                            data={islands?.islands || []}
                            keyField="id"
                        />
                    </div>
                );
            case 'topology':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Grid size={20} /> Network Topology
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                Substations Identified: <span style={{ color: '#06b6d4' }}>{topologySubstations.length}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem', position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search by Substation ID, Name, or Bus Number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '10px 10px 10px 36px',
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gap: '12px' }}>
                            {topologySubstations
                                .filter(sub => {
                                    if (!searchQuery) return true;
                                    const query = searchQuery.toLowerCase();
                                    const matchSubId = (sub.substation_id || '').toLowerCase().includes(query);
                                    const matchSubName = (sub.substation_name || '').toLowerCase().includes(query);
                                    const matchBus = (sub.buses || []).some(b =>
                                        String(b.bus_number).includes(query) ||
                                        (b.bus_name || '').toLowerCase().includes(query)
                                    );
                                    return matchSubId || matchSubName || matchBus;
                                })
                                .map(sub => {
                                    const subId = sub.substation_id || 'UNKNOWN';
                                    const isOpen = expandedSubstations.has(subId);
                                    const busCount = Array.isArray(sub.buses) ? sub.buses.length : 0;
                                    const branchCount = (sub.buses || []).reduce((acc, b) => acc + (b.branches?.length || 0), 0);
                                    const loadCount = sub.load_transformers?.length || 0;
                                    return (
                                        <div key={subId} style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                            <button
                                                onClick={() => toggleSubstation(subId)}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 16px',
                                                    background: 'rgba(15, 23, 42, 0.6)',
                                                    border: 'none',
                                                    color: '#e2e8f0',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{subId}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{sub.substation_name || 'Unknown Substation'}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '14px', color: '#94a3b8', fontSize: '0.75rem' }}>
                                                    <span>{busCount} buses</span>
                                                    <span>{branchCount} branches</span>
                                                    <span>{loadCount} load-tx</span>
                                                </div>
                                            </button>

                                            <AnimatePresence>
                                                {isOpen && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.35)' }}
                                                    >
                                                        {(sub.buses || []).map(bus => {
                                                            const busKey = `${subId}-${bus.bus_number}`;
                                                            const busOpen = expandedBuses.has(busKey);
                                                            return (
                                                                <div key={busKey} style={{ marginBottom: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                                    <button
                                                                        onClick={() => toggleBus(busKey)}
                                                                        style={{
                                                                            width: '100%',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            padding: '10px 12px',
                                                                            background: 'rgba(30, 41, 59, 0.5)',
                                                                            border: 'none',
                                                                            color: '#cbd5e1',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            {busOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                            <span style={{ fontWeight: 600 }}>{bus.bus_number}</span>
                                                                            <span style={{ color: '#94a3b8' }}>{bus.bus_name}</span>
                                                                        </div>
                                                                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{bus.branches?.length || 0} branches</div>
                                                                    </button>

                                                                    <AnimatePresence>
                                                                        {busOpen && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                style={{ padding: '10px 12px' }}
                                                                            >
                                                                                {(bus.branches || []).map((br, idx) => (
                                                                                    <div key={`${busKey}-br-${idx}`} style={{
                                                                                        display: 'flex',
                                                                                        justifyContent: 'space-between',
                                                                                        padding: '6px 8px',
                                                                                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                                                    }}>
                                                                                        <div style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                                                                                            {br.from_bus.substation_name || br.from_bus.substation_id} ({br.from_bus.bus_number}) → {br.to_bus.substation_name || br.to_bus.substation_id} ({br.to_bus.bus_number})
                                                                                            <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{br.ckt_id}</span>
                                                                                        </div>
                                                                                        <span style={{
                                                                                            fontSize: '0.75rem',
                                                                                            padding: '2px 6px',
                                                                                            borderRadius: '6px',
                                                                                            background: br.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                                                            color: br.is_active ? '#10b981' : '#ef4444'
                                                                                        }}>
                                                                                            {br.is_active ? 'Active' : 'Inactive'}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        })}

                                                        {(sub.load_transformers || []).length > 0 && (
                                                            <div style={{ marginTop: '12px' }}>
                                                                {(() => {
                                                                    const loadKey = `load-${subId}`;
                                                                    const loadOpen = expandedLoads.has(loadKey);
                                                                    return (
                                                                        <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                                            <button
                                                                                onClick={() => toggleLoad(loadKey)}
                                                                                style={{
                                                                                    width: '100%',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'space-between',
                                                                                    padding: '10px 12px',
                                                                                    background: 'rgba(30, 41, 59, 0.5)',
                                                                                    border: 'none',
                                                                                    color: '#67e8f9',
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    {loadOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                                    <span style={{ fontWeight: 600 }}>Load Transformers</span>
                                                                                </div>
                                                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{(sub.load_transformers || []).length} units</div>
                                                                            </button>

                                                                            <AnimatePresence>
                                                                                {loadOpen && (
                                                                                    <motion.div
                                                                                        initial={{ height: 0, opacity: 0 }}
                                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                                        exit={{ height: 0, opacity: 0 }}
                                                                                        style={{ padding: '10px 12px' }}
                                                                                    >
                                                                                        {(sub.load_transformers || []).map((tx, idx) => (
                                                                                            <div key={`${subId}-tx-${idx}`} style={{
                                                                                                display: 'flex',
                                                                                                justifyContent: 'space-between',
                                                                                                padding: '6px 8px',
                                                                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                                                                color: '#cbd5e1',
                                                                                                fontSize: '0.75rem'
                                                                                            }}>
                                                                                                <div>{tx.load_id}</div>
                                                                                                <div>{tx.p_mw} MW / {tx.q_mvar} MVar</div>
                                                                                                <span style={{
                                                                                                    fontSize: '0.75rem',
                                                                                                    padding: '2px 6px',
                                                                                                    borderRadius: '6px',
                                                                                                    background: tx.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                                                                    color: tx.is_active ? '#10b981' : '#ef4444'
                                                                                                }}>
                                                                                                    {tx.is_active ? 'Active' : 'Inactive'}
                                                                                                </span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </motion.div>
                                                                                )}
                                                                            </AnimatePresence>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                        </div>
                    </div >
                );
            default: // Overview
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
                        {/* Summary Cards */}
                        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: '#f59e0b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={20} /> <span style={{ fontWeight: 600 }}>Missing Data</span>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{missingCount}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Unmapped Buses</div>
                        </div>

                        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: '#8b5cf6', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={20} /> <span style={{ fontWeight: 600 }}>Islands</span>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{islandCount}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Detected Networks</div>
                        </div>



                        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: '#06b6d4', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Grid size={20} /> <span style={{ fontWeight: 600 }}>Topology</span>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{topologySubstations.length}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Substations Identified</div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                marginTop: '3rem',
                background: 'rgba(30, 41, 59, 0.3)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.05)',
                overflow: 'hidden'
            }}
        >
            <div style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.6)'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>Detailed Network Analysis</h3>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                        Breakdown of network components for the currently active snapshot.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <TabButton
                        active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                        icon={Grid} label="Overview" color="#f8fafc"
                    />
                    <TabButton
                        active={activeTab === 'missing'}
                        onClick={() => setActiveTab('missing')}
                        icon={AlertTriangle} label="Missing Data" color="#f59e0b"
                    />
                    <TabButton
                        active={activeTab === 'islands'}
                        onClick={() => setActiveTab('islands')}
                        icon={Zap} label="Islands" color="#8b5cf6"
                    />
                    <TabButton
                        active={activeTab === 'topology'}
                        onClick={() => setActiveTab('topology')}
                        icon={Grid} label="Topology" color="#06b6d4"
                    />
                </div>
            </div>

            <div style={{ padding: '2rem', minHeight: '300px' }}>
                {renderContent()}
            </div>
        </motion.div>
    );
};

export default ImportSummaryView;
