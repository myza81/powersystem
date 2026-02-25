import React, { useState, useEffect } from 'react';
import { X, Save, MapPin, AlertTriangle, Edit2, Upload, Plus, RefreshCw, Database, Zap, GitBranch, Trash2, CheckCircle2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

const SubstationForm = ({ substation, onSave, onCancel, onSLDUpload }) => {
    const [formData, setFormData] = useState(substation || {
        mnemonic: '',
        name: '',
        ownership: 'TNB',
        voltage: '',
        grid: '',
        latitude: '',
        longitude: ''
    });
    const [activeTab, setActiveTab] = useState('metadata');
    const [loadTransformers, setLoadTransformers] = useState([]);
    const [autoTransformers, setAutoTransformers] = useState([]);
    const [incomingBranches, setIncomingBranches] = useState([]);
    const [substationOptions, setSubstationOptions] = useState([]);
    const [assetLoading, setAssetLoading] = useState(false);
    const [assetStatus, setAssetStatus] = useState(null);

    // Modal Control State
    const [editingAsset, setEditingAsset] = useState(null); // { type: 'load'|'auto'|'branch', data: item|null }

    // Form States for Modal
    const [assetForm, setAssetForm] = useState({});

    const GRIDS = ['KEDP', 'PPNG', 'PERK', 'SELG', 'KLUM', 'NSEM', 'MLKA', 'JOH2', 'JOH1', 'PHNG', 'TERG', 'KELN'];
    const VOLTAGES = [500, 275, 132];
    const LOAD_LV = [33, 22, 11];
    const AUTO_LV = [275, 132];

    const handleChange = (e) => {
        const value = e.target.name === 'voltage' ? parseInt(e.target.value) : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const canManageAssets = Boolean(substation?.substation_id);

    const fetchAssets = async () => {
        if (!substation?.substation_id) return;
        setAssetLoading(true);
        try {
            const [loadsRes, autosRes, branchesRes] = await Promise.all([
                api.get(`/load-transformers/?substation=${substation.substation_id}`),
                api.get(`/auto-transformers/?substation=${substation.substation_id}`),
                api.get(`/incoming-branches/?substation=${substation.substation_id}`),
            ]);
            setLoadTransformers(loadsRes.data || []);
            setAutoTransformers(autosRes.data || []);
            setIncomingBranches(branchesRes.data || []);
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
    };

    const handleAssetSave = async (type) => {
        if (!substation?.substation_id) return;
        setAssetLoading(true);
        try {
            const endpointMap = {
                load: 'load-transformers',
                auto: 'auto-transformers',
                branch: 'incoming-branches'
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
                branch: 'incoming-branches'
            };
            await api.delete(`/${endpointMap[type]}/${id}/`);
            await fetchAssets();
            setAssetStatus({ type: 'success', msg: 'Asset deleted.' });
        } catch (err) {
            setAssetStatus({ type: 'error', msg: 'Failed to delete asset.' });
        }
        setAssetLoading(false);
    };

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

    const AssetModal = ({ type, data, onClose, onSave }) => {
        const isBranch = type === 'branch';
        const title = data?.id ? 'Edit' : 'Add';
        const typeLabel = type === 'load' ? 'Load Transformer' : type === 'auto' ? 'Auto Transformer' : 'Incoming Branch';

        return (
            <AnimatePresence>
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(10, 12, 16, 0.6)', zIndex: 2000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    backdropFilter: 'blur(8px)'
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-card"
                        style={{
                            width: '460px', padding: '2rem',
                            display: 'flex', flexDirection: 'column', gap: '1.5rem'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                                    {title} {typeLabel}
                                </h3>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {substation?.name}
                                </div>
                            </div>
                            <button onClick={onClose} style={{
                                background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)',
                                cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'all 0.2s'
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                <X size={18} />
                            </button>
                        </div>

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
                                        <input className="input-field mono" value={assetForm.breaker_number || ''} onChange={(e) => setAssetForm(f => ({ ...f, breaker_number: e.target.value }))} placeholder="Auto-generated if empty" />
                                    </div>
                                    <div>
                                        <label style={inputLabelStyle}>Commissioning Date <span style={{ color: 'var(--text-secondary)', fontSize: '0.6rem' }}>(Optional)</span></label>
                                        <input className="input-field mono" type="date" value={assetForm.commissioning_date || ''} onChange={(e) => setAssetForm(f => ({ ...f, commissioning_date: e.target.value }))} />
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
            </AnimatePresence>
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
                                                    <select name="voltage" className="input-field" value={formData.voltage} onChange={handleChange} required>
                                                        <option value="">-- Select --</option>
                                                        {VOLTAGES.map(v => <option key={v} value={v}>{v} kV</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={inputLabelStyle}>Grid Unit</label>
                                                    <select name="grid" className="input-field" value={formData.grid} onChange={handleChange} required>
                                                        <option value="">-- Select --</option>
                                                        {GRIDS.map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label style={inputLabelStyle}>Ownership</label>
                                                    <select name="ownership" className="input-field" value={formData.ownership} onChange={handleChange}>
                                                        <option value="TNB">TNB</option>
                                                        <option value="DC">Data Centre (DC)</option>
                                                        <option value="LSS">Large Scale Solar (LSS)</option>
                                                        <option value="IPP">Independent Power Producer (IPP)</option>
                                                        <option value="LPC">Large Power Consumer (LPC)</option>
                                                    </select>
                                                </div>

                                                <div style={{ gridColumn: 'span 3' }}>
                                                    <label style={inputLabelStyle}>Latitude</label>
                                                    <input name="latitude" type="number" step="any" className="input-field mono" value={formData.latitude} onChange={handleChange} placeholder="e.g. 3.1390" />
                                                </div>
                                                <div style={{ gridColumn: 'span 3' }}>
                                                    <label style={inputLabelStyle}>Longitude</label>
                                                    <input name="longitude" type="number" step="any" className="input-field mono" value={formData.longitude} onChange={handleChange} placeholder="e.g. 101.6869" />
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
                                                <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Save size={18} /> {substation?.substation_id ? 'Save Changes' : 'Create Substation'}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>
                                                        {activeTab === 'load' ? 'Load Transformers' : activeTab === 'auto' ? 'Auto Transformers' : 'Incoming Branches'}
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
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                                gap: '1rem',
                                                paddingBottom: '1rem'
                                            }}>
                                                {(activeTab === 'load' ? loadTransformers : activeTab === 'auto' ? autoTransformers : incomingBranches).map((asset) => (
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
                                                                {activeTab === 'branch' ? (
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

                                                {(activeTab === 'load' ? loadTransformers : activeTab === 'auto' ? autoTransformers : incomingBranches).length === 0 && (
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
