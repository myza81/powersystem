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
        background: active ? 'rgba(4, 125, 96, 0.1)' : 'rgba(100, 116, 139, 0.1)',
        color: active ? '#047d60' : '#64748b',
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.5px',
        border: `1px solid ${active ? 'rgba(4, 125, 96, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`
    }}>
        {active ? <Activity size={10} /> : <Server size={10} />}
        {active ? 'ACTIVE' : 'ARCHIVED'}
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
            color: '#1e293b',
            fontFamily: "'Poppins', 'IBM Plex Sans', sans-serif"
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
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid rgba(4, 125, 96, 0.1)' }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem' }}>
                            SNAPSHOT REGISTRY
                        </div>
                        <h1 style={{
                            fontSize: '2.6rem', fontWeight: 600, margin: 0,
                            color: '#0f172a', letterSpacing: '-0.03em'
                        }}>
                            Grid Snapshot Manager
                        </h1>
                    </div>

                    <button
                        onClick={() => setShowUpload(true)}
                        style={{
                            background: 'linear-gradient(135deg, #047d60, #059669)',
                            padding: '12px 24px', borderRadius: '10px',
                            fontSize: '0.8rem', height: '44px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer'
                        }}
                    >
                        <Plus size={16} /> New Import
                    </button>
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

            {/* Registry Table */}
            <div style={{ 
                background: '#fff', 
                borderRadius: '12px', 
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                border: '1px solid #e2e8f0'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(300px, 2fr) 180px 1fr 120px',
                    gap: '1rem',
                    padding: '0.85rem 1.25rem',
                    background: 'linear-gradient(135deg, rgba(4, 125, 96, 0.1), rgba(5, 150, 105, 0.05))',
                    borderBottom: '1px solid #e2e8f0',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#047d60',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    fontFamily: "'Poppins', sans-serif"
                }}>
                    <div>Model Reference</div>
                    <div>Timestamp</div>
                    <div>Description</div>
                    <div style={{ textAlign: 'center' }}>Status</div>
                </div>
                    
                <div style={{ maxHeight: 'calc(100vh - 480px)', overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <Loader2 className="animate-spin" size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <div style={{ fontSize: '0.85rem' }}>Loading registry...</div>
                    </div>
                ) : snapshots.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <Database size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <div style={{ fontSize: '0.85rem' }}>No snapshots found.</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Import your first PSS/E case.</div>
                    </div>
                ) : (
                    snapshots.map((snap, i) => (
                        <div
                            key={snap.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(300px, 2fr) 180px 1fr 120px',
                                gap: '1rem',
                                padding: '0.85rem 1.25rem',
                                borderBottom: '1px solid #f1f5f9',
                                alignItems: 'center',
                                background: snap.is_active ? 'rgba(4, 125, 96, 0.04)' : 'transparent',
                                fontSize: '0.8rem',
                                color: '#334155',
                                cursor: !snap.is_active ? 'pointer' : 'default'
                            }}
                            onClick={() => !snap.is_active && handleActivate(snap.id)}
                        >
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                                    <div style={{ fontWeight: 600, color: snap.is_active ? '#047d60' : '#334155' }}>
                                        {snap.name}
                                    </div>
                                    <StatusBadge active={snap.is_active} />
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                    UID: {snap.id}
                                </div>
                            </div>

                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {new Date(snap.timestamp).toLocaleDateString()}
                                <span style={{ marginLeft: '6px', opacity: 0.5 }}>
                                    {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <div style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {snap.description || '--'}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                {!snap.is_active ? (
                                    <button
                                        onClick={(e) => handleActivate(snap.id, e)}
                                        style={{
                                            background: '#047d60',
                                            border: 'none',
                                            color: '#fff',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
fontSize: '0.7rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ACTIVATE
                                    </button>
                                ) : (
                                    <div style={{ color: '#047d60', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Check size={10} /> CURRENT
                                    </div>
                                )}
                                <button
                                    onClick={(e) => handleDelete(snap.id, e)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#94a3b8',
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

            {summaryData && (
                <ImportSummaryView summary={summaryData} />
            )}
        </div>
    );
}

export default SnapshotManager;
