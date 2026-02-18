import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Trash2, FileText, Calendar, Database, Check, AlertCircle, Loader2, Plus, Network } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

const SnapshotManager = ({ onAnalyze }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [status, setStatus] = useState(null);

    const fetchSnapshots = async () => {
        setLoading(true);
        try {
            const res = await api.get('/snapshots/');
            setSnapshots(res.data);
        } catch (err) {
            console.error("Failed to fetch snapshots", err);
            setStatus({ type: 'error', msg: 'Failed to load snapshots' });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSnapshots();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !name) {
            setStatus({ type: 'error', msg: 'Please provide a file and a name' });
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('description', description);

        try {
            await api.post('/snapshots/upload/', formData);
            setStatus({ type: 'success', msg: 'Snapshot imported successfully' });
            setFile(null);
            setName('');
            setDescription('');
            setShowUpload(false);
            fetchSnapshots();
        } catch (err) {
            console.error("Upload failed", err);
            setStatus({ type: 'error', msg: err.response?.data?.error || 'Upload failed' });
        }
        setUploading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this snapshot? This will remove all associated network data.")) return;

        try {
            await api.delete(`/snapshots/${id}/`);
            setStatus({ type: 'success', msg: 'Snapshot deleted' });
            fetchSnapshots();
        } catch (err) {
            console.error("Delete failed", err);
            setStatus({ type: 'error', msg: 'Failed to delete snapshot' });
        }
    };

    return (
        <div className="snapshot-manager" style={{ padding: '2rem', color: '#fff' }}>
            {/* Status Toast */}
            {status && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed', top: '2rem', right: '2rem', zIndex: 1000,
                        background: status.type === 'success' ? 'var(--accent-cyan)' : '#f56565',
                        color: '#000', padding: '1rem 2rem', borderRadius: '0.5rem',
                        display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600
                    }}
                >
                    {status.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                    {status.msg}
                    <button onClick={() => setStatus(null)} style={{ background: 'none', border: 'none', marginLeft: '1rem', cursor: 'pointer' }}>×</button>
                </motion.div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, background: 'linear-gradient(90deg, #fff, #a5f3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Network Snapshots
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Manage PSS/E .raw network cases and historical data.
                    </p>
                </div>
                <button
                    onClick={() => setShowUpload(!showUpload)}
                    style={{
                        background: 'var(--accent-gradient)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        color: '#000',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)'
                    }}
                >
                    {showUpload ? 'Cancel Upload' : (
                        <>
                            <Upload size={18} /> Import .raw File
                        </>
                    )}
                </button>
            </div>

            <AnimatePresence>
                {showUpload && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ marginBottom: '2rem', overflow: 'hidden' }}
                    >
                        <form onSubmit={handleUpload} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Import New Snapshot</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Snapshot Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Feb 2026 Forecast"
                                        style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Description (Optional)</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Brief notes about this case..."
                                        style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>PSS/E .raw File</label>
                                <div
                                    style={{
                                        border: '2px dashed rgba(255,255,255,0.2)',
                                        borderRadius: '12px',
                                        padding: '2rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: file ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                                        borderColor: file ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)'
                                    }}
                                    onClick={() => document.getElementById('raw-upload').click()}
                                >
                                    <input
                                        type="file"
                                        id="raw-upload"
                                        hidden
                                        accept=".raw"
                                        onChange={(e) => setFile(e.target.files[0])}
                                    />
                                    <Upload size={32} style={{ color: file ? 'var(--accent-cyan)' : 'var(--text-secondary)', marginBottom: '1rem' }} />
                                    {file ? (
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{file.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--text-secondary)' }}>
                                            Click to select or drag and drop .raw file here
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploading}
                                style={{
                                    alignSelf: 'flex-end',
                                    background: uploading ? 'rgba(255,255,255,0.1)' : 'var(--accent-cyan)',
                                    color: uploading ? 'rgba(255,255,255,0.5)' : '#000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px 32px',
                                    fontWeight: 700,
                                    cursor: uploading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {uploading ? <Loader2 className="spin" size={20} /> : <Check size={20} />}
                                {uploading ? 'Importing...' : 'Start Import'}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                            <th style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Name</th>
                            <th style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Timestamp</th>
                            <th style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                        <Loader2 className="spin" /> Loading snapshots...
                                    </div>
                                </td>
                            </tr>
                        ) : snapshots.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No snapshots found. Import a .raw file to get started.
                                </td>
                            </tr>
                        ) : (
                            snapshots.map(snap => (
                                <motion.tr
                                    key={snap.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                    whileHover={{ background: 'rgba(255,255,255,0.02)' }}
                                >
                                    <td style={{ padding: '1.5rem' }}>
                                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{snap.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'monospace' }}>ID: {snap.id.substring(0, 8)}...</div>
                                    </td>
                                    <td style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={14} />
                                            {new Date(snap.timestamp).toLocaleString()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.5rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                                        {snap.description || '-'}
                                    </td>
                                    <td style={{ padding: '1.5rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button
                                            onClick={() => onAnalyze(snap.id)}
                                            style={{
                                                background: 'rgba(0, 229, 255, 0.1)',
                                                border: '1px solid rgba(0, 229, 255, 0.2)',
                                                color: 'var(--accent-cyan)',
                                                cursor: 'pointer',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                            className="hover:bg-cyan-900/30"
                                        >
                                            <Network size={16} /> Analyze
                                        </button>
                                        <button
                                            onClick={() => handleDelete(snap.id)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#f56565',
                                                cursor: 'pointer',
                                                padding: '8px',
                                                borderRadius: '8px',
                                                transition: 'background 0.2s'
                                            }}
                                            title="Delete Snapshot"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SnapshotManager;
