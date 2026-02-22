import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Trash2, FileText, Calendar, Database, Check, AlertCircle,
    Loader2, Plus, Power, Activity, Server, Zap, Search, X, ChevronRight,
    ArrowUpRight
} from 'lucide-react';
import axios from 'axios';

import api from '../api';

import ImportSummaryView from './ImportSummaryView';

// --- Components ---

const StatusBadge = ({ active }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        background: active ? 'rgba(0, 229, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
        color: active ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.3)',
        fontSize: '0.65rem',
        fontWeight: 800,
        letterSpacing: '0.5px',
        border: `1px solid ${active ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`
    }}>
        {active ? <Activity size={10} /> : <Server size={10} />}
        {active ? 'ACTIVE_SYSTEM_MODEL' : 'ARCHIVED_DATASET'}
    </div>
);

const StatCard = ({ icon: Icon, label, value, subLabel, color }) => (
    <div
        style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '4px',
            padding: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            minWidth: '0'
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Icon size={12} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
        </div>
        {subLabel && <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.25)', fontFamily: 'monospace' }}>{subLabel}</div>}
    </div>
);

const SnapshotManager = () => {
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [status, setStatus] = useState(null);
    const [activeSnapshot, setActiveSnapshot] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const SUMMARY_STORAGE_KEY = 'snapshot_summary_cache';

    // Fetch Snapshots
    const fetchSnapshots = async () => {
        setLoading(true);
        try {
            const res = await api.get('/snapshots/');
            const sorted = res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setSnapshots(sorted);
            const active = sorted.find(s => s.is_active);
            setActiveSnapshot(active);
            if (active) {
                try {
                    const cached = JSON.parse(localStorage.getItem(SUMMARY_STORAGE_KEY) || 'null');
                    if (cached && cached.snapshotId === active.id && cached.summary) {
                        setSummaryData(cached.summary);
                    }
                } catch (e) {
                    console.warn('Failed to restore summary cache', e);
                }
            }
        } catch (err) {
            console.error("Failed to fetch snapshots", err);
            setStatus({ type: 'error', msg: 'Failed to load snapshots' });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSnapshots();
    }, []);

    useEffect(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(SUMMARY_STORAGE_KEY) || 'null');
            if (cached?.summary && !summaryData) {
                setSummaryData(cached.summary);
            }
        } catch (e) {
            console.warn('Failed to read summary cache', e);
        }
    }, []);

    // Actions
    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !name) return setStatus({ type: 'error', msg: 'Please provide a file and a name' });

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('description', description);

        try {
            const res = await api.post('/snapshots/upload/', formData);
            setStatus({ type: 'success', msg: 'Snapshot imported successfully' });
            setFile(null);
            setName('');
            setDescription('');
            setShowUpload(false);

            // Show summary
            if (res.data.summary) {
                setSummaryData(res.data.summary);
                if (res.data.snapshot?.id) {
                    localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify({
                        snapshotId: res.data.snapshot.id,
                        summary: res.data.summary,
                    }));
                }
            }

            fetchSnapshots();
        } catch (err) {
            setStatus({ type: 'error', msg: err.response?.data?.error || 'Upload failed' });
        }
        setUploading(false);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this snapshot? This action cannot be undone.")) return;
        try {
            await api.delete(`/snapshots/${id}/`);
            setStatus({ type: 'success', msg: 'Snapshot deleted' });
            fetchSnapshots();
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to delete snapshot' });
        }
    };

    const handleActivate = async (id, e) => {
        e?.stopPropagation();
        try {
            const res = await api.post('/snapshots/activate/', { snapshot_id: id });
            setStatus({ type: 'success', msg: 'Model activated successfully' });

            // Show summary
            if (res.data.summary) {
                setSummaryData(res.data.summary);
                if (res.data.snapshot?.id) {
                    localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify({
                        snapshotId: res.data.snapshot.id,
                        summary: res.data.summary,
                    }));
                }
            }

            fetchSnapshots();
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to activate snapshot' });
        }
    };

    // Derived Stats
    const totalSnapshots = snapshots.length;
    const totalStorage = snapshots.reduce((acc, s) => acc + (s.size_bytes || 0), 0) / (1024 * 1024); // MB approx if available
    const lastUpdate = snapshots[0]?.timestamp ? new Date(snapshots[0].timestamp).toLocaleDateString() : '-';

    return (
        <div style={{
            minHeight: '100%',
            padding: '2rem',
            color: '#f8fafc',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Status Toast */}
            <AnimatePresence>
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            position: 'fixed', top: '24px', right: '24px', zIndex: 1000,
                            background: status.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                            backdropFilter: 'blur(8px)',
                            color: '#fff', padding: '12px 20px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                            fontWeight: 600, fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        {status.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                        {status.msg}
                        <button
                            onClick={() => setStatus(null)}
                            style={{ background: 'none', border: 'none', marginLeft: '8px', cursor: 'pointer', opacity: 0.8, color: 'white' }}
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Section */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                        <h1 style={{
                            fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem 0',
                            color: '#fff', letterSpacing: '-0.02em', textTransform: 'uppercase'
                        }}>
                            Model Registry
                        </h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                            CORE_VERSION_CONTROL / PPS/E_NETWORK_MODELS
                        </p>
                    </div>

                    <button
                        onClick={() => setShowUpload(true)}
                        className="btn-primary"
                        style={{
                            padding: '10px 20px', borderRadius: '4px',
                            fontSize: '0.8rem', height: '40px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                        }}
                    >
                        <Plus size={16} /> NEW_IMPORT
                    </button>
                </div>

                {/* KPI Area */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.75rem', marginTop: '1.5rem'
                }}>
                    <StatCard
                        icon={Database}
                        label="Registry Capacity"
                        value={`${totalSnapshots} Snapshots`}
                        color="var(--accent-blue)"
                    />
                    <StatCard
                        icon={Activity}
                        label="Active Model"
                        value={activeSnapshot ? activeSnapshot.name : 'NULL'}
                        subLabel={activeSnapshot ? `UID: ${activeSnapshot.id.substring(0, 12)}...` : 'NONE_ACTIVE'}
                        color="#10b981"
                    />
                    <StatCard
                        icon={Calendar}
                        label="Last Modification"
                        value={lastUpdate}
                        color="#8b5cf6"
                    />
                    <StatCard
                        icon={Zap}
                        label="System State"
                        value={activeSnapshot ? 'SYNCHRONIZED' : 'IDLE'}
                        subLabel="TOPOLOGY_ENGINE_V1"
                        color="#06b6d4"
                    />
                </div>
            </div>

            {/* Upload Modal (Overlay) */}
            <AnimatePresence>
                {showUpload && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 900,
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onClick={() => setShowUpload(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{
                                width: '100%', maxWidth: '500px',
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '24px',
                                padding: '2rem',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '0.8rem', margin: 0, fontWeight: 800, color: '#fff', letterSpacing: '1px', textTransform: 'uppercase' }}>Initialize_New_Model_Case</h2>
                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>System Model Import Module</div>
                                </div>
                                <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Snapshot Identifier</label>
                                    <input
                                        autoFocus
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Q1_2026_FORECAST"
                                        className="platinum-input mono"
                                        style={{ fontSize: '0.8rem' }}
                                        required
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Model Metadata</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Notes regarding topology constraints or case variance..."
                                        rows={3}
                                        className="platinum-input"
                                        style={{ resize: 'none', fontSize: '0.75rem' }}
                                    />
                                </div>

                                <div
                                    onClick={() => document.getElementById('raw-upload').click()}
                                    style={{
                                        border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1.5rem',
                                        textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                        background: file ? 'rgba(0, 229, 255, 0.05)' : 'rgba(255,255,255,0.01)',
                                        borderColor: file ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)'
                                    }}
                                >
                                    <input type="file" id="raw-upload" hidden accept=".raw" onChange={e => setFile(e.target.files[0])} />
                                    <Upload size={24} style={{ color: file ? 'var(--accent-blue)' : 'rgba(255,255,255,0.2)', marginBottom: '0.5rem' }} />
                                    <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                        {file ? file.name : "MODEL_SOURCE_REQUIRED"}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                                        {file ? `SIZE:${(file.size / 1024 / 1024).toFixed(2)}MB` : "Tap to select PSS/E .raw file"}
                                    </div>
                                </div>

                                <button
                                    disabled={uploading}
                                    type="submit"
                                    className="btn-primary"
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '12px', borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    {uploading && <Loader2 className="animate-spin" size={16} />}
                                    {uploading ? 'SYNCHRONIZING...' : 'START_SYSTEM_IMPORT'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Registry List Section */}
            <div style={{
                background: '#0f1115',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Available_Datasets</h3>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>COUNT:{snapshots.length}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                        <input
                            placeholder="FILTER_REGISTRY..."
                            className="platinum-input"
                            style={{ padding: '6px 10px 6px 30px', fontSize: '0.75rem', width: '220px', background: 'rgba(0,0,0,0.2)' }}
                        />
                    </div>
                </div>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {/* Table Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(300px, 2fr) 180px 1fr 120px',
                        gap: '1rem',
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(0,0,0,0.2)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        color: 'rgba(255,255,255,0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        <div>Identifier / State</div>
                        <div>Synchronization Time</div>
                        <div>Context_Notes</div>
                        <div style={{ textAlign: 'right' }}>Integration</div>
                    </div>
                    {loading ? (
                        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
                            <Loader2 className="animate-spin" size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <div>Loading registry...</div>
                        </div>
                    ) : snapshots.length === 0 ? (
                        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
                            <Database size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                            <div>No snapshots found. Import your first PSS/E case.</div>
                        </div>
                    ) : (
                        snapshots.map((snap, i) => (
                            <div
                                key={snap.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(300px, 2fr) 180px 1fr 120px',
                                    gap: '1rem',
                                    padding: '1rem 1.5rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    alignItems: 'center',
                                    background: snap.is_active ? 'rgba(0, 229, 255, 0.02)' : 'transparent',
                                    borderLeft: snap.is_active ? '2px solid var(--accent-blue)' : '2px solid transparent'
                                }}
                                className="snapshot-row"
                                onClick={() => !snap.is_active && handleActivate(snap.id)}
                            >
                                {/* Column 1: Info */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: snap.is_active ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                                            {snap.name}
                                        </div>
                                        <StatusBadge active={snap.is_active} />
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                                        UID:{snap.id}
                                    </div>
                                </div>

                                {/* Column 2: Date */}
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                    {new Date(snap.timestamp).toLocaleDateString()}
                                    <span style={{ marginLeft: '8px', opacity: 0.5 }}>
                                        {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* Column 3: Description */}
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {snap.description || '--'}
                                </div>

                                {/* Column 4: Actions */}
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    {!snap.is_active ? (
                                        <button
                                            onClick={(e) => handleActivate(snap.id, e)}
                                            style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ACTIVATE
                                        </button>
                                    ) : (
                                        <div style={{ color: 'var(--accent-blue)', fontSize: '0.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Check size={10} /> CURRENT
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => handleDelete(snap.id, e)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'rgba(239, 68, 68, 0.4)',
                                            padding: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
                .snapshot-row:hover {
                    background: rgba(255,255,255,0.03);
                }
                .action-btn:hover {
                    background: rgba(16, 185, 129, 0.1) !important;
                    border-color: #34d399 !important;
                }
                .delete-btn:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #ef4444 !important;
                }
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(6, 182, 212, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
                }
            `}</style>

            <AnimatePresence>
                {summaryData && (
                    <ImportSummaryView summary={summaryData} />
                )}
            </AnimatePresence>
        </div>
    );
};

export default SnapshotManager;
