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
    const [searchMissingTopology, setSearchMissingTopology] = useState('');
    const [searchMissingMaster, setSearchMissingMaster] = useState('');
    const [expandedSubstations, setExpandedSubstations] = useState(() => new Set());
    const [expandedBuses, setExpandedBuses] = useState(() => new Set());
    const [expandedLoads, setExpandedLoads] = useState(() => new Set());
    const [expandedIslands, setExpandedIslands] = useState(() => new Set());
    const [expandedMissing, setExpandedMissing] = useState(() => new Set());
    const [expandedIslandDiffMissing, setExpandedIslandDiffMissing] = useState(() => new Set());
    const [expandedIslandDiffExtra, setExpandedIslandDiffExtra] = useState(() => new Set());
    const [topologyTab, setTopologyTab] = useState('mapped'); // 'mapped', 'missing_topology', 'missing_master'
    const [expandedIslandLoads, setExpandedIslandLoads] = useState(() => new Set());
    const [islandLoadSearch, setIslandLoadSearch] = useState({});
    const [missingBusesSearch, setMissingBusesSearch] = useState({});

    if (!summary) return null;

    const { missing_substations, islands, network_topology } = summary;

    // Helper data prep
    const missingCount = missing_substations?.bus_count || 0;
    const islandCount = islands?.island_count || (Array.isArray(islands?.islands) ? islands.islands.length : 0);

    const topologySubstations = Object.values(network_topology?.substations || {});

    // Difference Arrays
    const masterSubs = network_topology?.master_substations || [];
    const masterSubIds = new Set(masterSubs.map(s => String(s.substation_id).trim().toUpperCase()));
    const topologySubIds = new Set(topologySubstations.map(s => String(s.substation_id).trim().toUpperCase()));

    const missingFromTopologyList = masterSubs.length > 0
        ? masterSubs.filter(s => !topologySubIds.has(String(s.substation_id).trim().toUpperCase()))
        : [];
    const missingFromMasterList = masterSubs.length > 0
        ? topologySubstations.filter(s => !masterSubIds.has(String(s.substation_id).trim().toUpperCase()))
        : [];

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

    const toggleIsland = (id) => {
        setExpandedIslands(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleMissing = (id) => {
        setExpandedMissing(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleIslandDiffMissing = (id) => {
        setExpandedIslandDiffMissing(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleIslandDiffExtra = (id) => {
        setExpandedIslandDiffExtra(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleIslandLoads = (id) => {
        setExpandedIslandLoads(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const updateIslandLoadSearch = (id, value) => {
        setIslandLoadSearch(prev => ({
            ...prev,
            [id]: value,
        }));
    };

    const updateMissingBusesSearch = (id, value) => {
        setMissingBusesSearch(prev => ({
            ...prev,
            [id]: value,
        }));
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'missing': {
                // Group buses by substation name
                const missingBuses = missing_substations?.buses || [];
                const groupedBySub = missingBuses.reduce((acc, bus) => {
                    const subName = bus.substation_name || 'UNKNOWN BUSES';
                    if (!acc[subName]) {
                        acc[subName] = {
                            buses: [],
                            total_mw: 0,
                            total_mvar: 0
                        };
                    }
                    acc[subName].buses.push(bus);
                    acc[subName].total_mw += (bus.load_p_mw || 0);
                    acc[subName].total_mvar += (bus.load_q_mvar || 0);
                    return acc;
                }, {});

                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {Object.entries(groupedBySub)
                                .sort((a, b) => b[1].total_mw - a[1].total_mw) // Sort by MW descending
                                .map(([subName, data]) => {
                                    const isOpen = expandedMissing.has(subName);
                                    const localSearch = missingBusesSearch[subName] || '';
                                    const filteredData = data.buses.filter(b => {
                                        if (!localSearch) return true;
                                        const q = localSearch.toLowerCase();
                                        return String(b.bus_number).includes(q) || (b.bus_name || '').toLowerCase().includes(q);
                                    });
                                    return (
                                        <div key={subName} style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                            <button
                                                onClick={() => toggleMissing(subName)}
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
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f59e0b' }}>{subName}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '14px', color: '#94a3b8', fontSize: '0.75rem' }}>
                                                    <span>{data.buses.length} buses</span>
                                                    <span>{data.total_mw.toFixed(3)} MW</span>
                                                    <span>{data.total_mvar.toFixed(3)} MVar</span>
                                                </div>
                                            </button>

                                            <AnimatePresence>
                                                {isOpen && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.35)' }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
                                                            <div style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Unmapped Buses</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ position: 'relative' }}>
                                                                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Search bus..."
                                                                        value={localSearch}
                                                                        onChange={(e) => updateMissingBusesSearch(subName, e.target.value)}
                                                                        style={{
                                                                            background: 'rgba(15, 23, 42, 0.6)',
                                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                                            borderRadius: '8px',
                                                                            padding: '6px 10px 6px 30px',
                                                                            color: '#fff',
                                                                            fontSize: '0.75rem',
                                                                            outline: 'none',
                                                                            width: '200px'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{filteredData.length} / {data.buses.length} rows</div>
                                                            </div>
                                                        </div>
                                                        <DataTable
                                                            columns={[
                                                                { header: 'Bus No.', field: 'bus_number' },
                                                                { header: 'Name', field: 'bus_name' },
                                                                { header: 'Base kV', field: 'base_kv' },
                                                                { header: 'Load (MW)', field: 'load_p_mw' },
                                                                { header: 'Load (MVar)', field: 'load_q_mvar' },
                                                            ]}
                                                            data={filteredData}
                                                            keyField="bus_id"
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                );
            }
            case 'islands':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={20} /> Detected Islands ({islandCount})
                            </h3>
                        </div>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {(islands?.islands || []).map(island => {
                                const isOpen = expandedIslands.has(island.id);
                                const loadCount = island.loads?.length || 0;
                                const loadQuery = islandLoadSearch[island.id] || '';
                                const filteredLoads = (island.loads || []).filter(load => {
                                    if (!loadQuery) return true;
                                    const query = loadQuery.toLowerCase();
                                    const loadId = String(load.load_id || '').toLowerCase();
                                    const busNo = String(load.bus_number || '').toLowerCase();
                                    const busName = String(load.bus_name || '').toLowerCase();
                                    const subName = String(load.substation_name || '').toLowerCase();
                                    return loadId.includes(query)
                                        || busNo.includes(query)
                                        || busName.includes(query)
                                        || subName.includes(query);
                                });

                                // Difference Calculations
                                const globalSubIds = new Set(topologySubstations.map(s => String(s.substation_id)));
                                const islandSubIds = new Set((island.substations || []).map(s => String(s.id)));

                                const missingFromIsland = topologySubstations.filter(s => !islandSubIds.has(String(s.substation_id)));
                                const missingFromTopology = (island.substations || []).filter(s => !globalSubIds.has(String(s.id)));

                                const isDiffMissingOpen = expandedIslandDiffMissing.has(island.id);
                                const isDiffExtraOpen = expandedIslandDiffExtra.has(island.id);
                                const isLoadsOpen = expandedIslandLoads.has(island.id);

                                const statusColor = island.status === 'Main Grid'
                                    ? '#10b981'
                                    : (island.status === 'Energized' ? '#22d3ee' : '#ef4444');
                                return (
                                    <div key={island.id} style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                        <button
                                            onClick={() => toggleIsland(island.id)}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                padding: '16px 20px',
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                border: 'none',
                                                color: '#e2e8f0',
                                                cursor: 'pointer',
                                                gap: '12px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.5px' }}>ISLAND #{island.id}</div>
                                                    <span style={{
                                                        background: `${statusColor}20`,
                                                        color: statusColor,
                                                        border: `1px solid ${statusColor}40`,
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}>{island.status}</span>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, 1fr)',
                                                gap: '12px',
                                                width: '100%',
                                                textAlign: 'left',
                                                background: 'rgba(0,0,0,0.2)',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Network Size</div>
                                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
                                                        {island.bus_count} Buses <span style={{ color: '#475569', margin: '0 4px' }}>•</span> {island.substation_count} Subs
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Active Load</div>
                                                    <div style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 600 }}>
                                                        {Number(island.total_load_mw || 0).toFixed(2)} MW
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Reactive Load</div>
                                                    <div style={{ fontSize: '0.9rem', color: '#818cf8', fontWeight: 600 }}>
                                                        {Number(island.total_load_mvar || 0).toFixed(2)} MVar
                                                    </div>
                                                </div>

                                                <div style={{
                                                    borderLeft: island.orphan_count > 0 ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.05)',
                                                    paddingLeft: '12px'
                                                }}>
                                                    <div style={{ fontSize: '0.7rem', color: island.orphan_count > 0 ? '#f59e0b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {island.orphan_count > 0 && <AlertCircle size={12} />}
                                                        Unmapped Substation
                                                    </div>
                                                    {island.orphan_count > 0 ? (
                                                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                            <strong style={{ color: '#f59e0b' }}>{island.orphan_count}</strong> loads · {Number(island.orphan_load_mw || 0).toFixed(1)} MW / {Number(island.orphan_load_mvar || 0).toFixed(1)} MVar
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <CheckCircle size={14} /> Fully Mapped
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {isOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    style={{ padding: '16px 20px', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <div style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                            <button
                                                                onClick={() => toggleIslandLoads(island.id)}
                                                                style={{
                                                                    width: '100%',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '10px 14px',
                                                                    background: 'rgba(0,0,0,0.2)',
                                                                    border: 'none',
                                                                    color: '#e2e8f0',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    {isLoadsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>Load Contributors</div>
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{loadCount} loads</div>
                                                            </button>

                                                            <AnimatePresence>
                                                                {isLoadsOpen && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)' }}
                                                                    >
                                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', gap: '12px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                                <div style={{ position: 'relative' }}>
                                                                                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Search loads..."
                                                                                        value={loadQuery}
                                                                                        onChange={(e) => updateIslandLoadSearch(island.id, e.target.value)}
                                                                                        style={{
                                                                                            background: 'rgba(15, 23, 42, 0.6)',
                                                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                                                            borderRadius: '8px',
                                                                                            padding: '6px 10px 6px 30px',
                                                                                            color: '#fff',
                                                                                            fontSize: '0.75rem',
                                                                                            outline: 'none',
                                                                                            width: '200px'
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{filteredLoads.length} / {loadCount} rows</div>
                                                                            </div>
                                                                        </div>
                                                                        <DataTable
                                                                            columns={[
                                                                                { header: 'Load ID', field: 'load_id' },
                                                                                { header: 'Bus No.', field: 'bus_number' },
                                                                                { header: 'Bus Name', field: 'bus_name' },
                                                                                { header: 'Substation', field: 'substation_name' },
                                                                                {
                                                                                    header: 'P (MW)',
                                                                                    render: row => Number(row.p_mw || 0).toFixed(3)
                                                                                },
                                                                                {
                                                                                    header: 'Q (MVar)',
                                                                                    render: row => Number(row.q_mvar || 0).toFixed(3)
                                                                                },
                                                                            ]}
                                                                            data={filteredLoads}
                                                                            keyField="load_id"
                                                                        />
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>

                                                        {/* Difference Tables comparing Island Subs vs Topology Subs */}
                                                        {(missingFromIsland.length > 0 || missingFromTopology.length > 0) && (
                                                            <React.Fragment>

                                                                {missingFromIsland.length > 0 && (
                                                                    <div style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                                        <button
                                                                            onClick={() => toggleIslandDiffMissing(island.id)}
                                                                            style={{
                                                                                width: '100%',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                padding: '10px 14px',
                                                                                background: 'rgba(0,0,0,0.2)',
                                                                                border: 'none',
                                                                                color: '#e2e8f0',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                {isDiffMissingOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171' }}>Substations Not In This Island</div>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{missingFromIsland.length} substations</div>
                                                                        </button>
                                                                        <AnimatePresence>
                                                                            {isDiffMissingOpen && (
                                                                                <motion.div
                                                                                    initial={{ height: 0, opacity: 0 }}
                                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                                    exit={{ height: 0, opacity: 0 }}
                                                                                    style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)' }}
                                                                                >
                                                                                    <DataTable
                                                                                        columns={[
                                                                                            { header: 'Substation ID', field: 'substation_id' },
                                                                                            { header: 'Substation Name', field: 'substation_name' },
                                                                                            { header: 'Buses', render: row => row.buses?.length || 0 },
                                                                                        ]}
                                                                                        data={missingFromIsland}
                                                                                        keyField="substation_id"
                                                                                    />
                                                                                </motion.div>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </div>
                                                                )}

                                                                {missingFromTopology.length > 0 && (
                                                                    <div style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                                        <button
                                                                            onClick={() => toggleIslandDiffExtra(island.id)}
                                                                            style={{
                                                                                width: '100%',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                padding: '10px 14px',
                                                                                background: 'rgba(0,0,0,0.2)',
                                                                                border: 'none',
                                                                                color: '#e2e8f0',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                {isDiffExtraOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24' }}>Island Substations Not In Topology</div>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{missingFromTopology.length} substations</div>
                                                                        </button>
                                                                        <AnimatePresence>
                                                                            {isDiffExtraOpen && (
                                                                                <motion.div
                                                                                    initial={{ height: 0, opacity: 0 }}
                                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                                    exit={{ height: 0, opacity: 0 }}
                                                                                    style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)' }}
                                                                                >
                                                                                    <DataTable
                                                                                        columns={[
                                                                                            { header: 'Substation ID', field: 'id' },
                                                                                            { header: 'Substation Name', field: 'name' },
                                                                                            { header: 'Buses', field: 'bus_count' },
                                                                                        ]}
                                                                                        data={missingFromTopology}
                                                                                        keyField="id"
                                                                                    />
                                                                                </motion.div>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </div>
                                                                )}
                                                            </React.Fragment>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 'topology':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Grid size={20} /> Network Topology
                            </h3>
                        </div>

                        {/* Sub-Tabs for Network Topology View */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', overflowX: 'auto' }}>
                            <TabButton
                                active={topologyTab === 'mapped'} onClick={() => setTopologyTab('mapped')}
                                icon={CheckCircle} label={`Mapped Substations (${topologySubstations.length})`} color="#10b981"
                            />
                            {missingFromTopologyList.length > 0 && (
                                <TabButton
                                    active={topologyTab === 'missing_topology'} onClick={() => setTopologyTab('missing_topology')}
                                    icon={AlertTriangle} label={`Missing From Raw File (${missingFromTopologyList.length})`} color="#f87171"
                                />
                            )}
                            {missingFromMasterList.length > 0 && (
                                <TabButton
                                    active={topologyTab === 'missing_master'} onClick={() => setTopologyTab('missing_master')}
                                    icon={AlertTriangle} label={`Unregistered Substations (${missingFromMasterList.length})`} color="#fbbf24"
                                />
                            )}
                        </div>

                        {topologyTab === 'missing_topology' && (() => {
                            const filteredData = missingFromTopologyList.filter(s => {
                                if (!searchMissingTopology) return true;
                                const q = searchMissingTopology.toLowerCase();
                                return (s.substation_id || '').toLowerCase().includes(q) ||
                                    (s.name || '').toLowerCase().includes(q) ||
                                    (s.grid || '').toLowerCase().includes(q) ||
                                    (s.state || '').toLowerCase().includes(q);
                            });
                            return (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ marginBottom: '1rem', position: 'relative' }}>
                                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search Missing Substations..."
                                            value={searchMissingTopology}
                                            onChange={(e) => setSearchMissingTopology(e.target.value)}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.4)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                padding: '10px 10px 10px 36px',
                                                color: '#fff',
                                                fontSize: '0.85rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{filteredData.length} / {missingFromTopologyList.length} rows</div>
                                    </div>
                                    <DataTable
                                        columns={[
                                            { header: 'Substation ID', field: 'substation_id' },
                                            { header: 'Substation Name', field: 'name' },
                                            { header: 'Grid', field: 'grid' },
                                            { header: 'State', field: 'state' },
                                        ]}
                                        data={filteredData}
                                        keyField="substation_id"
                                    />
                                </motion.div>
                            );
                        })()}

                        {topologyTab === 'missing_master' && (() => {
                            const filteredData = missingFromMasterList.filter(s => {
                                if (!searchMissingMaster) return true;
                                const q = searchMissingMaster.toLowerCase();
                                return (s.substation_id || '').toLowerCase().includes(q) ||
                                    (s.substation_name || '').toLowerCase().includes(q);
                            });
                            return (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ marginBottom: '1rem', position: 'relative' }}>
                                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search Unregistered Substations..."
                                            value={searchMissingMaster}
                                            onChange={(e) => setSearchMissingMaster(e.target.value)}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.4)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                padding: '10px 10px 10px 36px',
                                                color: '#fff',
                                                fontSize: '0.85rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{filteredData.length} / {missingFromMasterList.length} rows</div>
                                    </div>
                                    <DataTable
                                        columns={[
                                            { header: 'Substation ID', field: 'substation_id' },
                                            { header: 'Substation Name', field: 'substation_name' },
                                            { header: 'Buses Count', render: row => row.buses?.length || 0 },
                                        ]}
                                        data={filteredData}
                                        keyField="substation_id"
                                    />
                                </motion.div>
                            );
                        })()}

                        {topologyTab === 'mapped' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ position: 'relative', marginBottom: '4px' }}>
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
                                                                                        {(bus.branches || []).map((br, idx) => {
                                                                                            const isMother = br.from_bus?.bus_id === bus.bus_id;
                                                                                            const displayFrom = isMother ? br.from_bus : br.to_bus;
                                                                                            const displayTo = isMother ? br.to_bus : br.from_bus;
                                                                                            return (
                                                                                                <div key={`${busKey}-br-${idx}`} style={{
                                                                                                    display: 'flex',
                                                                                                    justifyContent: 'space-between',
                                                                                                    padding: '6px 8px',
                                                                                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                                                                }}>
                                                                                                    <div style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                                                                                                        {displayFrom?.substation_name || displayFrom?.substation_id} ({displayFrom?.bus_number}) → {displayTo?.substation_name || displayTo?.substation_id} ({displayTo?.bus_number})
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
                                                                                            );
                                                                                        })}
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
                            </motion.div>
                        )}
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
                        active={activeTab === 'topology'}
                        onClick={() => setActiveTab('topology')}
                        icon={Grid} label="Topology" color="#06b6d4"
                    />
                    <TabButton
                        active={activeTab === 'islands'}
                        onClick={() => setActiveTab('islands')}
                        icon={Zap} label="Islands" color="#8b5cf6"
                    />
                    <TabButton
                        active={activeTab === 'missing'}
                        onClick={() => setActiveTab('missing')}
                        icon={AlertTriangle} label="Missing Data" color="#f59e0b"
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
