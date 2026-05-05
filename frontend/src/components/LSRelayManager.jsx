import React, { useEffect, useMemo, useState } from 'react';
import {
    BarChart2, Building2, FileSpreadsheet,
    ChevronDown, ChevronUp, Info, Upload,
    CheckCircle, XCircle,
} from 'lucide-react';
import { LuCircuitBoard } from 'react-icons/lu';
import { CardLoader } from './Loader';
import SubstationFilter from './SubstationFilter';
import api from '../api';

// ── Constants ────────────────────────────────────────────────────────────────
const VOLTAGE_ORDER = [500, 275, 132, 66, 33, 11];

const TABS = [
    { id: 'population', label: 'Population', icon: Building2 },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'scanner', label: 'Scanner', icon: FileSpreadsheet },
];

const DEFAULT_FILTERS = {
    region: 'All',
    grid: 'All',
    state: 'All',
    voltage: 'All',
    ownership: 'All',
    search: '',
    hasRelay: 'All',
    commissionYear: 'All',
    transformerYear: 'All',
    schemeType: 'All',
};

const thStyle = {
    padding: '0.65rem 0.85rem',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 'var(--text-xs)',
    color: 'var(--text-3)',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
};
const tdStyle = {
    padding: '0.65rem 0.85rem',
    color: 'var(--text-1)',
    verticalAlign: 'middle',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatMw = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW`;
};

const sumMw = (items) => items.reduce((sum, item) => {
    if (item.current_mw === null || item.current_mw === undefined) return sum;
    const mw = Number(item.current_mw);
    return Number.isFinite(mw) ? sum + mw : sum;
}, 0);

const InfoTooltip = ({ text }) => {
    const [position, setPosition] = useState(null);

    const show = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({
            top: rect.top - 8,
            left: rect.left + rect.width / 2,
        });
    };

    return (
        <span
            tabIndex={0}
            onMouseEnter={show}
            onMouseLeave={() => setPosition(null)}
            onFocus={show}
            onBlur={() => setPosition(null)}
            style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', flexShrink: 0 }}
        >
            <Info size={12} strokeWidth={2.4} color="var(--text-3)" />
            {position && (
                <span style={{
                    position: 'fixed',
                    top: position.top,
                    left: position.left,
                    transform: 'translate(-50%, -100%)',
                    width: 235,
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.96)',
                    color: '#f8fafc',
                    boxShadow: 'var(--shadow-lg)',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    lineHeight: 1.45,
                    letterSpacing: 0,
                    textTransform: 'none',
                    whiteSpace: 'normal',
                    textAlign: 'left',
                    zIndex: 10000,
                    pointerEvents: 'none',
                }}>
                    {text}
                </span>
            )}
        </span>
    );
};

const aggregateRelayMw = (relaysForSubstation) => {
    const seen = new Set();
    let total = 0;

    relaysForSubstation.forEach(relay => {
        [
            ...(relay.load_transformers || []).map(asset => ({ asset, type: 'LT' })),
            ...(relay.auto_transformers || []).map(asset => ({ asset, type: 'AT' })),
        ].forEach(({ asset, type }, index) => {
            const key = `${type}-${asset.id || asset.bay_id || asset.display_name || asset.transformer_no || `${relay.id || 'relay'}-${index}`}`;
            if (seen.has(key)) return;
            seen.add(key);

            const mw = Number(asset.current_mw);
            if (Number.isFinite(mw)) total += mw;
        });
    });

    return total;
};

const assetLabel = (asset, type) => {
    if (asset.display_name) return asset.display_name;
    if (type === 'LT') return `T${asset.transformer_no ?? '?'}`;
    if (type === 'AT') return `AT${asset.transformer_no ?? '?'}`;
    if (type === 'IB') {
        const toSub = asset.to_substation_detail?.substation_id || asset.to_substation || 'Unknown';
        return `${toSub} Cct ${asset.ckt_id || '-'}`;
    }
    return asset.bay_id || 'Asset';
};

const RelayRow = ({ relay }) => {
    const loadTransformers = relay.load_transformers || [];
    const incomingBranches = relay.incoming_branches || [];
    const autoTransformers = relay.auto_transformers || [];
    const rows = [
        ...loadTransformers.map(asset => ({ asset, type: 'LT' })),
        ...incomingBranches.map(asset => ({ asset, type: 'IB' })),
        ...autoTransformers.map(asset => ({ asset, type: 'AT' })),
    ];
    const totalMw = sumMw([...loadTransformers, ...autoTransformers]);
    return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                    <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={thStyle}>Voltage Level</th>
                        <th style={thStyle}>LT / IB Details</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>MW</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Aggregate MW</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ asset, type }, index) => (
                        <tr key={`${type}-${asset.id || asset.bay_id}`} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            {index === 0 && (
                                <td rowSpan={rows.length} style={{ ...tdStyle, verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                        {relay.is_active
                                            ? <CheckCircle size={13} color="#22c55e" />
                                            : <XCircle size={13} color="#94a3b8" />}
                                        <span style={{ fontWeight: 700 }}>{relay.target_voltage != null ? `${relay.target_voltage} kV` : 'Unknown'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', marginTop: '0.25rem' }}>
                                        {relay.relay_name || `Relay #${relay.id}`}
                                    </div>
                                </td>
                            )}
                            <td style={tdStyle}>
                                <div style={{ fontWeight: 700 }}>{assetLabel(asset, type)}</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-3)', marginTop: 1 }}>
                                    {type} · {asset.bay_id || asset.to_substation_detail?.name || '-'}
                                </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: type === 'IB' ? 'var(--text-3)' : 'var(--brand-mid)' }}>
                                {formatMw(asset.current_mw)}
                            </td>
                            {index === 0 && (
                                <td rowSpan={rows.length} style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top', fontWeight: 800, color: 'var(--brand-dark)' }}>
                                    {formatMw(totalMw)}
                                    <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                                        LT/AT only
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ padding: '0.9rem', textAlign: 'center', color: 'var(--text-2)' }}>
                                No LT or IB details configured.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

const BreakdownTable = ({ data, columns, keyFn }) => (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', background: 'var(--surface-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-default)' }}>
                    {columns.map(c => (
                        <th key={c.key} style={{ ...thStyle, textAlign: c.right ? 'right' : 'left' }}>{c.label}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map(row => (
                    <tr key={keyFn(row)} style={{ borderBottom: '1px solid var(--border-default)' }}>
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
    {
        key: 'assigned', label: 'Assigned', right: true,
        render: row => <span style={{ fontWeight: 600, color: row.assigned > 0 ? 'var(--brand-mid)' : 'var(--text-3)' }}>{row.assigned}</span>,
    },
    {
        key: 'notAssigned', label: 'Not Assigned', right: true,
        render: row => {
            const n = row.subs - row.assigned;
            return <span style={{ fontWeight: 600, color: n > 0 ? '#f59e0b' : 'var(--text-3)' }}>{n}</span>;
        },
    },
    {
        key: 'notAssignedMw',
        label: 'Not Assigned (MW)',
        right: true,
        render: row => (
            <span style={{ fontWeight: 700, color: row.notAssignedMw > 0 ? '#b45309' : 'var(--text-3)' }}>
                {formatMw(row.notAssignedMw)}
            </span>
        ),
    },
    {
        key: 'availableUnassigned',
        label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                Available Unassigned
                <InfoTooltip text="Substations without scheme assignment, excluding critical substations." />
            </span>
        ),
        right: true,
        render: row => (
            <span style={{ fontWeight: 600, color: row.availableUnassigned > 0 ? '#0f766e' : 'var(--text-3)' }}>
                {row.availableUnassigned}
            </span>
        ),
    },
    {
        key: 'availableUnassignedMw',
        label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                Available Unassigned (MW)
                <InfoTooltip text="Aggregate LT/AT MW from available unassigned substations." />
            </span>
        ),
        right: true,
        render: row => (
            <span style={{ fontWeight: 700, color: row.availableUnassignedMw > 0 ? 'var(--brand-dark)' : 'var(--text-3)' }}>
                {formatMw(row.availableUnassignedMw)}
            </span>
        ),
    },
];

const SectionHeader = ({ title }) => (
    <div style={{
        fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)',
        margin: '1.5rem 0 0.6rem',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        borderBottom: '1px solid var(--border-default)', paddingBottom: '0.35rem',
    }}>
        {title}
    </div>
);

// ── Tab: Population ──────────────────────────────────────────────────────────
const PopulationTab = ({
    filteredSubs, relayMap,
    expandedSub, setExpandedSub,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={thStyle}>Sub ID</th>
                        <th style={thStyle}>Name</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>kV</th>
                        <th style={thStyle}>Region</th>
                        <th style={thStyle}>Grid</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Voltage Assignments</th>
                        <th style={thStyle}>Scheme Types</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredSubs.map(sub => {
                        const rels = relayMap[sub.substation_id] || [];
                        const isExpanded = expandedSub === sub.substation_id;
                        return (
                            <React.Fragment key={sub.substation_id}>
                                <tr
                                    onClick={() => setExpandedSub(isExpanded ? null : sub.substation_id)}
                                    style={{
                                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-default)',
                                        cursor: 'pointer',
                                        background: isExpanded ? 'rgba(4,125,96,0.05)' : 'transparent',
                                        transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {isExpanded
                                                ? <ChevronUp size={13} color="var(--brand-mid)" />
                                                : <ChevronDown size={13} color="var(--text-2)" />}
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sub.substation_id}</span>
                                            {sub.is_critical && (
                                                <span title="Critical substation" style={{ display: 'inline-flex', alignItems: 'center', color: '#dc2626' }}>
                                                    <Info size={13} strokeWidth={2.4} />
                                                </span>
                                            )}
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
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                            {(sub.relay_scheme_types || []).map(t => (
                                                <span key={t} style={{
                                                    padding: '1px 6px', borderRadius: '4px',
                                                    fontSize: '0.68rem', fontWeight: 600,
                                                    background: 'rgba(4,125,96,0.08)',
                                                    color: 'var(--brand-dark)',
                                                }}>{t}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>

                                {/* Expanded relay detail */}
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={7} style={{
                                            padding: '0.6rem 1rem 0.75rem 2.5rem',
                                            background: 'rgba(4,125,96,0.05)',
                                            borderBottom: '1px solid var(--border-default)',
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
                            <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-2)' }}>
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
const AnalyticsTab = ({ byRegion, byGrid, byVoltage, bySchemeType }) => (
    <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
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

// ── Tab: Scanner ─────────────────────────────────────────────────────────────
const ScannerTab = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '260px' }}>
        <div style={{
            border: '2px dashed var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '3rem 4rem',
            textAlign: 'center',
            background: 'var(--surface-card)',
        }}>
            <Upload size={38} color="var(--border-strong)" style={{ marginBottom: '0.9rem' }} />
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

    const [filterCriteria, setFilterCriteria] = useState(DEFAULT_FILTERS);
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

    const schemeTypeOptions = useMemo(() => {
        const types = new Set();
        subsWithRelays.forEach(s => (s.relay_scheme_types || []).forEach(type => types.add(type)));
        return ['All', 'None', ...[...types].sort()];
    }, [subsWithRelays]);

    const filteredSubs = useMemo(() => {
        const { region, grid, state, voltage, search, schemeType } = filterCriteria;
        const q = search.toLowerCase();
        return subsWithRelays.filter(s => {
            if (region !== 'All' && s.region !== region) return false;
            if (grid !== 'All' && s.grid !== grid) return false;
            if (state !== 'All' && s.state !== state) return false;
            if (voltage !== 'All' && String(s.voltage) !== String(voltage)) return false;
            if (q && !s.substation_id.toLowerCase().includes(q) &&
                !s.name.toLowerCase().includes(q) &&
                !(s.mnemonic || '').toLowerCase().includes(q)) return false;
            if (schemeType === 'None' && (s.relay_scheme_types || []).length > 0) return false;
            if (schemeType !== 'All' && schemeType !== 'None' && !(s.relay_scheme_types || []).includes(schemeType)) return false;
            return true;
        });
    }, [subsWithRelays, filterCriteria]);

    // Analytics breakdowns
    const byRegion = useMemo(() => {
        const map = {};
        subsWithRelays.forEach(s => {
            const key = s.region || 'Unknown';
            if (!map[key]) map[key] = { region: key, subs: 0, assigned: 0, notAssignedMw: 0, availableUnassigned: 0, availableUnassignedMw: 0 };
            const isAssigned = (s.relay_scheme_types || []).length > 0;
            map[key].subs++;
            if (isAssigned) map[key].assigned++;
            else if (!s.is_critical) {
                map[key].availableUnassigned++;
                const mw = aggregateRelayMw(relayMap[s.substation_id] || []);
                map[key].notAssignedMw += mw;
                map[key].availableUnassignedMw += mw;
            } else {
                map[key].notAssignedMw += aggregateRelayMw(relayMap[s.substation_id] || []);
            }
        });
        return Object.values(map).sort((a, b) => b.subs - a.subs);
    }, [subsWithRelays, relayMap]);

    const byGrid = useMemo(() => {
        const map = {};
        subsWithRelays.forEach(s => {
            const key = s.grid || 'Unknown';
            if (!map[key]) map[key] = { grid: key, subs: 0, assigned: 0, notAssignedMw: 0, availableUnassigned: 0, availableUnassignedMw: 0 };
            const isAssigned = (s.relay_scheme_types || []).length > 0;
            map[key].subs++;
            if (isAssigned) map[key].assigned++;
            else if (!s.is_critical) {
                map[key].availableUnassigned++;
                const mw = aggregateRelayMw(relayMap[s.substation_id] || []);
                map[key].notAssignedMw += mw;
                map[key].availableUnassignedMw += mw;
            } else {
                map[key].notAssignedMw += aggregateRelayMw(relayMap[s.substation_id] || []);
            }
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
                subs: 0, assigned: 0, notAssignedMw: 0, availableUnassigned: 0, availableUnassignedMw: 0,
            };
            const isAssigned = (s.relay_scheme_types || []).length > 0;
            map[key].subs++;
            if (isAssigned) map[key].assigned++;
            else if (!s.is_critical) {
                map[key].availableUnassigned++;
                const mw = aggregateRelayMw(relayMap[s.substation_id] || []);
                map[key].notAssignedMw += mw;
                map[key].availableUnassignedMw += mw;
            } else {
                map[key].notAssignedMw += aggregateRelayMw(relayMap[s.substation_id] || []);
            }
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

    if (loading) {
        return <CardLoader show message="Loading relay data…" />;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-default)', flexShrink: 0, background: 'var(--surface-card)', padding: '0 2rem', zIndex: 20 }}>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.6rem 1.25rem',
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderBottom: active ? '2px solid var(--brand-mid)' : '2px solid transparent',
                                color: active ? 'var(--brand-dark)' : 'var(--text-2)',
                                fontWeight: active ? 600 : 500,
                                fontSize: 'var(--text-sm)',
                                marginBottom: '-1px',
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'population' && (
                <SubstationFilter
                    substations={subsWithRelays}
                    currentFilters={filterCriteria}
                    onUpdateFilters={setFilterCriteria}
                    extraLabel="Scheme Type"
                    extraValue={filterCriteria.schemeType}
                    onExtraChange={(val) => setFilterCriteria(prev => ({ ...prev, schemeType: val }))}
                    extraOptions={schemeTypeOptions}
                    showRelayFilter={false}
                    pageTitle="LS Relay"
                    resultCount={filteredSubs.length}
                    icon={LuCircuitBoard}
                />
            )}

            {activeTab === 'analytics' && (
                <div style={{
                    flexShrink: 0,
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0 1.5rem',
                    background: 'var(--surface-card)',
                    borderBottom: '1px solid var(--border-default)',
                }}>
                    <BarChart2 size={16} color="var(--brand-mid)" strokeWidth={2} />
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                        Relay Analytics
                    </span>
                    <span style={{
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        color: 'var(--text-2)',
                        padding: '1px 8px',
                    }}>
                        {subsWithRelays.length.toLocaleString()} substations
                    </span>
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1rem 1.5rem 1.5rem' }} className="custom-scrollbar">
                {activeTab === 'population' && (
                    <PopulationTab
                        filteredSubs={filteredSubs}
                        relayMap={relayMap}
                        expandedSub={expandedSub} setExpandedSub={setExpandedSub}
                    />
                )}
                {activeTab === 'analytics' && (
                    <AnalyticsTab
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
