import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, Shield, Activity, ChevronRight, ChevronDown,
    BarChart2, Plus, Edit3, Eye, Clock, CheckCircle,
    AlertTriangle, BookOpen, RefreshCw, Tag
} from 'lucide-react';
import SchemeVersionView from './SchemeVersionView';
import ShedDesign from './ShedDesign';

const api = axios.create({ baseURL: '/api/v1' });

const SCHEME_TYPES = ['UFLS', 'UVLS', 'MANUAL'];
const SCHEME_LABELS = {
    UFLS: 'Under-Frequency Load Shedding',
    UVLS: 'Under-Voltage Load Shedding',
    MANUAL: 'Manual Load Shedding',
};
const SCHEME_COLORS = {
    UFLS: '#00e5ff',
    UVLS: '#a78bfa',
    MANUAL: '#34d399',
};

const STATUS_BADGE = {
    active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    draft: { label: 'Draft', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    superseded: { label: 'Superseded', color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

// ─── Status badge pill ────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const cfg = STATUS_BADGE[status] || STATUS_BADGE.draft;
    return (
        <span style={{
            fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em',
            padding: '2px 10px', borderRadius: '20px',
            color: cfg.color, background: cfg.bg,
            border: `1px solid ${cfg.color}30`,
        }}>
            {cfg.label.toUpperCase()}
        </span>
    );
};

// ─── Individual version row ───────────────────────────────────────
const VersionRow = ({ version, onView, onClone, onDesign }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '0.85rem 1rem',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.06)',
            transition: 'background 0.15s',
            cursor: 'default',
        }}
        whileHover={{ background: 'rgba(255,255,255,0.06)' }}
    >
        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>
                    {version.version_number}
                </span>
                <StatusBadge status={version.status} />
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>
                {version.effective_date
                    ? `Effective ${version.effective_date}`
                    : 'No effective date'
                }
                {version.published_by_username && ` · Published by ${version.published_by_username}`}
            </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
            {/* View (SchemeVersionView) — all versions */}
            <ActionBtn icon={<Eye size={14} />} label="View" onClick={() => onView(version)}
                color="#00e5ff" />
            {/* Design (ShedDesign) — draft only */}
            {version.status === 'draft' && (
                <ActionBtn icon={<Edit3 size={14} />} label="Edit Draft" onClick={() => onDesign(version)}
                    color="#a78bfa" />
            )}
            {/* Clone into new draft */}
            <ActionBtn icon={<Plus size={14} />} label="Clone" onClick={() => onClone(version)}
                color="#34d399" />
        </div>
    </motion.div>
);

const ActionBtn = ({ icon, label, onClick, color }) => (
    <button
        onClick={onClick}
        title={label}
        style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 10px', borderRadius: '7px',
            background: `${color}15`, border: `1px solid ${color}30`,
            color, fontSize: '0.78rem', fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${color}25`; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; }}
    >
        {icon}{label}
    </button>
);

// ─── Scheme tab panel ─────────────────────────────────────────────
const SchemePanel = ({ schemeType, onView, onDesign }) => {
    const [scheme, setScheme] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const color = SCHEME_COLORS[schemeType];
    const label = SCHEME_LABELS[schemeType];

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [schRes, verRes] = await Promise.all([
                api.get(`/shedding/schemes/?scheme_type=${schemeType}`),
                api.get(`/shedding/versions/?scheme_type=${schemeType}`),
            ]);
            setScheme(schRes.data.results?.[0] || schRes.data[0] || null);
            setVersions(verRes.data.results || verRes.data || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [schemeType]);

    useEffect(() => { load(); }, [load]);

    const handleCreateScheme = async () => {
        setCreating(true);
        try {
            await api.post('/shedding/schemes/', {
                scheme_type: schemeType,
                name: label,
                description: `${label} scheme`,
            });
            await load();
        } catch (e) {
            console.error(e);
        }
        setCreating(false);
    };

    const handleClone = async (sourceVersion) => {
        if (!scheme) return;
        const newNum = `Clone of ${sourceVersion.version_number} (${new Date().toLocaleDateString('en-MY')})`;
        try {
            // Create new draft version
            const { data: newVer } = await api.post('/shedding/versions/', {
                scheme: scheme.id,
                version_number: newNum,
                status: 'draft',
                notes: `Cloned from ${sourceVersion.version_number}`,
            });
            // Copy groups + assignments
            const { data: verDetail } = await api.get(`/shedding/versions/${sourceVersion.id}/`);
            for (const group of verDetail.groups || []) {
                const { data: newGroup } = await api.post('/shedding/groups/', {
                    version: newVer.id,
                    name: group.name,
                    order: group.order,
                    trigger_setpoint1: group.trigger_setpoint1,
                    trigger_delay1: group.trigger_delay1,
                    trigger_setpoint2: group.trigger_setpoint2,
                    trigger_delay2: group.trigger_delay2,
                    target_mw_shed: group.target_mw_shed,
                    include_autotransformers: group.include_autotransformers,
                });
                for (const a of group.assignments || []) {
                    await api.post('/shedding/assignments/', {
                        group: newGroup.id,
                        assignment_type: a.assignment_type,
                        from_substation_id: a.from_substation_id,
                        to_substation_id: a.to_substation_id,
                        circuit_id: a.circuit_id,
                        note: a.note,
                    });
                }
            }
            await load();
            // Open ShedDesign for the new draft
            onDesign(newVer);
        } catch (e) {
            console.error(e);
        }
    };

    const handleNewDraft = async () => {
        if (!scheme) { await handleCreateScheme(); return; }
        try {
            const { data: newVer } = await api.post('/shedding/versions/', {
                scheme: scheme.id,
                version_number: `Draft ${new Date().getFullYear()}-${String(versions.length + 1).padStart(2, '0')}`,
                status: 'draft',
            });
            await load();
            onDesign(newVer);
        } catch (e) {
            console.error(e);
        }
    };

    const activeVersion = versions.find(v => v.status === 'active');
    const drafts = versions.filter(v => v.status === 'draft');
    const history = versions.filter(v => v.status === 'superseded');

    if (loading) return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Header metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <MetricCard label="Active Version" value={activeVersion?.version_number || '—'}
                    icon={<CheckCircle size={18} />} color={color} />
                <MetricCard label="Draft(s)" value={drafts.length} icon={<Edit3 size={18} />} color="#f59e0b" />
                <MetricCard label="History" value={history.length} icon={<Clock size={18} />} color="#64748b" />
            </div>

            {/* No scheme yet */}
            {!scheme && (
                <div style={{
                    padding: '2rem', textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)',
                }}>
                    <Shield size={32} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '1rem' }} />
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                        No {schemeType} scheme exists yet.
                    </div>
                    <button onClick={handleCreateScheme} disabled={creating}
                        style={{
                            padding: '8px 20px', borderRadius: '8px',
                            background: `${color}20`, border: `1px solid ${color}40`,
                            color, cursor: 'pointer', fontWeight: 600,
                        }}>
                        {creating ? 'Creating…' : `Initialize ${schemeType} Scheme`}
                    </button>
                </div>
            )}

            {/* Active version */}
            {activeVersion && (
                <Section label="Active" icon={<CheckCircle size={14} />} color="#22c55e">
                    <VersionRow version={activeVersion}
                        onView={() => onView(activeVersion)}
                        onClone={() => handleClone(activeVersion)}
                        onDesign={() => onDesign(activeVersion)} />
                </Section>
            )}

            {/* Drafts */}
            {scheme && (
                <Section label="Drafts" icon={<Edit3 size={14} />} color="#f59e0b"
                    action={
                        <ActionBtn icon={<Plus size={13} />} label="New Draft"
                            onClick={handleNewDraft} color="#f59e0b" />
                    }
                >
                    {drafts.length === 0 ? (
                        <EmptyState text="No drafts." />
                    ) : drafts.map(v => (
                        <VersionRow key={v.id} version={v}
                            onView={() => onView(v)}
                            onClone={() => handleClone(v)}
                            onDesign={() => onDesign(v)} />
                    ))}
                </Section>
            )}

            {/* History */}
            {history.length > 0 && (
                <Section label="History" icon={<Clock size={14} />} color="#64748b" collapsible>
                    {history.map(v => (
                        <VersionRow key={v.id} version={v}
                            onView={() => onView(v)}
                            onClone={() => handleClone(v)}
                            onDesign={() => { }} />
                    ))}
                </Section>
            )}
        </div>
    );
};

const MetricCard = ({ label, value, icon, color }) => (
    <div style={{
        padding: '1rem 1.2rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: `1px solid ${color}20`,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, marginBottom: '6px' }}>
            {icon}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
            </span>
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
    </div>
);

const Section = ({ label, icon, color, children, action, collapsible = false }) => {
    const [open, setOpen] = useState(true);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '6px', borderBottom: `1px solid rgba(255,255,255,0.06)`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color }}>
                    {icon}
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {label}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {action}
                    {collapsible && (
                        <button onClick={() => setOpen(!open)} style={{
                            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                            cursor: 'pointer', padding: '2px',
                        }}>
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}
                </div>
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const EmptyState = ({ text }) => (
    <div style={{ padding: '1.2rem', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
        {text}
    </div>
);

// ─── Main Manager Component ───────────────────────────────────────
const LoadSheddingManager = () => {
    const [activeTab, setActiveTab] = useState('UFLS');
    const [innerView, setInnerView] = useState(null); // null | { mode: 'view'|'design', version }

    const handleView = (version) => setInnerView({ mode: 'view', version });
    const handleDesign = (version) => setInnerView({ mode: 'design', version });
    const handleBack = () => setInnerView(null);

    // Drill into SchemeVersionView
    if (innerView?.mode === 'view') {
        return (
            <SchemeVersionView
                version={innerView.version}
                onBack={handleBack}
                onDesign={handleDesign}
            />
        );
    }

    // Drill into ShedDesign
    if (innerView?.mode === 'design') {
        return (
            <ShedDesign
                version={innerView.version}
                onBack={handleBack}
                onPublished={handleBack}
            />
        );
    }

    return (
        <div style={{
            padding: '2rem',
            maxWidth: '1100px',
            margin: '0 auto',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Page Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: 'rgba(0,229,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Shield size={22} color="#00e5ff" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>
                        Load Shedding Schemes
                    </h1>
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
                    Manage versioned UFLS, UVLS, and Manual load shedding schemes
                </p>
            </div>

            {/* Scheme Type Tabs */}
            <div style={{
                display: 'flex', gap: '4px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '12px', padding: '4px',
                marginBottom: '2rem',
                border: '1px solid rgba(255,255,255,0.07)',
            }}>
                {SCHEME_TYPES.map(type => {
                    const active = activeTab === type;
                    const color = SCHEME_COLORS[type];
                    return (
                        <button key={type}
                            onClick={() => setActiveTab(type)}
                            style={{
                                flex: 1, padding: '10px 16px', borderRadius: '9px',
                                border: active ? `1px solid ${color}40` : '1px solid transparent',
                                background: active ? `${color}15` : 'transparent',
                                color: active ? color : 'rgba(255,255,255,0.4)',
                                fontWeight: active ? 700 : 500,
                                fontSize: '0.9rem', cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}
                        >
                            {type === 'UFLS' && <Zap size={16} />}
                            {type === 'UVLS' && <Activity size={16} />}
                            {type === 'MANUAL' && <BookOpen size={16} />}
                            {type}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                >
                    <SchemePanel
                        schemeType={activeTab}
                        onView={handleView}
                        onDesign={handleDesign}
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default LoadSheddingManager;
