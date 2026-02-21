import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, CheckCircle2, Edit3, ShieldAlert } from 'lucide-react';
import axios from 'axios';

import api from '../api';

const BayIdEditor = ({ substation, onClose, onSuccess }) => {
    const [transformers, setTransformers] = useState([]);
    const [bays, setBays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [edits, setEdits] = useState({}); // { `type-id`: new_bay_id }
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState(null);

    // Fetch latest data on mount to ensure we edit fresh state
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`/substations/${substation.substation_id}/`);
                setTransformers(res.data.transformers || []);
                setBays(res.data.incoming_bays || []);
            } catch (err) {
                setError("Failed to load latest configuration.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [substation]);

    const handleEdit = (type, id, value) => {
        setEdits(prev => ({
            ...prev,
            [`${type}-${id}`]: value
        }));
    };

    const getEditedValue = (type, item) => {
        const key = `${type}-${item.id}`;
        return edits[key] !== undefined ? edits[key] : item.bay_id;
    };

    const hasChanges = Object.keys(edits).length > 0;

    const prepareUpdates = () => {
        const updates = [];
        Object.entries(edits).forEach(([key, value]) => {
            const [type, id] = key.split('-');
            const originalItem = type === 'transformer'
                ? transformers.find(t => t.id.toString() === id)
                : bays.find(b => b.id.toString() === id);

            // Only add if value actually changed
            if (originalItem && originalItem.bay_id !== value) {
                updates.push({
                    type: type, // 'transformer' or 'bay' matches backend expectation
                    id: parseInt(id),
                    bay_id: value,
                    original: originalItem.bay_id,
                    name: originalItem.bay_name
                });
            }
        });
        return updates;
    };

    const pendingUpdates = prepareUpdates();

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await api.post(`/substations/${substation.substation_id}/update_bay_ids/`, {
                updates: pendingUpdates.map(u => ({ type: u.type, id: u.id, bay_id: u.bay_id }))
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update Bay IDs.");
            setSaving(false);
            setShowConfirm(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 1200,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card"
                style={{
                    width: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                    background: '#121212', border: '1px solid #333', padding: 0
                }}
            >
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Edit3 size={20} color="var(--accent-cyan)" />
                            Manage Bay IDs
                        </h2>
                        <p style={{ margin: '5px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                            Manually override Bay IDs for {substation.name}.
                            <span style={{ color: '#f56565', marginLeft: '5px' }}>Use with caution.</span>
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Loading assets...</div>
                    ) : (
                        <>
                            {error && (
                                <div style={{ background: 'rgba(245, 101, 101, 0.1)', border: '1px solid #f56565', color: '#f56565', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                                    {error}
                                </div>
                            )}

                            {/* Transformers Table */}
                            <h4 style={{ color: '#fff', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Transformers</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                                <thead>
                                    <tr style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem' }}>Name</th>
                                        <th style={{ padding: '0.75rem' }}>Current Bay ID</th>
                                        <th style={{ padding: '0.75rem' }}>New Bay ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transformers.map(t => (
                                        <tr key={`t-${t.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem', color: '#fff' }}>{t.bay_name}</td>
                                            <td style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{t.bay_id}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <input
                                                    type="text"
                                                    value={getEditedValue('transformer', t)}
                                                    onChange={(e) => handleEdit('transformer', t.id, e.target.value)}
                                                    className="input-field"
                                                    style={{ width: '200px', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {transformers.length === 0 && <tr><td colSpan="3" style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No transformers found</td></tr>}
                                </tbody>
                            </table>

                            {/* Incoming Bays Table */}
                            <h4 style={{ color: '#fff', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Incoming Bays</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem' }}>Name</th>
                                        <th style={{ padding: '0.75rem' }}>Current Bay ID</th>
                                        <th style={{ padding: '0.75rem' }}>New Bay ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bays.map(b => (
                                        <tr key={`b-${b.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem', color: '#fff' }}>{b.bay_name}</td>
                                            <td style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{b.bay_id}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <input
                                                    type="text"
                                                    value={getEditedValue('bay', b)}
                                                    onChange={(e) => handleEdit('bay', b.id, e.target.value)}
                                                    className="input-field"
                                                    style={{ width: '200px', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {bays.length === 0 && <tr><td colSpan="3" style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No incoming bays found</td></tr>}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: '#1a1a1a' }}>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button
                        onClick={() => pendingUpdates.length > 0 && setShowConfirm(true)}
                        className="btn-primary"
                        disabled={pendingUpdates.length === 0}
                        style={{ opacity: pendingUpdates.length === 0 ? 0.5 : 1 }}
                    >
                        <Save size={18} style={{ marginRight: '8px' }} />
                        Review & Save ({pendingUpdates.length})
                    </button>
                </div>

                {/* Confirmation Dialog Overlay */}
                <AnimatePresence>
                    {showConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.9)', zIndex: 1300,
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}
                        >
                            <div className="glass-card" style={{ width: '500px', background: '#2d1a1a', border: '1px solid #f56565', padding: '2rem' }}>
                                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                    <ShieldAlert size={48} color="#f56565" style={{ marginBottom: '1rem' }} />
                                    <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem', color: '#fff' }}>Confirm Bay ID Changes</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                                        You are about to manually override Bay IDs. This may affect system integration.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                                    {pendingUpdates.map((u, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
                                            <span style={{ color: '#fff' }}>{u.name}</span>
                                            <span style={{ fontFamily: 'monospace' }}>
                                                <span style={{ color: '#f56565' }}>{u.original}</span>
                                                <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px' }}>→</span>
                                                <span style={{ color: '#48bb78' }}>{u.bay_id}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        style={{ flex: 1, padding: '0.75rem', background: '#f56565', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        {saving ? 'Saving...' : 'Yes, Update IDs'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default BayIdEditor;
