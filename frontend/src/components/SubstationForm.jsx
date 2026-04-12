import React, { useState, useEffect, useRef } from 'react';
import { X, Save, MapPin, AlertTriangle, Edit2, Upload, Plus, RefreshCw, Database, Zap, GitBranch, ShieldAlert, Trash2, CheckCircle2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

const GRIDS = ['KEDP', 'PPNG', 'PERK', 'SELG', 'KLUM', 'NSEM', 'MLKA', 'JOH2', 'JOH1', 'PHNG', 'TERG', 'KELN'];
const VOLTAGES = [500, 275, 230, 132];
const LOAD_LV = [33, 22, 11];
const AUTO_LV = [275, 132];

const tabButtonStyle = (isActive) => {
    return {
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: 'none',
        background: isActive ? '#047d60' : 'transparent',
        color: isActive ? '#fff' : '#64748b',
        fontWeight: isActive ? 600 : 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'all 0.2s ease',
        fontSize: '0.85rem',
        textAlign: 'left',
        fontFamily: "'Poppins', sans-serif"
    };
};

const inputLabelStyle = {
    display: 'block',
    fontSize: '0.7rem',
    color: '#334155',
    marginBottom: '6px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    fontFamily: "'Poppins', sans-serif"
};

const pillStyle = (type, value) => {
    let bg = '#f1f5f9';
    let color = '#64748b';

    if (type === 'voltage') {
        bg = value >= 500 ? '#1e293b' : (value >= 275 ? '#e0f2fe' : (value >= 230 ? '#fef3c7' : '#ecfdf5'));
        color = value >= 500 ? '#ffffff' : (value >= 275 ? '#0369a1' : (value >= 230 ? '#b45309' : '#047d60'));
    } else if (type === 'ownership') {
        bg = 'rgba(255, 159, 67, 0.1)';
        color = '#c2410c';
    } else if (type === 'default') {
        bg = '#f1f5f9';
        color = '#64748b';
    }

    return {
        fontSize: '0.65rem',
        background: bg,
        color: color,
        padding: '2px 8px',
        borderRadius: '4px',
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 600,
        display: 'inline-block'
    };
};

const LT_COLS = '56px 88px 65px 108px 108px 126px 44px';
const AT_COLS = '56px 76px 76px 65px 108px 108px 44px';
const BR_COLS = '1fr 80px 100px 44px';
const LSR_COLS = '1fr 80px 80px 80px 72px 44px';

const TransformerForm = ({ asset, onSave, onDelete, onCancel, isNew }) => {
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [hovering, setHovering] = useState(false);

    useEffect(() => {
        if (asset) setForm(asset);
    }, [asset]);

    const handleSave = async () => {
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    const generateBreakerNumbers = (no, lv) => {
        if (!no) return { hv: '', lv: '' };
        const unit = parseInt(no);
        const hv = unit * 100 + 10;
        let lvBreaker;
        if (lv == 11) {
            lvBreaker = 30 + unit;
        } else if (lv == 22 || lv == 33) {
            lvBreaker = unit + "T0";
        } else {
            lvBreaker = '';
        }
        return { hv: String(hv), lv: String(lvBreaker) };
    };

    const handleChange = (e) => {
        let newForm = { ...form, [e.target.name]: e.target.value };
        if (isNew && (e.target.name === 'transformer_no' || e.target.name === 'lv_voltage')) {
            const no = e.target.name === 'transformer_no' ? e.target.value : form.transformer_no;
            const lv = e.target.name === 'lv_voltage' ? e.target.value : form.lv_voltage;
            if (no) {
                const breakers = generateBreakerNumbers(no, lv);
                newForm.hv_breaker_number = breakers.hv;
                newForm.lv_breaker_number = breakers.lv;
            }
        }
        setForm(newForm);
    };

    const cellInput = (extra = {}) => ({
        width: '100%', padding: '5px 8px', fontSize: '0.72rem',
        fontFamily: 'monospace', border: '1px solid transparent',
        borderRadius: '5px', background: 'transparent',
        color: '#1e293b', outline: 'none', transition: 'all 0.15s',
        ...extra,
    });

    if (isNew) {
        return (
            <div style={{
                display: 'grid', gridTemplateColumns: LT_COLS, gap: '6px',
                alignItems: 'center', padding: '8px 16px',
                background: 'rgba(4, 125, 96, 0.04)',
                borderTop: '2px solid #047d60',
                borderBottom: '1px solid rgba(4,125,96,0.12)',
            }}>
                <input
                    name="transformer_no" type="text" inputMode="numeric"
                    placeholder="T#" value={form.transformer_no || ''}
                    onChange={handleChange} autoFocus
                    style={cellInput({ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', border: '1px solid #cbd5e1', background: '#fff', color: '#047d60' })}
                />
                <select
                    name="lv_voltage" value={form.lv_voltage || ''}
                    onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#1d4ed8' })}
                >
                    <option value="">-- kV</option>
                    {LOAD_LV.map(v => <option key={v} value={v}>{v} kV</option>)}
                </select>
                <input
                    name="capacity_mva" type="text" inputMode="decimal"
                    placeholder="0.00" value={form.capacity_mva || ''}
                    onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff', textAlign: 'right' })}
                />
                <input
                    name="hv_breaker_number" placeholder="HV—"
                    value={form.hv_breaker_number || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff' })}
                />
                <input
                    name="lv_breaker_number" placeholder="LV—"
                    value={form.lv_breaker_number || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff' })}
                />
                <input
                    name="commissioning_date" type="date"
                    value={form.commissioning_date || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.68rem' })}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                        type="button" onClick={handleSave} disabled={saving}
                        style={{
                            width: '100%', padding: '3px 0', borderRadius: '4px', border: 'none',
                            background: '#047d60', color: '#fff', cursor: 'pointer',
                            fontSize: '0.62rem', fontWeight: 700, opacity: saving ? 0.6 : 1,
                            transition: 'all 0.15s', lineHeight: 1.4
                        }}
                    >
                        {saving ? '…' : 'Add'}
                    </button>
                    <button
                        type="button" onClick={onCancel}
                        style={{
                            width: '100%', padding: '3px 0', borderRadius: '4px',
                            border: '1px solid #e2e8f0', background: '#fff',
                            color: '#94a3b8', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s', lineHeight: 1.4
                        }}
                    >
                        <X size={11} />
                    </button>
                </div>
            </div>
        );
    }

    const lvPalette = form.lv_voltage == 33
        ? { bg: '#fef3c7', text: '#b45309' }
        : form.lv_voltage == 22
            ? { bg: '#dbeafe', text: '#1d4ed8' }
            : { bg: '#ecfdf5', text: '#047d60' };

    return (
        <div
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            style={{
                display: 'grid', gridTemplateColumns: LT_COLS, gap: '6px',
                alignItems: 'center', padding: '6px 16px',
                borderBottom: '1px solid #f1f5f9',
                background: hovering ? '#f8fafc' : '#fff',
                transition: 'background 0.15s',
            }}
        >
            {/* Unit badge */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{
                    fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace',
                    color: '#047d60', background: 'rgba(4,125,96,0.08)',
                    padding: '3px 7px', borderRadius: '4px', letterSpacing: '0.3px'
                }}>
                    T{form.transformer_no}
                </span>
            </div>

            {/* LV voltage select styled as pill */}
            <select
                name="lv_voltage" value={form.lv_voltage || ''} onChange={handleChange}
                style={{
                    width: '100%', padding: '4px 6px', fontSize: '0.72rem',
                    fontFamily: 'monospace', fontWeight: 700, textAlign: 'center',
                    background: lvPalette.bg, color: lvPalette.text,
                    border: 'none', borderRadius: '5px', cursor: 'pointer', outline: 'none'
                }}
            >
                {LOAD_LV.map(v => <option key={v} value={v}>{v} kV</option>)}
            </select>

            {/* Capacity */}
            <input
                name="capacity_mva" type="text" inputMode="decimal"
                value={form.capacity_mva || ''} onChange={handleChange} onBlur={handleSave}
                style={cellInput({
                    textAlign: 'center', fontWeight: 600, color: '#92400e',
                    background: hovering ? '#fffbeb' : 'transparent',
                    border: hovering ? '1px solid #fde68a' : '1px solid transparent',
                })}
            />

            {/* HV Breaker */}
            <input
                name="hv_breaker_number" value={form.hv_breaker_number || ''}
                onChange={handleChange} onBlur={handleSave}
                style={cellInput({
                    textAlign: 'center', color: '#475569',
                    border: hovering ? '1px solid #e2e8f0' : '1px solid transparent',
                    background: hovering ? '#fff' : 'transparent',
                })}
            />

            {/* LV Breaker */}
            <input
                name="lv_breaker_number" value={form.lv_breaker_number || ''}
                onChange={handleChange} onBlur={handleSave}
                style={cellInput({
                    textAlign: 'center', color: '#475569',
                    border: hovering ? '1px solid #e2e8f0' : '1px solid transparent',
                    background: hovering ? '#fff' : 'transparent',
                })}
            />

            {/* Commissioning date */}
            <input
                name="commissioning_date" type="date"
                value={form.commissioning_date || ''}
                onChange={handleChange} onBlur={handleSave}
                style={cellInput({
                    textAlign: 'center', fontSize: '0.68rem', color: '#64748b',
                    border: hovering ? '1px solid #e2e8f0' : '1px solid transparent',
                    background: hovering ? '#fff' : 'transparent',
                })}
            />

            {/* Delete */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={onDelete}
                    title="Delete entry"
                    style={{
                        background: hovering ? '#fef2f2' : 'transparent',
                        border: hovering ? '1px solid #fecaca' : '1px solid transparent',
                        color: '#ef4444', cursor: 'pointer', padding: '4px 6px',
                        borderRadius: '5px', display: 'flex', alignItems: 'center',
                        transition: 'all 0.15s'
                    }}
                >
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
};

const AutoTransformerRow = ({ asset, onSave, onDelete, onCancel, isNew }) => {
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [hovering, setHovering] = useState(false);

    useEffect(() => { if (asset) setForm(asset); }, [asset]);

    const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const cellInput = (extra = {}) => ({
        width: '100%', padding: '5px 8px', fontSize: '0.72rem',
        fontFamily: 'monospace', border: '1px solid transparent',
        borderRadius: '5px', background: 'transparent',
        color: '#1e293b', outline: 'none', transition: 'all 0.15s',
        textAlign: 'center', ...extra,
    });

    if (isNew) {
        return (
            <div style={{
                display: 'grid', gridTemplateColumns: AT_COLS, gap: '6px',
                alignItems: 'center', padding: '8px 16px',
                background: 'rgba(4, 125, 96, 0.04)',
                borderTop: '2px solid #047d60',
                borderBottom: '1px solid rgba(4,125,96,0.12)',
            }}>
                <input name="transformer_no" type="text" inputMode="numeric" placeholder="T#" value={form.transformer_no || ''} onChange={handleChange} autoFocus
                    style={cellInput({ fontWeight: 700, fontSize: '0.8rem', border: '1px solid #cbd5e1', background: '#fff', color: '#047d60' })} />
                <select name="hv_voltage" value={form.hv_voltage || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#1d4ed8' })}>
                    <option value="">HV kV</option>
                    {AUTO_LV.map(v => <option key={v} value={v}>{v} kV</option>)}
                </select>
                <select name="lv_voltage" value={form.lv_voltage || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#047d60' })}>
                    <option value="">LV kV</option>
                    {AUTO_LV.map(v => <option key={v} value={v}>{v} kV</option>)}
                </select>
                <input name="capacity_mva" type="text" inputMode="decimal" placeholder="0.00" value={form.capacity_mva || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff' })} />
                <input name="hv_breaker_number" placeholder="HV—" value={form.hv_breaker_number || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff' })} />
                <input name="lv_breaker_number" placeholder="LV—" value={form.lv_breaker_number || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff' })} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                    <button type="button" onClick={handleSave} disabled={saving}
                        style={{ width: '100%', padding: '3px 0', borderRadius: '4px', border: 'none', background: '#047d60', color: '#fff', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                        {saving ? '…' : 'Add'}
                    </button>
                    <button type="button" onClick={onCancel}
                        style={{ width: '100%', padding: '3px 0', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={11} />
                    </button>
                </div>
            </div>
        );
    }

    const hvPalette = { bg: '#dbeafe', text: '#1d4ed8' };
    const lvPalette = { bg: '#ecfdf5', text: '#047d60' };

    return (
        <div onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
            style={{
                display: 'grid', gridTemplateColumns: AT_COLS, gap: '6px',
                alignItems: 'center', padding: '6px 16px',
                borderBottom: '1px solid #f1f5f9',
                background: hovering ? '#f8fafc' : '#fff',
                transition: 'background 0.15s',
            }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace', color: '#047d60', background: 'rgba(4,125,96,0.08)', padding: '3px 7px', borderRadius: '4px' }}>
                    T{form.transformer_no}
                </span>
            </div>
            <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', background: hvPalette.bg, color: hvPalette.text, padding: '3px 8px', borderRadius: '5px' }}>
                    {form.hv_voltage} kV
                </span>
            </div>
            <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', background: lvPalette.bg, color: lvPalette.text, padding: '3px 8px', borderRadius: '5px' }}>
                    {form.lv_voltage} kV
                </span>
            </div>
            <input name="capacity_mva" type="text" inputMode="decimal" value={form.capacity_mva || ''} onChange={handleChange} onBlur={handleSave}
                style={cellInput({ fontWeight: 600, color: '#92400e', background: hovering ? '#fffbeb' : 'transparent', border: hovering ? '1px solid #fde68a' : '1px solid transparent' })} />
            <input name="hv_breaker_number" value={form.hv_breaker_number || ''} onChange={handleChange} onBlur={handleSave}
                style={cellInput({ color: '#475569', border: hovering ? '1px solid #e2e8f0' : '1px solid transparent', background: hovering ? '#fff' : 'transparent' })} />
            <input name="lv_breaker_number" value={form.lv_breaker_number || ''} onChange={handleChange} onBlur={handleSave}
                style={cellInput({ color: '#475569', border: hovering ? '1px solid #e2e8f0' : '1px solid transparent', background: hovering ? '#fff' : 'transparent' })} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={onDelete} title="Delete entry"
                    style={{ background: hovering ? '#fef2f2' : 'transparent', border: hovering ? '1px solid #fecaca' : '1px solid transparent', color: '#ef4444', cursor: 'pointer', padding: '4px 6px', borderRadius: '5px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
};

const IncomingBranchRow = ({ asset, substationOptions, onSave, onDelete, onCancel, isNew }) => {
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [hovering, setHovering] = useState(false);

    useEffect(() => { if (asset) setForm(asset); }, [asset]);

    const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const cellInput = (extra = {}) => ({
        width: '100%', padding: '5px 8px', fontSize: '0.72rem',
        fontFamily: 'monospace', border: '1px solid transparent',
        borderRadius: '5px', background: 'transparent',
        color: '#1e293b', outline: 'none', transition: 'all 0.15s',
        textAlign: 'center', ...extra,
    });

    if (isNew) {
        return (
            <div style={{
                display: 'grid', gridTemplateColumns: BR_COLS, gap: '6px',
                alignItems: 'center', padding: '8px 16px',
                background: 'rgba(4, 125, 96, 0.04)',
                borderTop: '2px solid #047d60',
                borderBottom: '1px solid rgba(4,125,96,0.12)',
            }}>
                <select name="to_substation" value={form.to_substation || ''} onChange={handleChange} autoFocus
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', textAlign: 'left' })}>
                    <option value="">-- Select substation</option>
                    {substationOptions.map(s => <option key={s.substation_id} value={s.substation_id}>{s.name} ({s.substation_id})</option>)}
                </select>
                <input name="ckt_id" placeholder="Ckt" value={form.ckt_id || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff' })} />
                <input name="breaker_number" placeholder="Breaker #" value={form.breaker_number || ''} onChange={handleChange}
                    style={cellInput({ border: '1px solid #cbd5e1', background: '#fff' })} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                    <button type="button" onClick={handleSave} disabled={saving}
                        style={{ width: '100%', padding: '3px 0', borderRadius: '4px', border: 'none', background: '#047d60', color: '#fff', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                        {saving ? '…' : 'Add'}
                    </button>
                    <button type="button" onClick={onCancel}
                        style={{ width: '100%', padding: '3px 0', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={11} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
            style={{
                display: 'grid', gridTemplateColumns: BR_COLS, gap: '6px',
                alignItems: 'center', padding: '6px 16px',
                borderBottom: '1px solid #f1f5f9',
                background: hovering ? '#f8fafc' : '#fff',
                transition: 'background 0.15s',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
                    {form.to_substation}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {substationOptions.find(s => s.substation_id === form.to_substation)?.name || ''}
                </span>
            </div>
            <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#475569', background: '#f8fafc', padding: '3px 7px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    {form.ckt_id || '—'}
                </span>
            </div>
            <input name="breaker_number" value={form.breaker_number || ''} onChange={handleChange} onBlur={handleSave}
                style={cellInput({ color: '#475569', border: hovering ? '1px solid #e2e8f0' : '1px solid transparent', background: hovering ? '#fff' : 'transparent' })} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={onDelete} title="Delete entry"
                    style={{ background: hovering ? '#fef2f2' : 'transparent', border: hovering ? '1px solid #fecaca' : '1px solid transparent', color: '#ef4444', cursor: 'pointer', padding: '4px 6px', borderRadius: '5px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
};

const LSRRow = ({ relay, onEdit, onDelete, isSelected }) => {
    const [hovering, setHovering] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onClick={onEdit}
            style={{
                display: 'grid', gridTemplateColumns: LSR_COLS,
                gap: '6px', alignItems: 'center', padding: '7px 16px',
                borderBottom: isSelected ? 'none' : '1px solid #f1f5f9',
                background: isSelected ? 'rgba(4,125,96,0.04)' : hovering ? '#f8fafc' : '#fff',
                borderLeft: isSelected ? '3px solid #047d60' : '3px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
            }}
        >
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>
                {relay.target_voltage ? `${relay.target_voltage}kV` : '—'}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', color: relay.load_transformers?.length > 0 ? '#047d60' : '#cbd5e1' }}>
                {relay.load_transformers?.length || 0}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', color: relay.auto_transformers?.length > 0 ? '#047d60' : '#cbd5e1' }}>
                {relay.auto_transformers?.length || 0}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', color: relay.incoming_branches?.length > 0 ? '#047d60' : '#cbd5e1' }}>
                {relay.incoming_branches?.length || 0}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{
                    fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                    background: relay.is_active !== false ? 'rgba(4,125,96,0.08)' : '#f1f5f9',
                    color: relay.is_active !== false ? '#047d60' : '#94a3b8',
                    border: `1px solid ${relay.is_active !== false ? 'rgba(4,125,96,0.2)' : '#e2e8f0'}`,
                }}>
                    {relay.is_active !== false ? 'Active' : 'Off'}
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete relay"
                    style={{ background: hovering ? '#fef2f2' : 'transparent', border: hovering ? '1px solid #fecaca' : '1px solid transparent', color: '#ef4444', cursor: 'pointer', padding: '4px 6px', borderRadius: '5px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
};

const LSRInlineForm = ({ data, substation, loadTransformers, autoTransformers, incomingBranches, loadSheddingRelays, onSave, onCancel }) => {
    const isEditing = !!data?.id;

    const availableVoltages = React.useMemo(() => {
        const vSet = new Set();
        loadTransformers?.forEach(lt => { if (lt.lv_voltage) vSet.add(lt.lv_voltage); });
        autoTransformers?.forEach(at => { if (at.lv_voltage) vSet.add(at.lv_voltage); });
        if (incomingBranches?.length > 0 && substation?.voltage) vSet.add(substation.voltage);
        return Array.from(vSet).sort((a, b) => b - a);
    }, [loadTransformers, autoTransformers, incomingBranches, substation]);

    const [form, setForm] = useState(() => {
        if (data?.id) {
            return {
                ...data,
                load_transformers: (data.load_transformers || []).map(t => typeof t === 'object' ? t.id : t),
                auto_transformers: (data.auto_transformers || []).map(t => typeof t === 'object' ? t.id : t),
                incoming_branches: (data.incoming_branches || []).map(b => typeof b === 'object' ? b.id : b),
            };
        }
        const v = availableVoltages[0] || '';
        return { target_voltage: v, relay_name: v ? `${v}kV System` : '', is_active: true, load_transformers: [], auto_transformers: [], incoming_branches: [], notes: '' };
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const targetV = form.target_voltage;
    const filteredLTs = React.useMemo(() => loadTransformers?.filter(lt => lt.lv_voltage === targetV) || [], [loadTransformers, targetV]);
    const filteredATs = React.useMemo(() => autoTransformers?.filter(at => at.lv_voltage === targetV) || [], [autoTransformers, targetV]);
    const filteredIBs = React.useMemo(() => substation?.voltage === targetV ? (incomingBranches || []) : [], [incomingBranches, substation, targetV]);

    const handleVoltageChange = (v) => {
        const parsed = parseInt(v);
        setForm(f => ({ ...f, target_voltage: parsed, relay_name: `${parsed}kV System`, load_transformers: [], auto_transformers: [], incoming_branches: [] }));
    };

    const toggleLT = (id, checked) => setForm(f => ({ ...f, load_transformers: checked ? [...(f.load_transformers || []), id] : (f.load_transformers || []).filter(x => x !== id) }));
    const toggleAT = (id, checked) => setForm(f => ({ ...f, auto_transformers: checked ? [...(f.auto_transformers || []), id] : (f.auto_transformers || []).filter(x => x !== id) }));
    const toggleIB = (id, checked) => setForm(f => ({ ...f, incoming_branches: checked ? [...(f.incoming_branches || []), id] : (f.incoming_branches || []).filter(x => (typeof x === 'object' ? x.id : x) !== id) }));

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const err = await onSave(form);
        if (err) setError(err);
        setSaving(false);
    };

    const chipStyle = (checked, isClaimed) => ({
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '0.65rem', padding: '2px 7px', borderRadius: '999px',
        cursor: isClaimed ? 'not-allowed' : 'pointer', userSelect: 'none',
        background: isClaimed ? '#f1f5f9' : checked ? 'rgba(4,125,96,0.1)' : '#fff',
        border: `1px solid ${isClaimed ? '#e2e8f0' : checked ? 'rgba(4,125,96,0.35)' : '#e2e8f0'}`,
        color: isClaimed ? '#cbd5e1' : checked ? '#047d60' : '#64748b',
        opacity: isClaimed ? 0.5 : 1, transition: 'all 0.12s',
    });

    const chipBox = { display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '7px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#f8fafc', minHeight: '38px', alignItems: 'flex-start' };

    return (
        <div style={{ borderTop: '2px solid #047d60', background: 'rgba(4,125,96,0.025)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            {/* Row 1: voltage + status */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px', alignItems: 'start' }}>
                <div>
                    <div style={{ ...inputLabelStyle, marginBottom: '5px' }}>Voltage Level</div>
                    <select
                        value={form.target_voltage || ''}
                        onChange={e => handleVoltageChange(e.target.value)}
                        disabled={isEditing}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontFamily: 'monospace', background: isEditing ? '#f8fafc' : '#fff', color: '#1e293b', cursor: isEditing ? 'not-allowed' : 'pointer', outline: 'none' }}
                    >
                        {availableVoltages.length === 0 && <option value="">No voltages available</option>}
                        {availableVoltages.map(v => <option key={v} value={v}>{v}kV</option>)}
                    </select>
                </div>
                <div>
                    <div style={{ ...inputLabelStyle, marginBottom: '5px' }}>Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '33px' }}>
                        <div onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                            style={{ width: '40px', height: '20px', background: form.is_active !== false ? 'rgba(4,125,96,0.4)' : '#e2e8f0', borderRadius: '20px', padding: '2px', cursor: 'pointer', position: 'relative', border: `1px solid ${form.is_active !== false ? 'rgba(4,125,96,0.5)' : '#cbd5e1'}`, transition: 'all 0.3s' }}>
                            <motion.div animate={{ x: form.is_active !== false ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                style={{ width: '14px', height: '14px', background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: form.is_active !== false ? '#047d60' : '#94a3b8', fontWeight: 600 }}>
                            {form.is_active !== false ? 'Active' : 'Off'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Row 2: asset selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                    <div style={{ ...inputLabelStyle, marginBottom: '5px' }}>Trip Load Transformers</div>
                    <div style={chipBox}>
                        {filteredLTs.length === 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>None for {targetV}kV</span>}
                        {filteredLTs.map(lt => {
                            const checked = (form.load_transformers || []).includes(lt.id);
                            const OWNER = loadSheddingRelays?.find(r => r.id !== data?.id && (r.load_transformers || []).includes(lt.id));
                            const isClaimed = !!OWNER;
                            return (
                                <label key={lt.id} style={chipStyle(checked, isClaimed)}>
                                    <input type="checkbox" disabled={isClaimed} checked={checked} onChange={e => toggleLT(lt.id, e.target.checked)} style={{ display: 'none' }} />
                                    <span className="mono">T{lt.transformer_no}{isClaimed ? ` (${OWNER.relay_name || 'other'})` : ''}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <div style={{ ...inputLabelStyle, marginBottom: '5px' }}>Trip Auto Transformers</div>
                    <div style={chipBox}>
                        {filteredATs.length === 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>None for {targetV}kV</span>}
                        {filteredATs.map(at => {
                            const checked = (form.auto_transformers || []).includes(at.id);
                            const OWNER = loadSheddingRelays?.find(r => r.id !== data?.id && (r.auto_transformers || []).includes(at.id));
                            const isClaimed = !!OWNER;
                            return (
                                <label key={at.id} style={chipStyle(checked, isClaimed)}>
                                    <input type="checkbox" disabled={isClaimed} checked={checked} onChange={e => toggleAT(at.id, e.target.checked)} style={{ display: 'none' }} />
                                    <span className="mono">T{at.transformer_no}{isClaimed ? ` (${OWNER.relay_name || 'other'})` : ''}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <div style={{ ...inputLabelStyle, marginBottom: '5px' }}>Trip Incoming Branches</div>
                    <div style={chipBox}>
                        {filteredIBs.length === 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>None for {targetV}kV</span>}
                        {filteredIBs.map(ib => {
                            const checked = (form.incoming_branches || []).some(b => (typeof b === 'object' ? b.id : b) === ib.id);
                            const OWNER = loadSheddingRelays?.find(r => r.id !== data?.id && (r.incoming_branches || []).some(b => (typeof b === 'object' ? b.id : b) === ib.id));
                            const isClaimed = !!OWNER;
                            return (
                                <label key={ib.id} style={chipStyle(checked, isClaimed)}>
                                    <input type="checkbox" disabled={isClaimed} checked={checked} onChange={e => toggleIB(ib.id, e.target.checked)} style={{ display: 'none' }} />
                                    <span className="mono">{ib.to_substation} {ib.ckt_id}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div>
                <div style={{ ...inputLabelStyle, marginBottom: '5px' }}>Notes</div>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any details..." rows={2}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.74rem', resize: 'vertical', fontFamily: "'Poppins', sans-serif", color: '#475569', background: '#fff', boxSizing: 'border-box', outline: 'none' }} />
            </div>

            {/* Error */}
            {error && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '0.72rem', color: '#dc2626', lineHeight: 1.5 }}>{error}</span>
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={onCancel}
                    style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                    Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                    style={{ padding: '6px 18px', borderRadius: '6px', border: 'none', background: '#047d60', color: '#fff', fontSize: '0.74rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1, fontFamily: "'Poppins', sans-serif" }}>
                    {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Add Relay')}
                </button>
            </div>
        </div>
    );
};

const AssetModal = ({ type, data, onClose, onSave, assetLoading, assetStatus, assetForm, setAssetForm, substationOptions, substation, loadTransformers, autoTransformers, incomingBranches }) => {
    const isBranch = type === 'branch';
    const isLSR = type === 'lsr';
    const title = data?.id ? 'Edit' : 'Add';
    const typeLabel = isLSR ? 'Load Shedding Relay' : type === 'load' ? 'Load Transformer' : type === 'auto' ? 'Auto Transformer' : 'Incoming Branch';

    // Calculate available voltages at this substation
    const availableVoltages = React.useMemo(() => {
        if (!isLSR) return [];
        const vSet = new Set();
        loadTransformers?.forEach(lt => { if (lt.lv_voltage) vSet.add(lt.lv_voltage); });
        autoTransformers?.forEach(at => { if (at.lv_voltage) vSet.add(at.lv_voltage); });
        // Assuming incoming branches operate at the substation's primary voltage
        if (incomingBranches?.length > 0 && substation?.voltage) {
            vSet.add(substation.voltage);
        }
        return Array.from(vSet).sort((a, b) => b - a); // Descending order
    }, [loadTransformers, autoTransformers, incomingBranches, substation, isLSR]);

    // Handle initial state for editing or default selection
    React.useEffect(() => {
        if (isLSR && !assetForm.target_voltage && availableVoltages.length > 0) {
            // If editing, try to infer target_voltage from existing name or assets
            let v = availableVoltages[0];
            if (data?.id && data.relay_name) {
                const match = data.relay_name.match(/(\d+)kV/);
                if (match) {
                    const parsedV = parseInt(match[1]);
                    if (availableVoltages.includes(parsedV)) v = parsedV;
                }
            }
            setAssetForm(f => ({ ...f, target_voltage: v, relay_name: `${v}kV System` }));
        }
    }, [isLSR, availableVoltages, data, assetForm.target_voltage, setAssetForm]);

    const targetV = assetForm.target_voltage;

    // Filter assets based on selected voltage
    const filteredLTs = React.useMemo(() => loadTransformers?.filter(lt => lt.lv_voltage === targetV) || [], [loadTransformers, targetV]);
    const filteredATs = React.useMemo(() => autoTransformers?.filter(at => at.lv_voltage === targetV) || [], [autoTransformers, targetV]);
    const filteredIBs = React.useMemo(() => (substation?.voltage === targetV) ? (incomingBranches || []) : [], [incomingBranches, substation, targetV]);


    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{ background: '#fff', padding: '1.5rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', margin: 0 }}>{title} {typeLabel}</h3>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '0.25rem' }}>{substation?.name} ({substation?.substation_id})</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}>
                        <X size={18} />
                    </button>
                </div>

                <AnimatePresence>
                    {assetStatus?.type === 'error' && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{ padding: '0.75rem', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <AlertTriangle size={16} color="#ef4444" />
                            <span style={{ fontSize: '0.8rem', color: '#ef4444', lineHeight: 1.4 }}>{assetStatus.msg}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {isLSR ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ gridColumn: 'span 1' }}>
                                <label style={inputLabelStyle}>Voltage Level</label>
                                <select
                                    className="input-field"
                                    value={assetForm.target_voltage || ''}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value);
                                        setAssetForm(f => ({
                                            ...f,
                                            target_voltage: v,
                                            relay_name: `${v}kV System`,
                                            // Reset selections when voltage changes to prevent accidental cross-voltage assignment
                                            load_transformers: [],
                                            auto_transformers: [],
                                            incoming_branches: []
                                        }));
                                    }}
                                    disabled={!!data?.id} // Disable changing voltage on existing relays to prevent chaos
                                >
                                    {availableVoltages.map(v => (
                                        <option key={v} value={v}>{v}kV</option>
                                    ))}
                                </select>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Name: <span style={{ color: 'var(--accent-cyan)' }}>{assetForm.relay_name || '...'}</span>
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 1' }}>
                                <label style={inputLabelStyle}>Status</label>
                                <div style={{ display: 'flex', alignItems: 'center', height: '36px', gap: '10px' }}>
                                    <div
                                        onClick={() => setAssetForm(f => ({ ...f, is_active: !f.is_active }))}
                                        style={{
                                            width: '40px', height: '20px',
                                            background: assetForm.is_active !== false ? 'rgba(76, 175, 80, 0.4)' : '#e2e8f0',
                                            borderRadius: '20px', padding: '2px', cursor: 'pointer', position: 'relative',
                                            border: `1px solid ${assetForm.is_active !== false ? 'rgba(76, 175, 80, 0.5)' : '#cbd5e1'}`,
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <motion.div animate={{ x: assetForm.is_active !== false ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            style={{ width: '14px', height: '14px', background: '#fff', borderRadius: '50%', boxShadow: '0 2px 4px #f1f5f9' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: assetForm.is_active !== false ? '#fff' : 'var(--text-secondary)', fontWeight: 500 }}>
                                        {assetForm.is_active !== false ? 'Active' : 'Off'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={inputLabelStyle}>Load Transformers</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f1f5f9', alignItems: 'flex-start' }}>
                                {filteredLTs.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No load transformers available for {targetV}kV.</div>}
                                {filteredLTs.map((lt) => {
                                    const checked = (assetForm.load_transformers || []).includes(lt.id);
                                    const OWNER = substation.load_shedding_relays?.find(r => r.id !== data?.id && r.load_transformers.includes(lt.id));
                                    const isClaimed = !!OWNER;

                                    return (
                                        <label key={lt.id} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                                            cursor: isClaimed ? 'not-allowed' : 'pointer',
                                            background: isClaimed ? '#f8fafc' : checked ? 'rgba(0, 191, 255, 0.2)' : '#f1f5f9',
                                            border: `1px solid ${isClaimed ? '#f1f5f9' : checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                                            color: isClaimed ? '#cbd5e1' : checked ? '#fff' : 'var(--text-secondary)',
                                            transition: 'all 0.2s', userSelect: 'none',
                                            opacity: isClaimed ? 0.4 : 1
                                        }}>
                                            <input type="checkbox" disabled={isClaimed} checked={checked} onChange={(e) => {
                                                const arr = assetForm.load_transformers || [];
                                                setAssetForm(f => ({ ...f, load_transformers: e.target.checked ? [...arr, lt.id] : arr.filter(id => id !== lt.id) }));
                                            }} style={{ display: 'none' }} />
                                            <span className="mono">T{lt.transformer_no} {isClaimed ? `(via ${OWNER.relay_name || 'other'})` : lt.lv_voltage ? `(${lt.lv_voltage}kV)` : ''}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label style={inputLabelStyle}>Auto Transformers</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f1f5f9', alignItems: 'flex-start' }}>
                                {filteredATs.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No auto transformers available for {targetV}kV.</div>}
                                {filteredATs.map((at) => {
                                    const checked = (assetForm.auto_transformers || []).includes(at.id);
                                    const OWNER = substation.load_shedding_relays?.find(r => r.id !== data?.id && r.auto_transformers.includes(at.id));
                                    const isClaimed = !!OWNER;

                                    return (
                                        <label key={at.id} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                                            cursor: isClaimed ? 'not-allowed' : 'pointer',
                                            background: isClaimed ? '#f8fafc' : checked ? 'rgba(0, 191, 255, 0.2)' : '#f1f5f9',
                                            border: `1px solid ${isClaimed ? '#f1f5f9' : checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                                            color: isClaimed ? '#cbd5e1' : checked ? '#fff' : 'var(--text-secondary)',
                                            transition: 'all 0.2s', userSelect: 'none',
                                            opacity: isClaimed ? 0.4 : 1
                                        }}>
                                            <input type="checkbox" disabled={isClaimed} checked={checked} onChange={(e) => {
                                                const arr = assetForm.auto_transformers || [];
                                                setAssetForm(f => ({ ...f, auto_transformers: e.target.checked ? [...arr, at.id] : arr.filter(id => id !== at.id) }));
                                            }} style={{ display: 'none' }} />
                                            <span className="mono">T{at.transformer_no} {isClaimed ? `(via ${OWNER.relay_name || 'other'})` : at.lv_voltage ? `(${at.lv_voltage}kV)` : ''}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label style={inputLabelStyle}>Incoming Branches</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f1f5f9', alignItems: 'flex-start' }}>
                                {filteredIBs.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No branches available for {targetV}kV.</div>}
                                {filteredIBs.map((ib) => {
                                    const checked = (assetForm.incoming_branches || []).some(b => (typeof b === 'object' ? b.id : b) === ib.id);
                                    const OWNER = substation.load_shedding_relays?.find(r => r.id !== data?.id && (r.incoming_branches || []).some(b => (typeof b === 'object' ? b.id : b) === ib.id));
                                    const isClaimed = !!OWNER;

                                    return (
                                        <label key={ib.id} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                                            cursor: isClaimed ? 'not-allowed' : 'pointer',
                                            background: isClaimed ? '#f8fafc' : checked ? 'rgba(0, 191, 255, 0.2)' : '#f1f5f9',
                                            border: `1px solid ${isClaimed ? '#f1f5f9' : checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                                            color: isClaimed ? '#cbd5e1' : checked ? '#fff' : 'var(--text-secondary)',
                                            transition: 'all 0.2s', userSelect: 'none',
                                            opacity: isClaimed ? 0.4 : 1
                                        }}>
                                            <input type="checkbox" disabled={isClaimed} checked={checked} onChange={(e) => {
                                                const arr = assetForm.incoming_branches || [];
                                                setAssetForm(f => ({ ...f, incoming_branches: e.target.checked ? [...arr, ib.id] : arr.filter(id => id !== ib.id) }));
                                            }} style={{ display: 'none' }} />
                                            <span className="mono">{ib.to_substation} {ib.ckt_id} {isClaimed ? `(via ${OWNER.relay_name || 'other'})` : ''}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label style={inputLabelStyle}>Relay Notes</label>
                            <textarea className="input-field" value={assetForm.notes || ''} onChange={(e) => setAssetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any details..." rows={2} style={{ resize: 'vertical' }} />
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        {isBranch ? (
                            <>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={inputLabelStyle}>Target Station</label>
                                    <select className="input-field" value={assetForm.to_substation || ''} onChange={(e) => setAssetForm(f => ({ ...f, to_substation: e.target.value }))}>
                                        <option value="">-- Select Substation --</option>
                                        {substationOptions.map((s) => (
                                            <option key={s.substation_id} value={s.substation_id}>{s.name} ({s.substation_id})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={inputLabelStyle}>Circuit No</label>
                                    <input className="input-field mono" value={assetForm.ckt_id || ''} onChange={(e) => setAssetForm(f => ({ ...f, ckt_id: e.target.value }))} placeholder="1" />
                                </div>
                                <div>
                                    <label style={inputLabelStyle}>Breaker ID</label>
                                    <input className="input-field mono" value={assetForm.breaker_number || ''} onChange={(e) => setAssetForm(f => ({ ...f, breaker_number: e.target.value }))} placeholder="e.g., 105" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label style={inputLabelStyle}>Unit Number</label>
                                    <input className="input-field mono" type="number" value={assetForm.transformer_no || ''} onChange={(e) => setAssetForm(f => ({ ...f, transformer_no: e.target.value }))} placeholder="e.g., 1" />
                                </div>
                                <div>
                                    <label style={inputLabelStyle}>LV (kV)</label>
                                    <select className="input-field mono" value={assetForm.lv_voltage || ''} onChange={(e) => setAssetForm(f => ({ ...f, lv_voltage: e.target.value }))}>
                                        <option value="">-- Select --</option>
                                        {(type === 'load' ? LOAD_LV : AUTO_LV).map(v => <option key={v} value={v}>{v} kV</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={inputLabelStyle}>Capacity (MVA)</label>
                                    <input className="input-field mono" type="number" value={assetForm.capacity_mva || ''} onChange={(e) => setAssetForm(f => ({ ...f, capacity_mva: e.target.value }))} placeholder="e.g., 30" />
                                </div>
                                <div>
                                    <label style={inputLabelStyle}>Commissioning Date <span style={{ color: 'var(--text-secondary)', fontSize: '0.6rem' }}>(Optional)</span></label>
                                    <input className="input-field mono" type="date" value={assetForm.commissioning_date || ''} onChange={(e) => setAssetForm(f => ({ ...f, commissioning_date: e.target.value }))} />
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button onClick={onClose}
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid #e2e8f0', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(type)}
                        className="btn-primary"
                        style={{ flex: 2, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        disabled={assetLoading}
                    >
                        {assetLoading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {assetLoading ? 'Saving...' : 'Save Asset'}
                    </button>
                </div>
            </motion.div >
        </div >
    );
};
const SubstationForm = ({ substation, onSave, onCancel, onSLDUpload, onSubstationRefresh, status, loading }) => {
    const [formData, setFormData] = useState(substation || {
        mnemonic: '',
        name: '',
        ownership: 'TNB',
        voltage: '',
        grid: '',
        latitude: '',
        longitude: ''
    });

    useEffect(() => {
        if (substation) {
            setFormData(substation);
        }
    }, [substation]);

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
    const [loadTransformers, setLoadTransformers] = useState([]);
    const [autoTransformers, setAutoTransformers] = useState([]);
    const [incomingBranches, setIncomingBranches] = useState([]);
    const [loadSheddingRelays, setLoadSheddingRelays] = useState([]);
    const [substationOptions, setSubstationOptions] = useState([]);
    const [assetLoading, setAssetLoading] = useState(false);
    const [assetStatus, setAssetStatus] = useState(null);

    // Auto-clear asset success messages after 5 seconds
    useEffect(() => {
        if (assetStatus?.type === 'success') {
            const timer = setTimeout(() => {
                setAssetStatus(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [assetStatus]);

    // Modal Control State
    const [editingAsset, setEditingAsset] = useState(null); // { type: 'load'|'auto'|'branch', data: item|null }

    // Inline editing state (for sections that use inline form instead of modal)
    const [inlineEditKey, setInlineEditKey] = useState(null); // key of asset being edited inline (e.g., 'load-123')
    const [inlineForm, setInlineForm] = useState({});
    const [isAddingLT, setIsAddingLT] = useState(false);
    const [isAddingAT, setIsAddingAT] = useState(false);
    const [inlineATForm, setInlineATForm] = useState({});
    const [isAddingBranch, setIsAddingBranch] = useState(false);
    const [inlineBranchForm, setInlineBranchForm] = useState({});
    // null = closed, 'new' = adding, relay.id = editing that relay
    const [editingLSRId, setEditingLSRId] = useState(null);

    const handleInlineSave = async (type, formData) => {
        if (!substation?.substation_id) return;
        setAssetLoading(true);
        try {
            const endpointMap = { load: 'load-transformers', auto: 'auto-transformers', branch: 'incoming-branches', lsr: 'load-shedding-relays' };
            const endpoint = endpointMap[type];
            const form = formData || inlineForm;
            const payload = {
                substation: substation.substation_id,
                transformer_no: parseInt(form.transformer_no) || undefined,
                hv_voltage: parseInt(form.hv_voltage) || undefined,
                lv_voltage: parseInt(form.lv_voltage) || undefined,
                hv_breaker_number: form.hv_breaker_number || undefined,
                lv_breaker_number: form.lv_breaker_number || undefined,
                capacity_mva: parseFloat(form.capacity_mva) || undefined,
                commissioning_date: form.commissioning_date || undefined,
                to_substation: form.to_substation || undefined,
                ckt_id: form.ckt_id || undefined,
                breaker_number: form.breaker_number || undefined,
            };
            
            console.log('Saving payload:', payload);
            
            if (form.id) {
                await api.patch(`/${endpoint}/${form.id}/`, payload);
            } else {
                await api.post(`/${endpoint}/`, payload);
            }
            
            await fetchAssets();
            if (onSubstationRefresh) {
                await onSubstationRefresh(substation.substation_id);
            }
        } catch (err) {
            console.error('Failed to save asset:', err);
        }
        setAssetLoading(false);
    };

    const handleLSRSave = async (formData) => {
        if (!substation?.substation_id) return 'No substation selected.';
        // Voltage conflict check
        if (typeof formData.target_voltage === 'number') {
            const conflict = loadSheddingRelays.find(r => {
                if (formData.id && r.id === formData.id) return false;
                return r.relay_name === `${formData.target_voltage}kV System`;
            });
            if (conflict) return `A relay for ${formData.target_voltage}kV already exists ('${conflict.relay_name}'). Edit the existing relay instead.`;
        }
        try {
            const payload = {
                ...formData,
                substation: substation.substation_id,
                load_transformers: (formData.load_transformers || []).map(t => typeof t === 'object' ? t.id : t),
                auto_transformers: (formData.auto_transformers || []).map(t => typeof t === 'object' ? t.id : t),
                incoming_branches: (formData.incoming_branches || []).map(b => typeof b === 'object' ? b.id : b),
            };
            if (formData.id) {
                await api.patch(`/load-shedding-relays/${formData.id}/`, payload);
            } else {
                await api.post('/load-shedding-relays/', payload);
            }
            setEditingLSRId(null);
            await fetchAssets();
            if (onSubstationRefresh) await onSubstationRefresh(substation.substation_id);
            return null;
        } catch (err) {
            return err.response?.data
                ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
                : 'Failed to save relay.';
        }
    };

    // Form States for Modal
    const [assetForm, setAssetForm] = useState({});


    const handleChange = (e) => {
        const value = e.target.name === 'voltage' ? parseInt(e.target.value) : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const canManageAssets = Boolean(substation?.substation_id);

    const fetchAssets = async () => {
        if (!substation?.substation_id) return;
        setAssetLoading(true);
        try {
            const [loadsRes, autosRes, branchesRes, lsRes] = await Promise.all([
                api.get(`/load-transformers/?substation=${substation.substation_id}`),
                api.get(`/auto-transformers/?substation=${substation.substation_id}`),
                api.get(`/incoming-branches/?substation=${substation.substation_id}`),
                api.get(`/load-shedding-relays/?substation=${substation.substation_id}`),
            ]);
            setLoadTransformers(loadsRes.data || []);
            setAutoTransformers(autosRes.data || []);
            setIncomingBranches(branchesRes.data || []);
            setLoadSheddingRelays(lsRes.data || []);
        } catch (err) {
            setAssetStatus({ type: 'error', msg: 'Failed to load bay assets.' });
        }
        setAssetLoading(false);
    };

    const fetchSubstations = async () => {
        try {
            const res = await api.get('/substations/');
            setSubstationOptions(res.data || []);
        } catch (err) {
            setAssetStatus({ type: 'error', msg: 'Failed to load substations list.' });
        }
    };

    useEffect(() => {
        if (canManageAssets) {
            fetchAssets();
            fetchSubstations();
        }
    }, [canManageAssets, substation?.substation_id]);

    const resetAssetForm = () => {
        setEditingAsset(null);
        setAssetForm({});
        setAssetStatus(null);
    };

    const handleAssetSave = async (type) => {
        if (!substation?.substation_id) return;

        // Validation for unique breaker numbers (with Tee-off override)
        const currentBreaker = assetForm.breaker_number || assetForm.hv_breaker_number || assetForm.lv_breaker_number;
        if (currentBreaker) {
            let existingAssets = [];
            // Combine all assets to check for cross-type breaker sharing
            existingAssets = [...loadTransformers, ...autoTransformers, ...incomingBranches];

            const isDuplicate = existingAssets.some(
                asset => asset.id !== editingAsset?.data?.id &&
                    (asset.breaker_number === currentBreaker ||
                        asset.lv_breaker_number === currentBreaker ||
                        asset.hv_breaker_number === currentBreaker)
            );

            if (isDuplicate) {
                const confirmTeeOff = window.confirm(
                    `Breaker ID '${currentBreaker}' is already in use at this substation.\n\n` +
                    `Is this a "tee-off" configuration sharing the same breaker?`
                );
                if (!confirmTeeOff) {
                    setAssetStatus({ type: 'error', msg: `Breaker ID '${currentBreaker}' is already in use.` });
                    return;
                }
            }
        }

        // --- NEW: LSR Voltage Duplication Validation ---
        if (type === 'lsr' && typeof assetForm.target_voltage === 'number') {
            const isEditing = !!editingAsset?.data?.id;

            // Check if ANY *other* relay has this voltage as its name or target
            const voltageConflict = loadSheddingRelays.find(relay => {
                if (isEditing && relay.id === editingAsset.data.id) return false;

                // If it already matches our target name exactly
                if (relay.relay_name === `${assetForm.target_voltage}kV System`) return true;

                // If we want to be even stricter, we could check the relay's assets 
                // but checking the name is standard for the new design.
                return false;
            });

            if (voltageConflict) {
                setAssetStatus({
                    type: 'error',
                    msg: `A relay for ${assetForm.target_voltage}kV already exists ('${voltageConflict.relay_name}'). Please edit the existing relay instead of creating a duplicate.`
                });
                return;
            }
        }
        // --- END LSR Validation ---

        setAssetLoading(true);
        try {
            const endpointMap = {
                load: 'load-transformers',
                auto: 'auto-transformers',
                branch: 'incoming-branches',
                lsr: 'load-shedding-relays'
            };
            const endpoint = endpointMap[type];
            const payload = { ...assetForm, substation: substation.substation_id };

            // Ensure we are only sending clean scalar IDs for M2M relationships (Write-Simple)
            if (payload.load_transformers) {
                payload.load_transformers = payload.load_transformers.map(t => typeof t === 'object' ? t.id : t);
            }
            if (payload.auto_transformers) {
                payload.auto_transformers = payload.auto_transformers.map(t => typeof t === 'object' ? t.id : t);
            }
            if (payload.incoming_branches) {
                payload.incoming_branches = payload.incoming_branches.map(b => typeof b === 'object' ? b.id : b);
            }

            if (editingAsset?.data?.id) {
                await api.patch(`/${endpoint}/${editingAsset.data.id}/`, payload);
            } else {
                await api.post(`/${endpoint}/`, payload);
            }

            resetAssetForm();
            await fetchAssets();
            if (onSubstationRefresh) {
                await onSubstationRefresh(substation.substation_id);
            }
            setAssetStatus({ type: 'success', msg: 'Asset saved successfully.' });
        } catch (err) {
            let msg = 'Failed to save asset.';
            if (err.response?.data) {
                msg = Object.entries(err.response.data)
                    .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                    .join(' | ');
            }
            setAssetStatus({ type: 'error', msg });
        }
        setAssetLoading(false);
    };

    const handleAssetDelete = async (type, id) => {
        if (!window.confirm('Are you sure you want to delete this asset?')) return;
        setAssetLoading(true);
        try {
            const endpointMap = {
                load: 'load-transformers',
                auto: 'auto-transformers',
                branch: 'incoming-branches',
                lsr: 'load-shedding-relays'
            };
            await api.delete(`/${endpointMap[type]}/${id}/`);
            await fetchAssets();
            if (onSubstationRefresh) {
                await onSubstationRefresh(substation.substation_id);
            }
            setAssetStatus({ type: 'success', msg: 'Asset deleted.' });
        } catch (err) {
            setAssetStatus({ type: 'error', msg: 'Failed to delete asset.' });
        }
        setAssetLoading(false);
    };

    const renderBaysGrouped = (bayIds, fullBaysList, type, isActive) => {
        if (!bayIds || bayIds.length === 0) return null;

        const normalizedBayIds = bayIds.map(bay => typeof bay === 'object' ? bay.id : bay);
        const selectedBays = fullBaysList.filter(b => normalizedBayIds.includes(b.id));
        if (selectedBays.length === 0) return null;

        const label = type === 'load' ? 'Load Transformer' : type === 'auto' ? 'Auto Transformer' : 'Incoming Branch';

        const cardStyle = {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '6px 8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid #f1f5f9',
            borderRadius: '6px',
            width: '100%',
        };

        const getPillStyle = () => ({
            background: isActive ? 'rgba(0, 188, 212, 0.12)' : '#f1f5f9',
            border: `1px solid ${isActive ? 'rgba(0, 188, 212, 0.25)' : '#e2e8f0'}`,
            color: isActive ? 'var(--accent-cyan)' : '#fff',
            fontSize: '0.6rem',
            padding: '1px 6px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '20px'
        });

        if (type === 'branch') {
            const groupedBranches = selectedBays.reduce((acc, curr) => {
                const sub = curr.to_substation || 'Unknown';
                if (!acc[sub]) acc[sub] = [];
                acc[sub].push(curr.ckt_id);
                return acc;
            }, {});

            return (
                <div style={cardStyle}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, padding: '4px 0' }}>
                        {/* Left Column: Category Name */}
                        <div style={{ minWidth: '120px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                {label}
                            </span>
                        </div>

                        {/* Right Column: Assets Grouped by Target Substation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                            {Object.entries(groupedBranches).map(([sub, ckts]) => (
                                <div key={sub} style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {ckts.map((ckt, idx) => (
                                        <span key={idx} className="mono" style={{ ...getPillStyle(), minWidth: '80px', textAlign: 'center' }}>
                                            {sub} {ckt}
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        const grouped = selectedBays.reduce((acc, curr) => {
            const v = curr.lv_voltage || 'Unknown';
            if (!acc[v]) acc[v] = [];
            acc[v].push(`T${curr.transformer_no}`);
            return acc;
        }, {});

        return (
            <div style={cardStyle}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, padding: '4px 0' }}>
                    {/* Left Column: Category Name */}
                    <div style={{ minWidth: '120px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {label}
                        </span>
                    </div>

                    {/* Right Column: Assets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        {Object.entries(grouped).map(([voltage, txs], vIdx) => (
                            <div key={voltage} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{
                                    fontSize: '0.6rem',
                                    color: isActive ? 'var(--accent-cyan)' : '#fff',
                                    fontWeight: 700,
                                    background: isActive ? 'rgba(0, 188, 212, 0.12)' : '#f1f5f9',
                                    border: `1px solid ${isActive ? 'rgba(0, 188, 212, 0.25)' : '#e2e8f0'}`,
                                    padding: '1px 0',
                                    width: '42px',
                                    display: 'inline-flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                    minHeight: '20px'
                                }}>
                                    {voltage}kV
                                </span>
                                {txs.map((tx, idx) => (
                                    <span key={idx} className="mono" style={getPillStyle()}>
                                        {tx}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <AnimatePresence>
                {editingAsset && (
                    <AssetModal
                        type={editingAsset.type}
                        data={editingAsset.data}
                        onClose={resetAssetForm}
                        onSave={handleAssetSave}
                        assetLoading={assetLoading}
                        assetStatus={assetStatus}
                        assetForm={assetForm}
                        setAssetForm={setAssetForm}
                        substationOptions={substationOptions}
                        substation={substation}
                        loadTransformers={loadTransformers}
                        autoTransformers={autoTransformers}
                        incomingBranches={incomingBranches}
                    />
                )}
            </AnimatePresence>

            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.4)', zIndex: 1000,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                backdropFilter: 'blur(4px)', padding: '1rem'
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                        width: '100%',
                        maxWidth: '1000px',
                        height: '100%',
                        maxHeight: '60vh',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.2)',
                        background: '#fff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '1.25rem 2rem',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#fff'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                padding: '10px',
                                background: 'linear-gradient(135deg, rgba(4, 125, 96, 0.1), rgba(5, 150, 105, 0.05))',
                                borderRadius: '10px',
                                border: '1px solid rgba(4, 125, 96, 0.2)'
                            }}>
                                {substation?.substation_id ? <Edit2 size={20} color="#047d60" /> : <MapPin size={20} color="#047d60" />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#1e293b', letterSpacing: '-0.3px', fontFamily: "'Poppins', sans-serif" }}>
                                    {substation?.substation_id ? substation.name : 'Add New Substation'}
                                </h2>
                                {substation?.substation_id && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#047d60', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>
                                            {substation.substation_id}
                                        </span>
                                        {substation.region && <span style={pillStyle('default', null)}>{substation.region}</span>}
                                        {substation.grid && <span style={pillStyle('default', null)}>{substation.grid}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={onCancel} style={{
                            background: '#f1f5f9', border: 'none', color: '#64748b',
                            cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s'
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* Sidebar - Navigation Shortcuts */}
                            <div style={{
                                width: '240px',
                                background: '#f8fafc',
                                borderRight: '1px solid #e2e8f0',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '1rem'
                            }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {[
                                    { id: 'details', label: 'Details & Location', icon: MapPin },
                                    { id: 'load', label: 'Load Transformers', icon: Zap, count: loadTransformers.length },
                                    { id: 'auto', label: 'Auto Transformers', icon: Database, count: autoTransformers.length },
                                    { id: 'branch', label: 'Incoming Branches', icon: GitBranch, count: incomingBranches.length },
                                    { id: 'lsr', label: 'Load Shedding Relays', icon: ShieldAlert, count: loadSheddingRelays.length },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => scrollToSection(tab.id)}
                                        disabled={tab.id !== 'details' && !canManageAssets}
                                        style={{
                                            ...tabButtonStyle(false),
                                            opacity: (tab.id !== 'details' && !canManageAssets) ? 0.5 : 1,
                                            justifyContent: 'space-between',
                                            background: 'transparent',
                                            color: '#64748b'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <tab.icon size={16} />
                                            <span>{tab.label}</span>
                                        </div>
                                        {tab.count !== undefined && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                background: '#e2e8f0',
                                                color: '#64748b',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontFamily: 'monospace',
                                                fontWeight: 700
                                            }}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {!canManageAssets && (
                                <div style={{ marginTop: 'auto', padding: '1.25rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <AlertTriangle size={14} color="#b45309" />
                                        <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Assets Locked</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#92400e', lineHeight: 1.4 }}>
                                        Save the substation details first to unlock asset management.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content Area - Single Page Form */}
                        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: '#fff' }} className="custom-scrollbar">
                            <form id="substation-form" onSubmit={(e) => {
                                e.preventDefault();
                                const { substation_id, sld, sld_file, transformers, incoming_bays, created_at, updated_at, state, region, ...editableData } = formData;
                                onSave(editableData);
                            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                                {/* Section: Details & Location */}
                                <div id="details">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.875rem' }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(4,125,96,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <MapPin size={15} color="#047d60" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif", letterSpacing: '-0.01em' }}>Details & Location</h3>
                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1px' }}>Substation identity and coordinates</div>
                                        </div>
                                    </div>
                                    <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
                                        {/* Row 1: Name + Mnemonic */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px' }}>
                                            <div>
                                                <label style={inputLabelStyle}>Substation Name</label>
                                                <input name="name" className="input-field" value={formData.name} onChange={handleChange} required placeholder="e.g. Pencawang Masuk Utama ..." />
                                            </div>
                                            <div>
                                                <label style={inputLabelStyle}>Mnemonic (ID)</label>
                                                <input name="mnemonic" className="input-field mono" value={formData.mnemonic} onChange={handleChange} required placeholder="ABCD" />
                                            </div>
                                        </div>
                                        {/* Row 2: Voltage + Grid + Ownership */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                            <div>
                                                <label style={inputLabelStyle}>Nominal Voltage</label>
                                                <select name="voltage" className="input-field" value={formData.voltage || ''} onChange={handleChange} required>
                                                    <option value="">-- Select --</option>
                                                    {VOLTAGES.map(v => <option key={v} value={v}>{v} kV</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={inputLabelStyle}>Grid Unit</label>
                                                <select name="grid" className="input-field" value={formData.grid || ''} onChange={handleChange} required>
                                                    <option value="">-- Select --</option>
                                                    {GRIDS.map(g => <option key={g} value={g}>{g}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={inputLabelStyle}>Ownership</label>
                                                <select name="ownership" className="input-field" value={formData.ownership || ''} onChange={handleChange}>
                                                    <option value="TNB">TNB</option>
                                                    <option value="DC">Data Centre (DC)</option>
                                                    <option value="LSS">Large Scale Solar (LSS)</option>
                                                    <option value="IPP">Independent Power Producer (IPP)</option>
                                                    <option value="LPC">Large Power Consumer (LPC)</option>
                                                    <option value="Tie-Line">Tie-Line</option>
                                                </select>
                                            </div>
                                        </div>
                                        {/* Row 3: Latitude + Longitude + Commission Date */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: '12px' }}>
                                            <div>
                                                <label style={inputLabelStyle}>Latitude</label>
                                                <input name="latitude" type="number" step="any" className="input-field mono" value={formData.latitude || ''} onChange={handleChange} placeholder="e.g. 3.1390" />
                                            </div>
                                            <div>
                                                <label style={inputLabelStyle}>Longitude</label>
                                                <input name="longitude" type="number" step="any" className="input-field mono" value={formData.longitude || ''} onChange={handleChange} placeholder="e.g. 101.6869" />
                                            </div>
                                            <div>
                                                <label style={inputLabelStyle}>Commission Date</label>
                                                <input name="commission_date" type="date" className="input-field mono" value={formData.commission_date || ''} onChange={handleChange} style={{ colorScheme: 'dark' }} />
                                            </div>
                                        </div>
                                        {/* Row 4: SLD File */}
                                        {substation?.substation_id && (
                                            <div>
                                                <label style={inputLabelStyle}>SLD File</label>
                                                <input type="file" id="sld-upload-input" hidden accept=".pdf,.dxf,.svg,image/*" onChange={(e) => e.target.files[0] && onSLDUpload?.(substation.substation_id, e.target.files[0])} />
                                                <label htmlFor="sld-upload-input" style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                    padding: '6px 14px', borderRadius: '6px',
                                                    border: '1px dashed #cbd5e1', background: '#f8fafc',
                                                    fontSize: '0.74rem', fontWeight: 600, color: '#64748b',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                    fontFamily: "'Poppins', sans-serif",
                                                }}>
                                                    {substation.sld_file ? <FileText size={14} /> : <Upload size={14} />}
                                                    {substation.sld_file ? 'Update SLD File' : 'Upload SLD File'}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Separator */}
                                <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                                {/* Section: Load Transformers */}
                                <div id="load">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.875rem' }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(4,125,96,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Zap size={15} color="#047d60" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif", letterSpacing: '-0.01em' }}>Load Transformers</h3>
                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1px' }}>HV/LV step-down units</div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.62rem', fontWeight: 700,
                                            background: loadTransformers.length > 0 ? 'rgba(4,125,96,0.08)' : '#f1f5f9',
                                            color: loadTransformers.length > 0 ? '#047d60' : '#94a3b8',
                                            padding: '2px 8px', borderRadius: '20px',
                                            border: `1px solid ${loadTransformers.length > 0 ? 'rgba(4,125,96,0.2)' : '#e2e8f0'}`
                                        }}>
                                            {loadTransformers.length} unit{loadTransformers.length !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={fetchAssets}
                                            disabled={assetLoading}
                                            style={{
                                                marginLeft: 'auto', background: 'transparent',
                                                border: '1px solid #e2e8f0', color: '#94a3b8',
                                                cursor: 'pointer', padding: '5px 8px',
                                                borderRadius: '6px', display: 'flex', alignItems: 'center',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <RefreshCw size={13} className={assetLoading ? 'animate-spin' : ''} />
                                        </button>
                                    </div>

                                    {canManageAssets ? (
                                        <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            {/* Column headers */}
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: LT_COLS,
                                                gap: '6px', padding: '8px 16px',
                                                background: 'linear-gradient(135deg, rgba(4,125,96,0.07), rgba(5,150,105,0.03))',
                                                borderBottom: '1px solid #e2e8f0',
                                                fontSize: '0.7rem', fontWeight: 700,
                                                color: '#047d60', textTransform: 'uppercase',
                                                letterSpacing: '0.08em', fontFamily: "'Poppins', sans-serif"
                                            }}>
                                                <div style={{ textAlign: 'center' }}>Unit</div>
                                                <div style={{ textAlign: 'center' }}>LV</div>
                                                <div style={{ textAlign: 'center' }}>Capacity</div>
                                                <div style={{ textAlign: 'center' }}>HV Breaker</div>
                                                <div style={{ textAlign: 'center' }}>LV Breaker</div>
                                                <div style={{ textAlign: 'center' }}>Commissioned</div>
                                                <div style={{ textAlign: 'center' }}>Action</div>
                                            </div>

                                            {/* Data rows */}
                                            {loadTransformers.map((asset) => (
                                                <TransformerForm
                                                    key={asset.id}
                                                    asset={asset}
                                                    onSave={(formData) => handleInlineSave('load', formData)}
                                                    onDelete={() => handleAssetDelete('load', asset.id)}
                                                />
                                            ))}

                                            {/* Empty state */}
                                            {loadTransformers.length === 0 && !isAddingLT && (
                                                <div style={{ padding: '2.25rem 1rem', textAlign: 'center', background: '#fafafa' }}>
                                                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                                                        <Zap size={15} color="#cbd5e1" />
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>No load transformers</div>
                                                    <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '2px' }}>Click "Add unit" to register one</div>
                                                </div>
                                            )}

                                            {/* New row form */}
                                            {isAddingLT && (
                                                <TransformerForm
                                                    asset={inlineForm}
                                                    onSave={async (formData) => { setInlineForm(formData); await handleInlineSave('load', formData); setIsAddingLT(false); setInlineForm({}); }}
                                                    onCancel={() => { setIsAddingLT(false); setInlineForm({}); }}
                                                    isNew
                                                />
                                            )}

                                            {/* Add button */}
                                            {!isAddingLT && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setInlineForm({ transformer_no: loadTransformers.length + 1, lv_voltage: '', capacity_mva: '', hv_breaker_number: '', lv_breaker_number: '', commissioning_date: '' });
                                                        setIsAddingLT(true);
                                                    }}
                                                    style={{
                                                        width: '100%', padding: '9px 16px',
                                                        border: 'none', borderTop: '1px dashed #e2e8f0',
                                                        background: '#fafafa', color: '#94a3b8',
                                                        cursor: 'pointer', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center',
                                                        gap: '6px', fontSize: '0.74rem', fontWeight: 600,
                                                        fontFamily: "'Poppins', sans-serif",
                                                        transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#047d60'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.color = '#94a3b8'; }}
                                                >
                                                    <Plus size={13} /> Add unit
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Save substation details first to manage assets</div>
                                        </div>
                                    )}
                                </div>

                                {/* Separator */}
                                <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                                {/* Section: Auto Transformers */}
                                <div id="auto">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.875rem' }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(4,125,96,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Database size={15} color="#047d60" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif", letterSpacing: '-0.01em' }}>Auto Transformers</h3>
                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1px' }}>HV/HV step-down units</div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.62rem', fontWeight: 700,
                                            background: autoTransformers.length > 0 ? 'rgba(4,125,96,0.08)' : '#f1f5f9',
                                            color: autoTransformers.length > 0 ? '#047d60' : '#94a3b8',
                                            padding: '2px 8px', borderRadius: '20px',
                                            border: `1px solid ${autoTransformers.length > 0 ? 'rgba(4,125,96,0.2)' : '#e2e8f0'}`
                                        }}>
                                            {autoTransformers.length} unit{autoTransformers.length !== 1 ? 's' : ''}
                                        </span>
                                        <button type="button" onClick={fetchAssets} disabled={assetLoading}
                                            style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #e2e8f0', color: '#94a3b8', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                                            <RefreshCw size={13} className={assetLoading ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                    {canManageAssets ? (
                                        <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: AT_COLS,
                                                gap: '6px', padding: '8px 16px',
                                                background: 'linear-gradient(135deg, rgba(4,125,96,0.07), rgba(5,150,105,0.03))',
                                                borderBottom: '1px solid #e2e8f0',
                                                fontSize: '0.7rem', fontWeight: 700,
                                                color: '#047d60', textTransform: 'uppercase',
                                                letterSpacing: '0.08em', fontFamily: "'Poppins', sans-serif"
                                            }}>
                                                <div style={{ textAlign: 'center' }}>Unit</div>
                                                <div style={{ textAlign: 'center' }}>HV</div>
                                                <div style={{ textAlign: 'center' }}>LV</div>
                                                <div style={{ textAlign: 'center' }}>Capacity</div>
                                                <div style={{ textAlign: 'center' }}>HV Breaker</div>
                                                <div style={{ textAlign: 'center' }}>LV Breaker</div>
                                                <div style={{ textAlign: 'center' }}>Action</div>
                                            </div>
                                            {autoTransformers.map((asset) => (
                                                <AutoTransformerRow
                                                    key={asset.id}
                                                    asset={asset}
                                                    onSave={(formData) => handleInlineSave('auto', formData)}
                                                    onDelete={() => handleAssetDelete('auto', asset.id)}
                                                />
                                            ))}
                                            {autoTransformers.length === 0 && !isAddingAT && (
                                                <div style={{ padding: '2.25rem 1rem', textAlign: 'center', background: '#fafafa' }}>
                                                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                                                        <Database size={15} color="#cbd5e1" />
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>No auto transformers</div>
                                                    <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '2px' }}>Click "Add unit" to register one</div>
                                                </div>
                                            )}
                                            {isAddingAT && (
                                                <AutoTransformerRow
                                                    asset={inlineATForm}
                                                    onSave={async (formData) => { setInlineATForm(formData); await handleInlineSave('auto', formData); setIsAddingAT(false); setInlineATForm({}); }}
                                                    onCancel={() => { setIsAddingAT(false); setInlineATForm({}); }}
                                                    isNew
                                                />
                                            )}
                                            {!isAddingAT && (
                                                <button type="button"
                                                    onClick={() => { setInlineATForm({ transformer_no: autoTransformers.length + 1, hv_voltage: '', lv_voltage: '', capacity_mva: '', hv_breaker_number: '', lv_breaker_number: '' }); setIsAddingAT(true); }}
                                                    style={{ width: '100%', padding: '9px 16px', border: 'none', borderTop: '1px dashed #e2e8f0', background: '#fafafa', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 600, fontFamily: "'Poppins', sans-serif", transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#047d60'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.color = '#94a3b8'; }}>
                                                    <Plus size={13} /> Add unit
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Save substation details first to manage assets</div>
                                        </div>
                                    )}
                                </div>

                                {/* Separator */}
                                <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                                {/* Section: Incoming Branches */}
                                <div id="branch">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.875rem' }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(4,125,96,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <GitBranch size={15} color="#047d60" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif", letterSpacing: '-0.01em' }}>Incoming Branches</h3>
                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1px' }}>Feeder & line connections</div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.62rem', fontWeight: 700,
                                            background: incomingBranches.length > 0 ? 'rgba(4,125,96,0.08)' : '#f1f5f9',
                                            color: incomingBranches.length > 0 ? '#047d60' : '#94a3b8',
                                            padding: '2px 8px', borderRadius: '20px',
                                            border: `1px solid ${incomingBranches.length > 0 ? 'rgba(4,125,96,0.2)' : '#e2e8f0'}`
                                        }}>
                                            {incomingBranches.length} line{incomingBranches.length !== 1 ? 's' : ''}
                                        </span>
                                        <button type="button" onClick={fetchAssets} disabled={assetLoading}
                                            style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #e2e8f0', color: '#94a3b8', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                                            <RefreshCw size={13} className={assetLoading ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                    {canManageAssets ? (
                                        <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: BR_COLS,
                                                gap: '6px', padding: '8px 16px',
                                                background: 'linear-gradient(135deg, rgba(4,125,96,0.07), rgba(5,150,105,0.03))',
                                                borderBottom: '1px solid #e2e8f0',
                                                fontSize: '0.7rem', fontWeight: 700,
                                                color: '#047d60', textTransform: 'uppercase',
                                                letterSpacing: '0.08em', fontFamily: "'Poppins', sans-serif"
                                            }}>
                                                <div>To Substation</div>
                                                <div style={{ textAlign: 'center' }}>CIRCUIT NO</div>
                                                <div style={{ textAlign: 'center' }}>BREAKER NO</div>
                                                <div style={{ textAlign: 'center' }}>Action</div>
                                            </div>
                                            {incomingBranches.map((asset) => (
                                                <IncomingBranchRow
                                                    key={asset.id}
                                                    asset={asset}
                                                    substationOptions={substationOptions}
                                                    onSave={(formData) => handleInlineSave('branch', formData)}
                                                    onDelete={() => handleAssetDelete('branch', asset.id)}
                                                />
                                            ))}
                                            {incomingBranches.length === 0 && !isAddingBranch && (
                                                <div style={{ padding: '2.25rem 1rem', textAlign: 'center', background: '#fafafa' }}>
                                                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                                                        <GitBranch size={15} color="#cbd5e1" />
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>No incoming branches</div>
                                                    <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '2px' }}>Click "Add bay" to register one</div>
                                                </div>
                                            )}
                                            {isAddingBranch && (
                                                <IncomingBranchRow
                                                    asset={inlineBranchForm}
                                                    substationOptions={substationOptions}
                                                    onSave={async (formData) => { setInlineBranchForm(formData); await handleInlineSave('branch', formData); setIsAddingBranch(false); setInlineBranchForm({}); }}
                                                    onCancel={() => { setIsAddingBranch(false); setInlineBranchForm({}); }}
                                                    isNew
                                                />
                                            )}
                                            {!isAddingBranch && (
                                                <button type="button"
                                                    onClick={() => { setInlineBranchForm({ to_substation: '', ckt_id: '', breaker_number: '' }); setIsAddingBranch(true); }}
                                                    style={{ width: '100%', padding: '9px 16px', border: 'none', borderTop: '1px dashed #e2e8f0', background: '#fafafa', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 600, fontFamily: "'Poppins', sans-serif", transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#047d60'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.color = '#94a3b8'; }}>
                                                    <Plus size={13} /> Add bay
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Save substation details first to manage assets</div>
                                        </div>
                                    )}
                                </div>

                                {/* Separator */}
                                <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

{/* Section: Load Shedding Relays */}
                                <div id="lsr">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.875rem' }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(4,125,96,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <ShieldAlert size={15} color="#047d60" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif", letterSpacing: '-0.01em' }}>Load Shedding Relays</h3>
                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1px' }}>Breaker trip wiring assignments</div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.62rem', fontWeight: 700,
                                            background: loadSheddingRelays.length > 0 ? 'rgba(4,125,96,0.08)' : '#f1f5f9',
                                            color: loadSheddingRelays.length > 0 ? '#047d60' : '#94a3b8',
                                            padding: '2px 8px', borderRadius: '20px',
                                            border: `1px solid ${loadSheddingRelays.length > 0 ? 'rgba(4,125,96,0.2)' : '#e2e8f0'}`
                                        }}>
                                            {loadSheddingRelays.length} assignment{loadSheddingRelays.length !== 1 ? 's' : ''}
                                        </span>
                                        <button type="button" onClick={fetchAssets} disabled={assetLoading}
                                            style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #e2e8f0', color: '#94a3b8', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                                            <RefreshCw size={13} className={assetLoading ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                    {canManageAssets ? (
                                        <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            {/* Table header */}
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: LSR_COLS,
                                                gap: '6px', padding: '8px 16px',
                                                background: 'linear-gradient(135deg, rgba(4,125,96,0.07), rgba(5,150,105,0.03))',
                                                borderBottom: '1px solid #e2e8f0',
                                                fontSize: '0.7rem', fontWeight: 700,
                                                color: '#047d60', textTransform: 'uppercase',
                                                letterSpacing: '0.08em', fontFamily: "'Poppins', sans-serif"
                                            }}>
                                                <div>Voltage</div>
                                                <div style={{ textAlign: 'center' }}>LOAD TX</div>
                                                <div style={{ textAlign: 'center' }}>AUTO TX</div>
                                                <div style={{ textAlign: 'center' }}>Branches</div>
                                                <div style={{ textAlign: 'center' }}>Status</div>
                                                <div style={{ textAlign: 'center' }}>Action</div>
                                            </div>

                                            {/* Existing relay rows — click to expand inline form */}
                                            {loadSheddingRelays.map((asset) => (
                                                <React.Fragment key={asset.id}>
                                                    <LSRRow
                                                        relay={asset}
                                                        isSelected={editingLSRId === asset.id}
                                                        onEdit={() => setEditingLSRId(editingLSRId === asset.id ? null : asset.id)}
                                                        onDelete={() => handleAssetDelete('lsr', asset.id)}
                                                    />
                                                    {editingLSRId === asset.id && (
                                                        <LSRInlineForm
                                                            data={asset}
                                                            substation={substation}
                                                            loadTransformers={loadTransformers}
                                                            autoTransformers={autoTransformers}
                                                            incomingBranches={incomingBranches}
                                                            loadSheddingRelays={loadSheddingRelays}
                                                            onSave={handleLSRSave}
                                                            onCancel={() => setEditingLSRId(null)}
                                                        />
                                                    )}
                                                </React.Fragment>
                                            ))}

                                            {/* Empty state */}
                                            {loadSheddingRelays.length === 0 && editingLSRId !== 'new' && (
                                                <div style={{ padding: '2.25rem 1rem', textAlign: 'center', background: '#fafafa' }}>
                                                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                                                        <ShieldAlert size={15} color="#cbd5e1" />
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>No load shedding relays</div>
                                                    <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '2px' }}>Click "Add relay" to configure one</div>
                                                </div>
                                            )}

                                            {/* New relay inline form */}
                                            {editingLSRId === 'new' && (
                                                <LSRInlineForm
                                                    data={null}
                                                    substation={substation}
                                                    loadTransformers={loadTransformers}
                                                    autoTransformers={autoTransformers}
                                                    incomingBranches={incomingBranches}
                                                    loadSheddingRelays={loadSheddingRelays}
                                                    onSave={handleLSRSave}
                                                    onCancel={() => setEditingLSRId(null)}
                                                />
                                            )}

                                            {/* Add relay button — hidden while adding */}
                                            {editingLSRId !== 'new' && (
                                                <button type="button"
                                                    onClick={() => setEditingLSRId('new')}
                                                    style={{ width: '100%', padding: '9px 16px', border: 'none', borderTop: '1px dashed #e2e8f0', background: '#fafafa', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 600, fontFamily: "'Poppins', sans-serif", transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#047d60'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.color = '#94a3b8'; }}>
                                                    <Plus size={13} /> Add relay
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Save substation details first to manage assets</div>
                                        </div>
                                    )}
                                </div>

                            </form>
                        </div>
                        {/* Footer — outside scroll area, always pinned to bottom */}
                        </div>
                        <div style={{ flexShrink: 0, padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
                            <button type="button" onClick={onCancel} style={{
                                padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.8rem',
                                background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b',
                                fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
                            }}>
                                Cancel
                            </button>
                            <button type="submit" form="substation-form" disabled={loading} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                {loading ? 'Saving...' : (substation?.substation_id ? 'Save Metadata' : 'Create Substation')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default SubstationForm;
