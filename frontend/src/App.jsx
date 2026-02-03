import React, { useState, useEffect } from 'react';
import { Upload, Plus, Edit2, MapPin, FileText, CheckCircle, AlertCircle, Search, Loader2, X, Cpu, Zap, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SubstationForm from './components/SubstationForm';

import ConfigurationEditor from './components/ConfigurationEditor';

// API Service
const api = axios.create({ baseURL: '/api/v1' });

const App = () => {
    const [substations, setSubstations] = useState([]);
    const [view, setView] = useState('list'); // list, create, edit
    const [selectedSub, setSelectedSub] = useState(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState(null);

    // Fetch Substations
    const fetchSubstations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/substations/');
            setSubstations(res.data);
        } catch (err) {
            console.error("Failed to fetch", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSubstations();
    }, []);

    const handleSave = async (data) => {
        console.log("App handleSave received data:", JSON.stringify(data, null, 2));
        setLoading(true);
        try {
            if (selectedSub) {
                console.log(`PATCH to /substations/${selectedSub.substation_id}/`);
                await api.patch(`/substations/${selectedSub.substation_id}/`, data);
                setStatus({ type: 'success', msg: 'Substation asset updated successfully' });
            } else {
                await api.post('/substations/', data);
                setStatus({ type: 'success', msg: 'New substation asset committed' });
            }
            setView('list');
            setSelectedSub(null);
            fetchSubstations();
        } catch (err) {
            console.error("Save error:", err);
            console.error("Error response:", err.response?.data);
            setStatus({ type: 'error', msg: err.response?.data?.error || 'Operation failed' });
        }
        setLoading(false);
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/substations/upload_bulk/', formData);
            const { summary, logs, created, errors } = res.data;
            let statusType = 'success';
            let message = summary;

            if (created === 0 && (res.data.duplicates_skipped > 0 || res.data.invalid_grid_skipped > 0 || errors.length > 0)) {
                statusType = 'error';
                message = `Sync Failed: 0 records added. (${summary})`;
            } else if (errors.length > 0 || res.data.duplicates_skipped > 0) {
                message = `${summary} (Check console for skips/errors)`;
            }

            setStatus({ type: statusType, msg: message });
            console.log("Sync Logs:", logs);
            if (errors.length > 0) console.error("Sync Errors:", errors);
            fetchSubstations();
        } catch (err) {
            console.error("Bulk upload err:", err);
            setStatus({ type: 'error', msg: err.response?.data?.error || 'Bulk sync failed.' });
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleSLDUpload = async (subId, file) => {
        setLoading(true);
        const formData = new FormData();
        formData.append('sld_file', file);
        try {
            await api.post(`/substations/${subId}/upload_sld/`, formData);
            setStatus({ type: 'success', msg: 'SLD file standards applied and stored' });
            fetchSubstations();
        } catch (err) {
            setStatus({ type: 'error', msg: 'SLD rejection: File must be PDF, Image, DXF, or SVG' });
        }
        setLoading(false);
    };

    const handleProcessSLD = async (substationId) => {
        setLoading(true);
        setStatus({ type: 'info', msg: `Analyzing SLD for ${substationId}...` });
        try {
            const res = await api.post(`/substations/${substationId}/process_sld/`);
            setSubstations(prev => prev.map(s => s.substation_id === substationId ? res.data : s));
            setStatus({ type: 'success', msg: `SLD Intelligence extracted for ${substationId}` });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', msg: err.response?.data?.error || "SLD Analysis failed" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            {status && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        position: 'fixed', top: '2rem', right: '2rem', zIndex: 1000,
                        background: status.type === 'success' ? 'var(--accent-cyan)' : '#f56565',
                        color: '#000', padding: '1rem 2rem', borderRadius: '0.5rem',
                        display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}
                >
                    {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    {status.msg}
                    <X size={16} style={{ marginLeft: '1rem', cursor: 'pointer' }} onClick={() => setStatus(null)} />
                </motion.div>
            )}

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>GridDefense <span style={{ color: 'var(--accent-blue)' }}>Ops</span></h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Substation Asset Management & Protection Sync</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {view === 'list' ? (
                        <button className="btn-primary" onClick={() => { setSelectedSub(null); setView('create'); }}>
                            <Plus size={18} style={{ marginRight: '8px' }} />
                            Manual Entry
                        </button>
                    ) : (
                        <button className="btn-secondary" onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem 1.5rem' }}>
                            View List
                        </button>
                    )}
                </div>
            </header>

            {view === 'list' && (
                <>
                    <section className="glass-card" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Search size={20} color="var(--text-secondary)" />
                            <input
                                className="input-field"
                                placeholder="Search substations by name, mnemonic, or ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </section>

                    <div className="substation-grid">
                        <AnimatePresence>
                            {substations
                                .filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.mnemonic.toLowerCase().includes(search.toLowerCase()))
                                .map(sub => (
                                    <SubstationCard
                                        key={sub.substation_id}
                                        substation={sub}
                                        onEdit={() => { setSelectedSub(sub); setView('edit'); }}
                                        onConfigEdit={() => { setSelectedSub(sub); setView('config'); }}
                                        onSLDUpload={handleSLDUpload}
                                        onProcess={handleProcessSLD}
                                        processing={loading}
                                    />
                                ))}
                        </AnimatePresence>
                    </div>

                    <section className="glass-card" style={{ marginTop: '3rem', textAlign: 'center', borderStyle: 'dashed', borderColor: 'rgba(0, 229, 255, 0.3)' }}>
                        <Upload size={48} color="var(--accent-blue)" style={{ marginBottom: '1rem' }} />
                        <h3>Bulk Sync Terminal</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Upload .xlsx or .csv provided by system operators</p>
                        <input type="file" id="bulk-upload" hidden onChange={handleBulkUpload} accept=".xlsx,.xls,.csv" />
                        <label htmlFor="bulk-upload" className="btn-primary" style={{ display: 'inline-block' }}>
                            {loading ? <Loader2 className="animate-spin" /> : "Select Grid Asset File"}
                        </label>
                    </section>
                </>
            )}

            {view === 'create' || view === 'edit' ? (
                <SubstationForm
                    substation={selectedSub}
                    onSave={handleSave}
                    onCancel={() => setView('list')}
                />
            ) : null}

            {view === 'config' && (
                <ConfigurationEditor
                    substation={selectedSub}
                    onSave={handleSave}
                    onCancel={() => setView('list')}
                />
            )}
        </div>
    );
};

const SubstationCard = ({ substation, onEdit, onConfigEdit, onSLDUpload, onProcess, processing }) => {
    const [showConfig, setShowConfig] = useState(false);
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) onSLDUpload(substation.substation_id, file);
    };

    const hasConfig = (substation.transformers?.length > 0 || substation.incoming_bays?.length > 0);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`glass-card ${showConfig ? 'expanded' : ''}`}
            whileHover={{ borderColor: 'var(--accent-blue)', boxShadow: '0 0 30px rgba(0, 229, 255, 0.1)' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="mono" style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>{substation.substation_id}</h4>
                        {hasConfig && <Zap size={10} color="var(--accent-cyan)" fill="var(--accent-cyan)" />}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', margin: '4px 0' }}>{substation.name}</h3>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {substation.sld_file && (
                        <Cpu
                            size={18}
                            color={hasConfig ? 'var(--accent-cyan)' : 'var(--text-secondary)'}
                            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                            onClick={() => onProcess(substation.substation_id)}
                            className={processing ? 'animate-pulse' : ''}
                        />
                    )}
                    <Edit2 size={16} color="var(--text-secondary)" style={{ cursor: 'pointer' }} onClick={onEdit} />
                </div>
            </div>

            <div style={{ fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Region: <span style={{ color: 'var(--accent-cyan)' }}>{substation.region || 'Pending'}</span></div>
                <div style={{ color: 'var(--text-secondary)' }}>Grid: <span style={{ color: 'white' }}>{substation.grid || 'N/A'}</span></div>
                <div style={{ color: 'var(--text-secondary)' }}>Voltage: <span style={{ color: 'white' }}>{substation.voltage} kV</span></div>
                <div style={{ color: 'var(--text-secondary)' }}>Owner: <span style={{ color: 'white' }}>{substation.ownership}</span></div>

                <div style={{ color: 'var(--text-secondary)', gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} />
                    <span style={{ color: substation.state ? 'white' : 'var(--text-secondary)' }}>
                        {substation.state ? `${substation.state} ` : ''}
                        ({substation.latitude ? `${parseFloat(substation.latitude).toFixed(4)}, ${parseFloat(substation.longitude).toFixed(4)}` : 'No Coordinates'})
                    </span>
                </div>

                <div style={{ color: 'var(--text-secondary)', gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={14} />
                    <span style={{ color: substation.sld_file ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {substation.sld}
                    </span>
                </div>
            </div>

            {hasConfig ? (
                <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                    <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setShowConfig(!showConfig)}
                    >
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Activity size={12} /> CONFIGURATION DATA
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Edit2 size={12} color="var(--text-secondary)" onClick={(e) => { e.stopPropagation(); onConfigEdit(); }} />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{showConfig ? 'Hide' : 'Show Details'}</span>
                        </div>
                    </div>

                    {showConfig && (
                        <div style={{ marginTop: '10px', fontSize: '0.8rem' }}>
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ color: 'var(--accent-blue)', fontSize: '0.7rem', marginBottom: '4px' }}>TRANSFORMERS</div>
                                    {substation.transformers.map(t => (
                                        <div key={t.id} style={{ borderLeft: '2px solid rgba(0,229,255,0.3)', paddingLeft: '8px', marginBottom: '4px' }}>
                                            <div style={{ fontWeight: '500' }}>{t.bay_name} ({t.capacity_mva}MVA)</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                                                HV: {t.hv_breaker_number}, LV: {t.lv_breaker_number}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            <div>
                                <div style={{ color: 'var(--accent-blue)', fontSize: '0.7rem', marginBottom: '4px' }}>LINE BAYS</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {substation.incoming_bays.map(b => (
                                        <div key={b.id} style={{ background: 'rgba(0,229,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                            {b.bay_id}: {b.breaker_number}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <button className="btn-secondary" onClick={onConfigEdit} style={{ fontSize: '0.7rem', width: '100%' }}>
                        <Plus size={12} style={{ marginRight: '4px' }} /> Add Configuration Manually
                    </button>
                </div>
            )}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <input type="file" id={`sld-${substation.substation_id}`} hidden onChange={handleFileChange} accept=".pdf,.dxf,.svg,image/*" />
                    <label htmlFor={`sld-${substation.substation_id}`} style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Upload size={12} /> {substation.sld_file ? 'Update SLD' : 'Upload SLD'}
                    </label>
                </div>
                {substation.sld_file && !hasConfig && (
                    <span
                        onClick={() => onProcess(substation.substation_id)}
                        style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {processing ? <Loader2 size={12} className="animate-spin" /> : <><Cpu size={12} /> Run Intelligence</>}
                    </span>
                )}
            </div>
        </motion.div>
    );
};

export default App;
