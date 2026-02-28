import React, { useState, useEffect } from 'react';
import { X, Save, MapPin, AlertTriangle, Edit2, Upload, Plus, RefreshCw, Database, Zap, GitBranch, ShieldAlert, Trash2, CheckCircle2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

const GRIDS = ['KEDP', 'PPNG', 'PERK', 'SELG', 'KLUM', 'NSEM', 'MLKA', 'JOH2', 'JOH1', 'PHNG', 'TERG', 'KELN'];
const VOLTAGES = [500, 275, 132];
const LOAD_LV = [33, 22, 11];
const AUTO_LV = [275, 132];

const tabButtonStyle = (isActive) => {
    return {
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: 'none',
        background: isActive ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
        color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
        fontWeight: isActive ? 600 : 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'all 0.2s ease',
        fontSize: '0.85rem',
        textAlign: 'left'
    };
};

const inputLabelStyle = {
    display: 'block',
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    fontWeight: 500,
    letterSpacing: '0.5px'
};

const pillStyle = (type, value) => {
    let bg = 'rgba(255,255,255,0.05)';
    let color = 'var(--text-secondary)';

    if (type === 'voltage') {
        bg = value >= 500 ? 'rgba(255,255,255,0.1)' : (value >= 275 ? 'rgba(0, 191, 255, 0.08)' : 'rgba(74, 222, 128, 0.1)');
        color = value >= 500 ? '#ffffff' : (value >= 275 ? '#15d5f6ff' : 'var(--accent-cyan)');
    } else if (type === 'ownership') {
        bg = 'rgba(255, 159, 67, 0.1)';
        color = '#ff9f43';
    }

    return {
        fontSize: '0.65rem',
        background: bg,
        color: color,
        padding: '2px 8px',
        borderRadius: '4px',
        fontWeight: 600,
        display: 'inline-block'
    };
};

const AssetModal = ({ type, data, onClose, onSave, assetLoading, assetStatus, assetForm, setAssetForm, substationOptions, substation, loadTransformers, autoTransformers, incomingBranches }) => {
    const isBranch = type === 'branch';
    const isLSR = type === 'lsr';
    const title = data?.id ? 'Edit' : 'Add';
    const typeLabel = isLSR ? 'Load Shedding Relay' : type === 'load' ? 'Load Transformer' : type === 'auto' ? 'Auto Transformer' : 'Incoming Branch';

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}
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
                            style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <AlertTriangle size={16} color="#ef4444" />
                            <span style={{ fontSize: '0.8rem', color: '#ef4444', lineHeight: 1.4 }}>{assetStatus.msg}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {isLSR ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Relay Status</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', height: '32px', gap: '10px' }}>
                                <div
                                    onClick={() => setAssetForm(f => ({ ...f, is_active: !f.is_active }))}
                                    style={{
                                        width: '40px', height: '20px',
                                        background: assetForm.is_active !== false ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255,255,255,0.1)',
                                        borderRadius: '20px', padding: '2px', cursor: 'pointer', position: 'relative',
                                        border: `1px solid ${assetForm.is_active !== false ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255,255,255,0.2)'}`,
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    <motion.div animate={{ x: assetForm.is_active !== false ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        style={{ width: '14px', height: '14px', background: '#fff', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', color: assetForm.is_active !== false ? '#fff' : 'var(--text-secondary)', fontWeight: 500 }}>
                                    {assetForm.is_active !== false ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label style={inputLabelStyle}>Load Transformers</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', alignItems: 'flex-start' }}>
                                {loadTransformers?.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No load transformers available.</div>}
                                {loadTransformers?.map((lt) => {
                                    const checked = (assetForm.load_transformers || []).includes(lt.id);
                                    return (
                                        <label key={lt.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px', cursor: 'pointer', background: checked ? 'rgba(0, 191, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`, color: checked ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s', userSelect: 'none' }}>
                                            <input type="checkbox" checked={checked} onChange={(e) => {
                                                const arr = assetForm.load_transformers || [];
                                                setAssetForm(f => ({ ...f, load_transformers: e.target.checked ? [...arr, lt.id] : arr.filter(id => id !== lt.id) }));
                                            }} style={{ display: 'none' }} />
                                            <span className="mono">T{lt.transformer_no} {lt.lv_voltage ? `(${lt.lv_voltage}kV)` : ''}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label style={inputLabelStyle}>Auto Transformers</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', alignItems: 'flex-start' }}>
                                {autoTransformers?.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No auto transformers available.</div>}
                                {autoTransformers?.map((at) => {
                                    const checked = (assetForm.auto_transformers || []).includes(at.id);
                                    return (
                                        <label key={at.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px', cursor: 'pointer', background: checked ? 'rgba(0, 191, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`, color: checked ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s', userSelect: 'none' }}>
                                            <input type="checkbox" checked={checked} onChange={(e) => {
                                                const arr = assetForm.auto_transformers || [];
                                                setAssetForm(f => ({ ...f, auto_transformers: e.target.checked ? [...arr, at.id] : arr.filter(id => id !== at.id) }));
                                            }} style={{ display: 'none' }} />
                                            <span className="mono">T{at.transformer_no} {at.lv_voltage ? `(${at.lv_voltage}kV)` : ''}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label style={inputLabelStyle}>Incoming Branches</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', alignItems: 'flex-start' }}>
                                {incomingBranches?.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No branches available.</div>}
                                {incomingBranches?.map((ib) => {
                                    const checked = (assetForm.incoming_branches || []).includes(ib.id);
                                    return (
                                        <label key={ib.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px', cursor: 'pointer', background: checked ? 'rgba(0, 191, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`, color: checked ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s', userSelect: 'none' }}>
                                            <input type="checkbox" checked={checked} onChange={(e) => {
                                                const arr = assetForm.incoming_branches || [];
                                                setAssetForm(f => ({ ...f, incoming_branches: e.target.checked ? [...arr, ib.id] : arr.filter(id => id !== ib.id) }));
                                            }} style={{ display: 'none' }} />
                                            <span className="mono">{ib.to_substation} {ib.ckt_id}</span>
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
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
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
            </motion.div>
        </div>
    );
};
const SubstationForm = ({ substation, onSave, onCancel, onSLDUpload, status, loading }) => {
    const [formData, setFormData] = useState(substation || {
        mnemonic: '',
        name: '',
        ownership: 'TNB',
        voltage: '',
        grid: '',
        latitude: '',
        longitude: ''
    });

    // Sync formData with substation prop when it changes (after save)
    useEffect(() => {
        if (substation) {
            setFormData(substation);
        }
    }, [substation]);
    const [activeTab, setActiveTab] = useState('metadata');
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

        // Front-end validation for unique breaker numbers
        const currentBreaker = assetForm.breaker_number;
        if (currentBreaker) {
            let existingAssets = [];
            if (type === 'load') existingAssets = loadTransformers;
            else if (type === 'auto') existingAssets = autoTransformers;
            else if (type === 'branch') existingAssets = incomingBranches;

            const isDuplicate = existingAssets.some(
                asset => asset.id !== editingAsset?.data?.id &&
                    (asset.breaker_number === currentBreaker || asset.lv_breaker_number === currentBreaker || asset.hv_breaker_number === currentBreaker)
            );

            if (isDuplicate) {
                setAssetStatus({ type: 'error', msg: `Breaker ID '${currentBreaker}' is already in use for this substation.` });
                return;
            }
        }

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

            if (editingAsset?.data?.id) {
                await api.patch(`/${endpoint}/${editingAsset.data.id}/`, payload);
            } else {
                await api.post(`/${endpoint}/`, payload);
            }

            resetAssetForm();
            await fetchAssets();
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
            setAssetStatus({ type: 'success', msg: 'Asset deleted.' });
        } catch (err) {
            setAssetStatus({ type: 'error', msg: 'Failed to delete asset.' });
        }
        setAssetLoading(false);
    };

    const renderBaysGrouped = (bayIds, fullBaysList, type, isActive) => {
        if (!bayIds || bayIds.length === 0) return null;

        const selectedBays = fullBaysList.filter(b => bayIds.includes(b.id));
        if (selectedBays.length === 0) return null;

        const label = type === 'load' ? 'Load Transformer' : type === 'auto' ? 'Auto Transformer' : 'Incoming Branch';

        const cardStyle = {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '6px 8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '6px',
            width: '100%',
        };

        const getPillStyle = () => ({
            background: isActive ? 'rgba(0, 188, 212, 0.12)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isActive ? 'rgba(0, 188, 212, 0.25)' : 'rgba(255,255,255,0.1)'}`,
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
                                    background: isActive ? 'rgba(0, 188, 212, 0.12)' : 'rgba(255,255,255,0.08)',
                                    border: `1px solid ${isActive ? 'rgba(0, 188, 212, 0.25)' : 'rgba(255,255,255,0.1)'}`,
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
                background: 'rgba(10, 12, 16, 0.4)', zIndex: 1000,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                backdropFilter: 'blur(4px)', padding: '1rem'
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card"
                    style={{
                        width: '100%',
                        maxWidth: '920px',
                        height: '100%',
                        maxHeight: '620px',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '1.25rem 2rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.01)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                padding: '10px',
                                background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.1), rgba(0, 255, 163, 0.1))',
                                borderRadius: '10px',
                                border: '1px solid rgba(0, 229, 255, 0.2)'
                            }}>
                                {substation?.substation_id ? <Edit2 size={20} color="var(--accent-cyan)" /> : <MapPin size={20} color="var(--accent-cyan)" />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.3px' }}>
                                    {substation?.substation_id ? substation.name : 'Add New Substation'}
                                </h2>
                                {substation?.substation_id && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                        <span className="mono" style={{ fontSize: '0.75rem', color: substation.voltage >= 500 ? '#ffffff' : (substation.voltage >= 275 ? '#15d5f6ff' : 'var(--accent-cyan)'), fontWeight: 600 }}>
                                            {substation.substation_id}
                                        </span>
                                        {substation.region && <span style={pillStyle('default', null)}>{substation.region}</span>}
                                        {substation.grid && <span style={pillStyle('default', null)}>{substation.grid}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={onCancel} style={{
                            background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)',
                            cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s'
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                        {/* Sidebar */}
                        <div style={{
                            width: '240px',
                            background: 'rgba(0,0,0,0.2)',
                            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '1rem'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {[
                                    { id: 'metadata', label: 'Details & Location', icon: MapPin },
                                    { id: 'load', label: 'Load Transformers', icon: Zap, count: loadTransformers.length },
                                    { id: 'auto', label: 'Auto Transformers', icon: Database, count: autoTransformers.length },
                                    { id: 'branch', label: 'Incoming Branches', icon: GitBranch, count: incomingBranches.length },
                                    { id: 'lsr', label: 'Load Shedding Relays', icon: ShieldAlert, count: loadSheddingRelays.length },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        disabled={tab.id !== 'metadata' && !canManageAssets}
                                        style={{
                                            ...tabButtonStyle(activeTab === tab.id),
                                            opacity: (tab.id !== 'metadata' && !canManageAssets) ? 0.5 : 1,
                                            justifyContent: 'space-between'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (activeTab !== tab.id && !(tab.id !== 'metadata' && !canManageAssets)) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.color = 'white';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (activeTab !== tab.id) {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <tab.icon size={16} />
                                            <span>{tab.label}</span>
                                        </div>
                                        {tab.count !== undefined && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                background: activeTab === tab.id ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
                                                color: activeTab === tab.id ? 'var(--bg-deep)' : 'var(--text-secondary)',
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
                                <div style={{ marginTop: 'auto', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <AlertTriangle size={14} color="#ff9f43" />
                                        <span style={{ fontSize: '0.75rem', color: '#ff9f43', fontWeight: 600 }}>Assets Locked</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        Save the substation details first to unlock asset management.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }} className="custom-scrollbar">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ height: '100%' }}
                                >
                                    {activeTab === 'metadata' ? (
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            const { substation_id, sld, sld_file, transformers, incoming_bays, created_at, updated_at, state, region, ...editableData } = formData;
                                            onSave(editableData);
                                        }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>

                                            <AnimatePresence mode="wait">
                                                {status && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        style={{
                                                            padding: '0.75rem 1rem',
                                                            borderRadius: '8px',
                                                            background: status.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            border: `1px solid ${status.type === 'success' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        {status.type === 'success' ? <CheckCircle2 size={16} color="#4ade80" /> : <AlertTriangle size={16} color="#ef4444" />}
                                                        <span style={{ fontSize: '0.85rem', color: status.type === 'success' ? '#4ade80' : '#ef4444', fontWeight: 500 }}>{status.msg}</span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1.5rem' }}>
                                                <div style={{ gridColumn: 'span 4' }}>
                                                    <label style={inputLabelStyle}>Substation Name</label>
                                                    <input name="name" className="input-field" value={formData.name} onChange={handleChange} required placeholder="e.g. Pencawang Masuk Utama ..." />
                                                </div>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={inputLabelStyle}>Mnemonic (ID)</label>
                                                    <input name="mnemonic" className="input-field mono" value={formData.mnemonic} onChange={handleChange} required placeholder="ABCD" />
                                                </div>

                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={inputLabelStyle}>Nominal Voltage</label>
                                                    <select name="voltage" className="input-field" value={formData.voltage || ''} onChange={handleChange} required>
                                                        <option value="">-- Select --</option>
                                                        {VOLTAGES.map(v => <option key={v} value={v}>{v} kV</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={inputLabelStyle}>Grid Unit</label>
                                                    <select name="grid" className="input-field" value={formData.grid || ''} onChange={handleChange} required>
                                                        <option value="">-- Select --</option>
                                                        {GRIDS.map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={inputLabelStyle}>Ownership</label>
                                                    <select name="ownership" className="input-field" value={formData.ownership || ''} onChange={handleChange}>
                                                        <option value="TNB">TNB</option>
                                                        <option value="DC">Data Centre (DC)</option>
                                                        <option value="LSS">Large Scale Solar (LSS)</option>
                                                        <option value="IPP">Independent Power Producer (IPP)</option>
                                                        <option value="LPC">Large Power Consumer (LPC)</option>
                                                    </select>
                                                </div>

                                                <div style={{ gridColumn: 'span 3' }}>
                                                    <label style={inputLabelStyle}>Latitude</label>
                                                    <input name="latitude" type="number" step="any" className="input-field mono" value={formData.latitude || ''} onChange={handleChange} placeholder="e.g. 3.1390" />
                                                </div>
                                                <div style={{ gridColumn: 'span 3' }}>
                                                    <label style={inputLabelStyle}>Longitude</label>
                                                    <input name="longitude" type="number" step="any" className="input-field mono" value={formData.longitude || ''} onChange={handleChange} placeholder="e.g. 101.6869" />
                                                </div>

                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={inputLabelStyle}>Commission Date</label>
                                                    <input name="commission_date" type="date" className="input-field mono" value={formData.commission_date || ''} onChange={handleChange} style={{ colorScheme: 'dark' }} />
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                {substation?.substation_id && (
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                                        <input type="file" id="sld-upload-input" hidden accept=".pdf,.dxf,.svg,image/*" onChange={(e) => e.target.files[0] && onSLDUpload?.(substation.substation_id, e.target.files[0])} />
                                                        <label htmlFor="sld-upload-input" style={{
                                                            padding: '0.75rem 1.25rem', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '0.5rem',
                                                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                                            fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)',
                                                            transition: 'all 0.2s'
                                                        }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                                        >
                                                            {substation.sld_file ? <FileText size={16} /> : <Upload size={16} />}
                                                            {substation.sld_file ? 'Update SLD File' : 'Upload SLD File'}
                                                        </label>
                                                    </div>
                                                )}
                                                <button type="button" onClick={onCancel} style={{
                                                    padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontSize: '0.9rem',
                                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)',
                                                    fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
                                                }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                >
                                                    Cancel
                                                </button>
                                                <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                                                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                                    {loading ? 'Saving...' : (substation?.substation_id ? 'Save Metadata' : 'Create Substation')}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>
                                                        {activeTab === 'lsr' ? 'Load Shedding Relays' : activeTab === 'load' ? 'Load Transformers' : activeTab === 'auto' ? 'Auto Transformers' : 'Incoming Branches'}
                                                    </h3>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                    <button style={{
                                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)',
                                                        cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                        onClick={fetchAssets} disabled={assetLoading}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                    >
                                                        <RefreshCw size={16} className={assetLoading ? 'animate-spin' : ''} />
                                                    </button>
                                                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => {
                                                        setEditingAsset({ type: activeTab, data: null });
                                                        setAssetForm({});
                                                    }}>
                                                        <Plus size={16} /> Add Asset
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: activeTab === 'lsr' ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
                                                gap: '1rem',
                                                paddingBottom: '1rem'
                                            }}>
                                                {(activeTab === 'lsr' ? loadSheddingRelays : activeTab === 'load' ? loadTransformers : activeTab === 'auto' ? autoTransformers : incomingBranches).map((asset) => (
                                                    <motion.div
                                                        key={asset.id}
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        style={{
                                                            background: 'rgba(255, 255, 255, 0.02)',
                                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            overflow: 'hidden',
                                                            transition: 'all 0.2s ease',
                                                            cursor: 'pointer',
                                                        }}
                                                        onClick={() => { setEditingAsset({ type: activeTab, data: asset }); setAssetForm(asset); }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
                                                    >
                                                        {/* Body */}
                                                        <div style={{ padding: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                                                                {activeTab === 'lsr' ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                            <span style={{ fontSize: '0.75rem', background: asset.is_active ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: asset.is_active ? '#4ade80' : 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                {asset.is_active ? <CheckCircle2 size={12} /> : <X size={12} />}
                                                                                {asset.is_active ? 'Active' : 'Inactive'}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                                                                            {renderBaysGrouped(asset.load_transformers, loadTransformers, 'load', asset.is_active)}
                                                                            {renderBaysGrouped(asset.auto_transformers, autoTransformers, 'auto', asset.is_active)}
                                                                            {renderBaysGrouped(asset.incoming_branches, incomingBranches, 'branch', asset.is_active)}
                                                                            {!asset.load_transformers?.length && !asset.auto_transformers?.length && !asset.incoming_branches?.length && (
                                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0 4px' }}>No bays connected</div>
                                                                            )}
                                                                        </div>
                                                                        {asset.notes && (
                                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                "{asset.notes}"
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : activeTab === 'branch' ? (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                        <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                                                                            {asset.to_substation} {asset.ckt_id}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                                                            Breaker {asset.breaker_number || '---'}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                                                                                T{asset.transformer_no}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.75rem', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-cyan)', padding: '4px 8px', borderRadius: '4px' }}>
                                                                                {asset.hv_voltage}/{asset.lv_voltage}kV
                                                                            </span>
                                                                            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 159, 67, 0.1)', color: '#ff9f43', padding: '4px 8px', borderRadius: '4px' }}>
                                                                                {asset.capacity_mva} MVA
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px', alignItems: 'center' }}>
                                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Breakers</span>
                                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                                                {asset.hv_breaker_number || '---'} / {asset.lv_breaker_number || '---'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleAssetDelete(activeTab, asset.id); }}
                                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'all 0.2s' }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'; }}
                                                                    aria-label="Delete Asset"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}

                                                {(activeTab === 'lsr' ? loadSheddingRelays : activeTab === 'load' ? loadTransformers : activeTab === 'auto' ? autoTransformers : incomingBranches).length === 0 && (
                                                    <div style={{ gridColumn: '1 / -1', padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                                        <Database size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: '1rem' }} />
                                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>No assets found</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Click 'Add Asset' to create one.</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default SubstationForm;
