import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Trash2, FileText, Calendar, Database, Check, AlertCircle,
    Loader2, Plus, Power, Activity, Server, Zap, Search, X, ChevronRight,
    ArrowUpRight
} from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

import ImportSummaryView from './ImportSummaryView';

// --- Components ---

const StatusBadge = ({ active }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        background: active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
        color: active ? '#34d399' : '#94a3b8',
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        border: active ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(148, 163, 184, 0.1)',
        boxShadow: active ? '0 0 10px rgba(16, 185, 129, 0.1)' : 'none'
    }}>
        {active ? <Activity size={12} /> : <Server size={12} />}
        {active ? 'ACTIVE MODEL' : 'ARCHIVED'}
    </div>
);

const StatCard = ({ icon: Icon, label, value, subLabel, color }) => (
    <motion.div
        whileHover={{ y: -2 }}
        style={{
            background: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            position: 'relative',
            overflow: 'hidden'
        }}
    >
        <div style={{
            position: 'absolute', top: 0, right: 0, p: 20,
            opacity: 0.05, transform: 'translate(20%, -20%) scale(3)'
        }}>
            <Icon size={100} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
                padding: '8px', borderRadius: '10px',
                background: `${color}20`, color: color
            }}>
                <Icon size={20} />
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>{label}</span>
        </div>

        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
            {value}
        </div>
        {subLabel && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{subLabel}</div>}
    </motion.div>
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
    const [showSummary, setShowSummary] = useState(false);
    const [summaryData, setSummaryData] = useState(null);

    // Fetch Snapshots
    const fetchSnapshots = async () => {
        setLoading(true);
        try {
            const res = await api.get('/snapshots/');
            const sorted = res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setSnapshots(sorted);
            const active = sorted.find(s => s.is_active);
            setActiveSnapshot(active);
        } catch (err) {
            console.error("Failed to fetch snapshots", err);
            setStatus({ type: 'error', msg: 'Failed to load snapshots' });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSnapshots();
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
                setShowSummary(true);
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
                setShowSummary(true);
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
            <div style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                fontSize: '2.15rem', fontWeight: 800, margin: '0 0 0.5rem 0',
                                background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                letterSpacing: '-0.03em'
                            }}
                        >
                            Model Registry
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '600px', lineHeight: 1.5 }}
                        >
                            Manage and version control your PSS/E network models. <br />
                            Active models drive the topology analysis and load flow engines.
                        </motion.p>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowUpload(true)}
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                            border: 'none', borderRadius: '12px',
                            padding: '12px 24px', color: '#fff',
                            fontWeight: 600, fontSize: '0.95rem',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
                            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Plus size={20} />
                        New Snapshot
                    </motion.button>
                </div>

                {/* KPI Cards */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.5rem', marginTop: '2rem'
                }}>
                    <StatCard
                        icon={Database}
                        label="Total Snapshots"
                        value={totalSnapshots}
                        color="#3b82f6"
                    />
                    <StatCard
                        icon={Activity}
                        label="Active Model"
                        value={activeSnapshot ? activeSnapshot.name : 'None'}
                        subLabel={activeSnapshot ? `ID: ${activeSnapshot.id.substring(0, 8)}` : 'Select a model'}
                        color="#10b981"
                    />
                    <StatCard
                        icon={Calendar}
                        label="Latest Update"
                        value={lastUpdate}
                        color="#8b5cf6"
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
                                <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>Import .raw File</h2>
                                <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>Snapshot Name</label>
                                    <input
                                        autoFocus
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Q1 2026 Forecast"
                                        style={{
                                            width: '100%', background: '#0f172a', border: '1px solid #334155',
                                            padding: '12px', borderRadius: '12px', color: '#fff', fontSize: '1rem',
                                            outline: 'none', transition: 'border-color 0.2s'
                                        }}
                                        required
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Optional notes about this case..."
                                        rows={3}
                                        style={{
                                            width: '100%', background: '#0f172a', border: '1px solid #334155',
                                            padding: '12px', borderRadius: '12px', color: '#fff', fontSize: '0.9rem',
                                            outline: 'none', resize: 'none', fontFamily: 'inherit'
                                        }}
                                    />
                                </div>

                                <div
                                    onClick={() => document.getElementById('raw-upload').click()}
                                    style={{
                                        border: '2px dashed #334155', borderRadius: '16px', padding: '2rem',
                                        textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                        background: file ? 'rgba(6, 182, 212, 0.05)' : 'transparent',
                                        borderColor: file ? '#06b6d4' : '#334155'
                                    }}
                                >
                                    <input type="file" id="raw-upload" hidden accept=".raw" onChange={e => setFile(e.target.files[0])} />
                                    <Upload size={32} style={{ color: file ? '#06b6d4' : '#64748b', marginBottom: '0.75rem' }} />
                                    <div style={{ color: '#e2e8f0', fontWeight: 500 }}>
                                        {file ? file.name : "Click to select .raw file"}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "or drag and drop here"}
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={uploading}
                                    type="submit"
                                    style={{
                                        marginTop: '0.5rem',
                                        background: uploading ? '#334155' : 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
                                        color: uploading ? '#94a3b8' : '#000',
                                        border: 'none', padding: '14px', borderRadius: '12px',
                                        fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    {uploading && <Loader2 className="animate-spin" size={20} />}
                                    {uploading ? 'Processing...' : 'Import Schematic'}
                                </motion.button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List Section */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.4)', borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Available Models</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            placeholder="Filter snapshots..."
                            style={{
                                background: '#0f172a', border: '1px solid #334155', borderRadius: '8px',
                                padding: '8px 12px 8px 36px', color: '#fff', fontSize: '0.8rem', width: '250px'
                            }}
                        />
                    </div>
                </div>

                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
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
                            <motion.div
                                key={snap.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(300px, 2fr) 1fr 1fr auto',
                                    gap: '1rem',
                                    padding: '1.25rem 2rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    alignItems: 'center',
                                    transition: 'background 0.2s',
                                    cursor: 'pointer'
                                }}
                                className="snapshot-row"
                                onClick={() => handleActivate(snap.id)}
                            >
                                {/* Column 1: Info */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: snap.is_active ? '#fff' : '#cbd5e1' }}>
                                            {snap.name}
                                        </div>
                                        <StatusBadge active={snap.is_active} />
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                                        {snap.id}
                                    </div>
                                </div>

                                {/* Column 2: Date */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                    <Calendar size={14} />
                                    {new Date(snap.timestamp).toLocaleDateString()}
                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                                        {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* Column 3: Description */}
                                <div style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {snap.description || '-'}
                                </div>

                                {/* Column 4: Actions */}
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    {!snap.is_active && (
                                        <button
                                            onClick={(e) => handleActivate(snap.id, e)}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid #334155',
                                                color: '#34d399',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                            className="action-btn"
                                        >
                                            <Zap size={14} /> Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleDelete(snap.id, e)}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: 'none',
                                            color: '#f87171',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        title="Delete"
                                        className="delete-btn"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
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
                {showSummary && summaryData && (
                    <ImportSummaryView summary={summaryData} />
                )}
            </AnimatePresence>
        </div>
    );
};

export default SnapshotManager;
