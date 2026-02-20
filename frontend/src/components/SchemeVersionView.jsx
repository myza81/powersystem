import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    ArrowLeft, BarChart2, Globe, Layers, ChevronDown, ChevronRight,
    Zap, Shield, Activity, MapPin, Eye, Edit3, CheckCircle,
    AlertTriangle, RefreshCw, Radio
} from 'lucide-react';

const api = axios.create({ baseURL: '/api/v1' });

const REGION_COLORS = {
    'North': '#00e5ff',
    'Central': '#a78bfa',
    'South': '#34d399',
    'East': '#f59e0b',
};

// ─── Helpers ──────────────────────────────────────────────────────
const fmtMw = (v) => v != null ? `${Number(v).toFixed(1)} MW` : '—';

// ─── Regional breakdown calculator ───────────────────────────────
function computeRegionBreakdown(groups) {
    const map = {};
    let total = 0;
    for (const g of groups) {
        for (const a of g.assignments || []) {
            const region = a.substation_region || 'Unknown';
            if (!map[region]) map[region] = 0;
        }
    }
    // sum target_mw_shed per group, attributed to group's dominant region
    for (const g of groups) {
        const mw = g.target_mw_shed || 0;
        total += mw;
        const regions = {};
        for (const a of g.assignments || []) {
            const r = a.substation_region || 'Unknown';
            regions[r] = (regions[r] || 0) + 1;
        }
        const dominant = Object.keys(regions).sort((a, b) => regions[b] - regions[a])[0] || 'Unknown';
        map[dominant] = (map[dominant] || 0) + mw;
    }
    return { map, total };
}

// ─── Regional bar chart ───────────────────────────────────────────
const RegionBreakdown = ({ groups }) => {
    const { map, total } = computeRegionBreakdown(groups);
    const regions = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (!regions.length) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {regions.map(([region, mw]) => {
                const pct = total > 0 ? (mw / total) * 100 : 0;
                const color = REGION_COLORS[region] || '#94a3b8';
                return (
                    <div key={region}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                                {region}
                            </span>
                            <span style={{ fontSize: '0.82rem', color, fontWeight: 600 }}>
                                {fmtMw(mw)} ({pct.toFixed(0)}%)
                            </span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                style={{ height: '100%', borderRadius: '4px', background: color }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Assignment item ──────────────────────────────────────────────
const AssignmentRow = ({ assignment }) => {
    const isBranch = assignment.assignment_type === 'branch';
    const label = isBranch
        ? `${assignment.from_substation_id} — ${assignment.to_substation_id} ${assignment.circuit_id}`
        : `${assignment.from_substation_id} ${assignment.circuit_id}`;

    const unresolved = !assignment.substation;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 10px', borderRadius: '7px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${unresolved ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)'}`,
        }}>
            <span style={{
                fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                color: isBranch ? '#00e5ff' : '#a78bfa',
                background: isBranch ? 'rgba(0,229,255,0.1)' : 'rgba(167,139,250,0.1)',
            }}>
                {isBranch ? 'BRANCH' : 'LOAD TX'}
            </span>
            <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0' }}>
                {label}
            </span>
            {assignment.substation_name && (
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                    {assignment.substation_name}
                </span>
            )}
            {assignment.substation_region && (
                <span style={{
                    fontSize: '0.68rem', padding: '1px 7px', borderRadius: '20px',
                    color: REGION_COLORS[assignment.substation_region] || '#94a3b8',
                    background: `${REGION_COLORS[assignment.substation_region] || '#94a3b8'}15`,
                }}>
                    {assignment.substation_region}
                </span>
            )}
            {unresolved && (
                <AlertTriangle size={14} color="#ef4444" title="Substation not found in master data" />
            )}
        </div>
    );
};

// ─── Group accordion ──────────────────────────────────────────────
const GroupAccordion = ({ group, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div style={{
            borderRadius: '12px', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.025)',
        }}>
            {/* Group header */}
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', padding: '1rem 1.2rem',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
            >
                <div style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    background: 'rgba(0,229,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00e5ff' }}>
                        {group.order}
                    </span>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>
                        {group.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {group.trigger_setpoint1 != null && (
                            <span>Primary: {group.trigger_setpoint1} Hz / {group.trigger_delay1}s</span>
                        )}
                        {group.trigger_setpoint2 != null && (
                            <span>Backup: {group.trigger_setpoint2} Hz / {group.trigger_delay2}s</span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {group.target_mw_shed != null && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>
                                {fmtMw(group.target_mw_shed)}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                                Target
                            </div>
                        </div>
                    )}
                    <div style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                </div>
            </button>

            {/* Assignments */}
            {open && (
                <div style={{ padding: '0 1.2rem 1rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(group.assignments || []).length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>
                            No assignments
                        </div>
                    ) : (
                        group.assignments.map(a => <AssignmentRow key={a.id} assignment={a} />)
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main SchemeVersionView ───────────────────────────────────────
const SchemeVersionView = ({ version, onBack, onDesign }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/shedding/versions/${version.id}/`);
            setDetail(data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [version.id]);

    useEffect(() => { load(); }, [load]);

    const schemeType = detail?.scheme_type || version.scheme_type;
    const groups = detail?.groups || [];
    const { total } = computeRegionBreakdown(groups);
    const totalFromGroups = groups.reduce((s, g) => s + (g.target_mw_shed || 0), 0);
    const totalAssignments = groups.reduce((s, g) => s + (g.assignments || []).length, 0);

    return (
        <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
            {/* Back nav */}
            <button onClick={onBack} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.88rem', padding: 0,
                transition: 'color 0.15s',
            }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
                <ArrowLeft size={16} /> Back to Schemes
            </button>

            {/* Version Header */}
            <div style={{
                padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(167,139,250,0.06))',
                border: '1px solid rgba(0,229,255,0.15)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Shield size={20} color="#00e5ff" />
                        <span style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {schemeType}
                        </span>
                        <span style={{
                            fontSize: '0.72rem', padding: '2px 10px', borderRadius: '20px',
                            background: version.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                            color: version.status === 'active' ? '#22c55e' : '#f59e0b',
                            border: `1px solid ${version.status === 'active' ? '#22c55e' : '#f59e0b'}30`,
                            fontWeight: 600,
                        }}>
                            {version.status?.toUpperCase()}
                        </span>
                    </div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>
                        Version {version.version_number}
                    </h2>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                        {version.effective_date && `Effective ${version.effective_date} · `}
                        {version.published_by_username && `Published by ${version.published_by_username}`}
                    </div>
                </div>
                {version.status === 'draft' && onDesign && (
                    <button onClick={() => onDesign(version)} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 16px', borderRadius: '9px',
                        background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                        color: '#a78bfa', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    }}>
                        <Edit3 size={15} /> Edit Draft
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.3)' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Analytics Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        <AnalyticCard label="Total MW Planned" value={fmtMw(totalFromGroups)}
                            icon={<BarChart2 size={18} />} color="#34d399" />
                        <AnalyticCard label="Groups" value={groups.length}
                            icon={<Layers size={18} />} color="#00e5ff" />
                        <AnalyticCard label="Assignments" value={totalAssignments}
                            icon={<Radio size={18} />} color="#a78bfa" />
                    </div>

                    {/* Regional Breakdown */}
                    {groups.length > 0 && (
                        <div style={{
                            padding: '1.5rem', borderRadius: '14px', marginBottom: '2rem',
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.2rem', color: 'rgba(255,255,255,0.7)' }}>
                                <Globe size={16} />
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Regional Breakdown
                                </span>
                            </div>
                            <RegionBreakdown groups={groups} />
                        </div>
                    )}

                    {/* Groups */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {groups.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                                No groups defined for this version.
                            </div>
                        ) : (
                            groups
                                .slice()
                                .sort((a, b) => a.order - b.order)
                                .map((g, i) => <GroupAccordion key={g.id} group={g} defaultOpen={i === 0} />)
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const AnalyticCard = ({ label, value, icon, color }) => (
    <div style={{
        padding: '1.2rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: `1px solid ${color}20`,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, marginBottom: '8px' }}>
            {icon}
            <span style={{ fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
            </span>
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
    </div>
);

export default SchemeVersionView;
