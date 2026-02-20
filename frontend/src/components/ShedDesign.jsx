import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    ArrowLeft, Plus, Trash2, GripVertical, Save, Upload,
    CheckCircle, AlertTriangle, X, RefreshCw, ChevronDown,
    ChevronRight, Shield, Edit3, Info, Zap
} from 'lucide-react';

const api = axios.create({ baseURL: '/api/v1' });

// ─── Parsers ──────────────────────────────────────────────────────
// "BRGS132 - MGST132 1"  → { type: branch, from, to, ckt }
// "BRGS132 T1"           → { type: load_transformer, from, ckt }
function parseLine(line) {
    line = line.trim();
    if (!line) return null;
    const branchMatch = line.match(/^(\S+)\s*-\s*(\S+)\s+(.+)$/);
    if (branchMatch) {
        return {
            assignment_type: 'branch',
            from_substation_id: branchMatch[1].toUpperCase(),
            to_substation_id: branchMatch[2].toUpperCase(),
            circuit_id: branchMatch[3].trim(),
        };
    }
    const loadMatch = line.match(/^(\S+)\s+(\S+)$/);
    if (loadMatch) {
        return {
            assignment_type: 'load_transformer',
            from_substation_id: loadMatch[1].toUpperCase(),
            to_substation_id: null,
            circuit_id: loadMatch[2].trim(),
        };
    }
    return null;
}

function formatAssignment(a) {
    if (a.assignment_type === 'branch') {
        return `${a.from_substation_id} - ${a.to_substation_id} ${a.circuit_id}`;
    }
    return `${a.from_substation_id} ${a.circuit_id}`;
}

// ─── Alert assistant ──────────────────────────────────────────────
function runAlerts(groups) {
    const alerts = [];
    const seen = new Set();

    for (const g of groups) {
        for (const a of (g.assignments || [])) {
            const key = `${a.from_substation_id}|${a.to_substation_id || ''}|${a.circuit_id}`;
            if (seen.has(key)) {
                alerts.push({
                    type: 'duplicate',
                    msg: `Duplicate assignment: ${formatAssignment(a)} (appears in multiple groups)`,
                });
            }
            seen.add(key);

            if (!a.substation) {
                alerts.push({
                    type: 'unresolved',
                    msg: `Substation not found: "${a.from_substation_id}" in ${g.name}`,
                });
            }
        }
    }
    return alerts;
}

// ─── Assignment input box for a group ─────────────────────────────
const AssignmentEditor = ({ groupId, assignments, onRefresh }) => {
    const [input, setInput] = useState('');
    const [preview, setPreview] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleParse = useCallback(() => {
        const lines = input.split('\n').filter(Boolean);
        const parsed = lines.map(l => ({ line: l, parsed: parseLine(l) }));
        setPreview(parsed);
    }, [input]);

    useEffect(() => { handleParse(); }, [input, handleParse]);

    const handleAdd = async () => {
        const valid = preview.filter(p => p.parsed);
        if (!valid.length) { setError('No valid lines to add.'); return; }
        setSaving(true);
        setError('');
        try {
            for (const { parsed } of valid) {
                await api.post('/shedding/assignments/', { group: groupId, ...parsed });
            }
            setInput('');
            setPreview([]);
            onRefresh();
        } catch (e) {
            setError(e.response?.data ? JSON.stringify(e.response.data) : e.message);
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/shedding/assignments/${id}/`);
            onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Existing assignments */}
            {assignments.map(a => (
                <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${a.substation ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                    <span style={{
                        fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                        color: a.assignment_type === 'branch' ? '#00e5ff' : '#a78bfa',
                        background: a.assignment_type === 'branch' ? 'rgba(0,229,255,0.1)' : 'rgba(167,139,250,0.1)',
                    }}>
                        {a.assignment_type === 'branch' ? 'BRANCH' : 'LOAD TX'}
                    </span>
                    <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.83rem', color: '#e2e8f0' }}>
                        {formatAssignment(a)}
                    </span>
                    {a.substation_name && (
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                            {a.substation_name}
                        </span>
                    )}
                    {!a.substation && (
                        <span title="Substation not found in master data">
                            <AlertTriangle size={13} color="#ef4444" />
                        </span>
                    )}
                    <button onClick={() => handleDelete(a.id)} style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
                        cursor: 'pointer', padding: '2px', borderRadius: '4px',
                        transition: 'color 0.15s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}

            {/* Input area */}
            <div style={{
                background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
            }}>
                <div style={{
                    padding: '6px 12px', background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500,
                }}>
                    BRANCH: BRGS132 - MGST132 1 · LOAD: BRGS132 T1
                </div>
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={'BRGS132 - MGST132 1\nLKGR132 T1\nBRGS132 - ASMB132 2'}
                    rows={3}
                    style={{
                        width: '100%', background: 'transparent', border: 'none',
                        color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.85rem',
                        padding: '10px 12px', resize: 'vertical', outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
                {/* Preview */}
                {preview.some(p => p.line) && (
                    <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {preview.map((p, i) => (
                            <div key={i} style={{
                                fontSize: '0.75rem',
                                color: p.parsed ? '#34d399' : '#ef4444',
                                fontFamily: 'monospace',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                {p.parsed ? <CheckCircle size={11} /> : <X size={11} />}
                                {p.parsed
                                    ? `${p.parsed.assignment_type === 'branch' ? 'Branch' : 'Load TX'}: ${formatAssignment(p.parsed)}`
                                    : `Invalid: "${p.line}"`
                                }
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {error && <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>{error}</span>}
                    <button onClick={handleAdd} disabled={saving || !preview.some(p => p.parsed)}
                        style={{
                            marginLeft: 'auto',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '5px 14px', borderRadius: '7px',
                            background: saving ? 'rgba(255,255,255,0.05)' : 'rgba(52,211,153,0.15)',
                            border: '1px solid rgba(52,211,153,0.3)',
                            color: '#34d399', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        }}>
                        {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                        {saving ? 'Saving…' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Group card (editable) ─────────────────────────────────────────
const GroupCard = ({ group: initialGroup, onDelete, onRefresh }) => {
    const [group, setGroup] = useState(initialGroup);
    const [expanded, setExpanded] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const update = (field, value) => {
        setGroup(g => ({ ...g, [field]: value }));
        setDirty(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            await api.patch(`/shedding/groups/${group.id}/`, {
                name: group.name,
                order: group.order,
                trigger_setpoint1: group.trigger_setpoint1 || null,
                trigger_delay1: group.trigger_delay1 || null,
                trigger_setpoint2: group.trigger_setpoint2 || null,
                trigger_delay2: group.trigger_delay2 || null,
                target_mw_shed: group.target_mw_shed || null,
                include_autotransformers: group.include_autotransformers,
            });
            setDirty(false);
            onRefresh();
        } catch (e) {
            console.error(e);
        }
        setSaving(false);
    };

    const Field = ({ label, field, type = 'number', step }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </label>
            <input
                type={type} step={step || '0.01'}
                value={group[field] ?? ''}
                onChange={e => update(field, e.target.value ? parseFloat(e.target.value) : null)}
                style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '7px', padding: '6px 10px',
                    color: '#f1f5f9', fontSize: '0.85rem', outline: 'none',
                    width: '100%', boxSizing: 'border-box',
                }}
            />
        </div>
    );

    return (
        <motion.div layout style={{
            borderRadius: '14px', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.09)',
            background: 'rgba(255,255,255,0.03)',
        }}>
            {/* Group header */}
            <div style={{
                padding: '0.9rem 1.2rem',
                display: 'flex', alignItems: 'center', gap: '10px',
            }}>
                <GripVertical size={16} color="rgba(255,255,255,0.2)" style={{ cursor: 'grab' }} />
                <div style={{
                    width: '26px', height: '26px', borderRadius: '6px',
                    background: 'rgba(0,229,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#00e5ff' }}>{group.order}</span>
                </div>
                <input
                    value={group.name}
                    onChange={e => update('name', e.target.value)}
                    style={{
                        flex: 1, background: 'transparent', border: 'none',
                        color: '#f1f5f9', fontWeight: 600, fontSize: '0.97rem', outline: 'none',
                    }}
                />
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {dirty && (
                        <button onClick={save} disabled={saving} style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 12px', borderRadius: '7px',
                            background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
                            color: '#34d399', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        }}>
                            {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    )}
                    <button onClick={() => setExpanded(!expanded)} style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                    }}>
                        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <button onClick={() => onDelete(group.id)} style={{
                        background: 'none', border: 'none',
                        color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '2px', borderRadius: '4px',
                        transition: 'color 0.15s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0 1.2rem 1.2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            {/* Setpoints grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.2rem', marginTop: '1rem' }}>
                                <Field label="Primary Setpoint" field="trigger_setpoint1" />
                                <Field label="Primary Delay (s)" field="trigger_delay1" />
                                <Field label="Backup Setpoint" field="trigger_setpoint2" />
                                <Field label="Backup Delay (s)" field="trigger_delay2" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.2rem' }}>
                                <Field label="Target MW Shed" field="target_mw_shed" />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Include Auto-Tx
                                    </label>
                                    <button onClick={() => update('include_autotransformers', !group.include_autotransformers)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '6px 12px', borderRadius: '7px',
                                            background: group.include_autotransformers ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${group.include_autotransformers ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                            color: group.include_autotransformers ? '#34d399' : 'rgba(255,255,255,0.35)',
                                            fontSize: '0.83rem', cursor: 'pointer',
                                        }}>
                                        <CheckCircle size={14} />
                                        {group.include_autotransformers ? 'Yes' : 'No'}
                                    </button>
                                </div>
                            </div>

                            {/* Assignment editor */}
                            <div style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Assignments
                            </div>
                            <AssignmentEditor
                                groupId={group.id}
                                assignments={group.assignments || []}
                                onRefresh={onRefresh}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ─── Main ShedDesign Component ─────────────────────────────────────
const ShedDesign = ({ version, onBack, onPublished }) => {
    const [detail, setDetail] = useState(null);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [pubErr, setPubErr] = useState('');
    const [alerts, setAlerts] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/shedding/versions/${version.id}/`);
            setDetail(data);
            const sorted = (data.groups || []).slice().sort((a, b) => a.order - b.order);
            setGroups(sorted);
            setAlerts(runAlerts(sorted));
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [version.id]);

    useEffect(() => { load(); }, [load]);

    const handleAddGroup = async () => {
        if (!detail) return;
        const newOrder = groups.length + 1;
        try {
            await api.post('/shedding/groups/', {
                version: version.id,
                name: `Group ${newOrder}`,
                order: newOrder,
                include_autotransformers: true,
            });
            load();
        } catch (e) { console.error(e); }
    };

    const handleDeleteGroup = async (id) => {
        try {
            await api.delete(`/shedding/groups/${id}/`);
            load();
        } catch (e) { console.error(e); }
    };

    const handlePublish = async () => {
        setPublishing(true);
        setPubErr('');
        try {
            await api.post(`/shedding/versions/${version.id}/publish/`);
            onPublished?.();
        } catch (e) {
            setPubErr(e.response?.data?.error || 'Publish failed.');
        }
        setPublishing(false);
    };

    if (loading) return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
    );

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

            {/* Header */}
            <div style={{
                padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(0,229,255,0.06))',
                border: '1px solid rgba(167,139,250,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <Edit3 size={18} color="#a78bfa" />
                        <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Draft Editor
                        </span>
                        <span style={{
                            fontSize: '0.72rem', padding: '2px 10px', borderRadius: '20px',
                            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.25)', fontWeight: 600,
                        }}>
                            DRAFT
                        </span>
                    </div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9' }}>
                        {detail?.scheme_type} — Version {version.version_number}
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                        {groups.length} group(s) · {groups.reduce((s, g) => s + (g.assignments || []).length, 0)} assignment(s)
                    </div>
                </div>
                <button onClick={handlePublish} disabled={publishing} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 20px', borderRadius: '10px',
                    background: publishing ? 'rgba(255,255,255,0.05)' : 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                    transition: 'all 0.15s',
                }}>
                    {publishing ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
                    {publishing ? 'Publishing…' : 'Publish Version'}
                </button>
            </div>

            {pubErr && (
                <div style={{
                    padding: '10px 16px', borderRadius: '10px', marginBottom: '1.5rem',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', fontSize: '0.85rem',
                }}>
                    {pubErr}
                </div>
            )}

            {/* Alert Assistant */}
            {alerts.length > 0 && (
                <div style={{
                    padding: '1rem 1.2rem', borderRadius: '12px', marginBottom: '1.5rem',
                    background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#f59e0b' }}>
                        <AlertTriangle size={16} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Alert Assistant — {alerts.length} issue{alerts.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {alerts.map((a, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: '8px', fontSize: '0.82rem',
                                color: a.type === 'duplicate' ? '#ef4444' : '#f59e0b',
                            }}>
                                <span style={{ flexShrink: 0 }}>{a.type === 'duplicate' ? '⚠ DUP' : '⚠ NOT FOUND'}</span>
                                <span>{a.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                {groups.map(g => (
                    <GroupCard
                        key={g.id}
                        group={g}
                        onDelete={handleDeleteGroup}
                        onRefresh={load}
                    />
                ))}
            </div>

            {/* Add group */}
            <button onClick={handleAddGroup} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px',
                background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)',
                borderRadius: '12px', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500,
                transition: 'all 0.15s',
            }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; e.currentTarget.style.color = '#00e5ff'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            >
                <Plus size={16} /> Add Group
            </button>

            {/* Notes */}
            {version.notes && (
                <div style={{
                    marginTop: '2rem', padding: '1rem', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                    fontSize: '0.83rem', color: 'rgba(255,255,255,0.4)',
                }}>
                    <Info size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    {version.notes}
                </div>
            )}
        </div>
    );
};

export default ShedDesign;
