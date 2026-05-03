import React, { useEffect, useMemo, useState } from 'react';
import {
    BarChart2, Building2, FileSpreadsheet, Zap,
    ChevronDown, ChevronUp, Search, X, Upload,
    CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import api from '../api';

// ── Constants ────────────────────────────────────────────────────────────────
const VOLTAGE_ORDER = [500, 275, 132, 66, 33, 11];

const TABS = [
    { id: 'population', label: 'Population', icon: Building2 },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'scanner', label: 'Scanner', icon: FileSpreadsheet },
];

const thStyle = {
    padding: '0.55rem 0.75rem',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.78rem',
    color: 'var(--text-2)',
    whiteSpace: 'nowrap',
};
const tdStyle = {
    padding: '0.55rem 0.75rem',
    color: 'var(--text-1)',
    verticalAlign: 'middle',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const SelectFilter = ({ value, onChange, options, label }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
            padding: '0.35rem 0.6rem',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            background: 'var(--surface-1)',
            color: 'var(--text-1)',
            fontSize: '0.8rem',
        }}
    >
        {options.map(o => <option key={o} value={o}>{o === 'All' ? `All ${label}` : o}</option>)}
    </select>
);

const RelayRow = ({ relay }) => {
    const ltCount = (relay.load_transformers || []).length;
    const ibCount = (relay.incoming_branches || []).length;
    const atCount = (relay.auto_transformers || []).length;
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.45rem 0.75rem',
            background: 'var(--surface-2)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            fontSize: '0.8rem',
        }}>
            {relay.is_active
                ? <CheckCircle size={13} color="#22c55e" />
                : <XCircle size={13} color="#94a3b8" />}
            <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                {relay.relay_name || `Relay #${relay.id}`}
            </span>
            {relay.target_voltage != null && (
                <span style={{ color: 'var(--text-2)', fontSize: '0.73rem' }}>
                    {relay.target_voltage} Hz
                </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                {ltCount > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{ltCount} LT</span>}
                {ibCount > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{ibCount} IB</span>}
                {atCount > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{atCount} AT</span>}
            </div>
            {relay.notes && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontStyle: 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {relay.notes}
                </span>
            )}
        </div>
    );
};

const BreakdownTable = ({ data, columns, keyFn }) => (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '0.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {columns.map(c => (
                        <th key={c.key} style={{ ...thStyle, textAlign: c.right ? 'right' : 'left' }}>{c.label}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map(row => (
                    <tr key={keyFn(row)} style={{ borderBottom: '1px solid var(--border)' }}>
                        {columns.map(c => (
                            <td key={c.key} style={{ ...tdStyle, textAlign: c.right ? 'right' : 'left' }}>
                                {c.render ? c.render(row) : row[c.key]}
                            </td>
                        ))}
                    </tr>
                ))}
                {data.length === 0 && (
                    <tr>
                        <td colSpan={columns.length} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-2)' }}>
                            No data
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    </div>
);

const makeGroupCols = (firstKey, firstLabel) => [
    { key: firstKey, label: firstLabel },
    { key: 'subs', label: 'Substations', right: true },
    { key: 'totalRelays', label: 'Total Relays', right: true },
    {
        key: 'activeRelays', label: 'Active', right: true,
        render: row => (
            <span style={{
                fontWeight: 600,
                color: row.activeRelays === row.totalRelays ? '#22c55e'
                    : row.activeRelays > 0 ? '#f59e0b' : '#94a3b8',
            }}>
                {row.activeRelays}
            </span>
        ),
    },
    {
        key: 'inactive', label: 'Inactive', right: true,
        render: row => {
            const n = row.totalRelays - row.activeRelays;
            return <span style={{ color: n > 0 ? '#ef4444' : '#94a3b8' }}>{n}</span>;
        },
    },
];

const StatCard = ({ label, value, sub, color }) => (
    <div style={{
        padding: '1rem 1.25rem',
        background: 'var(--surface-1)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        flex: '1 1 140px',
        minWidth: '120px',
    }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
        </div>
        <div style={{ fontSize: '1.7rem', fontWeight: 700, color: color || 'var(--text-1)', lineHeight: 1 }}>
            {value}
        </div>
        {sub && <div style={{ fontSize: '0.73rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
);

const SectionHeader = ({ title }) => (
    <div style={{
        fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)',
        margin: '1.5rem 0 0.6rem',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem',
    }}>
        {title}
    </div>
);

// ── Tab: Population ──────────────────────────────────────────────────────────
const PopulationTab = ({
    filteredSubs, relayMap,
    search, setSearch,
    regionFilter, setRegionFilter,
    gridFilter, setGridFilter,
    voltageFilter, setVoltageFilter,
    regions, grids, voltages,
    expandedSub, setExpandedSub,
    totalCount,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)', pointerEvents: 'none' }} />
                <input
                    type="text"
                    placeholder="Search by ID, mnemonic or name…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.38rem 1.8rem 0.38rem 2rem',
                        border: '1px solid var(--border)', borderRadius: '6px',
                        background: 'var(--surface-1)', color: 'var(--text-1)',
                        fontSize: '0.8rem', boxSizing: 'border-box',
                    }}
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 0 }}
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
            <SelectFilter value={regionFilter} onChange={setRegionFilter} options={regions} label="Regions" />
            <SelectFilter value={gridFilter} onChange={setGridFilter} options={grids} label="Grids" />
            <SelectFilter value={voltageFilter} onChange={setVoltageFilter} options={voltages} label="Voltages" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {filteredSubs.length} / {totalCount} substations
            </span>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={thStyle}>Sub ID</th>
                        <th style={thStyle}>Name</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>kV</th>
                        <th style={thStyle}>Region</th>
                        <th style={thStyle}>Grid</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Relays</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Active</th>
                        <th style={thStyle}>Scheme Types</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredSubs.map(sub => {
                        const rels = relayMap[sub.substation_id] || [];
                        const activeCount = rels.filter(r => r.is_active).length;
                        const isExpanded = expandedSub === sub.substation_id;
                        return (
                            <React.Fragment key={sub.substation_id}>
                                <tr
                                    onClick={() => setExpandedSub(isExpanded ? null : sub.substation_id)}
                                    style={{
                                        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                                        cursor: 'pointer',
                                        background: isExpanded ? 'var(--surface-2)' : 'transparent',
                                        transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-1)'; }}
                                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {isExpanded
                                                ? <ChevronUp size={13} color="var(--accent)" />
                                                : <ChevronDown size={13} color="var(--text-2)" />}
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sub.substation_id}</span>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 500 }}>{sub.name}</div>
                                        {sub.mnemonic && <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{sub.mnemonic}</div>}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{sub.voltage}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-2)' }}>{sub.region || '—'}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-2)' }}>{sub.grid || '—'}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{rels.length}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <span style={{ fontWeight: 600, color: activeCount > 0 ? '#22c55e' : '#94a3b8' }}>
                                            {activeCount}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                            {(sub.relay_scheme_types || []).map(t => (
                                                <span key={t} style={{
                                                    padding: '1px 6px', borderRadius: '4px',
                                                    fontSize: '0.68rem', fontWeight: 600,
                                                    background: 'var(--accent-bg, #3b82f622)',
                                                    color: 'var(--accent)',
                                                }}>{t}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>

                                {/* Expanded relay detail */}
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={8} style={{
                                            padding: '0.6rem 1rem 0.75rem 2.5rem',
                                            background: 'var(--surface-2)',
                                            borderBottom: '1px solid var(--border)',
                                        }}>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                                                Relay Details
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '700px' }}>
                                                {rels.map(relay => <RelayRow key={relay.id} relay={relay} />)}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                    {filteredSubs.length === 0 && (
                        <tr>
                            <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-2)' }}>
                                No substations match the current filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// ── Tab: Analytics ───────────────────────────────────────────────────────────
const AnalyticsTab = ({ subsWithRelays, relays, totalActiveRelays, totalInactiveRelays, byRegion, byGrid, byVoltage, bySchemeType }) => {
    const totalRelays = relays.length;
    const activeRatio = totalRelays > 0 ? Math.round((totalActiveRelays / totalRelays) * 100) : 0;

    return (
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
            {/* Summary cards */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <StatCard label="Substations with Relays" value={subsWithRelays.length} />
                <StatCard label="Total Relays" value={totalRelays} />
                <StatCard
                    label="Active Relays" value={totalActiveRelays}
                    sub={`${activeRatio}% of total`}
                    color="#22c55e"
                />
                <StatCard
                    label="Inactive Relays" value={totalInactiveRelays}
                    color={totalInactiveRelays > 0 ? '#f59e0b' : 'var(--text-1)'}
                />
            </div>

            <SectionHeader title="By Region" />
            <BreakdownTable
                data={byRegion}
                keyFn={r => r.region}
                columns={makeGroupCols('region', 'Region')}
            />

            <SectionHeader title="By Grid" />
            <BreakdownTable
                data={byGrid}
                keyFn={r => r.grid}
                columns={makeGroupCols('grid', 'Grid')}
            />

            <SectionHeader title="By Voltage" />
            <BreakdownTable
                data={byVoltage}
                keyFn={r => r.label}
                columns={[
                    { key: 'label', label: 'Voltage' },
                    ...makeGroupCols('label', 'Voltage').slice(1),
                ]}
            />

            {bySchemeType.length > 0 && (
                <>
                    <SectionHeader title="By Scheme Type" />
                    <BreakdownTable
                        data={bySchemeType}
                        keyFn={r => r.type}
                        columns={[
                            { key: 'type', label: 'Scheme Type' },
                            { key: 'subs', label: 'Substations', right: true },
                        ]}
                    />
                </>
            )}
        </div>
    );
};

// ── Tab: Scanner ─────────────────────────────────────────────────────────────
const ScannerTab = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '260px' }}>
        <div style={{
            border: '2px dashed var(--border)',
            borderRadius: '12px',
            padding: '3rem 4rem',
            textAlign: 'center',
            background: 'var(--surface-1)',
        }}>
            <Upload size={38} color="var(--border)" style={{ marginBottom: '0.9rem' }} />
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)', marginBottom: '0.35rem' }}>
                Excel File Scanner
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Upload an Excel file containing substation relay data.<br />
                This feature is under development.
            </div>
            <span style={{
                display: 'inline-block',
                padding: '0.3rem 1rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: '#f59e0b22',
                color: '#f59e0b',
                border: '1px solid #f59e0b55',
            }}>
                Coming Soon
            </span>
        </div>
    </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const LSRelayManager = ({ isStaff }) => {
    const [substations, setSubstations] = useState([]);
    const [relays, setRelays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('population');

    // Population filters
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('All');
    const [gridFilter, setGridFilter] = useState('All');
    const [voltageFilter, setVoltageFilter] = useState('All');
    const [expandedSub, setExpandedSub] = useState(null);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get('/substations/'),
            api.get('/load-shedding-relays/'),
        ]).then(([subsRes, relaysRes]) => {
            const subs = subsRes.data?.results ?? subsRes.data;
            const rels = relaysRes.data?.results ?? relaysRes.data;
            setSubstations(Array.isArray(subs) ? subs : []);
            setRelays(Array.isArray(rels) ? rels : []);
        }).catch(console.error)
          .finally(() => setLoading(false));
    }, []);

    // substation_id → relay[]
    const relayMap = useMemo(() => {
        const map = {};
        relays.forEach(r => {
            const sid = r.substation_id;
            if (!map[sid]) map[sid] = [];
            map[sid].push(r);
        });
        return map;
    }, [relays]);

    const subsWithRelays = useMemo(() =>
        substations.filter(s => (relayMap[s.substation_id]?.length ?? 0) > 0),
    [substations, relayMap]);

    // Filter options (derived from substations-with-relays only)
    const regions = useMemo(() => {
        const set = new Set(subsWithRelays.map(s => s.region).filter(Boolean));
        return ['All', ...[...set].sort()];
    }, [subsWithRelays]);

    const grids = useMemo(() => {
        const set = new Set(subsWithRelays.map(s => s.grid).filter(Boolean));
        return ['All', ...[...set].sort()];
    }, [subsWithRelays]);

    const voltages = useMemo(() => {
        const vs = [...new Set(subsWithRelays.map(s => String(s.voltage)).filter(v => v && v !== 'null'))];
        vs.sort((a, b) => {
            const ai = VOLTAGE_ORDER.indexOf(Number(a));
            const bi = VOLTAGE_ORDER.indexOf(Number(b));
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        return ['All', ...vs];
    }, [subsWithRelays]);

    const filteredSubs = useMemo(() => {
        const q = search.toLowerCase();
        return subsWithRelays.filter(s => {
            if (regionFilter !== 'All' && s.region !== regionFilter) return false;
            if (gridFilter !== 'All' && s.grid !== gridFilter) return false;
            if (voltageFilter !== 'All' && String(s.voltage) !== voltageFilter) return false;
            if (q && !s.substation_id.toLowerCase().includes(q) &&
                !s.name.toLowerCase().includes(q) &&
                !(s.mnemonic || '').toLowerCase().includes(q)) return false;
            return true;
        });
    }, [subsWithRelays, search, regionFilter, gridFilter, voltageFilter]);

    // Analytics breakdowns
    const byRegion = useMemo(() => {
        const map = {};
        subsWithRelays.forEach(s => {
            const key = s.region || 'Unknown';
            if (!map[key]) map[key] = { region: key, subs: 0, totalRelays: 0, activeRelays: 0 };
            const rels = relayMap[s.substation_id] || [];
            map[key].subs++;
            map[key].totalRelays += rels.length;
            map[key].activeRelays += rels.filter(r => r.is_active).length;
        });
        return Object.values(map).sort((a, b) => b.subs - a.subs);
    }, [subsWithRelays, relayMap]);

    const byGrid = useMemo(() => {
        const map = {};
        subsWithRelays.forEach(s => {
            const key = s.grid || 'Unknown';
            if (!map[key]) map[key] = { grid: key, subs: 0, totalRelays: 0, activeRelays: 0 };
            const rels = relayMap[s.substation_id] || [];
            map[key].subs++;
            map[key].totalRelays += rels.length;
            map[key].activeRelays += rels.filter(r => r.is_active).length;
        });
        return Object.values(map).sort((a, b) => b.subs - a.subs);
    }, [subsWithRelays, relayMap]);

    const byVoltage = useMemo(() => {
        const map = {};
        subsWithRelays.forEach(s => {
            const key = String(s.voltage || 'Unknown');
            if (!map[key]) map[key] = {
                voltage: Number(s.voltage) || 0,
                label: s.voltage ? `${s.voltage} kV` : 'Unknown',
                subs: 0, totalRelays: 0, activeRelays: 0,
            };
            const rels = relayMap[s.substation_id] || [];
            map[key].subs++;
            map[key].totalRelays += rels.length;
            map[key].activeRelays += rels.filter(r => r.is_active).length;
        });
        return Object.values(map).sort((a, b) => {
            const ai = VOLTAGE_ORDER.indexOf(a.voltage);
            const bi = VOLTAGE_ORDER.indexOf(b.voltage);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
    }, [subsWithRelays, relayMap]);

    const bySchemeType = useMemo(() => {
        const map = {};
        substations.forEach(s => {
            (s.relay_scheme_types || []).forEach(t => {
                if (!map[t]) map[t] = { type: t, subs: 0 };
                map[t].subs++;
            });
        });
        return Object.values(map).sort((a, b) => b.subs - a.subs);
    }, [substations]);

    const totalActiveRelays = useMemo(() => relays.filter(r => r.is_active).length, [relays]);
    const totalInactiveRelays = relays.length - totalActiveRelays;

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '0.5rem', color: 'var(--text-2)' }}>
                <Loader2 size={20} className="spin" />
                <span>Loading relay data…</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Page header */}
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                    <Zap size={20} color="var(--accent)" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>LS Relay Management</h2>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', margin: 0 }}>
                    {subsWithRelays.length} substations · {relays.length} relays ({totalActiveRelays} active)
                </p>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.5rem 1rem',
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                                color: active ? 'var(--accent)' : 'var(--text-2)',
                                fontWeight: active ? 600 : 400,
                                fontSize: '0.85rem',
                                marginBottom: '-1px',
                                transition: 'color 0.15s',
                            }}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {activeTab === 'population' && (
                    <PopulationTab
                        filteredSubs={filteredSubs}
                        relayMap={relayMap}
                        search={search} setSearch={setSearch}
                        regionFilter={regionFilter} setRegionFilter={setRegionFilter}
                        gridFilter={gridFilter} setGridFilter={setGridFilter}
                        voltageFilter={voltageFilter} setVoltageFilter={setVoltageFilter}
                        regions={regions} grids={grids} voltages={voltages}
                        expandedSub={expandedSub} setExpandedSub={setExpandedSub}
                        totalCount={subsWithRelays.length}
                    />
                )}
                {activeTab === 'analytics' && (
                    <AnalyticsTab
                        subsWithRelays={subsWithRelays}
                        relays={relays}
                        totalActiveRelays={totalActiveRelays}
                        totalInactiveRelays={totalInactiveRelays}
                        byRegion={byRegion}
                        byGrid={byGrid}
                        byVoltage={byVoltage}
                        bySchemeType={bySchemeType}
                    />
                )}
                {activeTab === 'scanner' && <ScannerTab />}
            </div>
        </div>
    );
};

export default LSRelayManager;
